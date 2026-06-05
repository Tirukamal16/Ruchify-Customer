import React, { useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, Pressable, Platform, Dimensions, ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import type { MenuItem } from '@/data/restaurants';
import { restaurantsApi } from '@/lib/api';
import { adaptRestaurant, adaptMenuItem } from '@/lib/adapters';
import { useCart } from '@/context/CartContext';

const { width } = Dimensions.get('window');

function parseAMPM(t: string): number {
  const match = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'AM' && h === 12) h = 0;
  if (meridiem === 'PM' && h !== 12) h += 12;
  return h * 60 + m;
}

function checkIsOpen(openTime: string, closeTime: string): boolean {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = parseAMPM(openTime);
  const closeMin = parseAMPM(closeTime);
  if (closeMin > openMin) return nowMin >= openMin && nowMin < closeMin;
  return nowMin >= openMin || nowMin < closeMin; // overnight hours
}

function MenuItemCard({ item, restaurantId, restaurantName, isOpen }: {
  item: MenuItem;
  restaurantId: string;
  restaurantName: string;
  isOpen: boolean;
}) {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const cartItem = items.find((ci) => ci.menuItem.id === item.id);
  const quantity = cartItem?.quantity || 0;
  const [descExpanded, setDescExpanded] = useState(false);
  const isLongDesc = !!item.description && item.description.length > 60;
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(0);

  const hasSizes = item.sizes && item.sizes.length > 1;
  const effectivePrice = hasSizes
    ? item.price + (item.sizes![selectedSizeIdx]?.priceAddon ?? 0)
    : item.price;
  const effectiveItem: MenuItem = hasSizes
    ? { ...item, price: effectivePrice, portionSize: item.sizes![selectedSizeIdx]?.name }
    : item;

  // Build a minimal restaurant object for addItem
  const restaurant = useMemo(() => ({
    id: restaurantId,
    name: restaurantName,
    cuisine: [],
    rating: 0,
    deliveryTime: '',
    distance: '',
    costForTwo: 0,
    image: '',
    address: '',
    openTime: '',
    closeTime: '',
    menu: [],
  }), [restaurantId, restaurantName]);

  return (
    <View style={styles.menuCard}>
      <View style={styles.menuCardContent}>
        <View style={styles.menuCardLeft}>
          <View style={styles.menuNameRow}>
            <View style={[styles.vegIndicator, { borderColor: item.isVeg ? '#22C55E' : '#EF4444' }]}>
              <View style={[styles.vegDot, { backgroundColor: item.isVeg ? '#22C55E' : '#EF4444' }]} />
            </View>
            {item.popular && (
              <View style={styles.popularBadge}>
                <Ionicons name="flame" size={10} color={Colors.primary} />
                <Text style={styles.popularText}>Popular</Text>
              </View>
            )}
          </View>
          <View style={styles.menuNamePortionRow}>
            <Text style={styles.menuItemName} numberOfLines={2}>{item.name}</Text>
            {!!item.portionSize && (
              <Text style={styles.portionSize}>{item.portionSize}</Text>
            )}
          </View>
          {hasSizes && (
            <View style={styles.sizeChipsRow}>
              {item.sizes!.map((sz, idx) => (
                <Pressable
                  key={sz.name}
                  style={[styles.sizeChip, selectedSizeIdx === idx && styles.sizeChipActive]}
                  onPress={() => setSelectedSizeIdx(idx)}
                >
                  <Text style={[styles.sizeChipText, selectedSizeIdx === idx && styles.sizeChipTextActive]}>
                    {sz.name}{sz.priceAddon > 0 ? ` +₹${sz.priceAddon}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.menuItemPrice}>₹{effectivePrice.toFixed(0)}</Text>
            {'avgRating' in item && (
              <View style={styles.ratingPill}>
                {item.avgRating != null ? (
                  <>
                    <Ionicons name="star" size={10} color="#F59E0B" />
                    <Text style={styles.ratingPillText}>{item.avgRating}</Text>
                  </>
                ) : (
                  <Text style={styles.ratingPillNew}>New</Text>
                )}
              </View>
            )}
            {quantity > 0 && (
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyBadgeText}>{quantity} in cart</Text>
              </View>
            )}
          </View>
          {!!item.description && (
            <Pressable onPress={() => isLongDesc && setDescExpanded((e) => !e)} disabled={!isLongDesc}>
              <Text style={styles.menuItemDesc} numberOfLines={descExpanded ? undefined : 2}>
                {item.description}
              </Text>
              {isLongDesc && (
                <Text style={styles.readMore}>{descExpanded ? 'Read less' : 'Read more'}</Text>
              )}
            </Pressable>
          )}
        </View>
        <View style={styles.menuCardRight}>
          <Image
            source={{ uri: item.image }}
            style={styles.menuItemImage}
            contentFit="cover"
            priority="normal"
            cachePolicy="memory-disk"
            transition={150}
          />
          {quantity > 0 ? (
            <View style={styles.quantityControl}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  if (quantity === 1) removeItem(item.id);
                  else updateQuantity(item.id, quantity - 1);
                }}
              >
                <Ionicons name="remove" size={16} color="#fff" />
              </Pressable>
              <Text style={styles.qtyText}>{quantity}</Text>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  updateQuantity(item.id, quantity + 1);
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.addButton, !isOpen && styles.addButtonClosed]}
              disabled={!isOpen}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                addItem(effectiveItem, restaurant);
              }}
            >
              <Text style={[styles.addButtonText, !isOpen && styles.addButtonClosedText]}>
                {isOpen ? 'ADD' : 'CLOSED'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export function ErrorBoundary({ error: _error, retry }: { error: Error; retry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, paddingTop: insets.top }}>
      <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: '#333', marginTop: 16, textAlign: 'center' }}>
        Couldn't load restaurant
      </Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' }}>
        Something went wrong. Please try again.
      </Text>
      <Pressable
        onPress={retry}
        style={{ marginTop: 24, backgroundColor: '#FF6B35', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' }}>Try Again</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={{ marginTop: 12, paddingVertical: 10 }}>
        <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 14, color: '#888' }}>Go Back</Text>
      </Pressable>
    </View>
  );
}

export default function RestaurantScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const insets = useSafeAreaInsets();
  const { items, itemCount, subtotal } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: apiRestaurant, isLoading: restaurantLoading } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => restaurantsApi.get(id),
    staleTime: 5 * 60 * 1000,
  });

  const { data: apiMenu, isLoading: menuLoading } = useQuery({
    queryKey: ['restaurant-menu', id],
    queryFn: () => restaurantsApi.getMenu(id),
    staleTime: 5 * 60 * 1000,
  });

  const restaurant = apiRestaurant ? adaptRestaurant(apiRestaurant) : null;
  const menu = (apiMenu ?? []).filter((m) => m.isAvailable).map(adaptMenuItem);
  const isOpen = restaurant ? checkIsOpen(restaurant.openTime, restaurant.closeTime) : true;

  const menuCategories = useMemo(() => {
    const cats = new Set<string>();
    menu.forEach((item) => cats.add(item.category));
    return Array.from(cats);
  }, [menu]);

  const filteredMenu = useMemo(() => {
    const byCategory = selectedCategory
      ? menu.filter((item) => item.category === selectedCategory)
      : menu;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false),
    );
  }, [menu, selectedCategory, searchQuery]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const isLoading = restaurantLoading || menuLoading;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Restaurant not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollViewCompat showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: itemCount > 0 ? 100 : 40 }}>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: restaurant.image }}
            style={styles.heroImage}
            contentFit="cover"
            priority="high"
            cachePolicy="memory-disk"
            transition={200}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.7)']}
            style={styles.heroGradient}
          />
          <Pressable
            style={[styles.backButton, { top: insets.top + webTopInset + 8 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.backButton, { top: insets.top + webTopInset + 8, left: undefined, right: 16 }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Ionicons name="home-outline" size={20} color="#fff" />
          </Pressable>
          <View style={[styles.heroInfo, { bottom: 16 }]}>
            <Text style={styles.heroName}>{restaurant.name}</Text>
            <Text style={styles.heroCuisine}>{restaurant.cuisine.join(' · ')}</Text>
          </View>
        </View>

        {/* Summary bar — rating, prep time, hours */}
        <View style={styles.infoBar}>
          <View style={[styles.infoPill, styles.infoPillHighlight]}>
            <Ionicons name="star" size={14} color="#fff" />
            <Text style={[styles.infoPillText, { color: '#fff' }]}>{restaurant.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.infoPill}>
            <Ionicons name="bicycle-outline" size={14} color={Colors.primary} />
            <Text style={styles.infoPillText}>{restaurant.deliveryTime}</Text>
          </View>
          <View style={styles.infoPill}>
            <Ionicons name="alarm-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.infoPillText}>{restaurant.openTime} – {restaurant.closeTime}</Text>
          </View>
          {/* "per person" cost badge hidden — no reliable costForOne field from API */}
        </View>

        {/* Full address row — separate so it never truncates */}
        {!!restaurant.address && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={15} color={Colors.primary} style={{ marginTop: 1 }} />
            <Text style={styles.addressText}>{restaurant.address}</Text>
          </View>
        )}

        {!isOpen && (
          <View style={styles.closedBanner}>
            <Ionicons name="time-outline" size={16} color="#fff" />
            <Text style={styles.closedBannerText}>
              Currently closed · Opens at {restaurant.openTime}
            </Text>
          </View>
        )}

        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Menu</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search dishes..."
            placeholderTextColor={Colors.textLight}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && Platform.OS !== 'ios' && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textLight} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPills}>
          <Pressable
            style={[styles.catPill, !selectedCategory && styles.catPillActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.catPillText, !selectedCategory && styles.catPillTextActive]}>All</Text>
          </Pressable>
          {menuCategories.map((cat) => (
            <Pressable
              key={cat}
              style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              <Text style={[styles.catPillText, selectedCategory === cat && styles.catPillTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {filteredMenu.length === 0 ? (
          <View style={styles.emptyMenu}>
            <Ionicons
              name={searchQuery ? 'search-outline' : 'restaurant-outline'}
              size={36}
              color={Colors.textLight}
            />
            <Text style={styles.emptyMenuText}>
              {searchQuery
                ? `No dishes match "${searchQuery}"`
                : 'No items available'}
            </Text>
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchText}>Clear search</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          filteredMenu.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              restaurantId={restaurant.id}
              restaurantName={restaurant.name}
              isOpen={isOpen}
            />
          ))
        )}
      </KeyboardAwareScrollViewCompat>

      {itemCount > 0 && (
        <View style={[styles.cartBar, { paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'web' ? 34 : 0) }]}>
          <View>
            <Text style={styles.cartBarItems}>{itemCount} item{itemCount > 1 ? 's' : ''}</Text>
            <Text style={styles.cartBarTotal}>₹{subtotal.toFixed(0)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.viewCartBtn, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              router.push('/(tabs)/cart');
            }}
          >
            <Text style={styles.viewCartText}>View Cart</Text>
            <Ionicons name="cart" size={18} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    position: 'relative',
    width: '100%',
    height: 280,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroInfo: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  heroName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroCuisine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  infoBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  addressText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  infoPillHighlight: {
    backgroundColor: '#22C55E',
  },
  infoPillText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  menuTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    color: Colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 6,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  clearSearchBtn: {
    marginTop: 8,
  },
  clearSearchText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: Colors.primary,
  },
  catPills: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  catPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
  },
  catPillActive: {
    backgroundColor: Colors.primary,
  },
  catPillText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  catPillTextActive: {
    color: '#fff',
  },
  emptyMenu: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyMenuText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  menuCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuCardContent: {
    flexDirection: 'row',
  },
  menuCardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  menuNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  vegIndicator: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: Colors.primary,
  },
  menuNamePortionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  menuItemName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: Colors.text,
    flexShrink: 1,
  },
  portionSize: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sizeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  sizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  sizeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  sizeChipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sizeChipTextActive: {
    color: Colors.primary,
    fontFamily: 'Poppins_500Medium',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  menuItemPrice: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingPillText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: Colors.textSecondary,
  },
  ratingPillNew: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: Colors.textLight,
  },
  qtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  qtyBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#fff',
  },
  menuItemDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
    lineHeight: 17,
  },
  readMore: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
  },
  menuCardRight: {
    alignItems: 'center',
    width: 110,
  },
  menuItemImage: {
    width: 110,
    height: 90,
    borderRadius: 12,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    marginTop: -16,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  addButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 6,
    marginTop: -16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonClosed: {
    borderColor: Colors.textLight,
    backgroundColor: Colors.surfaceAlt,
  },
  addButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: Colors.primary,
  },
  addButtonClosedText: {
    color: Colors.textLight,
    fontSize: 11,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
  },
  closedBannerText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#fff',
    flex: 1,
  },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cartBarItems: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  cartBarTotal: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  viewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  viewCartText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  errorText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 100,
  },
  goBackText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 12,
  },
});
