import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useOrders, type OrderStatus } from '@/context/OrderContext';

const steps: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'placed', label: 'Order Placed', icon: 'checkmark-circle' },
  { status: 'preparing', label: 'Preparing Food', icon: 'restaurant' },
  { status: 'picked_up', label: 'Picked Up', icon: 'bag-check' },
  { status: 'on_the_way', label: 'On the Way', icon: 'bicycle' },
  { status: 'delivered', label: 'Delivered', icon: 'home' },
];

const statusIndex: Record<OrderStatus, number> = {
  placed: 0,
  preparing: 1,
  picked_up: 2,
  on_the_way: 3,
  delivered: 4,
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
  container: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary + '30',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
});

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getOrder, updateOrderStatus } = useOrders();
  const order = getOrder(id);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!order || order.status === 'delivered') return;

    const nextStatuses: Record<OrderStatus, OrderStatus | null> = {
      placed: 'preparing',
      preparing: 'picked_up',
      picked_up: 'on_the_way',
      on_the_way: 'delivered',
      delivered: null,
    };

    const next = nextStatuses[order.status];
    if (next) {
      timerRef.current = setTimeout(() => {
        updateOrderStatus(order.id, next);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 8000 + Math.random() * 4000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [order?.status]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  if (!order) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <Text style={styles.errorText}>Order not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currentIdx = statusIndex[order.status];
  const isDelivered = order.status === 'delivered';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Order #{order.id}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            {isDelivered ? (
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            ) : (
              <PulsingDot />
            )}
            <View style={styles.statusHeaderText}>
              <Text style={styles.statusTitle}>
                {isDelivered ? 'Order Delivered!' : steps[currentIdx].label}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isDelivered
                  ? 'Thank you for ordering with FoodRush'
                  : `Estimated: ${order.estimatedDelivery}`}
              </Text>
            </View>
          </View>
        </View>

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

        {!isDelivered && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>Alex Johnson</Text>
              <View style={styles.driverRating}>
                <Ionicons name="star" size={12} color={Colors.star} />
                <Text style={styles.driverRatingText}>4.9</Text>
              </View>
            </View>
            <Pressable
              style={styles.callButton}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <Ionicons name="call" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        )}

        <View style={styles.orderDetails}>
          <Text style={styles.detailsTitle}>Order Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Restaurant</Text>
            <Text style={styles.detailValue}>{order.restaurantName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue}>{order.address}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment</Text>
            <Text style={styles.detailValue}>{order.paymentMethod}</Text>
          </View>
          <View style={styles.divider} />
          {order.items.map((item) => (
            <View key={item.menuItem.id} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{item.quantity}x {item.menuItem.name}</Text>
              <Text style={styles.detailValue}>${(item.menuItem.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${order.total.toFixed(2)}</Text>
          </View>
        </View>

        {isDelivered && (
          <Pressable
            style={styles.doneButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.doneButtonText}>Back to Home</Text>
          </Pressable>
        )}
      </ScrollView>
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
    fontSize: 18,
    color: Colors.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statusHeaderText: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  statusSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timeline: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    gap: 0,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timelineIndicator: {
    alignItems: 'center',
    width: 40,
  },
  timelineCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  timelineCircleCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  timelineCircleCurrent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  timelineLineCompleted: {
    backgroundColor: Colors.success,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  timelineLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.textLight,
  },
  timelineLabelCompleted: {
    color: Colors.text,
  },
  timelineLabelCurrent: {
    color: Colors.primary,
    fontFamily: 'Poppins_600SemiBold',
  },
  timelineActive: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  timelineDone: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.success,
    marginTop: 2,
  },
  driverCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  driverRatingText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderDetails: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  detailsTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.text,
    textAlign: 'right',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  totalLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  totalValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: Colors.text,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  doneButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: '#fff',
  },
  errorText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 100,
  },
  goBackText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 12,
  },
});
