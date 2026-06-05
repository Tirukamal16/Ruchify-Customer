import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
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

export default function RegisterPhoneScreen() {
  const insets = useSafeAreaInsets();
  const { sendRegisterOtp } = useAuth();
  const { phone: rawPhone } = useLocalSearchParams<{ phone?: string }>();
  const phoneParam = Array.isArray(rawPhone) ? rawPhone[0] : (rawPhone ?? '');
  const { show, toastProps } = useToast();

  const [phone, setPhone] = useState(phoneParam);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10 || !/^[6-9]/.test(digits)) {
      show('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }
    setLoading(true);
    try {
      await sendRegisterOtp(digits);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push({ pathname: '/(auth)/register-otp', params: { phone: digits } });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (err?.code === 'already_registered' || err?.status === 409) {
        show('Account already exists. Please login.', 'info');
        setTimeout(() => {
          router.replace({ pathname: '/(auth)/login', params: { phone: digits } });
        }, 800);
        return;
      }
      if (err?.status === 429) {
        const mins = err?.retryAfter ? Math.ceil(err.retryAfter / 60) : 10;
        show(`Too many requests. Try again in ${mins} minute(s).`, 'error');
        return;
      }
      show(err?.message || 'Could not send OTP. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Toast {...toastProps} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>

        <View style={styles.logoSection}>
          <Image
            source={require('@/assets/images/logo.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Enter your mobile number to get started</Text>

        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+91</Text>
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, (pressed || loading) && { opacity: 0.8 }]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
        </Pressable>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Already have an account?{' '}</Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.switchLink}>Login</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, flexGrow: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoImage: { width: 80, height: 80, borderRadius: 18 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 24, color: Colors.text },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 6, marginBottom: 28 },
  phoneRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  countryCode: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, justifyContent: 'center',
  },
  countryCodeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: Colors.text },
  inputWrap: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14,
  },
  input: {
    fontFamily: 'Poppins_400Regular', fontSize: 16, color: Colors.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12, padding: 0,
  },
  button: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  switchText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textSecondary },
  switchLink: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.primary },
});
