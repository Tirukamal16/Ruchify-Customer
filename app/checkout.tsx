import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrderContext';

const paymentMethods = [
  { id: 'upi', name: 'UPI', icon: 'phone-portrait-outline' },
  { id: 'card', name: 'Credit/Debit Card', icon: 'card-outline' },
  { id: 'cash', name: 'Cash on Delivery', icon: 'cash-outline' },
  { id: 'wallet', name: 'Wallet', icon: 'wallet-outline' },
];

const addressTypes = [
  { id: 'home', name: 'Home', icon: 'home-outline' },
  { id: 'work', name: 'Work', icon: 'briefcase-outline' },
  { id: 'other', name: 'Other', icon: 'location-outline' },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, restaurantName, subtotal, deliveryFee, discount, tax, total, clearCart } = useCart();
  const { placeOrder } = useOrders();
  const [selectedPayment, setSelectedPayment] = useState('cash');
  const [selectedAddressType, setSelectedAddressType] = useState('home');
  const [address, setAddress] = useState('123 Main Street, Downtown');
  const [contactName, setContactName] = useState('John Doe');
  const [phone, setPhone] = useState('+1 234 567 8900');
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handlePlaceOrder = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const order = placeOrder({
      restaurantName: restaurantName || 'Restaurant',
      items,
      subtotal,
      deliveryFee,
      tax,
      discount,
      total,
      address,
      paymentMethod: paymentMethods.find((p) => p.id === selectedPayment)?.name || 'Cash',
    });
    clearCart();
    router.replace({ pathname: '/tracking/[id]', params: { id: order.id } });
  };

  if (items.length === 0) {
    router.back();
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <View style={styles.addressTypes}>
          {addressTypes.map((type) => (
            <Pressable
              key={type.id}
              style={[styles.addressType, selectedAddressType === type.id && styles.addressTypeActive]}
              onPress={() => setSelectedAddressType(type.id)}
            >
              <Ionicons
                name={type.icon as any}
                size={18}
                color={selectedAddressType === type.id ? '#fff' : Colors.textSecondary}
              />
              <Text style={[styles.addressTypeText, selectedAddressType === type.id && styles.addressTypeTextActive]}>
                {type.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholderTextColor={Colors.textLight}
            />
          </View>
          <View style={styles.inputRow}>
            <View style={[styles.inputField, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Contact Name</Text>
              <TextInput
                style={styles.input}
                value={contactName}
                onChangeText={setContactName}
                placeholderTextColor={Colors.textLight}
              />
            </View>
            <View style={[styles.inputField, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.paymentGroup}>
          {paymentMethods.map((method) => (
            <Pressable
              key={method.id}
              style={[styles.paymentOption, selectedPayment === method.id && styles.paymentOptionActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedPayment(method.id);
              }}
            >
              <View style={[styles.paymentIcon, selectedPayment === method.id && styles.paymentIconActive]}>
                <Ionicons
                  name={method.icon as any}
                  size={20}
                  color={selectedPayment === method.id ? Colors.primary : Colors.textSecondary}
                />
              </View>
              <Text style={[styles.paymentName, selectedPayment === method.id && styles.paymentNameActive]}>
                {method.name}
              </Text>
              <View style={[styles.radio, selectedPayment === method.id && styles.radioActive]}>
                {selectedPayment === method.id && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRestaurant}>
            <Ionicons name="restaurant-outline" size={14} color={Colors.primary} />
            <Text style={styles.summaryRestaurantText}>{restaurantName}</Text>
          </View>
          {items.map((item) => (
            <View key={item.menuItem.id} style={styles.summaryItem}>
              <Text style={styles.summaryItemName}>{item.quantity}x {item.menuItem.name}</Text>
              <Text style={styles.summaryItemPrice}>${(item.menuItem.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={[styles.summaryValue, deliveryFee === 0 && { color: Colors.success }]}>
              {deliveryFee === 0 ? 'FREE' : `$${deliveryFee.toFixed(2)}`}
            </Text>
          </View>
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>-${discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxes</Text>
            <Text style={styles.summaryValue}>${tax.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.placeOrderBar, { paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'web' ? 34 : 0) }]}>
        <Pressable
          style={({ pressed }) => [styles.placeOrderButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          onPress={handlePlaceOrder}
        >
          <Text style={styles.placeOrderText}>Place Order - ${total.toFixed(2)}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    color: Colors.text,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  addressTypes: {
    flexDirection: 'row',
    gap: 10,
  },
  addressType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addressTypeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  addressTypeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  addressTypeTextActive: {
    color: '#fff',
  },
  inputGroup: {
    marginTop: 14,
    gap: 10,
  },
  inputField: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textLight,
  },
  input: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.text,
    padding: 0,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentGroup: {
    gap: 8,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  paymentOptionActive: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08',
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconActive: {
    backgroundColor: Colors.primary + '15',
  },
  paymentName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  paymentNameActive: {
    color: Colors.primary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  summaryRestaurant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  summaryRestaurantText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItemName: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  summaryItemPrice: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.text,
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
  placeOrderBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  placeOrderButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  placeOrderText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#fff',
  },
});
