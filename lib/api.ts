import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { fetch } from 'expo/fetch';

export const BASE_URL = 'https://ruchify.in';
const TOKENS_KEY = 'ruchify_tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  city: string;
  profileImageUrl?: string;
  isActive?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isNewUser?: boolean;
  user: AuthUser;
}

export interface ApiRestaurant {
  id: number;
  name: string;
  description?: string;
  cuisineType: string;
  address: string;
  city: string;
  phone: string;
  rating?: string;
  totalRatings?: number;
  imageUrl?: string;
  deliveryTime?: number;
  minOrder?: string;
  isActive: boolean;
  isServiceable?: boolean;
  openTime?: string;
  closeTime?: string;
  avgPrepTime?: number;
  latitude?: string;
  longitude?: string;
}

export interface ApiMenuItem {
  id: number;
  name: string;
  restaurantId: number;
  category: string;
  basePrice: string;
  description?: string;
  imageUrl?: string;
  isVeg: boolean;
  isAvailable: boolean;
  prepTime?: number;
  portionSize?: string;
  sizes?: { name: string; priceAddon: number }[];
  addons?: { name: string; price: number }[];
  /** 1-decimal avg rating string (e.g. "4.3"), or null for new items with no ratings yet. */
  avgRating?: string | null;
  totalRatings?: number;
}

export interface ApiOrderItem {
  menuItemId: number;
  name: string;
  quantity: number;
  price: number;   // API expects a number; responses also return strings but we parse them on read
  size?: string;
  addons?: { name: string; price: number }[];
}

export interface ApiOrder {
  id: number;
  restaurantId: number;
  customerId: number;
  riderId?: number;
  status: string;
  items: ApiOrderItem[];
  subtotal: string;
  deliveryFee: string;
  platformFee: string;
  discount: string;
  total: string;
  deliveryAddress: string;
  customerPhone: string;
  customerName: string;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  cancelReason?: string;
  estimatedDeliveryTime?: string;
  createdAt: string;
  acceptedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  // v2 bill fields
  billVersion?: number;
  foodGross?: string;
  promoDiscount?: string;
  restaurantDiscount?: string;
  packagingCharges?: string;
  packagingGstAmount?: string;
  deliveryFeeGstAmount?: string;
  platformFeeGstAmount?: string;
  gstAmount?: string;
  gstRate?: string;
  servicesGstRate?: string;
  couponCode?: string | null;
  // Canonical bill object attached by the server on all v2+ orders (GET /api/orders/:id etc.)
  bill?: QuoteBill;
}

// ─── Quote / Bill Types ───────────────────────────────────────────────────────

export interface QuoteGst {
  food: number;
  packaging: number;
  delivery: number;
  platform: number;
  total: number;
}

export interface QuoteBill {
  food_gross: number;
  promo_discount: number;
  restaurant_discount: number;
  taxable_food: number;
  packaging: number;
  delivery_partner_fee: number;
  platform_fee_inclusive: number;
  platform_fee_ex: number;
  gst: QuoteGst;
  overall_total: number;
  rates: { food_gst: number; services_gst: number };
  bill_version: number;
  coupon_code: string | null;
}

export interface QuoteResponse {
  distanceKm: number | null;
  bill: QuoteBill;
}

export interface ApiCoupon {
  id: number;
  code: string;
  description?: string;
  discountType: 'percentage' | 'flat';
  discountValue: string;
  minOrderValue?: string;
  maxDiscount?: string;
  usageLimit?: number;
  usedCount?: number;
  expiresAt?: string;
  isActive: boolean;
}

export interface ApiAdvertisement {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  adType: string;
  placement: string;
  restaurantId?: number;
  priority: number;
  isActive: boolean;
  impressions: number;
  clicks: number;
}

export interface ApiReviewItemRating {
  menuItemId: number;
  rating: number;
  comment?: string;
}

export interface ApiReview {
  id: number;
  orderId: number;
  customerId: number;
  restaurantId?: number;
  riderId?: number;
  restaurantRating?: number;
  riderRating?: number;
  comment?: string;
  createdAt: string;
  // v2 fields (Task #80)
  status?: 'published' | 'hidden' | 'flagged';
  images?: string[];
  itemRatings?: ApiReviewItemRating[];
  moderatedAt?: string | null;
  moderatedBy?: string | null;
  moderationNote?: string | null;
}

export interface ApiRider {
  id: number;
  name: string;
  phone: string;
  email?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  isOnline?: boolean;
  isAvailable?: boolean;
  totalDeliveries?: number;
  rating?: string;
  currentLatitude?: string;
  currentLongitude?: string;
  lastLocationUpdate?: string;
}

export interface ApiCustomerAddress {
  id: number;
  label: string;
  address: string;
  landmark?: string;
  city: string;
  pincode?: string;
  latitude?: string;
  longitude?: string;
  isDefault: boolean;
  isServiceable?: boolean;
}

export interface ApiSupportContact {
  phone: string;
  email: string;
  whatsapp: string;
}

export interface ApiNotification {
  id: number;
  userId: number;
  eventType: string;
  title: string;
  body: string;
  data: Record<string, any>;
  readAt: string | null;
  createdAt: string;
}

export interface ApiNotificationsListResponse {
  items: ApiNotification[];
  limit: number;
  offset: number;
}

// ─── Token Management ─────────────────────────────────────────────────────────

export async function getStoredTokens(): Promise<AuthTokens | null> {
  try {
    const data = await SecureStore.getItemAsync(TOKENS_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function storeTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
}

// ─── HTTP Core ───────────────────────────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const data: AuthResponse = JSON.parse(await res.text());
    await storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  requiresAuth = false,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const tokens = await getStoredTokens();
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }
  }

  let res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && requiresAuth) {
    const tokens = await getStoredTokens();
    if (tokens?.refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = doRefresh(tokens.refreshToken).finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      }
    }
  }

  if (!res.ok) {
    // Do NOT use res.statusText as the fallback: expo/fetch can populate it with
    // internal parse errors (e.g. "Unexpected token '-'") on certain responses,
    // which would leak a confusing JS engine error string to the user.
    let errorMsg = `Request failed (${res.status})`;
    let errorCode: string | undefined;
    let retryAfter: number | undefined;
    let attemptsRemaining: number | undefined;
    try {
      const errText = await res.text();
      if (errText && errText.trim()) {
        // Parse JSON separately so a non-JSON body (HTML / plain text) never
        // leaks a raw SyntaxError ("Unexpected token '") to the caller.
        try {
          const err = JSON.parse(errText);
          if (Array.isArray(err)) {
            // Zod validation error array from backend
            errorMsg = err.map((e: any) => e.message).join(', ');
          } else {
            errorMsg = err.message || err.error || errorMsg;
            errorCode = err.code;
            retryAfter = err.retryAfter;
            attemptsRemaining = err.attemptsRemaining;
          }
        } catch {
          // Body is not JSON (HTML error page, plain text, etc.) — keep statusText
        }
      }
    } catch {
      // Could not read response body — keep statusText
    }
    const error: any = new Error(errorMsg);
    error.status = res.status;
    error.code = errorCode;
    error.retryAfter = retryAfter;
    error.attemptsRemaining = attemptsRemaining;
    console.warn(`[API] ${method} ${path} → ${res.status} ERROR: ${errorMsg}`);
    throw error;
  }

  if (res.status === 204) {
    console.log(`[API] ${method} ${path} → 204 No Content`);
    return undefined as T;
  }
  const text = await res.text();
  console.log(`[API] ${method} ${path} → ${res.status} body(${text.length}): ${text.slice(0, 200)}`);
  if (!text || !text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Non-JSON success response (e.g. plain text) — return undefined
    return undefined as T;
  }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role?: string;
    city?: string;
    address?: string;
  }): Promise<AuthResponse> {
    return request<AuthResponse>('POST', '/api/auth/register', data);
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>('POST', '/api/auth/login', { email, password });
  },

  refresh(refreshToken: string): Promise<AuthResponse> {
    return request<AuthResponse>('POST', '/api/auth/refresh', { refreshToken });
  },

  logout(): Promise<void> {
    return request<void>('POST', '/api/auth/logout', undefined, true);
  },

  me(): Promise<AuthUser> {
    return request<AuthUser>('GET', '/api/auth/me', undefined, true);
  },

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string; accessToken: string; refreshToken: string }> {
    return request('PATCH', '/api/auth/change-password', { currentPassword, newPassword }, true);
  },

  sendOtp(phone: string): Promise<{ message: string; expiresIn: number }> {
    return request<{ message: string; expiresIn: number }>('POST', '/api/auth/send-otp', { phone, role: 'customer' });
  },

  verifyOtp(phone: string, otp: string): Promise<AuthResponse> {
    return request<AuthResponse>('POST', '/api/auth/verify-otp', { phone, otp, role: 'customer' });
  },

  // ── Registration (3-step) ──────────────────────────────────────────────────
  sendRegisterOtp(phone: string): Promise<{ message: string; expiresIn: number }> {
    return request<{ message: string; expiresIn: number }>('POST', '/api/auth/register/send-otp', { phone });
  },

  verifyRegisterOtp(phone: string, otp: string): Promise<{ message: string; registrationToken: string; expiresIn: number }> {
    return request<{ message: string; registrationToken: string; expiresIn: number }>('POST', '/api/auth/register/verify-otp', { phone, otp });
  },

  completeRegistration(data: {
    registrationToken: string;
    name: string;
    email?: string;
    city?: string;
  }): Promise<AuthResponse> {
    return request<AuthResponse>('POST', '/api/auth/register/complete', data);
  },

  updateProfile(data: { name?: string; email?: string; city?: string }): Promise<AuthUser> {
    return request<AuthUser>('PATCH', '/api/auth/profile', data, true);
  },

  sendEmailOtp(): Promise<{ message: string }> {
    return request<{ message: string }>('POST', '/api/auth/send-email-otp', undefined, true);
  },

  verifyEmailOtp(otp: string): Promise<{ message: string }> {
    return request<{ message: string }>('POST', '/api/auth/verify-email-otp', { otp }, true);
  },

  sendDeleteAccountOtp(): Promise<{ message: string }> {
    return request<{ message: string }>('POST', '/api/auth/delete-account/send-otp', undefined, true);
  },

  deleteAccount(otp: string): Promise<{ message: string }> {
    return request<{ message: string }>('DELETE', '/api/customer/account', { otp }, true);
  },
};

// ─── Restaurants API ─────────────────────────────────────────────────────────

export const restaurantsApi = {
  list(): Promise<ApiRestaurant[]> {
    return request<ApiRestaurant[]>('GET', '/api/restaurants').then((r) => r ?? []);
  },

  get(id: number | string): Promise<ApiRestaurant> {
    return request<ApiRestaurant>('GET', `/api/restaurants/${id}`);
  },

  getMenu(id: number | string): Promise<ApiMenuItem[]> {
    return request<ApiMenuItem[]>('GET', `/api/restaurants/${id}/menu`).then((r) => r ?? []);
  },

  getOrders(id: number | string): Promise<ApiOrder[]> {
    return request<ApiOrder[]>('GET', `/api/restaurants/${id}/orders`, undefined, true);
  },
};

// ─── Menu Items API ───────────────────────────────────────────────────────────

export const menuItemsApi = {
  list(): Promise<ApiMenuItem[]> {
    return request<ApiMenuItem[]>('GET', '/api/menu-items').then((r) => r ?? []);
  },

  get(id: number | string): Promise<ApiMenuItem> {
    return request<ApiMenuItem>('GET', `/api/menu-items/${id}`);
  },
};

// ─── Orders API ───────────────────────────────────────────────────────────────

export const ordersApi = {
  list(): Promise<ApiOrder[]> {
    return request<ApiOrder[]>('GET', '/api/orders', undefined, true).then((r) => r ?? []);
  },

  get(id: number | string): Promise<ApiOrder> {
    return request<ApiOrder>('GET', `/api/orders/${id}`, undefined, true);
  },

  quote(data: {
    restaurantId: number;
    items: { menuItemId: number; quantity: number }[];
    couponCode?: string | null;
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
  }): Promise<QuoteResponse> {
    return request<QuoteResponse>('POST', '/api/orders/quote', data, true);
  },

  create(data: {
    restaurantId: number;
    customerId: number;
    items: ApiOrderItem[];
    deliveryAddress: string;
    customerPhone: string;
    customerName: string;
    paymentMethod: 'cod' | 'upi' | 'card' | 'wallet';
    notes?: string;
    couponCode?: string | null;
    subtotal: string;
    total: string;
    deliveryLatitude?: string | null;
    deliveryLongitude?: string | null;
    razorpayPaymentId?: string;
  }): Promise<ApiOrder> {
    return request<ApiOrder>('POST', '/api/orders', data, true);
  },

  updateStatus(
    id: number | string,
    status: string,
    changedBy?: string,
    changedByRole?: string,
    note?: string,
  ): Promise<ApiOrder> {
    return request<ApiOrder>(
      'PATCH',
      `/api/orders/${id}/status`,
      { status, changedBy, changedByRole, note },
      true,
    );
  },

  assign(id: number | string, riderId: number): Promise<ApiOrder> {
    return request<ApiOrder>('PATCH', `/api/orders/${id}/assign`, { riderId }, true);
  },

  getHistory(id: number | string): Promise<any[]> {
    return request<any[]>('GET', `/api/orders/${id}/history`, undefined, true).then((r) => r ?? []);
  },
};

// ─── Reviews API ─────────────────────────────────────────────────────────────

export const reviewsApi = {
  list(): Promise<ApiReview[]> {
    return request<ApiReview[]>('GET', '/api/reviews', undefined, true).then((r) => r ?? []);
  },

  listByOrderId(orderId: number | string): Promise<ApiReview[]> {
    return request<ApiReview[]>('GET', `/api/reviews?orderId=${orderId}`, undefined, true).then((r) => r ?? []);
  },

  create(data: {
    orderId: number;
    customerId: number;
    restaurantId?: number;
    riderId?: number;
    restaurantRating?: number;
    riderRating?: number;
    comment?: string;
    images?: string[];
    itemRatings?: ApiReviewItemRating[];
  }): Promise<ApiReview> {
    return request<ApiReview>('POST', '/api/reviews', data, true);
  },

  update(id: number | string, data: {
    restaurantRating?: number;
    riderRating?: number;
    comment?: string;
    images?: string[];
    itemRatings?: ApiReviewItemRating[];
  }): Promise<ApiReview> {
    return request<ApiReview>('PATCH', `/api/reviews/${id}`, data, true);
  },
};

// ─── Coupons API ─────────────────────────────────────────────────────────────

export const couponsApi = {
  list(): Promise<ApiCoupon[]> {
    return request<ApiCoupon[]>('GET', '/api/coupons').then((r) => r ?? []);
  },

  validate(code: string): Promise<ApiCoupon> {
    return request<ApiCoupon>('GET', `/api/coupons/validate/${encodeURIComponent(code)}`);
  },
};

// ─── Advertisements API ───────────────────────────────────────────────────────

export const advertisementsApi = {
  list(): Promise<ApiAdvertisement[]> {
    return request<ApiAdvertisement[]>('GET', '/api/advertisements').then((r) => r ?? []);
  },

  active(placement?: 'home' | 'pre_payment' | 'restaurant'): Promise<ApiAdvertisement[]> {
    const q = placement ? `?placement=${placement}` : '';
    return request<ApiAdvertisement[]>('GET', `/api/advertisements/active${q}`).then((r) => r ?? []);
  },

  get(id: number): Promise<ApiAdvertisement> {
    return request<ApiAdvertisement>('GET', `/api/advertisements/${id}`);
  },

  recordImpression(id: number): Promise<void> {
    return request<void>('POST', `/api/advertisements/${id}/impression`);
  },

  recordClick(id: number): Promise<void> {
    return request<void>('POST', `/api/advertisements/${id}/click`);
  },
};

// ─── Customer Addresses API ───────────────────────────────────────────────────
// Canonical URLs: /api/customer/addresses (auth-scoped, JWT identifies the customer)

export const addressesApi = {
  list(): Promise<ApiCustomerAddress[]> {
    return request<ApiCustomerAddress[]>('GET', '/api/customer/addresses', undefined, true).then((r) => r ?? []);
  },

  create(data: {
    label?: string;
    address: string;
    landmark?: string;
    city?: string;
    pincode?: string;
    latitude?: string;
    longitude?: string;
    isDefault?: boolean;
  }): Promise<ApiCustomerAddress> {
    return request<ApiCustomerAddress>('POST', '/api/customer/addresses', data, true);
  },

  update(id: number, data: Partial<Omit<ApiCustomerAddress, 'id' | 'isServiceable'>>): Promise<ApiCustomerAddress> {
    return request<ApiCustomerAddress>('PATCH', `/api/customer/addresses/${id}`, data, true);
  },

  delete(id: number): Promise<void> {
    return request<void>('DELETE', `/api/customer/addresses/${id}`, undefined, true);
  },
};

// ─── Customers API ────────────────────────────────────────────────────────────

export const customersApi = {
  update(id: number, data: { name?: string; email?: string; city?: string }): Promise<AuthUser> {
    return request<AuthUser>('PATCH', `/api/customers/${id}`, data, true);
  },
};

// ─── Riders API ───────────────────────────────────────────────────────────────

export const ridersApi = {
  get(id: number | string): Promise<ApiRider> {
    return request<ApiRider>('GET', `/api/riders/${id}`);
  },
};

// ─── Config API ───────────────────────────────────────────────────────────────

export interface ApiConfig {
  id: number;
  key: string;
  value: string;
  category: string;
  description?: string;
}

export const configApi = {
  list(): Promise<ApiConfig[]> {
    return request<ApiConfig[]>('GET', '/api/config').then((r) => r ?? []);
  },
};

// ─── Maps API ─────────────────────────────────────────────────────────────────

export const mapsApi = {
  getKey(): Promise<{ key: string }> {
    return request<{ key: string }>('GET', '/api/maps-key');
  },
};

// ─── Support Contact API ──────────────────────────────────────────────────────
// No auth required. Cached 5 minutes by the server (Cache-Control: max-age=300).
// Any field can be an empty string if ops hasn't configured it — render no CTA.

export const supportContactApi = {
  get(): Promise<ApiSupportContact> {
    return request<ApiSupportContact>('GET', '/api/public/support-contact');
  },
};

// ─── Notifications API ────────────────────────────────────────────────────────
// Device token endpoints:
//   POST /api/device-tokens   { pushToken, platform }  — register
//   DELETE /api/device-tokens/:token                   — unregister
// Inbox endpoints (Bearer required):
//   GET  /api/notifications?limit=&offset=             — list (flat shape)
//   GET  /api/notifications/:id                        — detail + marks read
//   GET  /api/notifications/unread-count               — { unreadCount }
//   POST /api/notifications/:id/read                   — mark one read
//   POST /api/notifications/read-all                   — mark all read
//
// title / body / eventType are top-level on every row — do NOT read from data.

export const notificationsApi = {
  registerDevice(data: {
    pushToken: string;
    platform: 'ios' | 'android' | 'fcm';
  }): Promise<void> {
    return request<void>('POST', '/api/device-tokens', data, true);
  },

  // Best-effort on logout — backend auto-cleans stale tokens on FCM rejection.
  unregisterDevice(pushToken: string): Promise<void> {
    return request<void>('DELETE', `/api/device-tokens/${encodeURIComponent(pushToken)}`, undefined, true);
  },

  list(params?: { limit?: number; offset?: number }): Promise<ApiNotificationsListResponse> {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request<ApiNotificationsListResponse>('GET', `/api/notifications${qs ? `?${qs}` : ''}`, undefined, true);
  },

  // Fetches full detail AND marks the notification as read in one call.
  getById(id: number): Promise<ApiNotification> {
    return request<ApiNotification>('GET', `/api/notifications/${id}`, undefined, true);
  },

  unreadCount(): Promise<{ unreadCount: number }> {
    return request<{ unreadCount: number }>('GET', '/api/notifications/unread-count', undefined, true);
  },

  markRead(id: number): Promise<void> {
    return request<void>('POST', `/api/notifications/${id}/read`, undefined, true);
  },

  markAllRead(): Promise<void> {
    return request<void>('POST', '/api/notifications/read-all', undefined, true);
  },
};
