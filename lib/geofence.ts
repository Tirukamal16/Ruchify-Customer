export const SERVICE_CENTER_LAT = 13.2128; // Chittoor city centre
export const SERVICE_CENTER_LNG = 79.1003;
export const SERVICE_RADIUS_KM = 80; // covers all of Chittoor district + Tirupati

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns true when the point is within the delivery service area. */
export function isWithinServiceArea(lat: number, lng: number): boolean {
  return haversineKm(lat, lng, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG) <= SERVICE_RADIUS_KM;
}

/** Human-readable distance string. */
export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
