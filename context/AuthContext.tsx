import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, storeTokens, clearTokens, getStoredTokens, type AuthUser, type AuthResponse } from '@/lib/api';
import { registerDeviceForPush, unregisterDeviceForPush } from '@/hooks/usePushNotifications';

const USER_KEY = '@foodrush_user';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    city?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // ── Login OTP flow ──────────────────────────────────────────────────────────
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  // ── Registration OTP flow (3-step) ──────────────────────────────────────────
  sendRegisterOtp: (phone: string) => Promise<void>;
  verifyRegisterOtp: (phone: string, otp: string) => Promise<void>;
  completeRegistration: (data: { name: string; email?: string; city?: string }) => Promise<AuthUser>;
  // ── Misc ────────────────────────────────────────────────────────────────────
  finalizeDeferredLogin: () => Promise<AuthUser | null>;
  updateUser: (data: Partial<AuthUser>) => void;
  sendEmailOtp: () => Promise<void>;
  verifyEmailOtp: (otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistAuthResponse(response: AuthResponse): Promise<void> {
  await storeTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pendingAuthRef = useRef<AuthResponse | null>(null);
  /** In-memory only — never persisted. Cleared after completeRegistration or app kill. */
  const registrationTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Restore user from storage and verify token is still valid
    (async () => {
      try {
        const data = await AsyncStorage.getItem(USER_KEY);
        const tokens = await getStoredTokens();
        if (data && tokens) {
          setUser(JSON.parse(data));
          // Silently try to refresh profile in background
          authApi.me().then((fresh) => {
            setUser(fresh);
            AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
          }).catch(() => {});
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    await persistAuthResponse(response);
    setUser(response.user);
    registerDeviceForPush();
  }, []);

  const register = useCallback(async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    city?: string;
  }) => {
    const response = await authApi.register({ ...data, role: 'customer' });
    await persistAuthResponse(response);
    setUser(response.user);
    registerDeviceForPush();
  }, []);

  const logout = useCallback(async () => {
    await unregisterDeviceForPush();
    try {
      await authApi.logout();
    } catch {}
    await clearTokens();
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await authApi.me();
      setUser(fresh);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
    } catch {}
  }, []);

  // ── Login OTP flow ──────────────────────────────────────────────────────────
  const sendOtp = useCallback(async (phone: string) => {
    await authApi.sendOtp(phone);
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string): Promise<void> => {
    const response = await authApi.verifyOtp(phone, otp);
    if (response.isNewUser) {
      // Backend auto-created a new user via the login endpoint — reject login
      const err: any = new Error('No account found. Please register first.');
      err.code = 'not_registered';
      throw err;
    }
    if (response.user.role !== 'customer') {
      // Rider / restaurant owner trying to log in to the customer app
      const err: any = new Error('This account is not a customer account. Please use the correct app.');
      err.code = 'wrong_role';
      throw err;
    }
    await persistAuthResponse(response);
    setUser(response.user);
    registerDeviceForPush();
  }, []);

  // ── Registration OTP flow (3-step) ──────────────────────────────────────────
  const sendRegisterOtp = useCallback(async (phone: string) => {
    await authApi.sendRegisterOtp(phone);
  }, []);

  const verifyRegisterOtp = useCallback(async (phone: string, otp: string): Promise<void> => {
    const result = await authApi.verifyRegisterOtp(phone, otp);
    // Store in memory ONLY — never persist
    registrationTokenRef.current = result.registrationToken;
  }, []);

  const completeRegistration = useCallback(async (data: { name: string; email?: string; city?: string }): Promise<AuthUser> => {
    const token = registrationTokenRef.current;
    if (!token) {
      const err: any = new Error('Registration session expired. Please start over.');
      err.code = 'session_expired';
      throw err;
    }
    const response = await authApi.completeRegistration({
      registrationToken: token,
      ...data,
    });
    registrationTokenRef.current = null;
    if (response.user.role !== 'customer') {
      const err: any = new Error('This account is not a customer account.');
      err.code = 'wrong_role';
      throw err;
    }
    await persistAuthResponse(response);
    setUser(response.user);
    registerDeviceForPush();
    return response.user;
  }, []);

  const finalizeDeferredLogin = useCallback(async (): Promise<AuthUser | null> => {
    const pending = pendingAuthRef.current;
    if (pending) {
      await persistAuthResponse(pending);
      setUser(pending.user);
      pendingAuthRef.current = null;
      registerDeviceForPush();
      return pending.user;
    }
    return null;
  }, []);

  const updateUser = useCallback((data: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const sendEmailOtp = useCallback(async () => {
    await authApi.sendEmailOtp();
  }, []);

  const verifyEmailOtp = useCallback(async (otp: string) => {
    await authApi.verifyEmailOtp(otp);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, refreshUser, sendOtp, verifyOtp, sendRegisterOtp, verifyRegisterOtp, completeRegistration, finalizeDeferredLogin, updateUser, sendEmailOtp, verifyEmailOtp }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
