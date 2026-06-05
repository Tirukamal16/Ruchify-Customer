import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { Toast, useToast } from '@/components/Toast';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

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

export default function LoginOtpScreen() {
  const insets = useSafeAreaInsets();
  const { verifyOtp, sendOtp } = useAuth();
  const rawParams = useLocalSearchParams<{ phone: string }>();
  const phone = Array.isArray(rawParams.phone) ? rawParams.phone[0] : (rawParams.phone ?? '');
  const { show, toastProps } = useToast();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendSeconds]);

  const handleOtpChange = (value: string, index: number) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const updated = [...otp];
    updated[index] = digit;
    setOtp(updated);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (digit && updated.every((d) => d !== '') && index === OTP_LENGTH - 1) {
      handleVerify(updated.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const resetOtp = () => {
    setOtp(Array(OTP_LENGTH).fill(''));
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code ?? otp.join('');
    if (otpCode.length !== OTP_LENGTH) return;
    setLoading(true);
    try {
      await verifyOtp(phone!, otpCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      resetOtp();

      if (err?.code === 'not_registered' || err?.status === 404) {
        show('No account found. Redirecting to registration…', 'info');
        setTimeout(() => router.replace({ pathname: '/(auth)/register', params: { phone } }), 900);
        return;
      }
      if (err?.code === 'wrong_role') {
        show('This number is registered as a rider/restaurant. Please use the correct app.', 'error');
        return;
      }
      if (err?.status === 429) {
        show('Too many attempts. Please request a new OTP.', 'error');
        setResendSeconds(0);
        return;
      }
      if (err?.message?.toLowerCase().includes('no valid otp') || err?.message?.toLowerCase().includes('expired')) {
        show('OTP has expired. Please resend.', 'error');
        setResendSeconds(0);
        return;
      }
      const attempts = err?.attemptsRemaining != null ? ` ${err.attemptsRemaining} attempt(s) left.` : '';
      show(`Invalid OTP.${attempts}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || resending) return;
    setResending(true);
    try {
      await sendOtp(phone!);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      resetOtp();
      setResendSeconds(RESEND_SECONDS);
      show('OTP resent successfully!', 'success');
    } catch (err: any) {
      if (err?.status === 429) {
        const mins = err?.retryAfter ? Math.ceil(err.retryAfter / 60) : 10;
        show(`Too many requests. Try again in ${mins} minute(s).`, 'error');
      } else {
        show(err?.message || 'Could not resend OTP.', 'error');
      }
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = phone ? `+91 ${phone.slice(0, 2)}••••••${phone.slice(-2)}` : '';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Toast {...toastProps} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>

        <View style={styles.iconWrap}>
          <Ionicons name="chatbubble-ellipses" size={40} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP sent to{'\n'}
          <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
        </Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(val) => handleOtpChange(val, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, (pressed || loading || otp.join('').length < OTP_LENGTH) && { opacity: 0.6 }]}
          onPress={() => handleVerify()}
          disabled={loading || otp.join('').length < OTP_LENGTH}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Login</Text>}
        </Pressable>

        <View style={styles.resendRow}>
          {resendSeconds > 0 ? (
            <Text style={styles.resendTimer}>
              Resend OTP in <Text style={styles.timerCount}>{resendSeconds}s</Text>
            </Text>
          ) : (
            <Pressable onPress={handleResend} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={styles.resendLink}>Resend OTP</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, flexGrow: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 24, color: Colors.text },
  subtitle: {
    fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textSecondary,
    marginTop: 8, marginBottom: 32, lineHeight: 22,
  },
  phoneHighlight: { fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 32 },
  otpBox: {
    width: 48, height: 56, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.surface,
    textAlign: 'center', fontFamily: 'Poppins_700Bold', fontSize: 22, color: Colors.text,
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  button: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#fff' },
  resendRow: { alignItems: 'center', marginTop: 20 },
  resendTimer: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textSecondary },
  timerCount: { fontFamily: 'Poppins_600SemiBold', color: Colors.text },
  resendLink: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.primary },
});
