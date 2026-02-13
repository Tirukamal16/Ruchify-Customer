import React, { useState } from 'react';
import {
  StyleSheet, Text, View, FlatList, Pressable, TextInput, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useCart, type CartItem } from '@/context/CartContext';

function CartItemCard({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <View style={styles.cartItem}>
      <Image source={{ uri: item.menuItem.image }} style={styles.itemImage} contentFit="cover" />
      <View style={styles.itemDetails}>
        <View style={styles.itemNameRow}>
          <View style={[styles.vegBadge, { backgroundColor: item.menuItem.isVeg ? '#22C55E' : '#EF4444' }]}>
            <View style={styles.vegDot} />
          </View>
          <Text style={styles.itemName} numberOfLines={1}>{item.menuItem.name}</Text>
        </View>
        <Text style={styles.itemPrice}>${item.menuItem.price.toFixed(2)}</Text>
        <View style={styles.quantityRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateQuantity(item.menuItem.id, item.quantity - 1);
            }}
            style={styles.qtyBtn}
          >
            <Ionicons name="remove" size={16} color={Colors.primary} />
          </Pressable>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateQuantity(item.menuItem.id, item.quantity + 1);
            }}
            style={styles.qtyBtn}
          >
            <Ionicons name="add" size={16} color={Colors.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={styles.itemTotal}>${(item.menuItem.price * item.quantity).toFixed(2)}</Text>
        </View>
      </View>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          removeItem(item.menuItem.id);
        }}
        style={styles.removeBtn}
      >
        <Ionicons name="close" size={16} color={Colors.textLight} />
      </Pressable>
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const {
    items, restaurantName, subtotal, deliveryFee, discount, tax, total,
    appliedCoupon, applyCoupon, removeCoupon, clearCart, itemCount,
  } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (['FIRST30', 'RUSH20', 'FREEDEL'].includes(code)) {
      applyCoupon(code);
      setCouponInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Coupon', 'Please enter a valid coupon code.');
    }
  };

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, { paddingTop: insets.top + webTopInset }]}>
        <Ionicons name="cart-outline" size={64} color={Colors.textLight} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtext}>Add items from a restaurant to get started</Text>
        <Pressable style={styles.browseButton} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.browseButtonText}>Browse Restaurants</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cart</Text>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); clearCart(); }}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.restaurantBanner}>
        <Ionicons name="restaurant-outline" size={16} color={Colors.primary} />
        <Text style={styles.restaurantBannerText}>{restaurantName}</Text>
      </View>

      <FlatList
        data={items}
        renderItem={({ item }) => <CartItemCard item={item} />}
        keyExtractor={(item) => item.menuItem.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!items.length}
        ListFooterComponent={
          <View>
            <View style={styles.couponSection}>
              {appliedCoupon ? (
                <View style={styles.appliedCoupon}>
                  <Ionicons name="pricetag" size={16} color={Colors.success} />
                  <Text style={styles.appliedCouponText}>{appliedCoupon} applied</Text>
                  <Pressable onPress={() => { removeCoupon(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
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
                    style={[styles.applyButton, !couponInput.trim() && { opacity: 0.5 }]}
                    onPress={handleApplyCoupon}
                    disabled={!couponInput.trim()}
                  >
                    <Text style={styles.applyButtonText}>Apply</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.billSection}>
              <Text style={styles.billTitle}>Bill Details</Text>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Subtotal</Text>
                <Text style={styles.billValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Fee</Text>
                <Text style={[styles.billValue, deliveryFee === 0 && { color: Colors.success }]}>
                  {deliveryFee === 0 ? 'FREE' : `$${deliveryFee.toFixed(2)}`}
                </Text>
              </View>
              {discount > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Discount</Text>
                  <Text style={[styles.billValue, { color: Colors.success }]}>-${discount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Taxes</Text>
                <Text style={styles.billValue}>${tax.toFixed(2)}</Text>
              </View>
              <View style={[styles.billRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        }
      />

      <View style={[styles.checkoutBar, { paddingBottom: Platform.OS === 'web' ? 34 + 84 : Math.max(insets.bottom, 16) + 70 }]}>
        <View style={styles.checkoutInfo}>
          <Text style={styles.checkoutTotal}>${total.toFixed(2)}</Text>
          <Text style={styles.checkoutItems}>{itemCount} item{itemCount > 1 ? 's' : ''}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.checkoutButton, pressed && { opacity: 0.9 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: Colors.text,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  billTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: Colors.text,
    marginBottom: 4,
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
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  totalValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
