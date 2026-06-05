import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem } from './CartContext';

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;           // API numeric id as string (or local short UUID for offline)
  restaurantName: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  packingCharges?: number;
  platformFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  estimatedDelivery: string;
  address: string;
  paymentMethod: string;
  notes?: string;
}

interface OrderContextValue {
  orders: Order[];
  activeOrder: Order | null;
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  getOrder: (orderId: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextValue | null>(null);
const ORDERS_KEY = '@foodrush_orders';

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(ORDERS_KEY).then((data) => {
      if (data) setOrders(JSON.parse(data));
    });
  }, []);

  const saveOrders = useCallback((newOrders: Order[]) => {
    AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(newOrders));
  }, []);

  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => {
      const newOrders = [order, ...prev];
      saveOrders(newOrders);
      return newOrders;
    });
  }, [saveOrders]);

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) => {
      const newOrders = prev.map((o) => o.id === orderId ? { ...o, status } : o);
      saveOrders(newOrders);
      return newOrders;
    });
  }, [saveOrders]);

  const getOrder = useCallback((orderId: string) => {
    return orders.find((o) => o.id === orderId);
  }, [orders]);

  const activeOrder = useMemo(() => {
    return orders.find((o) => o.status !== 'delivered' && o.status !== 'cancelled') || null;
  }, [orders]);

  const value = useMemo(() => ({
    orders, activeOrder, addOrder, updateOrderStatus, getOrder,
  }), [orders, activeOrder, addOrder, updateOrderStatus, getOrder]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrders must be used within OrderProvider');
  return context;
}
