import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, type AppColors } from '@/constants/colors';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = '@ruchify_theme_mode';

interface ThemeContextValue {
  /** The user's saved preference: 'light' | 'dark' | 'system' */
  theme: ThemeMode;
  /** Persist the user's choice to AsyncStorage */
  setTheme: (mode: ThemeMode) => Promise<void>;
  /** The resolved color palette for the current effective theme */
  colors: AppColors;
  /** True when the effective theme is dark */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [theme, setThemeState] = useState<ThemeMode>('system');

  // Load persisted preference once on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((val) => {
        if (val === 'light' || val === 'dark' || val === 'system') {
          setThemeState(val);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  };

  const isDark =
    theme === 'dark' || (theme === 'system' && systemScheme === 'dark');

  const colors: AppColors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
