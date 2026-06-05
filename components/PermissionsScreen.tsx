import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

type Permission = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
};

const PERMISSIONS: Permission[] = [
  {
    icon: 'location-on',
    title: 'Location',
    description: 'Find restaurants near you and track your delivery in real time.',
  },
  {
    icon: 'notifications',
    title: 'Notifications',
    description: 'Get live updates on your order status and exclusive offers.',
  },
];

type Props = {
  onGranted: () => Promise<void>;
  onSkip: () => Promise<void>;
};

export function PermissionsScreen({ onGranted, onSkip }: Props) {
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, []);

  const handleGrant = async () => {
    setLoading(true);
    await onGranted();
    setLoading(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.inner}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="restaurant" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Ruchify</Text>
          <Text style={styles.subtitle}>Allow these permissions for the best experience.</Text>
        </View>

        {/* Permission list */}
        <View style={styles.list}>
          {PERMISSIONS.map((perm) => (
            <View key={perm.title} style={styles.permissionRow}>
              <View style={styles.iconBadge}>
                <MaterialIcons name={perm.icon} size={22} color={Colors.primary} />
              </View>
              <View style={styles.permissionText}>
                <Text style={styles.permTitle}>{perm.title}</Text>
                <Text style={styles.permDesc}>{perm.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.grantButton}
            onPress={handleGrant}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.grantText}>Allow Permissions</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>You can change these anytime in Settings.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    gap: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFF0EE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  permissionText: {
    flex: 1,
  },
  permTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  permDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
  grantButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  grantText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  skipButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  note: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    textAlign: 'center',
  },
});
