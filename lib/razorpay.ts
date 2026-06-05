import { Platform, NativeModules } from 'react-native';

// NOTE: key_secret must NEVER be placed here.
// It belongs only on the backend server for signature verification.
export const RAZORPAY_KEY_ID = 'rzp_live_Suk7bFsBPHQ6yt';

export interface RazorpayPaymentOptions {
  amount: number; // in paise (₹1 = 100 paise)
  orderId?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
}

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export async function openRazorpayCheckout(options: RazorpayPaymentOptions): Promise<RazorpaySuccess> {
  if (Platform.OS === 'web') {
    throw new Error('Online payments are not supported on web. Please use Cash on Delivery.');
  }

  // Check if the Razorpay native module is actually available.
  // The module registers itself as RNRazorpayCheckout (not RazorpayCheckout).
  // It won't be in Expo Go — only in a proper development/production build.
  if (!NativeModules.RNRazorpayCheckout) {
    throw new Error(
      'UPI/Card payments are not available in Expo Go. Please use Cash on Delivery, or run a development build (eas build --profile development).'
    );
  }

  const RazorpayCheckout = require('react-native-razorpay').default;

  // Build opts — do NOT include order_id when it is absent; passing undefined
  // causes the Razorpay SDK to reject the call with a cryptic error.
  const opts: Record<string, unknown> = {
    key: RAZORPAY_KEY_ID,
    amount: String(options.amount),
    currency: 'INR',
    name: 'Ruchify',
    description: 'Food Order Payment',
    prefill: {
      name: options.prefill?.name ?? '',
      email: options.prefill?.email ?? '',
      contact: options.prefill?.contact ?? '',
    },
    notes: options.notes ?? {},
    theme: { color: '#C8281A' },
    // Let Razorpay's own checkout UI handle method selection (UPI / Card / Wallet / NetBanking).
    // Do NOT restrict to a single method here — the full payment sheet is shown.
  };

  if (options.orderId) {
    opts.order_id = options.orderId;
  }

  return RazorpayCheckout.open(opts) as Promise<RazorpaySuccess>;
}
