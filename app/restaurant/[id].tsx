import React, { useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { restaurants, type MenuItem } from '@/data/restaurants';
import { useCart } from '@/context/CartContext';

const { width } = Dimensions.get('window');

function MenuItemCard({ item, restaurant }: { item: MenuItem; restaurant: typeof restaurants[0] }) {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const cartItem = items.find((ci) => ci.menuItem.id === item.id);
  const quantity = cartItem?.quantity || 0;

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
          <Text style={styles.menuItemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
          <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.menuRating}>
            <Ionicons name="star" size={12} color={Colors.star} />
            <Text style={styles.menuRatingText}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.menuCardRight}>
          <Image source={{ uri: item.image }} style={styles.menuItemImage} contentFit="cover" />
          {quantity > 0 ? (
            <View style={styles.quantityControl}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateQuantity(item.id, quantity + 1);
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.addButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                addItem(item, restaurant);
              }}
            >
              <Text style={styles.addButtonText}>ADD</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { items, itemCount, total } = useCart();
  const restaurant = restaurants.find((r) => r.id === id);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const menuCategories = useMemo(() => {
    const cats = new Set<string>();
    restaurant.menu.forEach((item) => cats.add(item.category));
    return Array.from(cats);
  }, [restaurant]);

  const filteredMenu = selectedCategory
    ? restaurant.menu.filter((item) => item.category === selectedCategory)
    : restaurant.menu;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: itemCount > 0 ? 100 : 40 }}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: restaurant.image }} style={styles.heroImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']}
            style={styles.heroGradient}
          />
          <Pressable
            style={[styles.backButton, { top: insets.top + webTopInset + 8 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={[styles.heroInfo, { bottom: 16 }]}>
            <Text style={styles.heroName}>{restaurant.name}</Text>
            <Text style={styles.heroCuisine}>{restaurant.cuisine.join(' | ')}</Text>
          </View>
        </View>

        <View style={styles.infoBar}>
          <View style={styles.infoPill}>
            <Ionicons name="star" size={14} color={Colors.star} />
            <Text style={styles.infoPillText}>{restaurant.rating}</Text>
          </View>
          <View style={styles.infoPill}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.infoPillText}>{restaurant.deliveryTime}</Text>
          </View>
          <View style={styles.infoPill}>
            <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.infoPillText}>{restaurant.distance}</Text>
          </View>
          <View style={styles.infoPill}>
            <Ionicons name="wallet-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.infoPillText}>${restaurant.costForTwo} for two</Text>
          </View>
        </View>

        {restaurant.offer && (
          <View style={styles.offerStrip}>
            <Ionicons name="pricetag" size={14} color={Colors.primary} />
            <Text style={styles.offerStripText}>{restaurant.offer}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{restaurant.openTime} - {restaurant.closeTime}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{restaurant.address}</Text>
          </View>
        </View>

        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Menu</Text>
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

        {filteredMenu.map((item) => (
          <MenuItemCard key={item.id} item={item} restaurant={restaurant} />
        ))}
      </ScrollView>

      {itemCount > 0 && (
        <View style={[styles.cartBar, { paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'web' ? 34 : 0) }]}>
          <View>
            <Text style={styles.cartBarItems}>{itemCount} item{itemCount > 1 ? 's' : ''}</Text>
            <Text style={styles.cartBarTotal}>${total.toFixed(2)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.viewCartBtn, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
  heroWrap: {
    position: 'relative',
    width: '100%',
    height: 240,
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
    paddingVertical: 14,
    gap: 8,
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
  infoPillText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  offerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.primary + '0D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  offerStripText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },
  detailRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontFamily: 'Poppins_400Regular',
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
  menuItemName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  menuItemPrice: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: Colors.text,
    marginTop: 4,
  },
  menuItemDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
    lineHeight: 17,
  },
  menuRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  menuRatingText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
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
  addButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: Colors.primary,
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
