import React from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { ordersApi, type ApiOrder } from '@/lib/api';
import { adaptOrderStatus } from '@/lib/adapters';
import AppHeader from '@/components/AppHeader';

const statusLabels: Record<string, string> = {
  placed: 'Order Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  picked_up: 'Picked Up',
  on_the_way: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const statusColors: Record<string, string> = {
  placed: Colors.warning,
  accepted: '#F97316',
  preparing: '#F97316',
  ready: '#8B5CF6',
  picked_up: '#6366F1',
  on_the_way: '#3B82F6',
  delivered: Colors.success,
  cancelled: Colors.error,
};

function OrderCard({ order }: { order: ApiOrder }) {
  const localStatus = adaptOrderStatus(order.status);
  const isActive = order.status !== 'delivered' && order.status !== 'cancelled';
  const date = new Date(order.createdAt);
  const formattedDate = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  const statusColor = statusColors[order.status] || Colors.textSecondary;

  return (
    <Pressable
      style={({ pressed }) => [styles.orderCard, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.push({ pathname: '/tracking/[id]', params: { id: String(order.id) } });
      }}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderRestaurant}>Order #{order.id}</Text>
          <Text style={styles.orderDate}>{formattedDate}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusLabels[order.status] ?? order.status}
          </Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        {order.items.slice(0, 3).map((item, i) => (
          <Text key={i} style={styles.orderItemText} numberOfLines={1}>
            {item.quantity}x {item.name}
          </Text>
        ))}
        {order.items.length > 3 && (
          <Text style={styles.moreItems}>+{order.items.length - 3} more items</Text>
        )}
        <Text style={styles.orderAddress} numberOfLines={1}>{order.deliveryAddress}</Text>
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>₹{parseFloat(order.total).toFixed(0)}</Text>
        <View style={styles.trackButton}>
          <Text style={styles.trackButtonText}>{isActive ? 'Track Order' : 'View Details'}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FAFAFA' }}>
      <Ionicons name="alert-circle-outline" size={52} color="#DDD" />
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: '#333', marginTop: 16, textAlign: 'center' }}>Couldn't load orders</Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' }}>Tap Retry to reload</Text>
      <Pressable onPress={retry} style={{ marginTop: 24, backgroundColor: '#FF6B35', paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 }}>
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' }}>Retry</Text>
      </Pressable>
    </View>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const { user } = useAuth();

  const { data: allOrders, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: () => ordersApi.list(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    select: (data) => data
      .filter((o) => o.customerId === user?.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  });
  const orders = allOrders;

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.authPrompt]}>
        <AppHeader title="My Orders" />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={56} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>Sign in to view orders</Text>
            <Text style={styles.emptySubtext}>Your order history will appear here after you sign in</Text>
            <Pressable style={styles.browseButton} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.browseButtonText}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="My Orders" />

      {isLoading ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        </ScrollView>
      ) : isError ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>Could not load orders</Text>
            <Pressable style={styles.browseButton} onPress={() => refetch()}>
              <Text style={styles.browseButtonText}>Retry</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={orders ?? []}
          renderItem={({ item }) => <OrderCard order={item} />}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtext}>Your order history will appear here</Text>
              <Pressable style={styles.browseButton} onPress={() => router.navigate('/(tabs)/')}>
                <Text style={styles.browseButtonText}>Browse Restaurants</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  authPrompt: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
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
  orderAddress: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
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
