import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

interface AppHeaderProps {
  title?: string;
  right?: React.ReactNode;
  hideLeft?: boolean;
  /** Pass children to render below the logo row (e.g. location row on Home) */
  children?: React.ReactNode;
}

export default function AppHeader({ title, right, hideLeft, children }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.bar}>
        {!hideLeft && (
          <View style={styles.left}>
            <Image
              source={require('@/assets/images/logo.jpeg')}
              style={styles.logo}
              resizeMode="cover"
            />
            <Text style={styles.brandName}>Ruchify</Text>
          </View>
        )}

        {title ? (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        ) : null}

        <View style={[styles.right, hideLeft && styles.rightFull]}>
          {right ?? null}
        </View>
      </View>

      {children ? <View style={styles.below}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  title: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: Colors.text,
    marginLeft: 12,
  },
  right: {
    marginLeft: 'auto',
  },
  rightFull: {
    flex: 1,
    marginLeft: 0,
  },
  below: {
    paddingTop: 6,
    paddingBottom: 2,
  },
});
