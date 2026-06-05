/**
 * useActiveOrderPoller
 *
 * Runs a background polling loop (every 15 s) for the user's active order.
 * Whenever the API returns a new status it:
 *   1. Updates the OrderContext so every screen stays in sync.
 *   2. Adds an entry to the in-app NotificationsContext (the bell panel).
 *   3. Fires a local push notification — visible even if the user has minimised
 *      the app, because expo-notifications shows it as a system banner/sound.
 *
 * The hook is mounted once in RootLayoutNav and runs for the lifetime of the
 * authenticated session.  The tracking screen's own React-Query refetch
 * continues to work alongside this — both write the same idempotent status to
 * OrderContext, so there are no race conditions.
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useOrders, type OrderStatus } from '@/context/OrderContext';
import { useNotifications } from '@/context/NotificationsContext';
import { ordersApi } from '@/lib/api';
import { adaptOrderStatus } from '@/lib/adapters';
import { NOTIFICATION_CHANNEL_ID } from '@/hooks/usePushNotifications';

// ─── Notification copy for every status transition ───────────────────────────

type StatusCopyFn = (restaurantName: string) => { title: string; body: string };

const STATUS_COPY: Partial<Record<OrderStatus, StatusCopyFn>> = {
  accepted: (r) => ({
    title: 'Order Accepted! 👍',
    body: `${r} has confirmed your order and will start preparing it shortly.`,
  }),
  preparing: (r) => ({
    title: 'Preparing Your Food! 👨‍🍳',
    body: `${r} is freshly preparing your food. Hang tight!`,
  }),
  ready: (r) => ({
    title: 'Order Ready for Pickup! 📦',
    body: `Your order from ${r} is packed and waiting for your delivery partner.`,
  }),
  picked_up: (r) => ({
    title: 'Order Picked Up! 🛵',
    body: `Your order from ${r} has been picked up and is on the way to you.`,
  }),
  on_the_way: (r) => ({
    title: 'Almost There! 🛵',
    body: `Your order from ${r} is on the way. Should arrive very soon!`,
  }),
  delivered: (r) => ({
    title: 'Order Delivered! 🎉',
    body: `Your food from ${r} has arrived. Enjoy your meal! ❤️`,
  }),
  cancelled: (r) => ({
    title: 'Order Cancelled',
    body: `Your order from ${r} has been cancelled. Tap to view details.`,
  }),
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;

export function useActiveOrderPoller() {
  const { activeOrder, updateOrderStatus } = useOrders();
  const { addNotification } = useNotifications();

  // Keep a ref so the interval callback always sees the latest values without
  // needing to be recreated whenever context values change.
  const activeOrderRef = useRef(activeOrder);
  const updateOrderStatusRef = useRef(updateOrderStatus);
  const addNotificationRef = useRef(addNotification);
  const prevStatusRef = useRef<OrderStatus | null>(null);

  useEffect(() => { activeOrderRef.current = activeOrder; });
  useEffect(() => { updateOrderStatusRef.current = updateOrderStatus; });
  useEffect(() => { addNotificationRef.current = addNotification; });

  useEffect(() => {
    // No active order → nothing to poll
    if (!activeOrder?.id) {
      prevStatusRef.current = null;
      return;
    }

    // Initialise prevStatus to the current known status so we don't fire a
    // spurious notification on the very first poll after mounting.
    if (prevStatusRef.current === null) {
      prevStatusRef.current = activeOrder.status;
    }

    const poll = async () => {
      const order = activeOrderRef.current;
      if (!order) return;

      // Don't keep polling delivered / cancelled orders.
      if (order.status === 'delivered' || order.status === 'cancelled') return;

      try {
        const apiOrder = await ordersApi.get(order.id);
        const newStatus = adaptOrderStatus(apiOrder.status);
        const prevStatus = prevStatusRef.current;

        if (prevStatus === newStatus) return; // no change

        // ── Status changed ────────────────────────────────────────────────
        prevStatusRef.current = newStatus;
        updateOrderStatusRef.current(order.id, newStatus);

        const copyFn = STATUS_COPY[newStatus];
        if (!copyFn) return;
        const copy = copyFn(order.restaurantName || 'The restaurant');

        // 1. In-app notification panel
        addNotificationRef.current({
          title: copy.title,
          body: copy.body,
          type: `order_${newStatus}`,
          orderId: order.id,
        });

        // 2. Local push notification (visible in system tray / lock screen)
        if (Platform.OS !== 'web') {
          Notifications.scheduleNotificationAsync({
            content: {
              title: copy.title,
              body: copy.body,
              data: { type: `order_${newStatus}`, orderId: order.id },
              sound: true,
              // Android: must target the channel we created at startup
              ...(Platform.OS === 'android' && { android: { channelId: NOTIFICATION_CHANNEL_ID } }),
            },
            trigger: null, // fire immediately
          }).catch(() => {}); // silent fail if permission not granted
        }

        // 3. Haptic feedback for the key milestones
        if (newStatus === 'delivered') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } else if (newStatus === 'cancelled') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
      } catch {
        // Network / server error — silently skip this poll cycle
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    // Run once immediately so the first notification fires within seconds of
    // the status changing, not up to 15 s later.
    poll();

    return () => clearInterval(timer);
  }, [activeOrder?.id]); // only recreate the interval when a new order becomes active
}
