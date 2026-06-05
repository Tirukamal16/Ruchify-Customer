import type { MenuItem, Restaurant } from '@/data/restaurants';
import type { ApiMenuItem, ApiRestaurant, ApiOrder } from './api';
import type { Order } from '@/context/OrderContext';
import { BASE_URL } from './api';

const PLACEHOLDER_RESTAURANT_IMG =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&q=90';

// Cuisine-specific restaurant banner images so every restaurant has a relevant hero photo.
const CUISINE_RESTAURANT_PLACEHOLDERS: Record<string, string> = {
  biryani:         'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&h=600&fit=crop&q=90',
  pizza:           'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=600&fit=crop&q=90',
  burger:          'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop&q=90',
  chinese:         'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&h=600&fit=crop&q=90',
  'south indian':  'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&h=600&fit=crop&q=90',
  'north indian':  'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop&q=90',
  desserts:        'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&h=600&fit=crop&q=90',
  bakery:          'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&h=600&fit=crop&q=90',
  cafe:            'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop&q=90',
  coffee:          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop&q=90',
  healthy:         'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop&q=90',
  sandwich:        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&h=600&fit=crop&q=90',
  tiffin:          'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&h=600&fit=crop&q=90',
  meals:           'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=800&h=600&fit=crop&q=90',
  chaat:           'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&h=600&fit=crop&q=90',
  seafood:         'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&h=600&fit=crop&q=90',
  chicken:         'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&h=600&fit=crop&q=90',
  mughlai:         'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop&q=90',
  italian:         'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=600&fit=crop&q=90',
  'fast food':     'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop&q=90',
  noodles:         'https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&h=600&fit=crop&q=90',
  asian:           'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&h=600&fit=crop&q=90',
};

function getRestaurantPlaceholder(cuisineType: string): string {
  if (!cuisineType) return PLACEHOLDER_RESTAURANT_IMG;
  const cuisines = cuisineType.split(',').map((s) => s.trim().toLowerCase());
  for (const c of cuisines) {
    if (CUISINE_RESTAURANT_PLACEHOLDERS[c]) return CUISINE_RESTAURANT_PLACEHOLDERS[c];
  }
  return PLACEHOLDER_RESTAURANT_IMG;
}

const PLACEHOLDER_MENU_IMG =
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=400&fit=crop&q=85';

// Category-specific placeholder images so items without an uploaded photo
// still show a relevant food image instead of a generic pizza picture.
const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  biryani:      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&h=400&fit=crop&q=85',
  rice:         'https://images.unsplash.com/photo-1536304993881-ff86e0c83cef?w=600&h=400&fit=crop&q=85',
  burger:       'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop&q=85',
  pizza:        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop&q=85',
  chinese:      'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&h=400&fit=crop&q=85',
  noodles:      'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&h=400&fit=crop&q=85',
  desserts:     'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&h=400&fit=crop&q=85',
  sweets:       'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&h=400&fit=crop&q=85',
  healthy:      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop&q=85',
  salad:        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop&q=85',
  coffee:       'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop&q=85',
  beverages:    'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&h=400&fit=crop&q=85',
  drinks:       'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&h=400&fit=crop&q=85',
  sandwich:     'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&h=400&fit=crop&q=85',
  chaat:        'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&h=400&fit=crop&q=85',
  'south indian': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&h=400&fit=crop&q=85',
  dosa:         'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&h=400&fit=crop&q=85',
  idli:         'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&h=400&fit=crop&q=85',
  'north indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop&q=85',
  curry:        'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop&q=85',
  dal:          'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop&q=85',
  breads:       'https://images.unsplash.com/photo-1568600891547-4ca48aa6c157?w=600&h=400&fit=crop&q=85',
  roti:         'https://images.unsplash.com/photo-1568600891547-4ca48aa6c157?w=600&h=400&fit=crop&q=85',
  sides:        'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop&q=85',
  snacks:       'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&h=400&fit=crop&q=85',
  starters:     'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=600&h=400&fit=crop&q=85',
  'main course': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop&q=85',
  seafood:      'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&h=400&fit=crop&q=85',
  chicken:      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&h=400&fit=crop&q=85',
  mutton:       'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&h=400&fit=crop&q=85',
};

function getMenuPlaceholder(category: string): string {
  const key = category.trim().toLowerCase();
  return CATEGORY_PLACEHOLDERS[key] ?? PLACEHOLDER_MENU_IMG;
}

/**
 * Convert a relative image path from the backend into an absolute URL.
 * /images/dosa.png        → https://ruchify.in/images/dosa.png
 * /objects/<uuid>         → https://ruchify.in/objects/<uuid>
 * Already absolute URLs   → returned as-is
 * Falsy                   → returns the placeholder
 */
function resolveImage(url: string | undefined | null, placeholder: string): string {
  if (!url) return placeholder;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BASE_URL}${url}`;
}

function formatTime(t?: string): string {
  if (!t) return '';
  // Convert "09:00" → "9:00 AM", "22:00" → "10:00 PM"
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function adaptRestaurant(api: ApiRestaurant): Restaurant {
  const prepTime = api.avgPrepTime ?? api.deliveryTime ?? 35;
  const lat = api.latitude ? parseFloat(api.latitude) : undefined;
  const lng = api.longitude ? parseFloat(api.longitude) : undefined;
  const cuisineLower = (api.cuisineType || '').toLowerCase();
  const isVeg = cuisineLower.includes('pure veg') ||
    (cuisineLower.includes('veg') && !cuisineLower.includes('non-veg') && !cuisineLower.includes('nonveg'));
  return {
    id: String(api.id),
    name: api.name,
    cuisine: api.cuisineType ? api.cuisineType.split(',').map((s) => s.trim()) : ['Restaurant'],
    rating: parseFloat(String(api.rating ?? '4.0')),
    deliveryTime: `${prepTime}-${prepTime + 10} min`,
    distance: '—',
    costForTwo: Math.round(parseFloat(api.minOrder ?? '150') * 2),
    image: resolveImage(api.imageUrl, getRestaurantPlaceholder(api.cuisineType || '')),
    offer: undefined,
    address: api.address || '',
    openTime: formatTime(api.openTime) || '10:00 AM',
    closeTime: formatTime(api.closeTime) || '10:00 PM',
    menu: [],
    latitude: lat,
    longitude: lng,
    isVeg,
  };
}

export function adaptMenuItem(api: ApiMenuItem): MenuItem {
  // Derive portionSize: use API field if present, else first size name, else nothing
  const portionSize =
    api.portionSize ||
    (api.sizes && api.sizes.length > 0 ? api.sizes[0].name : undefined);

  return {
    id: String(api.id),
    name: api.name,
    description: api.description || '',
    price: parseFloat(api.basePrice),
    image: resolveImage(api.imageUrl, getMenuPlaceholder(api.category)),
    rating: parseFloat(api.avgRating ?? '0') || 0,
    avgRating: api.avgRating ?? null,
    totalRatings: api.totalRatings,
    isVeg: api.isVeg,
    category: api.category,
    popular: false,
    portionSize,
    sizes: api.sizes && api.sizes.length > 0 ? api.sizes : undefined,
  };
}

/** Map API order status to the local OrderStatus type */
export function adaptOrderStatus(apiStatus: string): Order['status'] {
  const map: Record<string, Order['status']> = {
    placed: 'placed',
    accepted: 'accepted',
    preparing: 'preparing',
    ready: 'ready',
    picked_up: 'picked_up',
    on_the_way: 'on_the_way',
    delivered: 'delivered',
    cancelled: 'cancelled',
  };
  return map[apiStatus] ?? 'placed';
}

/** Build a partial Order object from an API order (items will be missing – caller must supply them) */
export function adaptApiOrder(api: ApiOrder, restaurantName: string): Omit<Order, 'items'> {
  const paymentLabel =
    api.paymentMethod === 'cod' ? 'Cash on Delivery' :
    api.paymentMethod === 'upi' ? 'UPI Payment' : 'Card Payment';
  return {
    id: String(api.id),
    restaurantName,
    subtotal: parseFloat(api.subtotal),
    deliveryFee: parseFloat(api.deliveryFee),
    platformFee: parseFloat(api.platformFee ?? '5'),
    discount: parseFloat(api.discount ?? '0'),
    total: parseFloat(api.total),
    status: adaptOrderStatus(api.status),
    createdAt: api.createdAt,
    estimatedDelivery: '35-45 min',
    address: api.deliveryAddress,
    paymentMethod: paymentLabel,
  };
}
