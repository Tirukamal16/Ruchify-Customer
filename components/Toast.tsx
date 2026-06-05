import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
}

export function Toast({ visible, message, type = 'success' }: ToastProps) {
  const [show, setShow] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 200, useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;

  const bgColor =
    type === 'error' ? Colors.error :
    type === 'info'  ? Colors.primary :
    Colors.success;

  const iconName =
    type === 'error' ? 'close-circle-outline' :
    type === 'info'  ? 'information-circle-outline' :
    'checkmark-circle-outline';

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}
    >
      <Ionicons name={iconName as any} size={18} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

export function useToast() {
  const [toastState, setToastState] = useState<{ message: string; type: ToastType } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (message: string, type: ToastType = 'success', duration = 2500) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastState({ message, type });
    timerRef.current = setTimeout(() => setToastState(null), duration);
  };

  const toastProps: ToastProps = {
    visible: toastState !== null,
    message: toastState?.message ?? '',
    type: toastState?.type ?? 'success',
  };

  return { show, toastProps };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    zIndex: 9999,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  text: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#fff',
  },
});
