import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, Platform,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { addressesApi } from '@/lib/api';
import { Toast, useToast } from '@/components/Toast';

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Ionicons name="alert-circle-outline" size={52} color="#DDD" />
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: '#333', marginTop: 16, textAlign: 'center' }}>Something went wrong</Text>
      <Pressable onPress={retry} style={{ marginTop: 24, backgroundColor: '#FF6B35', paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 }}>
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

export default function RegisterDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { user, completeRegistration } = useAuth();
  const rawParams = useLocalSearchParams<{ phone: string }>();
  const phone = Array.isArray(rawParams.phone) ? rawParams.phone[0] : (rawParams.phone ?? '');
  const { show, toastProps } = useToast();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Chittoor');
  const [completing, setCompleting] = useState(false);

  // Step 2 — address
  const [label, setLabel] = useState('Home');
  const [addressLine, setAddressLine] = useState('');
  const [landmark, setLandmark] = useState('');
  const [addrCity, setAddrCity] = useState('Chittoor');
  const [pincode, setPincode] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const handleCompleteRegistration = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      show('Please enter your full name (min 2 characters).', 'error');
      return;
    }
    if (trimmedName.length > 80) {
      show('Name must be 80 characters or less.', 'error');
      return;
    }
    if (email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        show('Please enter a valid email address.', 'error');
        return;
      }
    }
    setCompleting(true);
    try {
      await completeRegistration({
        name: trimmedName,
        ...(email.trim() ? { email: email.trim() } : {}),
        city: city.trim() || 'Chittoor',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAddrCity(city.trim() || 'Chittoor');
      setStep(2);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (err?.code === 'session_expired' || err?.status === 401) {
        show('Session expired. Please start over.', 'error');
        setTimeout(() => router.replace('/(auth)/register'), 1000);
        return;
      }
      if (err?.code === 'already_registered' || err?.status === 409) {
        show('Account already exists. Please login.', 'info');
        setTimeout(() => router.replace({ pathname: '/(auth)/login', params: { phone } }), 900);
        return;
      }
      show(err?.message || 'Could not create account. Please try again.', 'error');
    } finally {
      setCompleting(false);
    }
  };

  // Known cities within Chittoor district and nearby serviceable areas
  const CHITTOOR_AREA_CITIES = [
    'chittoor', 'tirupati', 'madanapalle', 'punganur', 'palamaner',
    'kuppam', 'srikalahasti', 'puttur', 'nagari', 'gudipala',
    'gangavaram', 'pakala', 'yerpedu', 'renigunta', 'chandragiri',
    'piler', 'srirangarajapuram', 'vayalpad', 'thamballapalle',
    'bangarupalyam', 'pileru',
  ];

  const doSaveAddress = async () => {
    const currentUser = user;
    if (!currentUser) {
      router.replace('/(tabs)');
      return;
    }
    setSavingAddress(true);
    try {
      await addressesApi.create({
        label,
        address: addressLine.trim(),
        landmark: landmark.trim() || undefined,
        city: addrCity.trim() || 'Chittoor',
        pincode: pincode.trim() || undefined,
        isDefault: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Non-fatal — address can be added from profile later
    } finally {
      setSavingAddress(false);
      router.replace('/(tabs)');
    }
  };

  const handleSaveAddress = async () => {
    if (!addressLine.trim()) {
      show('Please enter your delivery address.', 'error');
      return;
    }
    if (/[@*%$#^&()_+=!]/.test(addressLine.trim())) {
      show('Address contains unsupported characters.', 'error');
      return;
    }
    const currentUser = user;
    if (!currentUser) {
      router.replace('/(tabs)');
      return;
    }

    // Warn if city appears to be outside the Chittoor service area
    const cityLower = addrCity.trim().toLowerCase();
    if (cityLower && !CHITTOOR_AREA_CITIES.some((c) => cityLower.includes(c))) {
      Alert.alert(
        'Outside Delivery Area?',
        `We currently deliver only within Chittoor and nearby areas. "${addrCity.trim()}" may be outside our service area.\n\nPlease use an address within Chittoor for delivery. You can still save this address but orders may not be deliverable.`,
        [
          { text: 'Change City', style: 'cancel' },
          {
            text: 'Save Anyway',
            onPress: () => doSaveAddress(),
          },
        ],
      );
      return;
    }

    // City is within service area — save immediately
    doSaveAddress();
  };

  // ── Step 1: profile ────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <Toast {...toastProps} />
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>

          <View style={styles.logoSection}>
            <Image source={require('@/assets/images/logo.jpeg')} style={styles.logoImage} resizeMode="contain" />
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 1 of 2</Text>
          </View>

          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>Tell us your name to finish creating your account</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(t) => setName(t.replace(/[^a-zA-Z\s.\-']/g, ''))}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.textLight}
                  autoCapitalize="words"
                  autoComplete="name"
                  autoFocus
                  maxLength={80}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email (optional)</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textLight}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>City (optional)</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="business-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={(t) => setCity(t.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="Chittoor"
                  placeholderTextColor={Colors.textLight}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.button, (pressed || completing) && { opacity: 0.8 }]}
              onPress={handleCompleteRegistration}
              disabled={completing}
            >
              {completing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account →</Text>}
            </Pressable>
          </View>
        </KeyboardAwareScrollViewCompat>
      </View>
    );
  }

  // ── Step 2: delivery address ───────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Toast {...toastProps} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Step 2 of 2</Text>
        </View>

        <Text style={styles.title}>Add delivery address</Text>
        <Text style={styles.subtitle}>Save your address for faster checkout</Text>

        <View style={styles.labelRow}>
          {['Home', 'Work', 'Other'].map((l) => (
            <Pressable
              key={l}
              style={[styles.labelChip, label === l && styles.labelChipActive]}
              onPress={() => setLabel(l)}
            >
              <Text style={[styles.labelChipText, label === l && styles.labelChipTextActive]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Address *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="location-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={addressLine}
                onChangeText={(t) => setAddressLine(t.replace(/[@*%$#^&()_+=!]/g, ''))}
                placeholder="House no, Street, Area"
                placeholderTextColor={Colors.textLight}
                multiline
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Landmark</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="flag-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Opposite SBI Bank (optional)"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>City</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={addrCity}
                  onChangeText={(t) => setAddrCity(t.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Pincode</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={pincode}
                  onChangeText={setPincode}
                  placeholder="517001"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, (pressed || savingAddress) && { opacity: 0.8 }]}
            onPress={handleSaveAddress}
            disabled={savingAddress}
          >
            {savingAddress ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save & Go to Home</Text>}
          </Pressable>

          <Pressable style={styles.skipBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, flexGrow: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoSection: { alignItems: 'center', marginBottom: 16 },
  logoImage: { width: 80, height: 80, borderRadius: 18 },
  stepBadge: {
    backgroundColor: Colors.primary + '15', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 12,
  },
  stepText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: Colors.primary },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 24, color: Colors.text },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 6, marginBottom: 28 },
  form: { gap: 16 },
  row: { flexDirection: 'row', gap: 10 },
  labelRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  labelChip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  labelChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  labelChipText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text },
  labelChipTextActive: { color: '#fff' },
  inputGroup: { gap: 6 },
  inputLabel: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12, padding: 0,
  },
  button: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#fff' },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.textSecondary },
});
