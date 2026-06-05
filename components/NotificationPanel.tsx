import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useNotifications } from '@/context/NotificationsContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function NotificationPanel() {
  const { notifications, panelVisible, closePanel, clearAll, markAllRead } = useNotifications();

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (panelVisible) {
      markAllRead();
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 3,
        speed: 14,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [panelVisible]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 1, 1],
  });

  if (!panelVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={closePanel} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheetWrap, { transform: [{ translateY }] }]} pointerEvents="box-none">
        <View style={styles.sheet} pointerEvents="auto">
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="notifications" size={20} color={Colors.primary} />
              <Text style={styles.headerTitle}>Notifications</Text>
            </View>
            <View style={styles.headerRight}>
              {notifications.length > 0 && (
                <Pressable style={styles.clearBtn} onPress={clearAll}>
                  <Text style={styles.clearBtnText}>Clear all</Text>
                </Pressable>
              )}
              <Pressable style={styles.closeBtn} onPress={closePanel}>
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={38} color={Colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>Order updates will appear here</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
            >
              {notifications.map((n) => {
                const isDelivered = n.type?.includes('deliver');
                const isCancelled = n.type?.includes('cancel');
                const isPromo = n.type === 'promo' || n.type === 'offer_promotion';
                const iconName: any = isDelivered
                  ? 'checkmark-circle'
                  : isCancelled
                  ? 'close-circle'
                  : isPromo
                  ? 'pricetag'
                  : 'receipt-outline';
                const iconColor = isDelivered
                  ? Colors.success
                  : isCancelled
                  ? Colors.error
                  : Colors.primary;
                const iconBg = isDelivered
                  ? Colors.success + '22'
                  : isCancelled
                  ? Colors.error + '22'
                  : Colors.primary + '18';

                return (
                  <Pressable
                    key={n.id}
                    style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                    onPress={() => {
                      closePanel();
                      if (n.orderId) {
                        setTimeout(
                          () => router.push({ pathname: '/tracking/[id]', params: { id: n.orderId } }),
                          250,
                        );
                      }
                    }}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                      <Ionicons name={iconName} size={20} color={iconColor} />
                    </View>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{n.title}</Text>
                      {!!n.body && (
                        <Text style={styles.itemBody} numberOfLines={2}>{n.body}</Text>
                      )}
                      <Text style={styles.itemTime}>
                        {new Date(n.receivedAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit', minute: '2-digit', hour12: true,
                        })}
                        {' · '}
                        {new Date(n.receivedAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short',
                        })}
                      </Text>
                    </View>
                    {!!n.orderId && (
                      <Ionicons name="chevron-forward" size={15} color={Colors.textLight} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '82%',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 30,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    color: '#1A1A2E',
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
  },
  clearBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.primary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 52,
    gap: 10,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#1A1A2E',
  },
  emptySubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#9CA3AF',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  itemPressed: {
    backgroundColor: '#F3F4F6',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#1A1A2E',
  },
  itemBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  itemTime: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
