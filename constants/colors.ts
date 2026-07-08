export const lightColors = {
  primary: '#FF4B3A',
  primaryDark: '#E63E2E',
  primaryLight: '#FF6B5A',
  secondary: '#FFC529',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F5',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  star: '#FFB800',
  overlay: 'rgba(0,0,0,0.5)',
  cardShadow: 'rgba(0,0,0,0.08)',
};

export const darkColors = {
  primary: '#FF4B3A',
  primaryDark: '#E63E2E',
  primaryLight: '#FF6B5A',
  secondary: '#FFC529',
  background: '#0F0F0F',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  text: '#F2F2F7',
  textSecondary: '#AEAEB2',
  textLight: '#8E8E93',
  border: '#48484A',
  borderLight: '#38383A',
  success: '#30D158',
  warning: '#FFD60A',
  error: '#FF453A',
  star: '#FFD60A',
  overlay: 'rgba(0,0,0,0.7)',
  cardShadow: 'rgba(0,0,0,0.3)',
};

export type AppColors = typeof lightColors;

// Default export keeps the light palette so every existing file that does
// `import Colors from '@/constants/colors'` continues to work unchanged.
// Screens that want live dark-mode support should call `useTheme().colors`
// from `@/context/ThemeContext` instead.
const Colors = {
  ...lightColors,
  light: {
    text: lightColors.text,
    background: lightColors.background,
    tint: lightColors.primary,
    tabIconDefault: lightColors.textLight,
    tabIconSelected: lightColors.primary,
  },
};

export default Colors;
