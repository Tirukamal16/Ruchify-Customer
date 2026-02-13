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
  addItem: (item: MenuItem, restaurant: Restaurant) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateInstructions: (itemId: string, instructions: string) => void;
  clearCart: () => void;
  appliedCoupon: string | null;
  applyCoupon: (code: string) => void;
  removeCoupon: () => void;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_KEY = '@foodrush_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY).then((data) => {
      if (data) {
        const parsed = JSON.parse(data);
        setItems(parsed.items || []);
        setRestaurantId(parsed.restaurantId || null);
        setRestaurantName(parsed.restaurantName || null);
        setAppliedCoupon(parsed.appliedCoupon || null);
      }
    });
  }, []);

  const saveCart = useCallback((newItems: CartItem[], restId: string | null, restName: string | null, coupon: string | null) => {
    AsyncStorage.setItem(CART_KEY, JSON.stringify({ items: newItems, restaurantId: restId, restaurantName: restName, appliedCoupon: coupon }));
  }, []);

  const addItem = useCallback((item: MenuItem, restaurant: Restaurant) => {
    setItems((prev) => {
      if (restaurantId && restaurantId !== restaurant.id) {
        const newItems = [{ menuItem: item, quantity: 1 }];
        setRestaurantId(restaurant.id);
        setRestaurantName(restaurant.name);
        setAppliedCoupon(null);
        saveCart(newItems, restaurant.id, restaurant.name, null);
        return newItems;
      }
      if (!restaurantId) {
        setRestaurantId(restaurant.id);
        setRestaurantName(restaurant.name);
      }
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      let newItems: CartItem[];
      if (existing) {
        newItems = prev.map((ci) => ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      } else {
        newItems = [...prev, { menuItem: item, quantity: 1 }];
      }
      saveCart(newItems, restaurant.id, restaurant.name, appliedCoupon);
      return newItems;
    });
  }, [restaurantId, appliedCoupon, saveCart]);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const newItems = prev.filter((ci) => ci.menuItem.id !== itemId);
      if (newItems.length === 0) {
        setRestaurantId(null);
        setRestaurantName(null);
        setAppliedCoupon(null);
        saveCart([], null, null, null);
      } else {
        saveCart(newItems, restaurantId, restaurantName, appliedCoupon);
      }
      return newItems;
    });
  }, [restaurantId, restaurantName, appliedCoupon, saveCart]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) => {
      const newItems = prev.map((ci) => ci.menuItem.id === itemId ? { ...ci, quantity } : ci);
      saveCart(newItems, restaurantId, restaurantName, appliedCoupon);
      return newItems;
    });
  }, [restaurantId, restaurantName, appliedCoupon, removeItem, saveCart]);

  const updateInstructions = useCallback((itemId: string, instructions: string) => {
    setItems((prev) => {
      const newItems = prev.map((ci) => ci.menuItem.id === itemId ? { ...ci, specialInstructions: instructions } : ci);
      saveCart(newItems, restaurantId, restaurantName, appliedCoupon);
      return newItems;
    });
  }, [restaurantId, restaurantName, appliedCoupon, saveCart]);

  const clearCart = useCallback(() => {
    setItems([]);
    setRestaurantId(null);
    setRestaurantName(null);
    setAppliedCoupon(null);
    AsyncStorage.removeItem(CART_KEY);
  }, []);

  const applyCoupon = useCallback((code: string) => {
    setAppliedCoupon(code);
    saveCart(items, restaurantId, restaurantName, code);
  }, [items, restaurantId, restaurantName, saveCart]);

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    saveCart(items, restaurantId, restaurantName, null);
  }, [items, restaurantId, restaurantName, saveCart]);

  const subtotal = useMemo(() => items.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0), [items]);
  const deliveryFee = subtotal > 500 ? 0 : 49;
  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon === 'FIRST30') return Math.min(subtotal * 0.3, 75);
    if (appliedCoupon === 'RUSH20') return subtotal * 0.2;
    if (appliedCoupon === 'FREEDEL') return deliveryFee;
    return 0;
  }, [appliedCoupon, subtotal, deliveryFee]);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + deliveryFee + tax - discount;
  const itemCount = items.reduce((sum, ci) => sum + ci.quantity, 0);

  const value = useMemo(() => ({
    items, restaurantId, restaurantName, addItem, removeItem, updateQuantity,
    updateInstructions, clearCart, appliedCoupon, applyCoupon, removeCoupon,
    subtotal, deliveryFee, discount, tax, total, itemCount,
  }), [items, restaurantId, restaurantName, addItem, removeItem, updateQuantity,
    updateInstructions, clearCart, appliedCoupon, applyCoupon, removeCoupon,
    subtotal, deliveryFee, discount, tax, total, itemCount]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
