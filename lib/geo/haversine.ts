// IUGG mean Earth radius. Good to well under 0.5% error at vehicle scales,
// which is far below GPS noise itself.
const EARTH_RADIUS_METERS = 6371008.8;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two WGS84 coordinates. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}
