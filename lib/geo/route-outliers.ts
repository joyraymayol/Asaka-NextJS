import { haversineMeters } from "./haversine";

export type GeoFix = { latitude: number; longitude: number; fixTime: string };

// Deliberately stricter than trip-distance.ts's teleport guard (70 m/s).
// That threshold has to stay permissive -- under-counting a real highway
// segment silently shrinks a trip's distance. Here the cost of a false
// positive is just one fewer point on a line (invisible), while the cost of
// a false negative is a glitch spike visibly ruining the drawn route, so it
// pays to filter harder. 50 m/s (~180 km/h) comfortably clears any speed
// realistic for this fleet while still catching the multi-hundred-km/h jumps
// a bad GPS fix typically produces.
const MAX_PLAUSIBLE_SPEED_MPS = 50;

/**
 * Drops GPS fixes that jump implausibly far from the last *kept* fix, for
 * drawing a route line. Unlike trip-distance's integration (which also
 * filters out small parked-GPS jitter so it doesn't inflate a distance
 * total), this only removes genuine glitches -- jitter is fine to draw, it's
 * just a tiny visual cluster.
 *
 * Because the anchor never advances on a rejected fix, a short run of
 * consecutive glitch points (a common real-world pattern -- 1-3 bad fixes
 * stacked together before the tracker recovers) is filtered as a unit: each
 * one is compared against the same last-good anchor until a fix returns to
 * plausible range. Genuinely fast, sustained travel (e.g. highway driving)
 * is unaffected, since each consecutive real fix stays plausible relative to
 * the one right before it.
 */
export function filterRouteOutliers<T extends GeoFix>(points: T[]): T[] {
  if (points.length === 0) return points;

  const kept: T[] = [points[0]];
  let anchor = points[0];

  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const distanceMeters = haversineMeters(
      anchor.latitude,
      anchor.longitude,
      point.latitude,
      point.longitude,
    );
    const elapsedSeconds = (Date.parse(point.fixTime) - Date.parse(anchor.fixTime)) / 1000;

    // Duplicate/out-of-order timestamps can't imply a speed -- only reject
    // them if they also claim a large jump; a same-timestamp fix that's
    // essentially in place (dedupe/reorder noise) is harmless to keep.
    const isOutlier =
      elapsedSeconds > 0
        ? distanceMeters / elapsedSeconds > MAX_PLAUSIBLE_SPEED_MPS
        : distanceMeters > 100;
    if (isOutlier) continue; // drop -- anchor stays put

    kept.push(point);
    anchor = point;
  }

  return kept;
}
