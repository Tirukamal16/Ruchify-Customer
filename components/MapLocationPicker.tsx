import React, { useState, useRef } from 'react';
import {
  Modal, View, StyleSheet, Pressable, Text, Platform,
  ActivityIndicator, Alert, TextInput, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { isWithinServiceArea, haversineKm, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG, formatKm } from '@/lib/geofence';

// react-native-maps is not supported on web
let MapView: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch {}
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyCnyjy6HwneAx75ZeKj_wDAdwLzAfok6dY';

// Default coords: Chittoor
const DEFAULT_LAT = 13.2128;
const DEFAULT_LNG = 79.1003;

export interface PickedLocation {
  latitude: string;
  longitude: string;
  address: string;
  city: string;
  pincode: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
  initialCoords?: { latitude: number; longitude: number };
}

interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export default function MapLocationPicker({ visible, onClose, onConfirm, initialCoords }: Props) {
  const [region, setRegion] = useState({
    latitude: initialCoords?.latitude ?? DEFAULT_LAT,
    longitude: initialCoords?.longitude ?? DEFAULT_LNG,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Chittoor');
  const [pincode, setPincode] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const mapRef = useRef<any>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await resp.json();
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const comps: any[] = result.address_components || [];
        const find = (type: string) =>
          comps.find((c) => c.types.includes(type))?.long_name ?? '';

        const streetNum = find('street_number');
        const route = find('route');
        const sub2 = find('sublocality_level_2');
        const sub1 = find('sublocality_level_1');
        const subloc = find('sublocality');
        const locality = find('locality') || find('administrative_area_level_2');
        const postal = find('postal_code');

        const parts: string[] = [];
        if (streetNum && route) parts.push(`${streetNum} ${route}`);
        else if (route) parts.push(route);
        if (sub2) parts.push(sub2);
        if (sub1) parts.push(sub1);
        else if (subloc) parts.push(subloc);

        const resolvedAddr = parts.length > 0
          ? parts.join(', ')
          : result.formatted_address.split(',').slice(0, 2).join(',').trim();

        setAddress(resolvedAddr);
        if (locality) setCity(locality);
        if (postal) setPincode(postal);
      }
    } catch {}
    finally { setGeocoding(false); }
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_API_KEY}&components=country:in&language=en`
        );
        const data = await resp.json();
        if (data.predictions) {
          setSuggestions(
            data.predictions.slice(0, 5).map((p: any) => ({
              placeId: p.place_id,
              description: p.description,
            }))
          );
        }
      } catch {}
      finally { setSearchLoading(false); }
    }, 400);
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    Keyboard.dismiss();
    setSearchText(suggestion.description);
    setSuggestions([]);
    setGeocoding(true);
    try {
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${suggestion.placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await resp.json();
      const loc = data.result?.geometry?.location;
      if (loc) {
        const newRegion = {
          latitude: loc.lat,
          longitude: loc.lng,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 600);
        await reverseGeocode(loc.lat, loc.lng);
      }
    } catch {}
    finally { setGeocoding(false); }
  };

  const handleRegionChangeComplete = (reg: typeof region) => {
    setRegion(reg);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      reverseGeocode(reg.latitude, reg.longitude);
    }, 600);
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
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
          `Your current location is ${formatKm(dist)} away from Chittoor. We currently deliver only within 80 km of Chittoor.\n\nPlease pick a location within the Chittoor area instead.`,
        );
        return;
      }

      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 600);
      await reverseGeocode(latitude, longitude);
    } catch {
      Alert.alert('Error', 'Unable to fetch your current location.');
    } finally {
      setLocating(false);
    }
  };

  const handleConfirm = () => {
    if (!isWithinServiceArea(region.latitude, region.longitude)) {
      const dist = haversineKm(region.latitude, region.longitude, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG);
      Alert.alert(
        'Outside Delivery Area',
        `We currently deliver only within 80 km of Chittoor. This location is ${formatKm(dist)} away.\n\nPlease pick a location within the Chittoor area.`,
      );
      return;
    }
    onConfirm({
      latitude: region.latitude.toFixed(6),
      longitude: region.longitude.toFixed(6),
      address,
      city,
      pincode,
    });
    onClose();
  };

  // Map not supported on web
  if (Platform.OS === 'web' || !MapView) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Pick Delivery Location</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search address or landmark..."
              placeholderTextColor={Colors.textLight}
              value={searchText}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchLoading && <ActivityIndicator size="small" color={Colors.primary} />}
            {!!searchText && !searchLoading && (
              <Pressable onPress={() => { setSearchText(''); setSuggestions([]); }}>
                <Ionicons name="close-circle" size={16} color={Colors.textLight} />
              </Pressable>
            )}
          </View>
          {suggestions.length > 0 && (
            <View style={styles.suggestionsList}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.placeId}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(s)}
                >
                  <Ionicons name="location-outline" size={14} color={Colors.primary} style={{ marginTop: 1 }} />
                  <Text style={styles.suggestionText} numberOfLines={2}>{s.description}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            region={region}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
          />

          {/* Fixed centre pin */}
          <View style={styles.pinWrapper} pointerEvents="none">
            <Ionicons name="location" size={44} color={Colors.primary} style={styles.pinIcon} />
            <View style={styles.pinShadow} />
          </View>

          {/* Use Current Location button */}
          <Pressable style={styles.locateBtn} onPress={handleUseCurrentLocation} disabled={locating}>
            {locating
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : (
                <>
                  <Ionicons name="navigate" size={18} color={Colors.primary} />
                  <Text style={styles.locateBtnText}>Use Current Location</Text>
                </>
              )
            }
          </Pressable>
        </View>

        {/* Address preview */}
        <View style={styles.addressPreview}>
          <Ionicons name="location-outline" size={18} color={Colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            {geocoding ? (
              <View style={{ paddingVertical: 4 }}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : (
              <>
                <Text style={styles.addressText} numberOfLines={2}>
                  {address || 'Drag the map to set your delivery location'}
                </Text>
                {city ? (
                  <Text style={styles.cityText}>{city}{pincode ? ` – ${pincode}` : ''}</Text>
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* Confirm */}
        <View style={styles.confirmBar}>
          <Pressable
            style={[styles.confirmBtn, geocoding && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={geocoding}
          >
            <Text style={styles.confirmBtnText}>Confirm This Location</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.text },

  searchWrapper: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  suggestionsList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },

  mapContainer: { flex: 1, position: 'relative' },

  pinWrapper: {
    position: 'absolute',
    top: '50%', left: '50%',
    alignItems: 'center',
    // shift so the tip of the pin sits at centre
    transform: [{ translateX: -22 }, { translateY: -44 }],
  },
  pinIcon: { marginBottom: -4 },
  pinShadow: {
    width: 10, height: 5, borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  locateBtn: {
    position: 'absolute', bottom: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 14, paddingVertical: 10,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  locateBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },

  addressPreview: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 16, minHeight: 72,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  addressText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text, lineHeight: 20 },
  cityText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 3 },

  confirmBar: {
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  confirmBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' },
});
