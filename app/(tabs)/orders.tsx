import React from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useOrders, type Order } from '@/context/OrderContext';

const statusLabels: Record<string, string> = {
  placed: 'Order Placed',
  preparing: 'Preparing',
  picked_up: 'Picked Up',
  on_the_way: 'On the Way',
  delivered: 'Delivered',
};

const statusColors: Record<string, string> = {
  placed: Colors.warning,
  preparing: '#F97316',
  picked_up: '#6366F1',
  on_the_way: '#3B82F6',
  delivered: Colors.success,
};

function OrderCard({ order }: { order: Order }) {
  const isActive = order.status !== 'delivered';
  const date = new Date(order.createdAt);
  const formattedDate = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.orderCard, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isActive) {
          router.push({ pathname: '/tracking/[id]', params: { id: order.id } });
        }
      }}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderRestaurant}>{order.restaurantName}</Text>
          <Text style={styles.orderDate}>{formattedDate}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[order.status] }]} />
          <Text style={[styles.statusText, { color: statusColors[order.status] }]}>
            {statusLabels[order.status]}
          </Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        {order.items.slice(0, 3).map((item, i) => (
          <Text key={i} style={styles.orderItemText} numberOfLines={1}>
            {item.quantity}x {item.menuItem.name}
          </Text>
        ))}
        {order.items.length > 3 && (
          <Text style={styles.moreItems}>+{order.items.length - 3} more items</Text>
        )}
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
        {isActive ? (
          <View style={styles.trackButton}>
            <Text style={styles.trackButtonText}>Track Order</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        ) : (
          <Text style={styles.orderIdText}>#{order.id}</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Text style={styles.headerTitle}>My Orders</Text>
      <FlatList
        data={orders}
        renderItem={({ item }) => <OrderCard order={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!orders.length}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={56} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtext}>Your order history will appear here</Text>
            <Pressable
              style={styles.browseButton}
              onPress={() => router.push('/(tabs)')}
            >
              <Text style={styles.browseButtonText}>Browse Restaurants</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderRestaurant: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  orderDate: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
  },
  orderItems: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 4,
  },
  orderItemText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  moreItems: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.textLight,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  orderTotal: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },
  orderIdText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.textLight,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: Colors.text,
    marginTop: 8,
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
});
