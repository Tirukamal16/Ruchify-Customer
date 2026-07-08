import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput, Pressable,
  FlatList, Platform, Dimensions, ActivityIndicator, Linking,
  Modal, TouchableWithoutFeedback, Switch, Alert, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/colors';
import { categories } from '@/data/restaurants';
import type { Restaurant } from '@/data/restaurants';
import { BASE_URL, restaurantsApi, menuItemsApi, advertisementsApi, addressesApi, type ApiAdvertisement, type ApiCustomerAddress } from '@/lib/api';
import { adaptRestaurant } from '@/lib/adapters';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrderContext';
import { useNotifications } from '@/context/NotificationsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, useToast } from '@/components/Toast';
import AppHeader from '@/components/AppHeader';
import MapLocationPicker, { type PickedLocation } from '@/components/MapLocationPicker';
import { isWithinServiceArea, haversineKm, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG, formatKm } from '@/lib/geofence';
import { fuzzyMatch } from '@/lib/fuzzySearch';

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function parseDeliveryMinutes(deliveryTime: string): number {
  const match = deliveryTime.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 30;
}

const { width } = Dimensions.get('window');

type SortOption = 'relevance' | 'delivery_time' | 'rating' | 'distance' | 'cost_low' | 'cost_high';

// cost_low/cost_high are excluded — the backend doesn't expose a real cost field
const SORT_LABELS: Partial<Record<SortOption, string>> = {
  relevance: 'Relevance',
  delivery_time: 'Delivery Time',
  rating: 'Rating',
  distance: 'Distance',
};

const RATING_OPTIONS = [3, 3.5, 4, 4.5];

const AD_GRADIENTS: [string, string][] = [
  ['#FF6B35', '#FF8C5A'],
  ['#7C3AED', '#9B5DE5'],
  ['#0EA5E9', '#38BDF8'],
  ['#16A34A', '#4ADE80'],
];

function AdBannerCard({ item, index }: { item: ApiAdvertisement; index: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [g1, g2] = AD_GRADIENTS[index % AD_GRADIENTS.length];

  const imageUri = item.imageUrl
    ? item.imageUrl.startsWith('http')
      ? item.imageUrl
      : `${BASE_URL}${item.imageUrl}`
    : null;

  const handlePress = () => {
    advertisementsApi.recordClick(item.id).catch(() => {});
    if (item.linkUrl) {
      Linking.openURL(item.linkUrl).catch(() => {});
    }
  };

  if (imageUri) {
    return (
      <View style={styles.sliderOfferCard}>
        <Pressable onPress={handlePress} style={styles.offerCard}>
          <Image
            source={{ uri: imageUri }}
            style={styles.adImage}
            contentFit="cover"
            priority="high"
            transition={200}
            cachePolicy="memory-disk"
          />
          {(!!item.title || !!item.description) && (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={styles.adOverlay}
            >
              <Text style={styles.adOverlayTitle} numberOfLines={1}>{item.title}</Text>
              {!!item.description && (
                <Text style={styles.adOverlayDesc} numberOfLines={1}>{item.description}</Text>
              )}
            </LinearGradient>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.sliderOfferCard}>
      <Pressable onPress={handlePress} style={styles.offerCard}>
        <LinearGradient
          colors={[g1, g2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
        />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
          <Text style={styles.offerTitle}>{item.title}</Text>
          {!!item.description && <Text style={styles.offerSubtitle}>{item.description}</Text>}
        </View>
      </Pressable>
    </View>
  );
}

function AdSlider({ ads }: { ads: ApiAdvertisement[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const activeIndexRef = useRef(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    viewableItems.forEach(({ item }: any) => {
      advertisementsApi.recordImpression((item as ApiAdvertisement).id).catch(() => {});
    });
  }).current;

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      const next = (activeIndexRef.current + 1) % ads.length;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      activeIndexRef.current = next;
      setActiveIndex(next);
    }, 3500);
    return () => clearInterval(timer);
  }, [ads.length]);

  const handleScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    }
  }, []);

  return (
    <View style={styles.sliderWrapper}>
      <FlatList
        ref={flatListRef}
        data={ads}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => <AdBannerCard item={item} index={index} />}
        keyExtractor={(item) => String(item.id)}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />
      {ads.length > 1 && (
        <View style={styles.dotsContainer}>
          {ads.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function RestaurantCard({ item, matchedItemName }: { item: Restaurant; matchedItemName?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const costPerPerson = Math.round(item.costForTwo / 2);

  return (
    <Pressable
      style={({ pressed }) => [styles.restaurantCard, pressed && { opacity: 0.95, transform: [{ scale: 0.985 }] }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.push({ pathname: '/restaurant/[id]', params: { id: item.id } });
      }}
    >
      <View style={styles.restaurantImageWrap}>
        <Image source={{ uri: item.image }} style={styles.restaurantImage} contentFit="cover" />
        {/* Veg / Non-veg indicator */}
        <View style={[styles.vegIndicator, item.isVeg ? styles.vegIndicatorGreen : styles.vegIndicatorRed]}>
          <View style={[styles.vegDot, item.isVeg ? styles.vegDotGreen : styles.vegDotRed]} />
        </View>
        {item.offer && (
          <View style={styles.offerBadge}>
            <Ionicons name="pricetag" size={10} color="#fff" />
            <Text style={styles.offerBadgeText}>{item.offer}</Text>
          </View>
        )}
      </View>
      <View style={styles.restaurantInfo}>
        <View style={styles.restaurantNameRow}>
          <Text style={styles.restaurantName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color="#fff" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.cuisineText} numberOfLines={1}>{item.cuisine.join(' · ')}</Text>
        {matchedItemName && (
          <View style={styles.menuMatchTag}>
            <Ionicons name="fast-food-outline" size={11} color={colors.primary} />
            <Text style={styles.menuMatchText} numberOfLines={1}>Serves: {matchedItemName}</Text>
          </View>
        )}
        <View style={styles.restaurantMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>{item.deliveryTime}</Text>
          </View>
          {(item.distanceKm != null || item.distance !== '—') && (
            <>
              <View style={styles.metaDot} />
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.metaText}>
                  {item.distanceKm != null ? formatDistance(item.distanceKm) : item.distance}
                </Text>
              </View>
            </>
          )}
          <View style={styles.metaDot} />
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText}>₹{costPerPerson} for one</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background }}>
      <Ionicons name="alert-circle-outline" size={52} color={colors.borderLight} />
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: colors.text, marginTop: 16, textAlign: 'center' }}>Couldn't load restaurants</Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>Pull to refresh or tap Retry</Text>
      <Pressable onPress={retry} style={{ marginTop: 24, backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 }}>
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' }}>Retry</Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders } = useOrders();
  const queryClient = useQueryClient();
  const { show: showToast, toastProps } = useToast();
  const { unreadCount, openPanel, refresh: refreshNotifications } = useNotifications();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<ApiCustomerAddress | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<PickedLocation | null>(null);
  const [pendingLabel, setPendingLabel] = useState('Home');
  const [savingLocation, setSavingLocation] = useState(false);
  const [gettingCurrentLoc, setGettingCurrentLoc] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const serviceAreaChecked = useRef(false);
  const searchInputRef = useRef<TextInput>(null);

  // Filter & sort state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterOffersOnly, setFilterOffersOnly] = useState(false);
  const [filterCuisines, setFilterCuisines] = useState<string[]>([]);
  const [filterBolt, setFilterBolt] = useState(false);

  // Temp filter state used inside modal before applying
  const [tempSort, setTempSort] = useState<SortOption>('relevance');
  const [tempRating, setTempRating] = useState<number | null>(null);
  const [tempOffersOnly, setTempOffersOnly] = useState(false);
  const [tempCuisines, setTempCuisines] = useState<string[]>([]);
  const [tempBolt, setTempBolt] = useState(false);

  const activeFilterCount = [
    sortBy !== 'relevance',
    filterRating !== null,
    filterOffersOnly,
    filterCuisines.length > 0,
    filterBolt,
    vegOnly,
  ].filter(Boolean).length;

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressesApi.list().then((r) => r ?? []),
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!addresses) return;
    if (addresses.length === 0) {
      setSelectedAddress(null);
      return;
    }
    const stillExists = selectedAddress && addresses.some((a) => a.id === selectedAddress.id);
    if (!stillExists) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      setSelectedAddress(def);
    }
  }, [addresses]);

  // Get device location once; check service area and enable distance sorting
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        setUserLocation({ latitude, longitude });

        if (!serviceAreaChecked.current) {
          serviceAreaChecked.current = true;
          const dist = haversineKm(latitude, longitude, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG);
          if (!isWithinServiceArea(latitude, longitude)) {
            showToast(
              `Delivery is currently available only in Chittoor. You're ${formatDistance(dist)} away.`,
              'info',
              6000,
            );
          }
        }
      } catch {}
    })();
  }, []);

  // Whether the currently selected delivery address is outside the service area.
  const isAddressOutOfArea = useMemo(() => {
    if (!selectedAddress?.latitude || !selectedAddress?.longitude) return false;
    const lat = parseFloat(selectedAddress.latitude);
    const lng = parseFloat(selectedAddress.longitude);
    if (isNaN(lat) || isNaN(lng)) return false;
    return !isWithinServiceArea(lat, lng);
  }, [selectedAddress]);

  const handleMapConfirm = (loc: PickedLocation) => {
    setPendingLocation(loc);
    const existingLabels = (addresses ?? []).map((a) => a.label?.toLowerCase());
    if (!existingLabels.includes('home')) setPendingLabel('Home');
    else if (!existingLabels.includes('work')) setPendingLabel('Work');
    else setPendingLabel('Other');
    // Delay so MapLocationPicker's modal fully dismisses before the address
    // modal presents — prevents iOS modal-stacking glitches.
    setTimeout(() => setAddressModalVisible(true), 350);
  };

  const handleSavePickedLocation = async () => {
    console.log('[AddressSave] START — user:', user?.id, 'pendingLocation:', JSON.stringify(pendingLocation));
    if (!user || !pendingLocation) {
      console.log('[AddressSave] ABORTED — missing user or pendingLocation');
      return;
    }
    setSavingLocation(true);
    const payload = {
      label: pendingLabel,
      address: pendingLocation.address || pendingLocation.city || 'My Location',
      city: pendingLocation.city || 'Chittoor',
      pincode: pendingLocation.pincode || undefined,
      latitude: pendingLocation.latitude,
      longitude: pendingLocation.longitude,
      isDefault: !addresses || addresses.length === 0,
    };
    console.log('[AddressSave] API payload:', JSON.stringify(payload));
    try {
      const newAddr = await addressesApi.create(payload);
      console.log('[AddressSave] API create response:', JSON.stringify(newAddr));
      // Refetch the addresses list so the header updates immediately
      await queryClient.refetchQueries({ queryKey: ['addresses'] });
      const updatedList = queryClient.getQueryData<ApiCustomerAddress[]>(['addresses']) ?? [];
      console.log('[AddressSave] Updated addresses list:', JSON.stringify(updatedList));
      const toSelect = newAddr ?? updatedList.find((a) => a.isDefault) ?? updatedList[updatedList.length - 1] ?? null;
      console.log('[AddressSave] Selecting address:', JSON.stringify(toSelect));
      setSelectedAddress(toSelect);
      setPendingLocation(null);
      setAddressModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      console.log('[AddressSave] ERROR:', err?.status, err?.code, err?.message);
      const msg = err?.message?.replace(/^\d+:\s*/, '') || 'Could not save address. Please try again.';
      Alert.alert('Could not save address', msg);
    } finally {
      setSavingLocation(false);
    }
  };

  // Use current GPS location as delivery address
  const handleUseCurrentLocation = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setGettingCurrentLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow location access to use this feature.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      if (!isWithinServiceArea(latitude, longitude)) {
        const dist = haversineKm(latitude, longitude, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG);
        Alert.alert(
          'Outside Delivery Area',
          `Your current location is ${formatKm(dist)} away from Chittoor. We only deliver within 80 km of Chittoor.`,
        );
        return;
      }

      // Reverse geocode using Expo
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addrParts = [geo?.street, geo?.district || geo?.subregion].filter(Boolean);
      const addr = addrParts.join(', ') || 'Current Location';
      const city = geo?.city || geo?.region || 'Chittoor';
      const pincode = geo?.postalCode || '';

      const newPending: PickedLocation = {
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        address: addr,
        city,
        pincode,
      };
      setPendingLocation(newPending);
      const existingLabels = (addresses ?? []).map((a) => a.label?.toLowerCase());
      if (!existingLabels.includes('home')) setPendingLabel('Home');
      else if (!existingLabels.includes('work')) setPendingLabel('Work');
      else setPendingLabel('Other');
      // The pending card will now show in the address modal
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      Alert.alert('Error', 'Unable to get your current location. Please try again.');
    } finally {
      setGettingCurrentLoc(false);
    }
  }, [addresses]);

  const { data: apiRestaurants, isLoading, isError } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => restaurantsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: ads } = useQuery({
    queryKey: ['ads', 'home'],
    queryFn: () => advertisementsApi.active('home'),
    staleTime: 10 * 60 * 1000,
  });

  // Always fetch all menu items for veg filtering & search
  const { data: allMenuItems } = useQuery({
    queryKey: ['menu-items-all'],
    queryFn: () => menuItemsApi.list(),
    staleTime: 10 * 60 * 1000,
  });

  // Set of restaurant IDs where ALL their menu items are veg (pure-veg restaurants).
  // Used by the Veg toggle so only fully-vegetarian restaurants appear.
  const vegRestaurantIds = useMemo(() => {
    if (!allMenuItems) return null;
    const restaurantVegStatus = new Map<string, boolean>();
    allMenuItems.forEach((item) => {
      const id = String(item.restaurantId);
      if (!restaurantVegStatus.has(id)) {
        restaurantVegStatus.set(id, item.isVeg);
      } else if (!item.isVeg) {
        // Even one non-veg item disqualifies the restaurant
        restaurantVegStatus.set(id, false);
      }
    });
    const ids = new Set<string>();
    restaurantVegStatus.forEach((allVeg, id) => { if (allVeg) ids.add(id); });
    return ids;
  }, [allMenuItems]);

  // Map restaurantId → first matched item name (for search).
  // Searches both item name and description for better recall.
  const menuMatchMap = useMemo(() => {
    if (!search || !allMenuItems) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const item of allMenuItems) {
      if (
        (fuzzyMatch(item.name, search) ||
          (item.description && fuzzyMatch(item.description, search))) &&
        !map.has(String(item.restaurantId))
      ) {
        map.set(String(item.restaurantId), item.name);
      }
    }
    return map;
  }, [allMenuItems, search]);

  // Map restaurantId → first matched item name (for category tile filter).
  // Mirrors menuMatchMap logic so that clicking "Biryani" finds restaurants
  // whose menu items contain "biryani" even if the cuisine tag doesn't.
  const categoryMenuMatchMap = useMemo(() => {
    if (!selectedCategory || !allMenuItems) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const item of allMenuItems) {
      if (
        (fuzzyMatch(item.name, selectedCategory) ||
          fuzzyMatch(item.category, selectedCategory) ||
          (item.description && fuzzyMatch(item.description, selectedCategory))) &&
        !map.has(String(item.restaurantId))
      ) {
        map.set(String(item.restaurantId), item.name);
      }
    }
    return map;
  }, [allMenuItems, selectedCategory]);

  const restaurants: Restaurant[] = useMemo(() => {
    const base = (apiRestaurants ?? [])
      .filter((r) => r.isActive)
      .map((r) => {
        const adapted = adaptRestaurant(r);
        // Override isVeg using actual menu items when available (all items must be veg).
        // Falls back to cuisine-name heuristic while menu items are still loading.
        const effectiveIsVeg = vegRestaurantIds
          ? vegRestaurantIds.has(adapted.id)
          : adapted.isVeg;
        if (userLocation && adapted.latitude != null && adapted.longitude != null) {
          const km = haversineKm(userLocation.latitude, userLocation.longitude, adapted.latitude, adapted.longitude);
          return { ...adapted, isVeg: effectiveIsVeg, distanceKm: km, distance: formatDistance(km) };
        }
        return { ...adapted, isVeg: effectiveIsVeg };
      });
    if (userLocation) {
      base.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }
    return base;
  }, [apiRestaurants, userLocation, vegRestaurantIds]);

  // Extract all unique cuisines for cuisine filter
  const availableCuisines = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach((r) => r.cuisine.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    let result = restaurants.filter((r) => {
      const matchesSearch = !search ||
        fuzzyMatch(r.name, search) ||
        r.cuisine.some((c) => fuzzyMatch(c, search)) ||
        (r.address && fuzzyMatch(r.address, search)) ||
        menuMatchMap.has(r.id);
      // Use includes (not ===) so "South Indian" cuisine matches "south indian" category
      // and vice versa. Also check menu items so e.g. clicking "Biryani" shows a
      // "North Indian" restaurant that has biryani on the menu.
      const matchesCategory = !selectedCategory ||
        r.cuisine.some((c) =>
          fuzzyMatch(c, selectedCategory) || fuzzyMatch(selectedCategory, c)
        ) ||
        categoryMenuMatchMap.has(r.id);
      // Veg filter: show if restaurant is fully veg OR has any veg menu items
      const matchesVeg = !vegOnly || r.isVeg === true || (vegRestaurantIds?.has(r.id) ?? false);
      const matchesRating = !filterRating || r.rating >= filterRating;
      const matchesOffers = !filterOffersOnly || !!r.offer;
      const matchesCuisines = filterCuisines.length === 0 ||
        r.cuisine.some((c) => filterCuisines.includes(c));
      const matchesBolt = !filterBolt || parseDeliveryMinutes(r.deliveryTime) <= 15;
      return matchesSearch && matchesCategory && matchesVeg && matchesRating && matchesOffers && matchesCuisines && matchesBolt;
    });

    // Apply sort
    switch (sortBy) {
      case 'delivery_time':
        result = [...result].sort((a, b) => parseDeliveryMinutes(a.deliveryTime) - parseDeliveryMinutes(b.deliveryTime));
        break;
      case 'rating':
        result = [...result].sort((a, b) => b.rating - a.rating);
        break;
      case 'distance':
        result = [...result].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
        break;
      case 'cost_low':
        result = [...result].sort((a, b) => a.costForTwo - b.costForTwo);
        break;
      case 'cost_high':
        result = [...result].sort((a, b) => b.costForTwo - a.costForTwo);
        break;
    }

    return result;
  }, [restaurants, search, selectedCategory, vegOnly, vegRestaurantIds, filterRating, filterOffersOnly, filterCuisines, filterBolt, sortBy, menuMatchMap, categoryMenuMatchMap]);

  const openFilterModal = () => {
    // Initialise temp state from current applied state
    setTempSort(sortBy);
    setTempRating(filterRating);
    setTempOffersOnly(filterOffersOnly);
    setTempCuisines([...filterCuisines]);
    setTempBolt(filterBolt);
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setSortBy(tempSort);
    setFilterRating(tempRating);
    setFilterOffersOnly(tempOffersOnly);
    setFilterCuisines([...tempCuisines]);
    setFilterBolt(tempBolt);
    setFilterModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const resetFilters = () => {
    setTempSort('relevance');
    setTempRating(null);
    setTempOffersOnly(false);
    setTempCuisines([]);
    setTempBolt(false);
  };

  const clearAllFilters = () => {
    setSortBy('relevance');
    setFilterRating(null);
    setFilterOffersOnly(false);
    setFilterCuisines([]);
    setFilterBolt(false);
    setVegOnly(false);
  };

  return (
    <View style={styles.container}>
      <Toast {...toastProps} />

      {/* ── App Header ─────────────────────────────────────────────────────── */}
      <AppHeader
        right={
          <View style={styles.headerRight}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                refreshNotifications();
                openPanel();
              }}
            >
              <Ionicons name="notifications-outline" size={23} color={colors.text} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        }
      >
        <Pressable style={styles.locationRow} onPress={() => setAddressModalVisible(true)}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>Deliver to</Text>
            <Text style={styles.locationAddress} numberOfLines={1}>
              {selectedAddress
                ? `${selectedAddress.label ? selectedAddress.label + ' – ' : ''}${selectedAddress.address}${selectedAddress.city ? ', ' + selectedAddress.city : ''}`
                : 'Select delivery location'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        </Pressable>
      </AppHeader>

      {/* ── Address picker modal ────────────────────────────────────────────── */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setAddressModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Choose delivery address</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            {!pendingLocation && (addresses && addresses.length > 0 ? (
              addresses.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                const lat = parseFloat(addr.latitude);
                const lng = parseFloat(addr.longitude);
                const isOutOfArea = !isNaN(lat) && !isNaN(lng) && !isWithinServiceArea(lat, lng);
                return (
                  <Pressable
                    key={addr.id}
                    style={[styles.addressRow, isSelected && styles.addressRowSelected, isOutOfArea && { opacity: 0.55 }]}
                    onPress={() => {
                      if (isOutOfArea) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setSelectedAddress(addr);
                      setAddressModalVisible(false);
                    }}
                  >
                    <View style={[styles.addressIcon, isSelected && styles.addressIconSelected]}>
                      <Ionicons
                        name={addr.label?.toLowerCase() === 'home' ? 'home' : addr.label?.toLowerCase() === 'work' ? 'briefcase' : 'location'}
                        size={16}
                        color={isSelected ? '#fff' : colors.textSecondary}
                      />
                    </View>
                    <View style={styles.addressInfo}>
                      {!!addr.label && <Text style={[styles.addressLabel, isSelected && styles.addressLabelSelected]}>{addr.label}</Text>}
                      <Text style={styles.addressText} numberOfLines={2}>{addr.address}{addr.city ? ', ' + addr.city : ''}</Text>
                      {!!addr.landmark && <Text style={styles.addressLandmark} numberOfLines={1}>{addr.landmark}</Text>}
                      {isOutOfArea && (
                        <View style={styles.notDeliverableBadge}>
                          <Text style={styles.notDeliverableText}>Not deliverable</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && !isOutOfArea && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.noAddressState}>
                <Ionicons name="location-outline" size={40} color={colors.textLight} />
                <Text style={styles.noAddressText}>No saved addresses</Text>
                <Text style={styles.noAddressSubtext}>Add a location below</Text>
              </View>
            ))}

            {/* Pending location card */}
            {pendingLocation && (
              <View style={styles.pendingCard}>
                <View style={styles.pendingAddrRow}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                  <Text style={styles.pendingAddrText} numberOfLines={2}>
                    {pendingLocation.address}
                    {pendingLocation.city ? `, ${pendingLocation.city}` : ''}
                    {pendingLocation.pincode ? ` – ${pendingLocation.pincode}` : ''}
                  </Text>
                </View>
                <Text style={styles.pendingLabelHint}>Save this location as:</Text>
                <View style={styles.labelRow}>
                  {['Home', 'Work', 'Other'].map((l) => (
                    <Pressable
                      key={l}
                      style={[styles.labelChip, pendingLabel === l && styles.labelChipActive]}
                      onPress={() => setPendingLabel(l)}
                    >
                      <Text style={[styles.labelChipText, pendingLabel === l && styles.labelChipTextActive]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.pendingActions}>
                  <Pressable style={styles.pendingCancelBtn} onPress={() => setPendingLocation(null)}>
                    <Text style={styles.pendingCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.pendingSaveBtn, savingLocation && { opacity: 0.7 }]}
                    onPress={handleSavePickedLocation}
                    disabled={savingLocation}
                  >
                    {savingLocation
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.pendingSaveText}>Save Address</Text>
                    }
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          {!pendingLocation && user && (
            <View style={styles.addressActions}>
              {Platform.OS !== 'web' && (
                <Pressable
                  style={[styles.addressActionBtn, styles.addressActionBtnPrimary, gettingCurrentLoc && { opacity: 0.7 }]}
                  onPress={handleUseCurrentLocation}
                  disabled={gettingCurrentLoc}
                >
                  {gettingCurrentLoc
                    ? <ActivityIndicator size="small" color="#fff" />
                    : (
                      <>
                        <Ionicons name="navigate" size={16} color="#fff" />
                        <Text style={styles.addressActionBtnTextWhite}>Use Current Location</Text>
                      </>
                    )
                  }
                </Pressable>
              )}
              {Platform.OS !== 'web' && (
                <Pressable
                  style={styles.addressActionBtn}
                  onPress={() => {
                    setAddressModalVisible(false);
                    setShowMapPicker(true);
                  }}
                >
                  <Ionicons name="map-outline" size={16} color={colors.primary} />
                  <Text style={styles.addressActionBtnText}>Add from Map</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Modal>

      {showMapPicker && (
        <MapLocationPicker
          visible
          onClose={() => setShowMapPicker(false)}
          onConfirm={handleMapConfirm}
        />
      )}


      {/* ── Filter / Sort modal ─────────────────────────────────────────────── */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={styles.modalHandle} />
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Sort & Filter</Text>
            <Pressable onPress={resetFilters}>
              <Text style={styles.filterResetText}>Reset All</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            {/* Sort By */}
            <Text style={styles.filterSectionLabel}>Sort By</Text>
            <View style={styles.filterChipsWrap}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.filterChip, tempSort === opt && styles.filterChipActive]}
                  onPress={() => setTempSort(opt)}
                >
                  <Text style={[styles.filterChipText, tempSort === opt && styles.filterChipTextActive]}>
                    {SORT_LABELS[opt]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Ratings */}
            <Text style={styles.filterSectionLabel}>Minimum Rating</Text>
            <View style={styles.filterChipsWrap}>
              <Pressable
                style={[styles.filterChip, tempRating === null && styles.filterChipActive]}
                onPress={() => setTempRating(null)}
              >
                <Text style={[styles.filterChipText, tempRating === null && styles.filterChipTextActive]}>Any</Text>
              </Pressable>
              {RATING_OPTIONS.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.filterChip, tempRating === r && styles.filterChipActive]}
                  onPress={() => setTempRating(r)}
                >
                  <Ionicons name="star" size={12} color={tempRating === r ? '#fff' : colors.star} />
                  <Text style={[styles.filterChipText, tempRating === r && styles.filterChipTextActive]}>{r}+</Text>
                </Pressable>
              ))}
            </View>

            {/* Offers & Bolt */}
            <Text style={styles.filterSectionLabel}>Special Filters</Text>
            <View style={styles.filterTogglesWrap}>
              <Pressable
                style={[styles.filterToggleRow, tempBolt && styles.filterToggleRowActive]}
                onPress={() => setTempBolt(!tempBolt)}
              >
                <Ionicons name="flash-outline" size={18} color={tempBolt ? colors.primary : colors.textSecondary} />
                <View style={styles.filterToggleInfo}>
                  <Text style={[styles.filterToggleLabel, tempBolt && { color: colors.primary }]}>Bolt – 15 Mins</Text>
                  <Text style={styles.filterToggleSubtext}>Ultra-fast delivery restaurants</Text>
                </View>
                <View style={[styles.filterToggleCheck, tempBolt && styles.filterToggleCheckActive]}>
                  {tempBolt && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </Pressable>
            </View>

            {/* Cuisines */}
            {availableCuisines.length > 0 && (
              <>
                <Text style={styles.filterSectionLabel}>Cuisines</Text>
                <View style={styles.filterChipsWrap}>
                  {availableCuisines.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.filterChip, tempCuisines.includes(c) && styles.filterChipActive]}
                      onPress={() => {
                        setTempCuisines((prev) =>
                          prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                        );
                      }}
                    >
                      <Text style={[styles.filterChipText, tempCuisines.includes(c) && styles.filterChipTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <Pressable style={styles.applyFiltersBtn} onPress={applyFilters}>
            <Text style={styles.applyFiltersBtnText}>Apply Filters</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
        removeClippedSubviews={Platform.OS !== 'web'}
        overScrollMode="never"
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBarWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchBarInput}
              placeholder="Search restaurants, dishes..."
              placeholderTextColor={colors.textLight}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textLight} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Ad Banners Slider */}
        {ads && ads.length > 0 && <AdSlider ads={ads} />}

        {/* Categories */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>What's on your mind?</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={styles.categoryTile}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setSelectedCategory(isActive ? null : cat.id);
                }}
              >
                <View style={[styles.categoryImgWrap, isActive && styles.categoryImgWrapActive]}>
                  <Image
                    source={{ uri: (cat as any).image }}
                    style={styles.categoryImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </View>
                <Text style={[styles.categoryTileText, isActive && styles.categoryTileTextActive]} numberOfLines={1}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Restaurant section header */}
        <View style={styles.restaurantHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurantSectionTitle}>
              {userLocation ? 'Nearby Restaurants' : 'Popular Restaurants'}
            </Text>
            {filteredRestaurants.length > 0 && (
              <Text style={styles.restaurantCount}>{filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}</Text>
            )}
          </View>

          {/* Veg toggle */}
          <Pressable
            style={[styles.vegToggleChip, vegOnly && styles.vegToggleChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setVegOnly(!vegOnly);
            }}
          >
            <View style={[styles.vegDot, vegOnly ? styles.vegDotGreen : { backgroundColor: colors.border }]} />
            <Text style={[styles.vegToggleText, vegOnly && styles.vegToggleTextActive]}>Veg</Text>
          </Pressable>

          {/* Filter button */}
          <Pressable style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]} onPress={openFilterModal}>
            <Ionicons name="options-outline" size={16} color={activeFilterCount > 0 ? '#fff' : colors.text} />
            <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            </Text>
          </Pressable>
        </View>

        {/* Active filter chips row */}
        {(sortBy !== 'relevance' || filterBolt || filterOffersOnly) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipsRow}>
            {sortBy !== 'relevance' && (
              <Pressable style={styles.activeChip} onPress={() => setSortBy('relevance')}>
                <Text style={styles.activeChipText}>{SORT_LABELS[sortBy]}</Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            )}
            {filterBolt && (
              <Pressable style={styles.activeChip} onPress={() => setFilterBolt(false)}>
                <Ionicons name="flash" size={12} color={colors.primary} />
                <Text style={styles.activeChipText}>Bolt 15 mins</Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            )}
            {filterOffersOnly && (
              <Pressable style={styles.activeChip} onPress={() => setFilterOffersOnly(false)}>
                <Text style={styles.activeChipText}>Offers</Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            )}
            {filterRating !== null && (
              <Pressable style={styles.activeChip} onPress={() => setFilterRating(null)}>
                <Ionicons name="star" size={12} color={colors.primary} />
                <Text style={styles.activeChipText}>{filterRating}+ stars</Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            )}
            <Pressable style={styles.clearAllChip} onPress={clearAllFilters}>
              <Text style={styles.clearAllChipText}>Clear all</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* Out-of-area banner — shown when the chosen delivery address is outside service area */}
        {isAddressOutOfArea && (
          <View style={styles.outOfAreaBanner}>
            <Ionicons name="alert-circle-outline" size={28} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.outOfAreaTitle}>Outside Delivery Area</Text>
              <Text style={styles.outOfAreaBody}>
                We currently deliver only within 80 km of Chittoor. The selected address is outside our service area.
                Please change your delivery address to see available restaurants.
              </Text>
            </View>
            <Pressable onPress={() => setAddressModalVisible(true)} style={styles.changeAddrBtn}>
              <Text style={styles.changeAddrBtnText}>Change</Text>
            </Pressable>
          </View>
        )}

        {/* Restaurant list */}
        {isAddressOutOfArea ? null : isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Finding restaurants near you...</Text>
          </View>
        ) : isError ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textLight} />
            <Text style={styles.emptyText}>Could not load restaurants</Text>
            <Text style={styles.emptySubtext}>Check your internet connection and try again</Text>
          </View>
        ) : filteredRestaurants.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textLight} />
            <Text style={styles.emptyText}>No restaurants found</Text>
            <Text style={styles.emptySubtext}>
              {activeFilterCount > 0 || vegOnly
                ? 'Try adjusting your filters'
                : 'Try a different search or category'}
            </Text>
            {(activeFilterCount > 0 || vegOnly) && (
              <Pressable style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredRestaurants.map((r) => (
            <RestaurantCard key={r.id} item={r} matchedItemName={menuMatchMap.get(r.id)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // ── Header ──────────────────────────────────────────────────────────────────
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    iconBtn: {
      padding: 6,
      position: 'relative',
    },
    notifBadge: {
      position: 'absolute',
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    notifBadgeText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 9,
      color: '#fff',
      lineHeight: 13,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    locationText: {
      flex: 1,
    },
    locationLabel: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15,
    },
    locationAddress: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    // ── Search ──────────────────────────────────────────────────────────────────
    searchSection: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.background,
    },
    searchBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 9,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    searchBarInput: {
      flex: 1,
      fontFamily: 'Poppins_400Regular',
      fontSize: 14,
      color: colors.text,
      padding: 0,
    },
    // ── Ad Banners Slider ────────────────────────────────────────────────────────
    sliderWrapper: {
      marginTop: 8,
      marginBottom: 4,
    },
    sliderOfferCard: {
      width: width,
      paddingHorizontal: 20,
    },
    offerCard: {
      width: width - 40,
      height: 170,
      borderRadius: 18,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 20,
      backgroundColor: colors.primary,
    },
    adImage: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 18,
    },
    adOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      paddingTop: 24,
      paddingBottom: 14,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    },
    adOverlayTitle: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: '#fff',
    },
    adOverlayDesc: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    offerTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 22,
      color: '#fff',
    },
    offerSubtitle: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 13,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 2,
    },
    // ── Categories ──────────────────────────────────────────────────────────────
    sectionHeaderRow: {
      paddingHorizontal: 20,
      marginTop: 22,
      marginBottom: 12,
    },
    sectionTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    categoriesContainer: {
      paddingHorizontal: 20,
      gap: 14,
      paddingBottom: 4,
    },
    categoryTile: {
      alignItems: 'center',
      width: 70,
    },
    categoryImgWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      overflow: 'hidden',
      borderWidth: 2.5,
      borderColor: colors.border,
    },
    categoryImgWrapActive: {
      borderColor: colors.primary,
      borderWidth: 3,
    },
    categoryImg: {
      width: '100%',
      height: '100%',
    },
    categoryTileText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 6,
      textAlign: 'center',
    },
    categoryTileTextActive: {
      color: colors.primary,
      fontFamily: 'Poppins_600SemiBold',
    },
    // ── Restaurant section header ────────────────────────────────────────────────
    restaurantHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: 22,
      marginBottom: 10,
      gap: 10,
    },
    restaurantSectionTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    restaurantCount: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    vegToggleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    vegToggleChipActive: {
      borderColor: '#22C55E',
      backgroundColor: '#22C55E18',
    },
    vegToggleText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    vegToggleTextActive: {
      color: '#16A34A',
    },
    vegIndicator: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fff',
    },
    vegIndicatorGreen: {
      borderColor: '#22C55E',
    },
    vegIndicatorRed: {
      borderColor: '#EF4444',
    },
    vegDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    vegDotGreen: {
      backgroundColor: '#22C55E',
    },
    vegDotRed: {
      backgroundColor: '#EF4444',
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterBtnText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
      color: colors.text,
    },
    filterBtnTextActive: {
      color: '#fff',
    },
    // ── Active filter chips ─────────────────────────────────────────────────────
    activeChipsRow: {
      paddingHorizontal: 20,
      gap: 8,
      marginBottom: 8,
      paddingBottom: 4,
    },
    activeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    activeChipText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 12,
      color: colors.primary,
    },
    clearAllChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
    },
    clearAllChipText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 12,
      color: colors.textSecondary,
    },
    // ── Restaurant cards ────────────────────────────────────────────────────────
    restaurantCard: {
      marginHorizontal: 20,
      marginBottom: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 4,
    },
    restaurantImageWrap: {
      position: 'relative',
    },
    restaurantImage: {
      width: '100%',
      height: 185,
    },
    offerBadge: {
      position: 'absolute',
      bottom: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    offerBadgeText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11,
      color: '#fff',
    },
    restaurantInfo: {
      padding: 14,
    },
    restaurantNameRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    restaurantName: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 16,
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: '#22C55E',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    ratingText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 12,
      color: '#fff',
    },
    cuisineText: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 3,
    },
    menuMatchTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 5,
      alignSelf: 'flex-start',
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    menuMatchText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      color: colors.primary,
    },
    restaurantMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      gap: 6,
      flexWrap: 'wrap',
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.textLight,
    },
    metaText: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    // ── Out-of-area banner ──────────────────────────────────────────────────────
    outOfAreaBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: '#FFFBEB',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1.5,
      borderColor: '#FDE68A',
    },
    outOfAreaTitle: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: '#92400E',
      marginBottom: 3,
    },
    outOfAreaBody: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      color: '#78350F',
      lineHeight: 18,
    },
    changeAddrBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: '#F59E0B',
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    changeAddrBtnText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
      color: '#fff',
    },
    // ── States ──────────────────────────────────────────────────────────────────
    loadingState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      gap: 12,
    },
    loadingText: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      gap: 8,
    },
    emptyText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 16,
      color: colors.text,
    },
    emptySubtext: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
    },
    clearFiltersBtn: {
      marginTop: 8,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    clearFiltersBtnText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: colors.primary,
    },
    // ── Address modal ────────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 20,
      paddingTop: 12,
      maxHeight: '70%',
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 17,
      color: colors.text,
      marginBottom: 16,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    addressRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '0D',
    },
    addressIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addressIconSelected: {
      backgroundColor: colors.primary,
    },
    addressInfo: {
      flex: 1,
    },
    addressLabel: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: colors.text,
      marginBottom: 2,
    },
    addressLabelSelected: {
      color: colors.primary,
    },
    addressText: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    addressLandmark: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11,
      color: colors.textLight,
      marginTop: 2,
    },
    notDeliverableBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#EF444418',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
      marginTop: 4,
    },
    notDeliverableText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 10,
      color: '#EF4444',
    },
    noAddressState: {
      alignItems: 'center',
      paddingVertical: 28,
      gap: 8,
    },
    noAddressText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 15,
      color: colors.text,
    },
    noAddressSubtext: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
    },
    addressActions: {
      gap: 10,
      marginTop: 12,
    },
    addressActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.primary + '06',
    },
    addressActionBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    addressActionBtnText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: colors.primary,
    },
    addressActionBtnTextWhite: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: '#fff',
    },
    pendingCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
      marginBottom: 4,
    },
    pendingAddrRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    pendingAddrText: {
      flex: 1,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
    },
    pendingLabelHint: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    labelRow: {
      flexDirection: 'row',
      gap: 8,
    },
    labelChip: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    labelChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    labelChipText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: colors.text,
    },
    labelChipTextActive: {
      color: '#fff',
    },
    pendingActions: {
      flexDirection: 'row',
      gap: 10,
    },
    pendingCancelBtn: {
      flex: 1,
      paddingVertical: 11,
      alignItems: 'center',
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
    },
    pendingCancelText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 14,
      color: colors.text,
    },
    pendingSaveBtn: {
      flex: 2,
      paddingVertical: 11,
      alignItems: 'center',
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    pendingSaveText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 14,
      color: '#fff',
    },
    // ── Filter sheet ─────────────────────────────────────────────────────────────
    filterSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 20,
      paddingTop: 12,
      maxHeight: '82%',
    },
    filterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    filterTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    filterResetText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: colors.primary,
    },
    filterSectionLabel: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 14,
      color: colors.text,
      marginBottom: 10,
      marginTop: 16,
    },
    filterChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: colors.text,
    },
    filterChipTextActive: {
      color: '#fff',
    },
    filterTogglesWrap: {
      gap: 8,
    },
    filterToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterToggleRowActive: {
      borderColor: colors.primary + '60',
      backgroundColor: colors.primary + '08',
    },
    filterToggleInfo: {
      flex: 1,
    },
    filterToggleLabel: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 14,
      color: colors.text,
    },
    filterToggleSubtext: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    filterToggleCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    filterToggleCheckActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    applyFiltersBtn: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    applyFiltersBtnText: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 15,
      color: '#fff',
    },
  });
}
