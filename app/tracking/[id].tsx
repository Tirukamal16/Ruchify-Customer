import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform,
  Alert, ActivityIndicator, BackHandler, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useOrders, type OrderStatus } from '@/context/OrderContext';
import { useAuth } from '@/context/AuthContext';
import { ordersApi, ridersApi, reviewsApi, type ApiReview, type ApiReviewItemRating } from '@/lib/api';
import { adaptOrderStatus } from '@/lib/adapters';
import { BillBreakdown, type V1Bill, type V2Bill } from '@/components/BillBreakdown';

const steps: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'placed', label: 'Order Placed', icon: 'checkmark-circle' },
  { status: 'accepted', label: 'Accepted', icon: 'thumbs-up' },
  { status: 'preparing', label: 'Preparing Food', icon: 'restaurant' },
  { status: 'ready', label: 'Ready for Pickup', icon: 'bag-check' },
  { status: 'picked_up', label: 'Picked Up', icon: 'bicycle' },
  { status: 'delivered', label: 'Delivered', icon: 'home' },
];

const statusIndex: Record<OrderStatus, number> = {
  placed: 0,
  accepted: 1,
  preparing: 2,
  ready: 3,
  picked_up: 4,
  on_the_way: 4,
  delivered: 5,
  cancelled: -1,
};

function PulsingDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.6, { duration: 1200 }), -1, true);
    opacity.value = withRepeat(withTiming(0.3, { duration: 1200 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={pulseStyles.container}>
      <Animated.View style={[pulseStyles.ring, animatedStyle]} />
      <View style={pulseStyles.dot} />
    </View>
  );
}

const pulseStyles = StyleSheet.create({
  container: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary + '30' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
});

const CANCEL_WINDOW_SEC = 20;

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} hitSlop={6}>
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={26}
            color={star <= value ? '#F59E0B' : Colors.border}
          />
        </Pressable>
      ))}
    </View>
  );
}

function ReviewSection({
  orderId,
  customerId,
  restaurantId,
  riderId,
  orderItems,
}: {
  orderId: string;
  customerId: number;
  restaurantId?: number;
  riderId?: number;
  orderItems: { menuItemId: number; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews-order', orderId],
    queryFn: () => reviewsApi.listByOrderId(orderId),
    staleTime: 60000,
  });

  const existingReview: ApiReview | undefined = reviews?.[0];
  const isModerated = !!existingReview?.moderatedAt;

  // Form state
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [riderRating, setRiderRating] = useState(0);
  const [comment, setComment] = useState('');
  const [itemRatings, setItemRatings] = useState<Record<number, number>>({});

  // Pre-fill when entering edit mode
  useEffect(() => {
    if (editing && existingReview) {
      setRestaurantRating(existingReview.restaurantRating ?? 0);
      setRiderRating(existingReview.riderRating ?? 0);
      setComment(existingReview.comment ?? '');
      const ir: Record<number, number> = {};
      (existingReview.itemRatings ?? []).forEach((r) => { ir[r.menuItemId] = r.rating; });
      setItemRatings(ir);
    }
    if (!editing && !existingReview) {
      setRestaurantRating(0);
      setRiderRating(0);
      setComment('');
      setItemRatings({});
    }
  }, [editing]);

  const handleSubmit = async () => {
    if (restaurantRating === 0) {
      Alert.alert('Rating required', 'Please rate the restaurant before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const builtItemRatings: ApiReviewItemRating[] = orderItems
        .filter((item) => itemRatings[item.menuItemId] > 0)
        .map((item) => ({ menuItemId: item.menuItemId, rating: itemRatings[item.menuItemId] }));

      const payload = {
        restaurantRating,
        riderRating: riderRating > 0 ? riderRating : undefined,
        comment: comment.trim() || undefined,
        itemRatings: builtItemRatings.length > 0 ? builtItemRatings : undefined,
      };

      if (existingReview) {
        await reviewsApi.update(existingReview.id, payload);
      } else {
        await reviewsApi.create({
          orderId: parseInt(orderId, 10),
          customerId,
          restaurantId,
          riderId,
          ...payload,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['reviews-order', orderId] });
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      if (err?.status === 409) {
        Alert.alert(
          'Review locked',
          'This review has been moderated and can no longer be edited.',
        );
        await queryClient.invalidateQueries({ queryKey: ['reviews-order', orderId] });
        setEditing(false);
      } else {
        Alert.alert('Error', err?.message?.replace(/^\d+:\s*/, '') || 'Could not submit review.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (reviewsLoading) {
    return (
      <View style={rvStyles.card}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  // Show submitted review (read-only)
  if (existingReview && !editing) {
    return (
      <View style={rvStyles.card}>
        <Text style={rvStyles.cardTitle}>Your Review</Text>
        <View style={rvStyles.ratingRow}>
          <Ionicons name="restaurant-outline" size={14} color={Colors.textSecondary} />
          <Text style={rvStyles.ratingLabel}>Restaurant</Text>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons key={s} name={s <= (existingReview.restaurantRating ?? 0) ? 'star' : 'star-outline'} size={14} color="#F59E0B" />
            ))}
          </View>
        </View>
        {(existingReview.riderRating ?? 0) > 0 && (
          <View style={rvStyles.ratingRow}>
            <Ionicons name="bicycle-outline" size={14} color={Colors.textSecondary} />
            <Text style={rvStyles.ratingLabel}>Rider</Text>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name={s <= (existingReview.riderRating ?? 0) ? 'star' : 'star-outline'} size={14} color="#F59E0B" />
              ))}
            </View>
          </View>
        )}
        {!!existingReview.comment && (
          <Text style={rvStyles.commentDisplay}>{existingReview.comment}</Text>
        )}
        {isModerated ? (
          <Text style={rvStyles.moderatedNote}>Review moderated — editing is no longer available.</Text>
        ) : (
          <Pressable style={rvStyles.editBtn} onPress={() => setEditing(true)}>
            <Ionicons name="pencil-outline" size={14} color={Colors.primary} />
            <Text style={rvStyles.editBtnText}>Edit Review</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Show create/edit form
  return (
    <View style={rvStyles.card}>
      <Text style={rvStyles.cardTitle}>{existingReview ? 'Edit Review' : 'Rate Your Order'}</Text>

      <Text style={rvStyles.sectionLabel}>Restaurant *</Text>
      <StarPicker value={restaurantRating} onChange={setRestaurantRating} />

      {riderId != null && (
        <>
          <Text style={[rvStyles.sectionLabel, { marginTop: 14 }]}>Delivery Partner</Text>
          <StarPicker value={riderRating} onChange={setRiderRating} />
        </>
      )}

      {orderItems.length > 0 && (
        <>
          <Text style={[rvStyles.sectionLabel, { marginTop: 14 }]}>Rate Your Items</Text>
          {orderItems.map((item) => (
            <View key={item.menuItemId} style={rvStyles.itemRatingRow}>
              <Text style={rvStyles.itemName} numberOfLines={1}>{item.name}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    hitSlop={6}
                    onPress={() => setItemRatings((prev) => ({ ...prev, [item.menuItemId]: star }))}
                  >
                    <Ionicons
                      name={star <= (itemRatings[item.menuItemId] ?? 0) ? 'star' : 'star-outline'}
                      size={18}
                      color={star <= (itemRatings[item.menuItemId] ?? 0) ? '#F59E0B' : Colors.border}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={[rvStyles.sectionLabel, { marginTop: 14 }]}>Comment (optional)</Text>
      <TextInput
        style={rvStyles.commentInput}
        value={comment}
        onChangeText={setComment}
        placeholder="Tell us about your experience..."
        placeholderTextColor={Colors.textLight}
        multiline
        numberOfLines={3}
        maxLength={500}
      />

      <View style={rvStyles.formBtns}>
        {existingReview && (
          <Pressable style={rvStyles.cancelEditBtn} onPress={() => setEditing(false)}>
            <Text style={rvStyles.cancelEditBtnText}>Cancel</Text>
          </Pressable>
        )}
        <Pressable
          style={[rvStyles.submitBtn, submitting && { opacity: 0.6 }, existingReview ? { flex: 1 } : { flex: 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={rvStyles.submitBtnText}>{existingReview ? 'Update Review' : 'Submit Review'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const rvStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginTop: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: Colors.text, marginBottom: 12 },
  sectionLabel: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  ratingLabel: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.text, flex: 1 },
  commentDisplay: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 10, lineHeight: 19 },
  moderatedNote: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textLight, fontStyle: 'italic', marginTop: 6 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  editBtnText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.primary },
  itemRatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  itemName: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.text, flex: 1, marginRight: 12 },
  commentInput: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.text,
    minHeight: 80, textAlignVertical: 'top',
  },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelEditBtn: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center',
  },
  cancelEditBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.textSecondary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitBtnText: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#fff' },
});

// Screen-level error boundary — prevents a tracking-screen crash from showing
// the full-app "Something went wrong" overlay.
export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: '#111', marginTop: 16, textAlign: 'center' }}>
        Couldn't load order
      </Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
        Your order was placed successfully. Tap below to retry loading the tracking screen.
      </Text>
      <Pressable
        onPress={retry}
        style={{ marginTop: 24, backgroundColor: '#C8281A', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 }}
      >
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' }}>Try Again</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/(tabs)/orders')} style={{ marginTop: 12, padding: 8 }}>
        <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 14, color: '#C8281A' }}>Go to My Orders</Text>
      </Pressable>
    </View>
  );
}

export default function TrackingScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  // useLocalSearchParams can return string | string[] — normalise to string
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const insets = useSafeAreaInsets();
  const { getOrder, updateOrderStatus } = useOrders();
  const { user } = useAuth();
  const localOrder = getOrder(id);
  const [cancelling, setCancelling] = useState(false);
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(0);

  // Android hardware back → always go to My Orders, not the previous stack screen
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/orders');
      return true;
    });
    return () => sub.remove();
  }, []);

  // Poll API for status updates every 15 seconds
  const { data: apiOrder } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id),
    refetchInterval: 15000,
    staleTime: 10000,
    retry: 2,
  });

  // Fetch rider details when assigned
  const { data: rider } = useQuery({
    queryKey: ['rider', apiOrder?.riderId],
    queryFn: () => ridersApi.get(apiOrder!.riderId!),
    enabled: !!apiOrder?.riderId,
    staleTime: 30000,
  });

  // Derive current status early — needed by effects below
  const currentStatus: OrderStatus = localOrder
    ? localOrder.status
    : apiOrder
    ? adaptOrderStatus(apiOrder.status)
    : 'placed';

  // Sync API status to local state
  useEffect(() => {
    if (apiOrder) {
      const apiStatus = adaptOrderStatus(apiOrder.status);
      if (localOrder && localOrder.status !== apiStatus) {
        updateOrderStatus(id, apiStatus);
        if (apiStatus === 'delivered') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    }
  }, [apiOrder?.status]);

  // 20-second cancellation countdown — only active while status is 'placed'
  useEffect(() => {
    const createdAt = localOrder?.createdAt ?? apiOrder?.createdAt;
    if (!createdAt || currentStatus !== 'placed') {
      setCancelSecondsLeft(0);
      return;
    }
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
    const remaining = Math.max(0, CANCEL_WINDOW_SEC - elapsed);
    if (remaining <= 0) { setCancelSecondsLeft(0); return; }

    setCancelSecondsLeft(Math.ceil(remaining));
    const interval = setInterval(() => {
      setCancelSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [localOrder?.createdAt, apiOrder?.createdAt, currentStatus]);

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order?',
      'This cannot be undone. Your order will be cancelled immediately.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await ordersApi.updateStatus(
                id,
                'cancelled',
                user?.name ?? 'Customer',
                'customer',
                'Cancelled by customer',
              );
              updateOrderStatus(id, 'cancelled');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            } catch (err: any) {
              Alert.alert('Error', err?.message?.replace(/^\d+:\s*/, '') || 'Could not cancel order. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const displayAddress = localOrder?.address ?? apiOrder?.deliveryAddress ?? '';
  const displayTotal = localOrder ? localOrder.total : apiOrder ? parseFloat(apiOrder.total) : 0;
  const displayPayment = localOrder?.paymentMethod ?? (apiOrder?.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online');
  const displayRestaurant = localOrder?.restaurantName ?? `Restaurant #${apiOrder?.restaurantId ?? ''}`;
  const displayItems = localOrder?.items ?? [];

  if (!localOrder && !apiOrder) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <Text style={styles.errorText}>Loading order...</Text>
      </View>
    );
  }

  const currentIdx = statusIndex[currentStatus] ?? 0;
  const isDelivered = currentStatus === 'delivered';
  const isCancelled = currentStatus === 'cancelled';

  const orderTimestamp = localOrder?.createdAt ?? apiOrder?.createdAt;
  const formattedTime = orderTimestamp
    ? new Date(orderTimestamp).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Sticky Order ID header (41) */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(tabs)/orders')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Order #{id}</Text>
          {formattedTime && (
            <Text style={styles.headerTimestamp}>{formattedTime}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            {isDelivered ? (
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            ) : isCancelled ? (
              <Ionicons name="close-circle" size={48} color={Colors.error} />
            ) : (
              <PulsingDot />
            )}
            <View style={styles.statusHeaderText}>
              <Text style={styles.statusTitle}>
                {isDelivered
                  ? 'Order Delivered!'
                  : isCancelled
                  ? 'Order Cancelled'
                  : steps[currentIdx]?.label ?? currentStatus}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isDelivered
                  ? 'Thank you for ordering with Ruchify'
                  : isCancelled
                  ? 'Your order has been cancelled'
                  : localOrder?.estimatedDelivery
                  ? `Estimated: ${localOrder.estimatedDelivery}`
                  : 'Your order is being processed'}
              </Text>
            </View>
          </View>

          {/* Cancel button — only during 20-second window before restaurant accepts */}
          {currentStatus === 'placed' && cancelSecondsLeft > 0 && (
            <Pressable
              style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
              onPress={handleCancelOrder}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
                  <Text style={styles.cancelBtnText}>Cancel Order</Text>
                  <View style={styles.cancelTimer}>
                    <Text style={styles.cancelTimerText}>{cancelSecondsLeft}s</Text>
                  </View>
                </>
              )}
            </Pressable>
          )}
        </View>

        {!isCancelled && (
          <View style={styles.timeline}>
            {steps.map((step, index) => {
              const isCompleted = index <= currentIdx;
              const isCurrent = index === currentIdx;
              return (
                <View key={step.status} style={styles.timelineStep}>
                  <View style={styles.timelineIndicator}>
                    <View style={[
                      styles.timelineCircle,
                      isCompleted && styles.timelineCircleCompleted,
                      isCurrent && !isDelivered && styles.timelineCircleCurrent,
                    ]}>
                      <Ionicons
                        name={step.icon as any}
                        size={16}
                        color={isCompleted ? '#fff' : Colors.textLight}
                      />
                    </View>
                    {index < steps.length - 1 && (
                      <View style={[
                        styles.timelineLine,
                        index < currentIdx && styles.timelineLineCompleted,
                      ]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[
                      styles.timelineLabel,
                      isCompleted && styles.timelineLabelCompleted,
                      isCurrent && !isDelivered && styles.timelineLabelCurrent,
                    ]}>
                      {step.label}
                    </Text>
                    {isCurrent && !isDelivered && (
                      <Text style={styles.timelineActive}>In progress...</Text>
                    )}
                    {isCompleted && index < currentIdx && (
                      <Text style={styles.timelineDone}>Completed</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!isDelivered && !isCancelled && apiOrder?.riderId && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{rider?.name ?? 'Delivery Partner'}</Text>
              <Text style={styles.driverSub}>
                {rider ? `${rider.vehicleType ?? 'Bike'} · ${rider.vehicleNumber ?? ''}` : 'Assigned to your order'}
              </Text>
            </View>
            <Pressable
              style={styles.callButton}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <Ionicons name="call" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        )}

        {/* Full Invoice Summary (39) */}
        <View style={styles.orderDetails}>
          <Text style={styles.detailsTitle}>Invoice Summary</Text>

          {/* Restaurant & delivery info */}
          <View style={styles.invoiceInfoBlock}>
            <View style={styles.invoiceInfoRow}>
              <Ionicons name="restaurant-outline" size={14} color={Colors.primary} />
              <Text style={styles.invoiceInfoLabel}>Restaurant</Text>
              <Text style={styles.invoiceInfoValue}>{displayRestaurant}</Text>
            </View>
            <View style={styles.invoiceInfoRow}>
              <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.invoiceInfoLabel}>Delivery to</Text>
              <Text style={styles.invoiceInfoValue} numberOfLines={2}>{displayAddress}</Text>
            </View>
            <View style={styles.invoiceInfoRow}>
              <Ionicons name="card-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.invoiceInfoLabel}>Payment</Text>
              <Text style={styles.invoiceInfoValue}>{displayPayment}</Text>
            </View>
            <View style={styles.invoiceInfoRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.invoiceInfoLabel}>Est. Delivery</Text>
              <Text style={styles.invoiceInfoValue}>{localOrder?.estimatedDelivery ?? '35-45 min'}</Text>
            </View>
          </View>

          {/* Itemised receipt */}
          <Text style={styles.invoiceSectionLabel}>Items Ordered</Text>
          {displayItems.length > 0
            ? displayItems.map((item) => (
                <View key={item.menuItem.id}>
                  <View style={styles.detailRow}>
                    <View style={styles.itemRowLeft}>
                      <View style={[styles.vegDot, { backgroundColor: item.menuItem.isVeg ? '#22C55E' : '#EF4444' }]} />
                      <Text style={styles.detailLabel}>{item.quantity}× {item.menuItem.name}</Text>
                    </View>
                    <Text style={styles.detailValue}>₹{(item.menuItem.price * item.quantity).toFixed(0)}</Text>
                  </View>
                  {!!item.specialInstructions && (
                    <Text style={styles.itemNote}>📝 {item.specialInstructions}</Text>
                  )}
                </View>
              ))
            : (apiOrder?.items ?? []).map((item, i) => (
                <View key={i} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{item.quantity}× {item.name}</Text>
                  <Text style={styles.detailValue}>₹{(Number(item.price) * item.quantity).toFixed(0)}</Text>
                </View>
              ))
          }

          {/* Order notes */}
          {!!(localOrder?.notes || apiOrder?.notes) && (
            <View style={styles.notesRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.notesText}>{localOrder?.notes || apiOrder?.notes}</Text>
            </View>
          )}

          {/* Fee breakdown */}
          <View style={styles.divider} />
          {(() => {
            // Guide §3: canonical bill object is source of truth — check first
            if (apiOrder?.bill) {
              return <BillBreakdown quoteBill={apiOrder.bill} />;
            }
            // V2 bill: flat fields fallback for orders without bill object
            if (apiOrder?.billVersion === 2 || apiOrder?.foodGross) {
              const v2: V2Bill = {
                foodGross: apiOrder.foodGross ?? String(parseFloat(apiOrder.subtotal ?? '0')),
                promoDiscount: apiOrder.promoDiscount,
                restaurantDiscount: apiOrder.restaurantDiscount,
                packagingCharges: apiOrder.packagingCharges,
                packagingGstAmount: apiOrder.packagingGstAmount,
                deliveryFeeGstAmount: apiOrder.deliveryFeeGstAmount,
                platformFeeGstAmount: apiOrder.platformFeeGstAmount,
                gstAmount: apiOrder.gstAmount,
                gstRate: apiOrder.gstRate,
                servicesGstRate: apiOrder.servicesGstRate,
                deliveryFee: apiOrder.deliveryFee ?? '0',
                platformFee: apiOrder.platformFee,
                discount: apiOrder.discount,
                total: apiOrder.total,
                couponCode: apiOrder.couponCode,
              };
              return <BillBreakdown v2Bill={v2} />;
            }
            // V1 bill: legacy layout (orders before 2026-05-12)
            if (apiOrder) {
              const v1: V1Bill = {
                subtotal: apiOrder.subtotal ?? String(displayTotal),
                deliveryFee: apiOrder.deliveryFee ?? '0',
                platformFee: apiOrder.platformFee,
                discount: apiOrder.discount,
                gstAmount: apiOrder.gstAmount,
                total: apiOrder.total,
              };
              return <BillBreakdown v1Bill={v1} />;
            }
            // Local order only (immediately after placing, before API loads)
            if (localOrder) {
              const v1: V1Bill = {
                subtotal: String(localOrder.subtotal),
                deliveryFee: String(localOrder.deliveryFee),
                platformFee: String(localOrder.platformFee),
                discount: String(localOrder.discount),
                total: String(localOrder.total),
              };
              return <BillBreakdown v1Bill={v1} />;
            }
            return null;
          })()}
        </View>

        {isDelivered && user && (
          <ReviewSection
            orderId={id}
            customerId={user.id}
            restaurantId={apiOrder?.restaurantId}
            riderId={apiOrder?.riderId}
            orderItems={
              (apiOrder?.items ?? []).map((item) => ({
                menuItemId: item.menuItemId,
                name: item.name,
              }))
            }
          />
        )}

        {(isDelivered || isCancelled) && (
          <Pressable
            style={styles.doneButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              router.replace('/(tabs)/orders');
            }}
          >
            <Text style={styles.doneButtonText}>Back to Orders</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: Colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  statusCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statusHeaderText: { flex: 1 },
  statusTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: Colors.text },
  statusSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  timeline: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 20,
  },
  timelineStep: { flexDirection: 'row', minHeight: 56 },
  timelineIndicator: { alignItems: 'center', width: 40 },
  timelineCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  timelineCircleCompleted: { backgroundColor: Colors.success, borderColor: Colors.success },
  timelineCircleCurrent: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 4 },
  timelineLineCompleted: { backgroundColor: Colors.success },
  timelineContent: { flex: 1, paddingLeft: 12, paddingBottom: 16, justifyContent: 'center' },
  timelineLabel: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.textLight },
  timelineLabelCompleted: { color: Colors.text },
  timelineLabelCurrent: { color: Colors.primary, fontFamily: 'Poppins_600SemiBold' },
  timelineActive: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.primary, marginTop: 2 },
  timelineDone: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.success, marginTop: 2 },
  driverCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  driverInfo: { flex: 1, marginLeft: 12 },
  driverName: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: Colors.text },
  driverSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  callButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center',
  },
  orderDetails: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 8 },
  detailsTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.text, marginBottom: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemNote: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textLight, marginTop: -4, marginBottom: 4, paddingLeft: 20 },
  detailLabel: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.textSecondary, flex: 1 },
  detailValue: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text, textAlign: 'right', flex: 1 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 4 },
  totalLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: Colors.text },
  totalValue: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: Colors.text },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 14, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.error,
    backgroundColor: Colors.error + '0C',
  },
  cancelBtnText: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: Colors.error, flex: 1,
  },
  cancelTimer: {
    backgroundColor: Colors.error + '20', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  cancelTimerText: {
    fontFamily: 'Poppins_700Bold', fontSize: 12, color: Colors.error,
  },
  doneButton: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  doneButtonText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: '#fff' },
  errorText: { fontFamily: 'Poppins_500Medium', fontSize: 16, color: Colors.text, textAlign: 'center', marginTop: 100 },
  goBackText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.primary, textAlign: 'center', marginTop: 12 },
  headerTimestamp: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  invoiceInfoBlock: { gap: 10, marginBottom: 4 },
  invoiceInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  invoiceInfoLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary, width: 80 },
  invoiceInfoValue: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: Colors.text, flex: 1, textAlign: 'right' },
  invoiceSectionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: Colors.text, marginTop: 6, marginBottom: 2 },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.surfaceAlt, borderRadius: 8, padding: 8, marginTop: 4 },
  notesText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary, flex: 1 },
  itemRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  totalRow: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
});
