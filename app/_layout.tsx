import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import NotificationPanel from "@/components/NotificationPanel";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PermissionsScreen } from "@/components/PermissionsScreen";
import { Toast } from "@/components/Toast";
import { useToast } from "@/components/Toast";
import { queryClient } from "@/lib/query-client";
import { CartProvider } from "@/context/CartContext";
import { OrderProvider } from "@/context/OrderContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationsProvider, useNotifications } from "@/context/NotificationsContext";
import { useAppPermissions } from "@/hooks/useAppPermissions";
import { registerDeviceForPush, ensureNotificationChannel } from "@/hooks/usePushNotifications";
import { useActiveOrderPoller } from "@/hooks/useActiveOrderPoller";
import { notificationsApi } from "@/lib/api";
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Platform } from "react-native";

SplashScreen.preventAutoHideAsync();

// Create the Android notification channel as early as possible.
// Must exist before the first notification (local or remote) arrives.
// No-ops on iOS and web.
ensureNotificationChannel();

// Show foreground notifications as both system banners AND our in-app Toast.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Navigate to the appropriate screen based on the notification data fields.
 *
 * The backend sends:  data.eventType  (e.g. "order_accepted")
 * Local notifications send: data.type (same values, from our own poller)
 * We read both so either source works.
 */
function handleNotificationNavigation(
  response: Notifications.NotificationResponse,
  router: ReturnType<typeof useRouter>,
) {
  const data = response.notification.request.content.data as Record<string, string> | null;
  if (!data) return;

  // Backend uses `eventType`; our local notifications use `type` — handle both.
  const eventType = data.eventType || data.type;
  const orderId = data.orderId;

  switch (eventType) {
    // All order-lifecycle events deep-link to the tracking screen
    case 'order_placed':
    case 'order_accepted':
    case 'order_preparing':
    case 'order_ready':
    case 'order_picked_up':
    case 'order_on_the_way':
    case 'order_delivered':
    case 'order_cancelled':
    // Legacy server-sent types
    case 'rider_assigned':
    case 'order_out_for_delivery':
      if (orderId) router.push({ pathname: '/tracking/[id]', params: { id: orderId } });
      break;
    case 'offer_promotion':
    case 'promo':
      router.push('/(tabs)');
      break;
    // ad_banner_reload — silent, no navigation
  }
  // Clear badge count whenever the user taps any notification
  Notifications.setBadgeCountAsync(0).catch(() => {});
}

function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup && segments[1] !== 'register-details') {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments]);

  return null;
}

function RootLayoutNav() {
  const router = useRouter();
  const { show: showToast, toastProps } = useToast();
  const { user } = useAuth();
  const { addNotification, refresh: refreshNotifications } = useNotifications();

  // Global order-status poller — fires in-app + local push notifications for
  // every status transition, regardless of which screen the user is on.
  useActiveOrderPoller();

  // Re-fetch server notifications whenever the user logs in (or on first mount
  // if already authenticated) so the bell panel is never empty.
  useEffect(() => {
    if (user) refreshNotifications();
  }, [user?.id]);

  useEffect(() => {
    // Re-register device token on every app start (catches token rotations)
    if (user) {
      registerDeviceForPush();
    }

    // Handle notification tap when app was in killed state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationNavigation(response, router);
    });

    // Foreground: show in-app toast + store in notification panel.
    // Backend sends data.eventType; local notifications send data.type — read both.
    const fgSub = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? '';
      const body = notification.request.content.body ?? '';
      const data = notification.request.content.data as Record<string, string> | null;
      showToast(body || title || 'New notification', 'info', 4000);
      addNotification({
        title: title || 'Notification',
        body: body || '',
        type: data?.eventType || data?.type,
        orderId: data?.orderId,
      });
    });

    // Background / tapped: store in notification panel AND deep-link.
    // The foreground listener fires for in-app notifications, but background
    // notifications only arrive here when the user taps them, so we must
    // explicitly add them to the in-app panel here.
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const title = response.notification.request.content.title ?? '';
      const body = response.notification.request.content.body ?? '';
      const data = response.notification.request.content.data as Record<string, string> | null;
      if (title) {
        addNotification({
          title,
          body: body || '',
          type: data?.eventType || data?.type,
          orderId: data?.orderId,
        });
      }
      handleNotificationNavigation(response, router);
    });

    // FCM token rotation: re-register with backend whenever the token changes
    const tokenSub = Notifications.addPushTokenListener(async (tokenData) => {
      if (!user || Platform.OS === 'web') return;
      try {
        await notificationsApi.registerDevice({
          pushToken: tokenData.data as string,
          platform: Platform.OS as 'ios' | 'android',
        });
      } catch {}
    });

    return () => {
      fgSub.remove();
      tapSub.remove();
      tokenSub.remove();
    };
  }, [user?.id]);

  return (
    <View style={{ flex: 1 }}>
      <AuthGuard />
      <Toast {...toastProps} />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="tracking/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="checkout" options={{ headerShown: false }} />
      </Stack>
      {/* Rendered at root level so it always appears above tabs, header, everything */}
      <NotificationPanel />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const { permissionsRequested, requestPermissions, skipPermissions } = useAppPermissions();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || permissionsRequested === null) return null;

  if (!permissionsRequested) {
    return (
      <PermissionsScreen
        onGranted={requestPermissions}
        onSkip={skipPermissions}
      />
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <AuthProvider>
              <CartProvider>
                <OrderProvider>
                  <NotificationsProvider>
                    <RootLayoutNav />
                  </NotificationsProvider>
                </OrderProvider>
              </CartProvider>
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
