import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Platform,
  Alert, ActivityIndicator, Modal, Switch, Linking,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { authApi, addressesApi, configApi, clearTokens, type ApiCustomerAddress } from '@/lib/api';
import { Toast, useToast } from '@/components/Toast';
import MapLocationPicker, { type PickedLocation } from '@/components/MapLocationPicker';

const NOTIF_PREFS_KEY = '@ruchify_notif_prefs';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProfileField({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldIcon}>
        <Ionicons name={icon as any} size={18} color={Colors.primary} />
      </View>
      <View style={styles.fieldContent}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function MenuRow({ icon, label, subtitle, onPress, danger, rightElement }: {
  icon: string; label: string; subtitle?: string;
  onPress?: () => void; danger?: boolean; rightElement?: React.ReactNode;
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
      {rightElement ?? <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />}
    </Pressable>
  );
}

function ModalSheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: Math.max(bottom, 16) }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <KeyboardAwareScrollViewCompat
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            {children}
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const { user, isAuthenticated, isLoading, logout, refreshUser, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const { show: showToast, toastProps } = useToast();

  // Fetch support contact details from backend config
  const { data: configItems } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.list(),
    staleTime: 10 * 60 * 1000,
  });
  const supportEmail = configItems?.find((c) => c.key === 'support_email')?.value ?? 'support@ruchify.in';
  const supportPhone = configItems?.find((c) => c.key === 'support_phone')?.value ?? '9381828481';
  const appVersion = configItems?.find((c) => c.key === 'app_version')?.value ?? '1.0.8';

  // Refresh user profile on mount to ensure latest name/data
  useEffect(() => {
    refreshUser();
  }, []);

  // Modal visibility
  const [showNotif, setShowNotif]           = useState(false);
  const [showAddresses, setShowAddresses]   = useState(false);
  const [showPayment, setShowPayment]       = useState(false);
  const [showHelp, setShowHelp]             = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // ── Edit Profile ─────────────────────────────────────────────────────────
  const [editName, setEditName]   = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const openEditProfile = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    const name = editName.trim();
    const email = editEmail.trim();
    if (!name) { Alert.alert('Required', 'Name cannot be empty.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authApi.updateProfile({ name, email: email || undefined });
      updateUser(updated);
      setShowEditProfile(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Profile updated!');
    } catch (err: any) {
      Alert.alert('Error', err?.message?.replace(/^\d+:\s*/, '') || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };


  // ── Notifications ────────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    orderUpdates: true,
    promotions: true,
    offers: true,
    system: true,
  });

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREFS_KEY).then((v) => {
      if (v) setNotifPrefs(JSON.parse(v));
    });
  }, []);

  const toggleNotif = async (key: keyof typeof notifPrefs) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
  };

  // ── Saved Addresses ──────────────────────────────────────────────────────
  const [addresses, setAddresses]         = useState<ApiCustomerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddAddr, setShowAddAddr]     = useState(false);
  const [addrLabel, setAddrLabel]         = useState('Home');
  const [addrLine, setAddrLine]           = useState('');
  const [addrLandmark, setAddrLandmark]   = useState('');
  const [addrCity, setAddrCity]           = useState('Chittoor');
  const [addrPincode, setAddrPincode]     = useState('');
  const [addrLat, setAddrLat]             = useState('');
  const [addrLng, setAddrLng]             = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [savingAddr, setSavingAddr]       = useState(false);

  const fetchAddresses = useCallback(async () => {
    if (!user) return;
    setLoadingAddresses(true);
    try {
      const list = await addressesApi.list(user.id);
      setAddresses(list);
    } catch {}
    finally { setLoadingAddresses(false); }
  }, [user]);

  const openAddresses = () => { setShowAddresses(true); fetchAddresses(); };

  const handleDeleteAddress = (id: number) => {
    Alert.alert('Delete Address', 'Remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await addressesApi.delete(id);
            setAddresses((prev) => prev.filter((a) => a.id !== id));
            queryClient.invalidateQueries({ queryKey: ['addresses', user?.id] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Address removed');
          } catch (err: any) {
            Alert.alert('Error', err?.message?.replace(/^\d+:\s*/, '') || 'Could not delete address.');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (id: number) => {
    const target = addresses.find((a) => a.id === id);
    if (!target) return;

    const willBeDefault = !target.isDefault;

    // Optimistic local update — enforce exactly one default at a time
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, isDefault: willBeDefault ? a.id === id : false })),
    );

    try {
      // Unset every current default first, then set/unset the target
      const updates: Promise<any>[] = [];
      addresses.forEach((a) => {
        if (a.isDefault && a.id !== id) {
          updates.push(addressesApi.update(a.id, { isDefault: false }));
        }
      });
      updates.push(addressesApi.update(id, { isDefault: willBeDefault }));
      await Promise.all(updates);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast(willBeDefault ? 'Default address set' : 'Default removed');
      queryClient.invalidateQueries({ queryKey: ['addresses', user?.id] });
      fetchAddresses(); // reconcile with backend truth
    } catch (err: any) {
      fetchAddresses(); // revert optimistic update on failure
      Alert.alert('Error', err?.message?.replace(/^\d+:\s*/, '') || 'Could not update address.');
    }
  };

  const handleMapConfirm = (loc: PickedLocation) => {
    if (loc.address) setAddrLine(loc.address);
    if (loc.city) setAddrCity(loc.city);
    if (loc.pincode) setAddrPincode(loc.pincode);
    setAddrLat(loc.latitude);
    setAddrLng(loc.longitude);
    setShowMapPicker(false);
  };

  const handleSaveAddress = async () => {
    if (!addrLine.trim()) { Alert.alert('Required', 'Please enter the address.'); return; }
    if (!user) return;
    setSavingAddr(true);
    try {
      await addressesApi.create(user.id, {
        label: addrLabel,
        address: addrLine.trim(),
        landmark: addrLandmark.trim() || undefined,
        city: addrCity.trim() || 'Chittoor',
        pincode: addrPincode.trim() || undefined,
        latitude: addrLat || undefined,
        longitude: addrLng || undefined,
        isDefault: addresses.length === 0,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Address saved!');
      setAddrLine(''); setAddrLandmark(''); setAddrCity('Chittoor'); setAddrPincode('');
      setAddrLat(''); setAddrLng('');
      setShowAddAddr(false);
      fetchAddresses();
    } catch (err: any) {
      Alert.alert('Error', err?.message?.replace(/^\d+:\s*/, '') || 'Could not save address.');
    } finally { setSavingAddr(false); }
  };

  // ── Delete Account ───────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'otp'>('confirm');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRequestDeleteOtp = async () => {
    setSendingOtp(true);
    try {
      await authApi.sendDeleteAccountOtp();
      setDeleteStep('otp');
    } catch (err: any) {
      Alert.alert('Error', err?.message?.replace(/^\d+:\s*/, '') || 'Could not send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP sent to your phone.');
      return;
    }
    setDeleting(true);
    try {
      await authApi.deleteAccount(deleteOtp);
      await clearTokens();
      setShowDeleteModal(false);
      showToast('Account deleted successfully.');
      setTimeout(() => logout(), 500);
    } catch (err: any) {
      Alert.alert('Error', err?.message?.replace(/^\d+:\s*/, '') || 'Could not delete account. Please check the OTP and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteStep('confirm');
    setDeleteOtp('');
    setShowDeleteModal(true);
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setLoggingOut(true);
          await logout();
          setLoggingOut(false);
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + webTopInset }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <ScrollView contentContainerStyle={[styles.centered, { flexGrow: 1 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.guestTitle}>You're not signed in</Text>
          <Text style={styles.guestSubtitle}>Sign in to view your profile, orders, and preferences</Text>
          <Pressable style={styles.signInButton} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
          <Pressable style={styles.registerLink} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.registerLinkText}>Create an account</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Profile" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
      >

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.avatarName}>{user?.name || 'Ruchify User'}</Text>
          <Text style={styles.avatarSub}>{user?.phone ? `+91 ${user.phone}` : user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user?.role}</Text>
          </View>
        </View>

        {/* Personal Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Info</Text>
            <Pressable onPress={openEditProfile} style={styles.editBtn} hitSlop={8}>
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.editFields}>
            <ProfileField icon="person-outline"   label="Name"   value={user?.name || ''} />
            <ProfileField icon="mail-outline"     label="Email"  value={user?.email || ''} />
            <ProfileField icon="call-outline"     label="Phone"  value={user?.phone ? `+91 ${user.phone}` : ''} />
            <ProfileField icon="location-outline" label="City"   value={user?.city || ''} />
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.menuGroup}>
            <MenuRow
              icon="notifications-outline"
              label="Notifications"
              subtitle="Manage notification preferences"
              onPress={() => setShowNotif(true)}
            />
            <MenuRow
              icon="card-outline"
              label="Payment Methods"
              subtitle="View supported payment options"
              onPress={() => setShowPayment(true)}
            />
            <MenuRow
              icon="location-outline"
              label="Saved Addresses"
              subtitle="Manage delivery addresses"
              onPress={openAddresses}
            />
            <MenuRow
              icon="help-circle-outline"
              label="Help & Support"
              subtitle="FAQs and contact us"
              onPress={() => setShowHelp(true)}
            />
            <MenuRow
              icon="document-text-outline"
              label="Terms & Conditions"
              onPress={() => Linking.openURL('https://ruchify.in/terms')}
            />
            <MenuRow
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              onPress={() => Linking.openURL('https://ruchify.in/privacy')}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <View style={styles.menuGroup}>
            <MenuRow
              icon="trash-outline"
              label="Delete My Account"
              subtitle="Permanently delete account and data"
              onPress={openDeleteModal}
              danger
            />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <Pressable
            style={[styles.logoutButton, loggingOut && { opacity: 0.7 }]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut
              ? <ActivityIndicator size="small" color={Colors.error} />
              : <><Ionicons name="log-out-outline" size={18} color={Colors.error} /><Text style={styles.logoutText}>Log Out</Text></>
            }
          </Pressable>
        </View>

        <Text style={styles.version}>Ruchify v{appVersion} · User #{user?.id}</Text>
      </ScrollView>


      {/* ── Notifications Modal ───────────────────────────────────────────── */}
      <ModalSheet visible={showNotif} onClose={() => setShowNotif(false)} title="Notifications">
        <Text style={styles.modalDesc}>Choose which notifications you'd like to receive.</Text>
        {([
          { key: 'orderUpdates', label: 'Order Updates',    sub: 'Status changes, ETA, delivery confirmation' },
          { key: 'promotions',   label: 'Promotions',       sub: 'Exclusive deals and discount codes' },
          { key: 'offers',       label: 'Restaurant Offers', sub: 'New menus, limited-time combos' },
          { key: 'system',       label: 'System Alerts',    sub: 'Account activity, security notices' },
        ] as { key: keyof typeof notifPrefs; label: string; sub: string }[]).map(({ key, label, sub }) => (
          <View key={key} style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>{label}</Text>
              <Text style={styles.toggleSub}>{sub}</Text>
            </View>
            <Switch
              value={notifPrefs[key]}
              onValueChange={() => toggleNotif(key)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </ModalSheet>

      {/* ── Payment Methods Modal ─────────────────────────────────────────── */}
      <ModalSheet visible={showPayment} onClose={() => setShowPayment(false)} title="Payment Methods">
        <Text style={styles.modalDesc}>Ruchify supports the following payment options at checkout.</Text>
        {[
          { icon: 'cash-outline',      label: 'Cash on Delivery',  sub: 'Pay in cash when your order arrives' },
          { icon: 'phone-portrait-outline', label: 'UPI',          sub: 'Google Pay, PhonePe, Paytm & more' },
          { icon: 'card-outline',      label: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay' },
        ].map(({ icon, label, sub }) => (
          <View key={label} style={styles.paymentRow}>
            <View style={styles.paymentIcon}>
              <Ionicons name={icon as any} size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentLabel}>{label}</Text>
              <Text style={styles.paymentSub}>{sub}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
        ))}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.infoText}>All transactions are secured with 256-bit SSL encryption.</Text>
        </View>
      </ModalSheet>

      {/* ── Saved Addresses Modal ─────────────────────────────────────────── */}
      <ModalSheet visible={showAddresses} onClose={() => { setShowAddresses(false); setShowAddAddr(false); }} title="Saved Addresses">
        {loadingAddresses ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
        ) : (
          <>
            {addresses.length === 0 && !showAddAddr && (
              <View style={styles.emptyBox}>
                <Ionicons name="location-outline" size={40} color={Colors.textLight} />
                <Text style={styles.emptyText}>No saved addresses yet.</Text>
              </View>
            )}
            {addresses.map((addr) => (
              <View key={addr.id} style={styles.addressCard}>
                <View style={styles.addressCardLeft}>
                  <View style={styles.addressLabelBadge}>
                    <Text style={styles.addressLabelText}>{addr.label}</Text>
                  </View>
                  <Text style={styles.addressLine}>{addr.address}</Text>
                  {addr.landmark ? <Text style={styles.addressSub}>Near {addr.landmark}</Text> : null}
                  <Text style={styles.addressSub}>{addr.city}{addr.pincode ? ` - ${addr.pincode}` : ''}</Text>
                </View>
                <View style={styles.addressActions}>
                  <Pressable onPress={() => handleSetDefault(addr.id)} style={styles.addressActionBtn}>
                    {addr.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default ✕</Text>
                      </View>
                    ) : (
                      <Text style={styles.setDefaultText}>Set default</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => handleDeleteAddress(addr.id)} style={styles.addressActionBtn}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            ))}

            {showAddAddr ? (
              <View style={styles.addAddrForm}>
                <Text style={styles.addAddrTitle}>New Address</Text>
                <View style={styles.labelRow}>
                  {['Home', 'Work', 'Other'].map((l) => (
                    <Pressable key={l} style={[styles.labelChip, addrLabel === l && styles.labelChipActive]}
                      onPress={() => setAddrLabel(l)}>
                      <Text style={[styles.labelChipText, addrLabel === l && styles.labelChipTextActive]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>
                {Platform.OS !== 'web' && (
                  <Pressable style={styles.mapPickerBtn} onPress={() => setShowMapPicker(true)}>
                    <Ionicons name="map-outline" size={16} color={Colors.primary} />
                    <Text style={styles.mapPickerBtnText}>
                      {addrLat ? 'Location picked \u2713 — change on map' : 'Pick Location on Map'}
                    </Text>
                  </Pressable>
                )}
                <View style={styles.modalInputWrap}>
                  <TextInput style={styles.modalInput} value={addrLine} onChangeText={setAddrLine}
                    placeholder="House no, Street, Area *" placeholderTextColor={Colors.textLight} multiline />
                </View>
                <View style={styles.modalInputWrap}>
                  <TextInput style={styles.modalInput} value={addrLandmark} onChangeText={setAddrLandmark}
                    placeholder="Landmark (optional)" placeholderTextColor={Colors.textLight} />
                </View>
                <View style={styles.addAddrRow}>
                  <View style={[styles.modalInputWrap, { flex: 1 }]}>
                    <TextInput style={styles.modalInput} value={addrCity} onChangeText={setAddrCity}
                      placeholder="City" placeholderTextColor={Colors.textLight} />
                  </View>
                  <View style={[styles.modalInputWrap, { flex: 1 }]}>
                    <TextInput style={styles.modalInput} value={addrPincode} onChangeText={setAddrPincode}
                      placeholder="Pincode" placeholderTextColor={Colors.textLight} keyboardType="number-pad" maxLength={6} />
                  </View>
                </View>
                <View style={styles.addAddrRow}>
                  <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setShowAddAddr(false)}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryBtn, { flex: 1 }, savingAddr && { opacity: 0.7 }]}
                    onPress={handleSaveAddress} disabled={savingAddr}>
                    {savingAddr ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.addAddrBtn} onPress={() => setShowAddAddr(true)}>
                <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.addAddrBtnText}>Add New Address</Text>
              </Pressable>
            )}
          </>
        )}
      </ModalSheet>

      {/* ── Edit Profile Modal ────────────────────────────────────────────── */}
      <ModalSheet visible={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit Profile">
        <Text style={styles.modalDesc}>Update your name and email address.</Text>
        <View style={styles.modalField}>
          <Text style={styles.modalLabel}>Full Name *</Text>
          <View style={styles.modalInputWrap}>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textLight}
              autoCapitalize="words"
              maxLength={60}
            />
          </View>
        </View>
        <View style={styles.modalField}>
          <Text style={styles.modalLabel}>Email Address</Text>
          <View style={styles.modalInputWrap}>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Enter email (optional)"
              placeholderTextColor={Colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={100}
            />
          </View>
        </View>
        <View style={styles.addAddrRow}>
          <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setShowEditProfile(false)}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, { flex: 1 }, savingProfile && { opacity: 0.7 }]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Save</Text>
            }
          </Pressable>
        </View>
      </ModalSheet>

      {/* ── Help & Support Modal ──────────────────────────────────────────── */}
      <ModalSheet visible={showHelp} onClose={() => setShowHelp(false)} title="Help & Support">
        <View style={styles.contactRow}>
          <View style={styles.contactIcon}><Ionicons name="mail-outline" size={20} color={Colors.primary} /></View>
          <View>
            <Text style={styles.contactLabel}>Email Support</Text>
            <Text style={styles.contactValue}>{supportEmail}</Text>
          </View>
        </View>
        <View style={styles.contactRow}>
          <View style={styles.contactIcon}><Ionicons name="call-outline" size={20} color={Colors.primary} /></View>
          <View>
            <Text style={styles.contactLabel}>Customer Care</Text>
            <Text style={styles.contactValue}>{supportPhone}</Text>
          </View>
        </View>
        <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
        {[
          { q: 'How do I track my order?', a: 'Go to the Orders tab and tap "Track Order" on any active order.' },
          { q: 'How do I cancel an order?', a: 'Orders can be cancelled before the restaurant accepts. Go to Orders → Track → Cancel.' },
          { q: 'What if my order is late?', a: 'Check the tracking screen for live updates. Contact support if ETA has passed significantly.' },
          { q: 'How do refunds work?', a: 'Approved refunds are processed within 5–7 business days to your original payment method.' },
          { q: 'Can I change my delivery address?', a: 'Address changes are only possible before the restaurant accepts your order.' },
        ].map(({ q, a }) => (
          <View key={q} style={styles.faqItem}>
            <Text style={styles.faqQ}>{q}</Text>
            <Text style={styles.faqA}>{a}</Text>
          </View>
        ))}
      </ModalSheet>

      {/* ── Delete Account Modal ──────────────────────────────────────────── */}
      <Modal visible={showDeleteModal} transparent animationType="slide" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 32 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.error }]}>Delete Account</Text>
              <Pressable onPress={() => setShowDeleteModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            {deleteStep === 'confirm' ? (
              <View style={{ gap: 16, paddingTop: 8 }}>
                <Text style={styles.modalDesc}>
                  This is permanent. Your orders will be anonymized for tax records. All addresses, cart items, and notifications will be deleted.
                </Text>
                <View style={styles.addAddrRow}>
                  <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setShowDeleteModal(false)}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: Colors.error }, sendingOtp && { opacity: 0.7 }]}
                    onPress={handleRequestDeleteOtp}
                    disabled={sendingOtp}
                  >
                    {sendingOtp
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.primaryBtnText}>Send OTP</Text>
                    }
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ gap: 16, paddingTop: 8 }}>
                <Text style={styles.modalDesc}>
                  Enter the 6-digit OTP sent to your registered phone number to confirm deletion.
                </Text>
                <View style={styles.modalInputWrap}>
                  <TextInput
                    style={[styles.modalInput, { textAlign: 'center', letterSpacing: 6, fontSize: 20 }]}
                    value={deleteOtp}
                    onChangeText={(t) => setDeleteOtp(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    placeholder="------"
                    placeholderTextColor={Colors.textLight}
                    maxLength={6}
                    autoFocus
                  />
                </View>
                <View style={styles.addAddrRow}>
                  <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setDeleteStep('confirm')}>
                    <Text style={styles.secondaryBtnText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: Colors.error }, deleting && { opacity: 0.7 }]}
                    onPress={handleConfirmDelete}
                    disabled={deleting}
                  >
                    {deleting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.primaryBtnText}>Delete Forever</Text>
                    }
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Toast {...toastProps} />

      {showMapPicker && (
        <MapLocationPicker
          visible
          onClose={() => setShowMapPicker(false)}
          onConfirm={handleMapConfirm}
          initialCoords={
            addrLat && addrLng
              ? { latitude: parseFloat(addrLat), longitude: parseFloat(addrLng) }
              : undefined
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  guestTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 20, color: Colors.text, textAlign: 'center', marginTop: 8 },
  guestSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  signInButton: { backgroundColor: Colors.primary, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14, marginTop: 8, width: '100%', alignItems: 'center' },
  signInButtonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' },
  registerLink: { paddingVertical: 8 },
  registerLinkText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.primary },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: 24, color: Colors.text },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarName: { fontFamily: 'Poppins_600SemiBold', fontSize: 20, color: Colors.text },
  avatarSub: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  roleBadge: { backgroundColor: Colors.primary + '15', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20, marginTop: 8 },
  roleBadgeText: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: Colors.primary, textTransform: 'capitalize' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.text },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.primary + '12' },
  editBtnText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: Colors.primary },
  editFields: { gap: 10 },
  fieldContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: 12, gap: 12 },
  fieldIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '10', alignItems: 'center', justifyContent: 'center' },
  fieldContent: { flex: 1 },
  fieldLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textLight },
  fieldValue: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.text, marginTop: 2 },
  menuGroup: { backgroundColor: Colors.surface, borderRadius: 14, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  menuContent: { flex: 1 },
  menuLabel: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.text },
  menuSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textLight, marginTop: 1 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.error + '0D', paddingVertical: 14, borderRadius: 14 },
  logoutText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.error },
  version: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textLight, textAlign: 'center', marginTop: 8, marginBottom: 20 },

  // Modal base
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 0, maxHeight: '90%' },
  modalScrollContent: { gap: 14, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: Colors.text },
  modalClose: { padding: 4 },
  modalDesc: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  modalField: { gap: 6 },
  modalLabel: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text },
  modalInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, backgroundColor: Colors.background },
  modalInput: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.text, paddingVertical: Platform.OS === 'ios' ? 13 : 11, padding: 0 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' },
  secondaryBtn: { backgroundColor: Colors.surfaceAlt, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: Colors.text },

  // Notifications
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  toggleLabel: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.text },
  toggleSub: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textLight, marginTop: 1 },

  // Payment Methods
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  paymentIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primary + '10', alignItems: 'center', justifyContent: 'center' },
  paymentLabel: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.text },
  paymentSub: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.textLight },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary + '10', borderRadius: 10, padding: 12, marginTop: 4 },
  infoText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.primary },

  // Addresses
  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textLight },
  addressCard: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: 12, padding: 12, marginBottom: 10, gap: 10 },
  addressCardLeft: { flex: 1, gap: 2 },
  addressLabelBadge: { backgroundColor: Colors.primary + '15', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 20, marginBottom: 4 },
  addressLabelText: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: Colors.primary },
  addressLine: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text },
  addressSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary },
  addressActions: { alignItems: 'flex-end', gap: 6, justifyContent: 'center' },
  addressActionBtn: { padding: 4 },
  setDefaultText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: Colors.primary },
  defaultBadge: { backgroundColor: Colors.success + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  defaultBadgeText: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: Colors.success },
  addAddrBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, borderStyle: 'dashed', marginTop: 4 },
  addAddrBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.primary },
  addAddrForm: { gap: 10, marginTop: 4 },
  addAddrTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: Colors.text },
  addAddrRow: { flexDirection: 'row', gap: 10 },
  labelRow: { flexDirection: 'row', gap: 8 },
  labelChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  labelChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  labelChipText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text },
  labelChipTextActive: { color: '#fff' },
  mapPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, backgroundColor: Colors.primary + '08' },
  mapPickerBtnText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.primary, flex: 1 },

  // Help
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  contactIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primary + '10', alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary },
  contactValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.text },
  faqTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: Colors.text, marginTop: 8 },
  faqItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  faqQ: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text },
  faqA: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 3 },

});
