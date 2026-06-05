import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable, TextInput, Platform, Alert, ActivityIndicator,
  ScrollView, BackHandler,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useCart, type CartItem } from '@/context/CartContext';
import { useQuote } from '@/hooks/useQuote';
import { BillBreakdown } from '@/components/BillBreakdown';
import AppHeader from '@/components/AppHeader';
import { Toast, useToast } from '@/components/Toast';

function CartItemCard({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem, updateInstructions } = useCart();
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.specialInstructions ?? '');

  return (
    <View style={styles.cartItem}>
      <Image source={{ uri: item.menuItem.image }} style={styles.itemImage} contentFit="cover" cachePolicy="memory-disk" />
      <View style={styles.itemDetails}>
        <View style={styles.itemNameRow}>
          <View style={[styles.vegBadge, { backgroundColor: item.menuItem.isVeg ? '#22C55E' : '#EF4444' }]}>
            <View style={styles.vegDot} />
          </View>
          <Text style={styles.itemName} numberOfLines={1}>{item.menuItem.name}</Text>
        </View>
        <Text style={styles.itemPrice}>₹{item.menuItem.price.toFixed(0)}</Text>
        <View style={styles.quantityRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              updateQuantity(item.menuItem.id, item.quantity - 1);
            }}
            style={styles.qtyBtn}
          >
            <Ionicons name="remove" size={16} color={Colors.primary} />
          </Pressable>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              updateQuantity(item.menuItem.id, item.quantity + 1);
            }}
            style={styles.qtyBtn}
          >
            <Ionicons name="add" size={16} color={Colors.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={styles.itemTotal}>₹{(item.menuItem.price * item.quantity).toFixed(0)}</Text>
        </View>
        {/* Special instructions toggle */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setShowNote((v) => !v);
          }}
          style={styles.noteToggle}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={12} color={Colors.primary} />
          <Text style={styles.noteToggleText}>
            {item.specialInstructions ? 'Edit note' : 'Add cooking note'}
          </Text>
        </Pressable>
        {showNote && (
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={(text) => {
              setNoteText(text);
              updateInstructions(item.menuItem.id, text);
            }}
            placeholder="e.g. No spicy, less oil…"
            placeholderTextColor={Colors.textLight}
            multiline
            maxLength={120}
          />
        )}
        {!!item.specialInstructions && !showNote && (
          <Text style={styles.notePreview} numberOfLines={1}>📝 {item.specialInstructions}</Text>
        )}
      </View>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          removeItem(item.menuItem.id);
        }}
        style={styles.removeBtn}
      >
        <Ionicons name="close" size={16} color={Colors.textLight} />
      </Pressable>
    </View>
  );
}

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FAFAFA' }}>
      <Ionicons name="alert-circle-outline" size={52} color="#DDD" />
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: '#333', marginTop: 16, textAlign: 'center' }}>Couldn't load cart</Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' }}>Tap Retry to reload</Text>
      <Pressable onPress={retry} style={{ marginTop: 24, backgroundColor: '#FF6B35', paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 }}>
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' }}>Retry</Text>
      </Pressable>
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { items, restaurantName, restaurantApiId, couponCode, setCouponCode, clearCart, itemCount, subtotal } = useCart();
  const { quote, isLoading: quoteLoading } = useQuote();
  const { show: showToast, toastProps } = useToast();
  const couponJustApplied = useRef(false);

  // Detect coupon rejection: server returned coupon_code: null after user applied a code
  useEffect(() => {
    if (!couponJustApplied.current || quoteLoading || !quote) return;
    couponJustApplied.current = false;
    if (couponCode && quote.bill.coupon_code === null) {
      showToast('Coupon could not be applied. Please check the code and try again.', 'error');
    }
  }, [quote, quoteLoading]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !restaurantApiId) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.push({ pathname: '/restaurant/[id]', params: { id: restaurantApiId } });
      return true;
    });
    return () => handler.remove();
  }, [restaurantApiId]);

  const [couponInput, setCouponInput] = useState('');
  const [couponPending, setCouponPending] = useState(false);

  const displayTotal = quote?.bill.overall_total ?? subtotal;

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponPending(true);
    setCouponCode(code);
    setCouponInput('');
    couponJustApplied.current = true;
    setTimeout(() => setCouponPending(false), 400);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleRemoveCoupon = () => {
    setCouponCode(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <AppHeader title="Cart" />
        <ScrollView contentContainerStyle={styles.emptyContainer} showsVerticalScrollIndicator={false}>
          <Ionicons name="cart-outline" size={64} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>Add items from a restaurant to get started</Text>
          <Pressable style={styles.browseButton} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.browseButtonText}>Browse Restaurants</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast {...toastProps} />
      <AppHeader
        title="Cart"
        right={
          <Pressable onPress={() => {
            Alert.alert(
              'Clear Cart',
              'Are you sure you want to remove all items?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    clearCart();
                  },
                },
              ],
            );
          }}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        }
      />

      <Pressable
        style={({ pressed }) => [styles.restaurantBanner, pressed && { opacity: 0.75 }]}
        onPress={() => {
          if (restaurantApiId) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push({ pathname: '/restaurant/[id]', params: { id: restaurantApiId } });
          }
        }}
        disabled={!restaurantApiId}
      >
        <Ionicons name="restaurant-outline" size={16} color={Colors.primary} />
        <Text style={styles.restaurantBannerText}>{restaurantName}</Text>
        <View style={{ flex: 1 }} />
        {restaurantApiId ? (
          <>
            <Text style={styles.addMoreText}>Add more</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </>
        ) : null}
      </Pressable>

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item) => <CartItemCard key={item.menuItem.id} item={item} />)}

        <View style={styles.couponSection}>
          {couponCode ? (
            <View style={styles.appliedCoupon}>
              <Ionicons name="pricetag" size={16} color={Colors.success} />
              <Text style={styles.appliedCouponText}>{couponCode} applied</Text>
              <Pressable onPress={handleRemoveCoupon}>
                <Ionicons name="close-circle" size={18} color={Colors.textLight} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.couponInputRow}>
              <TextInput
                style={styles.couponInput}
                placeholder="Enter coupon code"
                placeholderTextColor={Colors.textLight}
                value={couponInput}
                onChangeText={setCouponInput}
                autoCapitalize="characters"
              />
              <Pressable
                style={[styles.applyButton, (!couponInput.trim() || couponPending) && { opacity: 0.5 }]}
                onPress={handleApplyCoupon}
                disabled={!couponInput.trim() || couponPending}
              >
                {couponPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.applyButtonText}>Apply</Text>
                }
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.billSection}>
          <View style={styles.billTitleRow}>
            <Text style={styles.billTitle}>Bill Details</Text>
            {quoteLoading && (
              <ActivityIndicator size="small" color={Colors.primary} />
            )}
          </View>
          {quote?.bill ? (
            <BillBreakdown quoteBill={quote.bill} />
          ) : !quoteLoading ? (
            // Fallback while quote loads for the first time
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>₹{subtotal.toFixed(0)}</Text>
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.checkoutBar, { paddingBottom: Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 16) }]}>
        <View style={styles.checkoutInfo}>
          <Text style={styles.checkoutTotal}>₹{displayTotal % 1 === 0 ? displayTotal : displayTotal.toFixed(2)}</Text>
          <Text style={styles.checkoutItems}>{itemCount} item{itemCount > 1 ? 's' : ''}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.checkoutButton, pressed && { opacity: 0.9 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/checkout');
          }}
        >
          <Text style={styles.checkoutButtonText}>Checkout</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  browseButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  browseButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  clearText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.primary,
  },
  restaurantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.primary + '0D',
    borderRadius: 10,
    marginBottom: 12,
  },
  restaurantBannerText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.primary,
  },
  addMoreText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vegBadge: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  itemName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  itemPrice: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  noteToggleText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.primary,
  },
  noteInput: {
    marginTop: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.text,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  notePreview: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  couponSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  couponInput: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.text,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  applyButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#fff',
  },
  appliedCoupon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.success + '12',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  appliedCouponText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.success,
    flex: 1,
  },
  billSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  billTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  billTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  billValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.text,
  },
  checkoutBar: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  checkoutInfo: {},
  checkoutTotal: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  checkoutItems: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  checkoutButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  checkoutButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
});
