import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationsApi } from '@/lib/api';

/**
 * The notification channel ID used for all order-related notifications.
 *
 * MUST match the channelId the backend sends inside the FCM android payload:
 *   message.android.notification.channelId = "default"
 *
 * Android 8+ (API 26) silently drops any notification whose channelId does
 * not match a channel that exists on the device.
 */
export const NOTIFICATION_CHANNEL_ID = 'default';

/**
 * Create the Android notification channel.
 * Safe to call multiple times — Android is idempotent about channel creation.
 * Called once at app startup (see _layout.tsx) so both local scheduled
 * notifications and remote FCM pushes have a channel to land in.
 */
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Order Updates',
    description: 'Real-time updates for your Ruchify orders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#C8281A',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Request permission, ensure the Android channel exists, then register the
 * FCM / APNs device token with the backend.
 * Safe to call on every login — silently no-ops in Expo Go or on simulators.
 */
export async function registerDeviceForPush(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    // Always ensure the channel exists before anything else (Android only).
    await ensureNotificationChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const pushToken = tokenData.data as string;
    const platform = Platform.OS as 'ios' | 'android';

    await notificationsApi.registerDevice({ pushToken, platform });
  } catch {
    // Silently ignore — Expo Go, simulator, or no network
  }
}

/**
 * Unregister the current device token from the backend on logout.
 */
export async function unregisterDeviceForPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    await notificationsApi.unregisterDevice(tokenData.data as string);
  } catch {
    // Silently ignore — backend auto-removes stale tokens on FCM rejection anyway
  }
}
