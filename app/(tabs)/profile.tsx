import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const PROFILE_KEY = '@foodrush_profile';

interface ProfileData {
  name: string;
  phone: string;
  email: string;
  address: string;
}

function ProfileField({ icon, label, value, onChangeText }: {
  icon: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldIcon}>
        <Ionicons name={icon as any} size={18} color={Colors.primary} />
      </View>
      <View style={styles.fieldContent}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={Colors.textLight}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      </View>
    </View>
  );
}

function MenuItem({ icon, label, subtitle, onPress, danger }: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, danger && { backgroundColor: Colors.error + '12' }]}>
        <Ionicons name={icon as any} size={18} color={danger ? Colors.error : Colors.textSecondary} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, danger && { color: Colors.error }]}>{label}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [profile, setProfile] = useState<ProfileData>({
    name: 'John Doe',
    phone: '+1 234 567 8900',
    email: 'john@example.com',
    address: '123 Main Street, Downtown',
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((data) => {
      if (data) setProfile(JSON.parse(data));
    });
  }, []);

  const saveProfile = () => {
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const updateField = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable onPress={() => editing ? saveProfile() : setEditing(true)}>
            <Ionicons name={editing ? "checkmark" : "create-outline"} size={22} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.avatarName}>{profile.name}</Text>
          <Text style={styles.avatarEmail}>{profile.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          {editing ? (
            <View style={styles.editFields}>
              <ProfileField icon="person-outline" label="Name" value={profile.name} onChangeText={(v) => updateField('name', v)} />
              <ProfileField icon="call-outline" label="Phone" value={profile.phone} onChangeText={(v) => updateField('phone', v)} />
              <ProfileField icon="mail-outline" label="Email" value={profile.email} onChangeText={(v) => updateField('email', v)} />
              <ProfileField icon="location-outline" label="Address" value={profile.address} onChangeText={(v) => updateField('address', v)} />
            </View>
          ) : (
            <View style={styles.infoCards}>
              <View style={styles.infoCard}>
                <Ionicons name="call-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.infoText}>{profile.phone}</Text>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.infoText}>{profile.address}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.menuGroup}>
            <MenuItem icon="notifications-outline" label="Notifications" subtitle="Manage notification preferences" />
            <MenuItem icon="card-outline" label="Payment Methods" subtitle="Add or manage payment methods" />
            <MenuItem icon="location-outline" label="Saved Addresses" subtitle="Manage delivery addresses" />
            <MenuItem icon="help-circle-outline" label="Help & Support" subtitle="Get help with your orders" />
            <MenuItem icon="document-text-outline" label="Terms & Conditions" />
            <MenuItem icon="shield-checkmark-outline" label="Privacy Policy" />
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            style={styles.logoutButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Log Out', 'Are you sure you want to log out?');
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>

        <Text style={styles.version}>FoodRush v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: Colors.text,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: Colors.text,
  },
  avatarEmail: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  editFields: {
    gap: 10,
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textLight,
  },
  fieldInput: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.text,
    padding: 0,
    marginTop: 2,
  },
  infoCards: {
    gap: 10,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  menuGroup: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.text,
  },
  menuSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.error + '0D',
    paddingVertical: 14,
    borderRadius: 14,
  },
  logoutText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.error,
  },
  version: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
});
