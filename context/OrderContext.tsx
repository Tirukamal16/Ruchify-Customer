import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { CartItem } from './CartContext';

export type OrderStatus = 'placed' | 'preparing' | 'picked_up' | 'on_the_way' | 'delivered';

export interface Order {
  id: string;
  restaurantName: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  estimatedDelivery: string;
  address: string;
  paymentMethod: string;
}

interface OrderContextValue {
  orders: Order[];
  activeOrder: Order | null;
  placeOrder: (params: {
    restaurantName: string;
    items: CartItem[];
    subtotal: number;
    deliveryFee: number;
    tax: number;
    discount: number;
    total: number;
    address: string;
    paymentMethod: string;
  }) => Order;
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

  const placeOrder = useCallback((params: {
    restaurantName: string;
    items: CartItem[];
    subtotal: number;
    deliveryFee: number;
    tax: number;
    discount: number;
    total: number;
    address: string;
    paymentMethod: string;
  }) => {
    const order: Order = {
      id: Crypto.randomUUID().slice(0, 8).toUpperCase(),
      ...params,
      status: 'placed',
      createdAt: new Date().toISOString(),
      estimatedDelivery: `${25 + Math.floor(Math.random() * 20)} min`,
    };
    const newOrders = [order, ...orders];
    setOrders(newOrders);
    saveOrders(newOrders);
    return order;
  }, [orders, saveOrders]);

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
    return orders.find((o) => o.status !== 'delivered') || null;
  }, [orders]);

  const value = useMemo(() => ({
    orders, activeOrder, placeOrder, updateOrderStatus, getOrder,
  }), [orders, activeOrder, placeOrder, updateOrderStatus, getOrder]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrders must be used within OrderProvider');
  return context;
}
