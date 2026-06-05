import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const PERMISSIONS_KEY = 'ruchify_permissions_requested_v1';

export function useAppPermissions() {
  const [permissionsRequested, setPermissionsRequested] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PERMISSIONS_KEY).then((value) => {
      setPermissionsRequested(value === 'true');
    });
  }, []);

  const requestPermissions = async () => {
    // Location — needed for finding nearby restaurants & tracking delivery
    await Location.requestForegroundPermissionsAsync();

    // Push notifications — needed for order updates & offers (iOS + Android)
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });

    // Camera — needed for profile photo
    await ImagePicker.requestCameraPermissionsAsync();

    // Media library — needed for picking profile photo from gallery
    await ImagePicker.requestMediaLibraryPermissionsAsync();

    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
    setPermissionsRequested(true);
  };

  const skipPermissions = async () => {
    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
    setPermissionsRequested(true);
  };

  return { permissionsRequested, requestPermissions, skipPermissions };
}
