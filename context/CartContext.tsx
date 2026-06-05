import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MenuItem, Restaurant } from '@/data/restaurants';

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

interface CartContextValue {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  restaurantApiId: number | null;
  addItem: (item: MenuItem, restaurant: Restaurant) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateInstructions: (itemId: string, instructions: string) => void;
  clearCart: () => void;
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = '@foodrush_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [restaurantApiId, setRestaurantApiId] = useState<number | null>(null);
  const [couponCode, setCouponCodeState] = useState<string | null>(null);
  const [orderNotes, setOrderNotesState] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY).then((data) => {
      if (data) {
        const parsed = JSON.parse(data);
        setItems(parsed.items || []);
        setRestaurantId(parsed.restaurantId || null);
        setRestaurantName(parsed.restaurantName || null);
        setRestaurantApiId(parsed.restaurantApiId ?? null);
        setCouponCodeState(parsed.couponCode || null);
        setOrderNotesState(parsed.orderNotes || '');
      }
    });
  }, []);

  const saveCart = useCallback((
    newItems: CartItem[],
    restId: string | null,
    restName: string | null,
    restApiId: number | null,
    coupon: string | null,
    notes?: string,
  ) => {
    AsyncStorage.setItem(CART_KEY, JSON.stringify({
      items: newItems,
      restaurantId: restId,
      restaurantName: restName,
      restaurantApiId: restApiId,
      couponCode: coupon,
      orderNotes: notes ?? '',
    }));
  }, []);

  const addItem = useCallback((item: MenuItem, restaurant: Restaurant) => {
    setItems((prev) => {
      const apiId = parseInt(restaurant.id, 10) || null;
      if (restaurantId && restaurantId !== restaurant.id) {
        const newItems = [{ menuItem: item, quantity: 1 }];
        setRestaurantId(restaurant.id);
        setRestaurantName(restaurant.name);
        setRestaurantApiId(apiId);
        setCouponCodeState(null);
        saveCart(newItems, restaurant.id, restaurant.name, apiId, null);
        return newItems;
      }
      if (!restaurantId) {
        setRestaurantId(restaurant.id);
        setRestaurantName(restaurant.name);
        setRestaurantApiId(apiId);
      }
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      let newItems: CartItem[];
      if (existing) {
        newItems = prev.map((ci) => ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      } else {
        newItems = [...prev, { menuItem: item, quantity: 1 }];
      }
      saveCart(newItems, restaurant.id, restaurant.name, parseInt(restaurant.id, 10) || null, couponCode);
      return newItems;
    });
  }, [restaurantId, couponCode, saveCart]);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const newItems = prev.filter((ci) => ci.menuItem.id !== itemId);
      if (newItems.length === 0) {
        setRestaurantId(null);
        setRestaurantName(null);
        setRestaurantApiId(null);
        setCouponCodeState(null);
        saveCart([], null, null, null, null);
      } else {
        saveCart(newItems, restaurantId, restaurantName, restaurantApiId, couponCode);
      }
      return newItems;
    });
  }, [restaurantId, restaurantName, restaurantApiId, couponCode, saveCart]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) => {
      const newItems = prev.map((ci) => ci.menuItem.id === itemId ? { ...ci, quantity } : ci);
      saveCart(newItems, restaurantId, restaurantName, restaurantApiId, couponCode);
      return newItems;
    });
  }, [restaurantId, restaurantName, restaurantApiId, couponCode, removeItem, saveCart]);

  const updateInstructions = useCallback((itemId: string, instructions: string) => {
    setItems((prev) => {
      const newItems = prev.map((ci) => ci.menuItem.id === itemId ? { ...ci, specialInstructions: instructions } : ci);
      saveCart(newItems, restaurantId, restaurantName, restaurantApiId, couponCode);
      return newItems;
    });
  }, [restaurantId, restaurantName, restaurantApiId, couponCode, saveCart]);

  const setCouponCode = useCallback((code: string | null) => {
    setCouponCodeState(code);
    AsyncStorage.getItem(CART_KEY).then((raw) => {
      const parsed = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(CART_KEY, JSON.stringify({ ...parsed, couponCode: code }));
    });
  }, []);

  const setOrderNotes = useCallback((notes: string) => {
    setOrderNotesState(notes);
    AsyncStorage.getItem(CART_KEY).then((raw) => {
      const parsed = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(CART_KEY, JSON.stringify({ ...parsed, orderNotes: notes }));
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setRestaurantId(null);
    setRestaurantName(null);
    setRestaurantApiId(null);
    setCouponCodeState(null);
    setOrderNotesState('');
    AsyncStorage.removeItem(CART_KEY);
  }, []);

  const subtotal = useMemo(() => items.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, ci) => sum + ci.quantity, 0), [items]);

  const value = useMemo(() => ({
    items, restaurantId, restaurantName, restaurantApiId,
    addItem, removeItem, updateQuantity, updateInstructions, clearCart,
    couponCode, setCouponCode,
    orderNotes, setOrderNotes,
    subtotal, itemCount,
  }), [items, restaurantId, restaurantName, restaurantApiId,
    addItem, removeItem, updateQuantity, updateInstructions, clearCart,
    couponCode, setCouponCode,
    orderNotes, setOrderNotes,
    subtotal, itemCount]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
