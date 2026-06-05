import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsApi } from '@/lib/api';

const NOTIFICATIONS_STORAGE_KEY = 'ruchify_notifications_v1';
const CLEARED_AT_KEY = 'ruchify_notifications_cleared_at';
const MAX_STORED_NOTIFICATIONS = 50;

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type?: string;
  orderId?: string;
  receivedAt: number;
  read: boolean;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  panelVisible: boolean;
  openPanel: () => void;
  closePanel: () => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'receivedAt' | 'read'>) => void;
  markAllRead: () => void;
  clearAll: () => void;
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  // Tracks when the user last hit "Clear all" — server notifs older than this are suppressed
  const clearedAtRef = useRef<number>(0);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY),
      AsyncStorage.getItem(CLEARED_AT_KEY),
    ])
      .then(([raw, clearedRaw]) => {
        if (clearedRaw) clearedAtRef.current = Number(clearedRaw);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setNotifications(parsed);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await notificationsApi.list({ limit: 50, offset: 0 });
      if (!response?.items?.length) return;
      const cutoff = clearedAtRef.current;
      const serverNotifs: AppNotification[] = response.items
        .map((n) => ({
          id: `srv-${n.id}`,
          title: n.title || 'Notification',
          body: n.body || '',
          type: n.eventType,
          orderId: n.data?.orderId != null ? String(n.data.orderId) : undefined,
          receivedAt: new Date(n.createdAt).getTime(),
          read: !!n.readAt,
        }))
        // Drop any notification the user has already cleared
        .filter((n) => n.receivedAt > cutoff);

      setNotifications((prev) => {
        const serverIds = new Set(serverNotifs.map((n) => n.id));
        const localOnly = prev.filter((n) => !n.id.startsWith('srv-') && !serverIds.has(n.id));
        return [...serverNotifs, ...localOnly]
          .sort((a, b) => b.receivedAt - a.receivedAt)
          .slice(0, MAX_STORED_NOTIFICATIONS);
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!loaded) return;
    refresh();
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED_NOTIFICATIONS))).catch(() => {});
  }, [notifications, loaded]);

  const openPanel = useCallback(() => {
    setPanelVisible(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelVisible(false);
  }, []);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'receivedAt' | 'read'>) => {
    setNotifications((prev) => {
      const newNotif: AppNotification = {
        ...n,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        receivedAt: Date.now(),
        read: false,
      };
      const isDuplicate = prev.some(
        (existing) =>
          existing.type === newNotif.type &&
          existing.orderId === newNotif.orderId &&
          newNotif.receivedAt - existing.receivedAt < 30_000,
      );
      if (isDuplicate) return prev;
      return [newNotif, ...prev.slice(0, MAX_STORED_NOTIFICATIONS - 1)];
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    notificationsApi.markAllRead().catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    const now = Date.now();
    clearedAtRef.current = now;
    setNotifications([]);
    AsyncStorage.multiSet([
      [NOTIFICATIONS_STORAGE_KEY, '[]'],
      [CLEARED_AT_KEY, String(now)],
    ]).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider value={{
      notifications, unreadCount, panelVisible,
      openPanel, closePanel,
      addNotification, markAllRead, clearAll, refresh,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
