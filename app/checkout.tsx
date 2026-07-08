import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable, TextInput, Platform, Alert,
  ActivityIndicator, BackHandler, Animated,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrderContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { ordersApi, addressesApi, type ApiOrderItem } from '@/lib/api';
import { isWithinServiceArea, haversineKm, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG, formatKm } from '@/lib/geofence';
import MapLocationPicker, { type PickedLocation } from '@/components/MapLocationPicker';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { NOTIFICATION_CHANNEL_ID } from '@/hooks/usePushNotifications';
import { useQuote } from '@/hooks/useQuote';
import { BillBreakdown } from '@/components/BillBreakdown';
import { Toast, useToast } from '@/components/Toast';

// Cities within the Chittoor district / nearby serviceable areas (for city-name fallback validation)
const CHITTOOR_AREA_CITIES = [
  'chittoor', 'tirupati', 'madanapalle', 'punganur', 'palamaner',
  'kuppam', 'srikalahasti', 'puttur', 'nagari', 'gudipala',
  'gangavaram', 'pakala', 'yerpedu', 'renigunta', 'chandragiri',
  'piler', 'srirangarajapuram', 'vayalpad', 'thamballapalle',
  'bangarupalyam', 'pileru',
];

// Payment options: COD or Online (Razorpay handles UPI / Card / Wallet / NetBanking internally).
const paymentMethods = [
  { id: 'cod',    name: 'Cash on Delivery',             icon: 'cash-outline',          apiValue: 'cod' as const },
  { id: 'online', name: 'Pay Online (UPI / Card / Wallet)', icon: 'card-outline',     apiValue: 'upi' as const },
];

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FAFAFA' }}>
      <Ionicons name="alert-circle-outline" size={52} color="#DDD" />
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: '#333', marginTop: 16, textAlign: 'center' }}>Checkout unavailable</Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' }}>Something went wrong. Tap Retry or go back to your cart.</Text>
      <Pressable onPress={retry} style={{ marginTop: 24, backgroundColor: '#FF6B35', paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 }}>
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' }}>Retry</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={{ marginTop: 12, paddingVertical: 10 }}>
        <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 14, color: '#888' }}>Back to Cart</Text>
      </Pressable>
    </View>
  );
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, restaurantName, restaurantApiId, subtotal, couponCode, clearCart, orderNotes, setOrderNotes } = useCart();
  const { addOrder } = useOrders();
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useNotifications();
  const { show: showToast, toastProps } = useToast();
  const queryClient = useQueryClient();

  const [selectedPayment, setSelectedPayment] = useState('cod');
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [address, setAddress] = useState('');
  const [newPickedLoc, setNewPickedLoc] = useState<PickedLocation | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [placing, setPlacing] = useState(false);
  // notes is persisted in CartContext (orderNotes) so it survives navigating away to add items
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string | undefined>();

  // Delivery coordinates for server-side quote (accurate delivery fee)
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);

  const { quote, isLoading: quoteLoading, error: quoteError } = useQuote({
    deliveryLatitude: deliveryLat,
    deliveryLongitude: deliveryLng,
  });
  const displayTotal = quote?.bill?.overall_total ?? subtotal;
  const successScale = useRef(new Animated.Value(0)).current;
  const orderPlaced = useRef(false);
  const prefilled = useRef(false);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  // Fetch saved addresses
  const { data: savedAddresses, isLoading: loadingAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressesApi.list().then((r) => r ?? []),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Auto-select default address and set delivery coordinates.
  // Skip addresses the server marks as not serviceable.
  // Prefer a recently added address (within last 10 min) over the default.
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && selectedAddressId === null) {
      const serviceable = savedAddresses.filter((a) => {
        if (a.latitude && a.longitude) {
          return isWithinServiceArea(parseFloat(a.latitude), parseFloat(a.longitude));
        }
        return a.isServiceable !== false;
      });
      const tenMinAgo = Date.now() - 10 * 60 * 1000;
      const recentlyAdded = serviceable.find(
        (a) => a.createdAt && new Date(a.createdAt).getTime() > tenMinAgo,
      );
      const def = recentlyAdded ?? serviceable.find((a) => a.isDefault) ?? serviceable[0];
      if (!def) { setShowNewAddress(true); return; }
      setSelectedAddressId(def.id);
      setShowNewAddress(false);
      if (def.latitude && def.longitude) {
        setDeliveryLat(parseFloat(def.latitude));
        setDeliveryLng(parseFloat(def.longitude));
      }
    } else if (savedAddresses && savedAddresses.length === 0) {
      setShowNewAddress(true);
    }
  }, [savedAddresses]);

  // Prefill from user profile — only once
  useEffect(() => {
    if (user && !prefilled.current) {
      prefilled.current = true;
      setContactName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (items.length === 0 && !orderPlaced.current) {
      router.back();
    }
  }, [items.length]);

  // Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/cart');
      return true;
    });
    return () => sub.remove();
  }, []);

  if (items.length === 0 && !orderSuccess) return null;

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.centered, { flexGrow: 1 }]} showsVerticalScrollIndicator={false}>
          <Ionicons name="lock-closed-outline" size={56} color={Colors.primary} />
          <Text style={styles.authTitle}>Sign in to place your order</Text>
          <Text style={styles.authSubtitle}>You need an account to complete checkout</Text>
          <Pressable style={styles.authButton} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.authButtonText}>Sign In</Text>
          </Pressable>
          <Pressable style={styles.authSecondary} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.authSecondaryText}>Create Account</Text>
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      </View>
    );
  }

  const handlePlaceOrder = async () => {
    const selectedSaved = savedAddresses?.find((a) => a.id === selectedAddressId);
    let finalAddress = selectedSaved
      ? `${selectedSaved.address}${selectedSaved.landmark ? ', ' + selectedSaved.landmark : ''}, ${selectedSaved.city}${selectedSaved.pincode ? ' - ' + selectedSaved.pincode : ''}`
      : address.trim();

    if (!finalAddress) {
      Alert.alert('Missing address', 'Please select or enter a delivery address.');
      return;
    }

    // Geofence check — validate saved address coordinates
    if (selectedSaved && selectedSaved.latitude && selectedSaved.longitude) {
      const lat = parseFloat(selectedSaved.latitude);
      const lng = parseFloat(selectedSaved.longitude);
      if (!isWithinServiceArea(lat, lng)) {
        const dist = haversineKm(lat, lng, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG);
        Alert.alert(
          'Outside Delivery Area',
          `Sorry, we can't deliver to "${selectedSaved.label || selectedSaved.address}" — it's ${formatKm(dist)} from Chittoor, outside our 80 km service area.\n\nPlease choose a different address.`,
        );
        return;
      }
    }

    // Fallback: no coordinates — validate by city name
    if (selectedSaved && (!selectedSaved.latitude || !selectedSaved.longitude)) {
      const cityLower = (selectedSaved.city || '').trim().toLowerCase();
      if (cityLower && !CHITTOOR_AREA_CITIES.some((c) => cityLower.includes(c))) {
        Alert.alert(
          'Outside Delivery Area',
          `Sorry, we don't deliver to "${selectedSaved.city}". We currently deliver only within Chittoor and nearby areas.\n\nPlease choose or add a different address.`,
        );
        return;
      }
    }

    // For a new address on native: require map confirmation to enforce geofence
    if (showNewAddress && !selectedSaved && Platform.OS !== 'web') {
      if (!newPickedLoc) {
        Alert.alert(
          'Location Required',
          'Please tap "Pick Location on Map" to confirm your delivery address. This ensures we can reach you within our delivery area.',
        );
        return;
      }
      const pickedLat = parseFloat(newPickedLoc.latitude);
      const pickedLng = parseFloat(newPickedLoc.longitude);
      if (!isWithinServiceArea(pickedLat, pickedLng)) {
        const dist = haversineKm(pickedLat, pickedLng, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG);
        Alert.alert(
          'Outside Delivery Area',
          `The selected location is ${formatKm(dist)} from Chittoor. We only deliver within 80 km of Chittoor.\n\nPlease pick a location within the delivery area.`,
        );
        return;
      }
    }

    if (!contactName.trim() || !phone.trim()) {
      Alert.alert('Missing info', 'Please enter your contact name and phone.');
      return;
    }

    const restApiId = restaurantApiId;
    if (!restApiId) {
      Alert.alert('Error', 'Restaurant information is missing. Please go back and try again.');
      return;
    }

    const paymentMethod = paymentMethods.find((p) => p.id === selectedPayment)?.apiValue ?? 'cod';

    // For online payments open Razorpay's native checkout UI.
    // Razorpay shows its own full-screen sheet where the user picks UPI / Card / Wallet / NetBanking.
    // We do NOT pre-select or collect payment details here.
    let razorpayPaymentId: string | undefined;
    if (paymentMethod !== 'cod') {
      try {
        const payment = await openRazorpayCheckout({
          amount: Math.round(displayTotal * 100), // paise
          prefill: {
            name: contactName.trim(),
            contact: phone.trim(),
            email: user?.email || '',
          },
          notes: { restaurant: restaurantName || '' },
        });
        razorpayPaymentId = payment.razorpay_payment_id;
        setPaymentRef(payment.razorpay_payment_id);
      } catch (err: any) {
        // code 0 = user cancelled
        if (err?.code === 0) {
          Alert.alert('Payment Cancelled', 'You cancelled the payment.');
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          Alert.alert('Payment Failed', err?.description || err?.message || 'Payment could not be processed. Please try again.');
        }
        return;
      }
    }

    // Pre-save new address to the server before placing the order.
    // This lets the server validate the address in isolation and set isServiceable correctly.
    // If the server marks it non-serviceable we abort early rather than getting a 422 on the order.
    if (showNewAddress && !selectedSaved && user && address.trim()) {
      try {
        const saved = await addressesApi.create({
          label: 'Other',
          address: newPickedLoc?.address || address.trim(),
          city: newPickedLoc?.city || 'Chittoor',
          pincode: newPickedLoc?.pincode || undefined,
          latitude: newPickedLoc?.latitude || undefined,
          longitude: newPickedLoc?.longitude || undefined,
          isDefault: !savedAddresses || savedAddresses.length === 0,
        });
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        // Rebuild finalAddress in the same structured format the server expects for saved addresses.
        // The server matches deliveryAddress against saved address records — a flat joined string
        // ("Street, City, Pincode") doesn't match, but the structured format ("Street, City - Pincode") does.
        if (saved) {
          finalAddress = `${saved.address}${saved.landmark ? ', ' + saved.landmark : ''}, ${saved.city}${saved.pincode ? ' - ' + saved.pincode : ''}`;
          setSelectedAddressId(saved.id);
          setShowNewAddress(false);
        }
      } catch {
        // Pre-save failed (network error, etc.) — proceed and let the order attempt fail gracefully
      }
    }

    setPlacing(true);
    try {
      const orderItems: ApiOrderItem[] = items.map((ci) => ({
        menuItemId: parseInt(ci.menuItem.id, 10),
        name: ci.menuItem.name,
        quantity: ci.quantity,
        price: ci.menuItem.price,
      }));

      const orderTotal = displayTotal.toFixed(2);
      const apiOrder = await ordersApi.create({
        restaurantId: restApiId,
        customerId: user!.id,
        items: orderItems,
        deliveryAddress: finalAddress,
        customerPhone: phone.trim(),
        customerName: contactName.trim(),
        paymentMethod,
        notes: orderNotes.trim() || undefined,
        couponCode: couponCode ?? null,
        subtotal: orderTotal,
        total: orderTotal,
        deliveryLatitude: deliveryLat != null ? String(deliveryLat) : null,
        deliveryLongitude: deliveryLng != null ? String(deliveryLng) : null,
        razorpayPaymentId,
      });

      // If server recomputed total differs from quote by >₹2, warn user
      if (quote?.bill && apiOrder.total) {
        const serverTotal = parseFloat(apiOrder.total);
        const diff = Math.abs(serverTotal - quote.bill.overall_total);
        if (diff > 2) {
          showToast(`Final price updated to ₹${serverTotal % 1 === 0 ? serverTotal : serverTotal.toFixed(2)}`, 'info', 5000);
        }
      }

      const paymentLabel =
        paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment';

      const serverTotal = apiOrder.total ? parseFloat(apiOrder.total) : displayTotal;

      const order = {
        id: String(apiOrder.id),
        restaurantName: restaurantName || 'Restaurant',
        items,
        subtotal,
        deliveryFee: 0,
        packingCharges: 0,
        platformFee: 0,
        discount: 0,
        total: serverTotal,
        status: 'placed' as const,
        createdAt: apiOrder.createdAt || new Date().toISOString(),
        estimatedDelivery: '35-45 min',
        address: apiOrder.deliveryAddress,
        paymentMethod: paymentLabel,
        notes: orderNotes.trim() || undefined,
      };

      orderPlaced.current = true;
      addOrder(order);
      clearCart();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // ── Notifications ────────────────────────────────────────────────────────
      // 1. In-app notification panel (shown in the notifications bell)
      addNotification({
        title: 'Order Placed!',
        body: `Your order from ${restaurantName || 'Restaurant'} has been placed. We're on it!`,
        type: 'order_placed',
        orderId: String(apiOrder.id),
      });

      // 2. Local push notification — shows as a system banner even if the app
      //    is backgrounded immediately after placing the order.
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Order Placed! 🎉',
          body: `Your order from ${restaurantName || 'Restaurant'} is confirmed and being prepared.`,
          data: { type: 'order_placed', orderId: String(apiOrder.id) },
          sound: true,
          // Android 8+: must target the named channel created at startup
          ...(Platform.OS === 'android' && { android: { channelId: NOTIFICATION_CHANNEL_ID } }),
        },
        trigger: null, // fire immediately
      }).catch(() => {}); // silent fail — permissions may not be granted
      // ────────────────────────────────────────────────────────────────────────

      // Show success overlay briefly then navigate.
      // Replace the entire stack so the back button on the tracking screen goes to My Orders,
      // not back to checkout/restaurant.
      setOrderSuccess(true);
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }).start();
      setTimeout(() => {
        router.replace({ pathname: '/tracking/[id]', params: { id: order.id } });
      }, 1400);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (err?.status === 422 && err?.code === 'address_not_serviceable') {
        Alert.alert(
          'Outside Delivery Area',
          "Sorry, we can't deliver to the selected location. Please choose an address within the Chittoor area.",
        );
      } else {
        Alert.alert('Order Failed', err?.message?.replace(/^\d+:\s*/, '') || 'Could not place order. Please try again.');
      }
    } finally {
      setPlacing(false);
    }
  };

  // Hard gate: disable Place Order only if the selected saved address is not serviceable.
  // Quote errors never block placement — the server recomputes all prices on POST /api/orders.
  const selectedSavedForGate = savedAddresses?.find((a) => a.id === selectedAddressId);
  const isSelectedAddressOutOfArea = (() => {
    if (showNewAddress || selectedSavedForGate == null) return false;
    const hasCoords = !!selectedSavedForGate.latitude && !!selectedSavedForGate.longitude;
    if (hasCoords) {
      return !isWithinServiceArea(
        parseFloat(selectedSavedForGate.latitude),
        parseFloat(selectedSavedForGate.longitude),
      );
    }
    return selectedSavedForGate.isServiceable === false;
  })();

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Toast {...toastProps} />
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(tabs)/cart')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollViewCompat style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 90, paddingHorizontal: 20 }}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>

        {loadingAddresses ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginBottom: 12 }} />
        ) : (
          <>
            {/* Saved addresses */}
            {savedAddresses && savedAddresses.length > 0 && (
              <View style={styles.addressList}>
                {savedAddresses.map((addr) => {
                  // Trust client-side coordinate check when coordinates are available.
                  // Only fall back to server's isServiceable flag when no coordinates exist.
                  const hasCoords = !!addr.latitude && !!addr.longitude;
                  const isOutOfArea = hasCoords
                    ? !isWithinServiceArea(parseFloat(addr.latitude), parseFloat(addr.longitude))
                    : addr.isServiceable === false;
                  const isSelected = selectedAddressId === addr.id && !showNewAddress;
                  return (
                  <Pressable
                    key={addr.id}
                    style={[
                      styles.addressCard,
                      isSelected && styles.addressCardActive,
                      isOutOfArea && styles.addressCardDisabled,
                    ]}
                    onPress={() => {
                      if (isOutOfArea) return;
                      setSelectedAddressId(addr.id);
                      setShowNewAddress(false);
                      if (addr.latitude && addr.longitude) {
                        setDeliveryLat(parseFloat(addr.latitude));
                        setDeliveryLng(parseFloat(addr.longitude));
                      } else {
                        setDeliveryLat(null);
                        setDeliveryLng(null);
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }}
                  >
                    <View style={styles.addressCardLeft}>
                      <Ionicons
                        name={addr.label === 'Work' ? 'briefcase-outline' : 'home-outline'}
                        size={18}
                        color={isOutOfArea ? Colors.textLight : isSelected ? Colors.primary : Colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[
                            styles.addressCardLabel,
                            isSelected && { color: Colors.primary },
                            isOutOfArea && { color: Colors.textLight },
                          ]}>
                            {addr.label}{addr.isDefault ? '  ✓ Default' : ''}
                          </Text>
                          {isSelected && (
                            <View style={styles.selectedBadge}>
                              <Text style={styles.selectedBadgeText}>Selected</Text>
                            </View>
                          )}
                          {addr.createdAt && Date.now() - new Date(addr.createdAt).getTime() < 24 * 60 * 60 * 1000 && !addr.isDefault && (
                            <View style={styles.newBadge}>
                              <Text style={styles.newBadgeText}>New</Text>
                            </View>
                          )}
                          {isOutOfArea && (
                            <View style={styles.notDeliverableBadge}>
                              <Text style={styles.notDeliverableText}>Not deliverable</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.addressCardText, isOutOfArea && { color: Colors.textLight }]} numberOfLines={2}>{addr.address}</Text>
                        {!!addr.landmark && (
                          <Text style={styles.addressCardSub} numberOfLines={1}>{addr.landmark}</Text>
                        )}
                      </View>
                    </View>
                    {!isOutOfArea && (
                      <View style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleActive,
                      ]}>
                        {isSelected && (
                          <View style={styles.radioDotInner} />
                        )}
                      </View>
                    )}
                  </Pressable>
                  );
                })}

                {/* Add new address option */}
                <Pressable
                  style={[styles.addressCard, showNewAddress && styles.addressCardActive]}
                  onPress={() => {
                    setShowNewAddress(true);
                    setSelectedAddressId(null);
                    setDeliveryLat(null);
                    setDeliveryLng(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                >
                  <View style={styles.addressCardLeft}>
                    <Ionicons name="add-circle-outline" size={18} color={showNewAddress ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.addressCardLabel, showNewAddress && { color: Colors.primary }]}>
                      Use a different address
                    </Text>
                  </View>
                  <View style={[styles.radioCircle, showNewAddress && styles.radioCircleActive]}>
                    {showNewAddress && <View style={styles.radioDotInner} />}
                  </View>
                </Pressable>
              </View>
            )}

            {/* New address input */}
            {showNewAddress && (
              <View style={[styles.inputGroup, { marginTop: 10 }]}>
                {Platform.OS !== 'web' && (
                  <Pressable style={styles.mapPickerBtn} onPress={() => setShowMapPicker(true)}>
                    <Ionicons name="map-outline" size={16} color={Colors.primary} />
                    <Text style={styles.mapPickerBtnText}>Pick Location on Map</Text>
                  </Pressable>
                )}
                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>
                    Address *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={address}
                    onChangeText={setAddress}
                    editable={true}
                    placeholder="House no, Street, Area, City..."
                    placeholderTextColor={Colors.textLight}
                    multiline
                  />
                  {Platform.OS !== 'web' && !newPickedLoc && (
                    <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.warning, marginTop: 4 }}>
                      Tap "Pick Location on Map" to verify your address is within our delivery area.
                    </Text>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {/* Contact details */}
        <View style={[styles.inputGroup, { marginTop: 10 }]}>
          <View style={styles.inputRow}>
            <View style={[styles.inputField, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Contact Name</Text>
              <TextInput
                style={styles.input}
                value={contactName}
                onChangeText={(t) => setContactName(t.replace(/[^a-zA-Z\s]/g, ''))}
                placeholder="Your name"
                placeholderTextColor={Colors.textLight}
                maxLength={50}
              />
            </View>
            <View style={[styles.inputField, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textLight}
                maxLength={10}
                placeholder="10-digit number"
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
              <View style={{ flex: 1 }}>
                <Text style={[styles.paymentName, selectedPayment === method.id && styles.paymentNameActive]}>
                  {method.name}
                </Text>
                {method.id === 'online' && (
                  <Text style={styles.paymentSubtext}>Powered by Razorpay · Secure</Text>
                )}
              </View>
              <View style={[styles.radio, selectedPayment === method.id && styles.radioActive]}>
                {selectedPayment === method.id && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))}
        </View>

        {/* Info banner when Online is selected */}
        {selectedPayment === 'online' && (
          <View style={styles.razorpayInfoBanner}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
            <Text style={styles.razorpayInfoText}>
              Tap "Pay" to open the secure Razorpay payment screen.{'\n'}
              Choose UPI, Credit/Debit Card, Net Banking or Wallet there.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Special Request</Text>
        <View style={styles.notesField}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.textSecondary} style={{ marginTop: 2 }} />
          <TextInput
            style={styles.notesInput}
            placeholder="Any special instructions for this order..."
            placeholderTextColor={Colors.textLight}
            value={orderNotes}
            onChangeText={setOrderNotes}
            multiline
            maxLength={200}
          />
        </View>

        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRestaurant}>
            <Ionicons name="restaurant-outline" size={14} color={Colors.primary} />
            <Text style={styles.summaryRestaurantText}>{restaurantName}</Text>
          </View>

          <View style={styles.summaryItemsScroll}>
            {items.map((item) => (
              <View key={item.menuItem.id} style={styles.summaryItem}>
                <Text style={styles.summaryItemName}>{item.quantity}x {item.menuItem.name}</Text>
                <Text style={styles.summaryItemPrice}>₹{(item.menuItem.price * item.quantity).toFixed(0)}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.addMoreBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: restaurantApiId! } })}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.addMoreBtnText}>Add More Items</Text>
          </Pressable>

          <View style={styles.divider} />
          {quote?.bill ? (
            <>
              {quoteLoading && (
                <Text style={styles.updatingLabel}>Updating…</Text>
              )}
              <BillBreakdown quoteBill={quote.bill} />
            </>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₹{subtotal.toFixed(0)}</Text>
              </View>
              {quoteLoading && (
                <ActivityIndicator size="small" color={Colors.primary} style={{ alignSelf: 'center' }} />
              )}
            </>
          )}
        </View>
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.placeOrderBar, { paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'web' ? 34 : 0) }]}>
        {isSelectedAddressOutOfArea && (
          <Text style={styles.outOfAreaNote}>
            This address is outside our 80 km delivery area. Please select a different address.
          </Text>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.placeOrderButton,
            pressed && { opacity: 0.9 },
            (placing || isSelectedAddressOutOfArea) && { opacity: 0.5 },
          ]}
          onPress={handlePlaceOrder}
          disabled={placing || isSelectedAddressOutOfArea}
        >
          {placing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeOrderText}>
              {selectedPayment === 'cod'
                ? `Place Order · ₹${Math.round(displayTotal)}`
                : `Pay ₹${Math.round(displayTotal)} via Razorpay`}
            </Text>
          )}
        </Pressable>
      </View>

      {showMapPicker && (
        <MapLocationPicker
          visible
          onClose={() => setShowMapPicker(false)}
          onConfirm={(loc: PickedLocation) => {
            const full = [loc.address, loc.city, loc.pincode].filter(Boolean).join(', ');
            setAddress(full);
            setNewPickedLoc(loc);
            if (loc.latitude && loc.longitude) {
              setDeliveryLat(parseFloat(loc.latitude));
              setDeliveryLng(parseFloat(loc.longitude));
            }
          }}
        />
      )}

      {/* Order success overlay */}
      {orderSuccess && (
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: successScale }] }]}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Order Placed!</Text>
            {paymentRef ? (
              <View style={styles.paymentRefBox}>
                <Text style={styles.paymentRefLabel}>Payment Reference</Text>
                <Text style={styles.paymentRefValue}>{paymentRef}</Text>
              </View>
            ) : null}
            <Text style={styles.successSub}>Redirecting to order tracking…</Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  authTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 12,
  },
  authSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  authButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  authButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  authSecondary: {
    paddingVertical: 10,
  },
  authSecondaryText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.primary,
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
  addressList: {
    gap: 8,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 10,
  },
  addressCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  addressCardDisabled: {
    opacity: 0.55,
    borderColor: Colors.border,
  },
  notDeliverableBadge: {
    backgroundColor: Colors.error + '18',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  notDeliverableText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: Colors.error,
  },
  newBadge: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: Colors.primary,
  },
  selectedBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: '#fff',
  },
  addressCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  addressCardLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 2,
  },
  addressCardText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  addressCardSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: Colors.primary,
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  mapPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 11, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 12,
    backgroundColor: Colors.primary + '08',
  },
  mapPickerBtnText: {
    fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.primary,
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
  },
  paymentNameActive: {
    color: Colors.primary,
  },
  paymentSubtext: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
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
  razorpayInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    backgroundColor: Colors.primary + '0D',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  razorpayInfoText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  notesField: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesInput: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.text,
    padding: 0,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  summaryItemsScroll: {},
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
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  addMoreBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
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
  updatingLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.text,
  },
  placeOrderBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  outOfAreaNote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 8,
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
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    color: Colors.text,
  },
  paymentRefBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  paymentRefLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  paymentRefValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  successSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
