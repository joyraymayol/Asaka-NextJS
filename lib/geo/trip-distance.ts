import { haversineMeters } from "./haversine";

// Path-integrated trip distance with noise filtering, designed for GPS fixes
// arriving every ~20s. Pure and chunk-safe: the caller persists `anchor` and
// `lastProcessedFixTime` between calls (lib/dal/trips.ts stores them on the
// Trip row), and feeding one position stream through N sequential calls
// yields exactly the same total as one big call -- see trip-distance.test.ts.

/** The subset of a raw Traccar position this module needs. */
export type RoutePoint = {
  latitude: number;
  longitude: number;
  fixTime: string;
  valid: boolean;
  accuracy: number;
  /** Knots, as Traccar reports it (GPS doppler speed). */
  speed: number;
};

/** Last *accepted* point -- the reference all candidate fixes are gated against. */
export type Anchor = { lat: number; lon: number };

export type IntegrationResult = {
  addedMeters: number;
  anchor: Anchor | null;
  /** fixTime of the last processed point (accepted or rejected), for resuming. */
  lastProcessedFixTime: string | null;
};

// A candidate must move at least this far from the anchor to count as real
// movement. Parked GPS jitter is typically +/-5-15m; at the 20s reporting
// cadence even walking pace (~3km/h) covers >15m per fix, so real movement
// clears the gate while drift stays inside it. The anchor deliberately does
// NOT advance on rejected fixes -- a slow random walk can't ratchet distance.
const MIN_SEGMENT_METERS = 15;

// The distance gate alone is not enough: two jittery fixes can land ~2x the
// jitter radius apart (e.g. +/-10m jitter -> ~28m excursions) and leak a few
// meters per fix, which adds up to km/day on a parked vehicle. GPS doppler
// speed is the discriminator -- it reads ~0 when parked even while the
// position wanders, and it's measured independently of position noise. A
// candidate must report at least this speed (knots; 1.5kn = 2.8km/h) ...
const MIN_MOVING_SPEED_KNOTS = 1.5;

// ... UNLESS it has moved this far from the anchor, a fallback so protocols
// with broken/missing speed still accumulate distance (in coarser steps).
// Parked jitter never legitimately reaches 150m from a fixed point.
const FALLBACK_SEGMENT_METERS = 150;

// Reject a segment whose implied speed from the anchor exceeds this -- a GPS
// glitch teleporting kilometers away for one fix would otherwise add a huge
// phantom segment. 70 m/s = 252 km/h, comfortably above any fleet vehicle.
// Genuine coverage gaps (tunnel, ferry, device offline) pass naturally: the
// elapsed time is large, so the implied speed is low.
const MAX_IMPLIED_SPEED_MPS = 70;

/**
 * @param anchor Last accepted point from the previous call, or null on the
 *   first-ever call for a trip.
 * @param anchorFixTime Best-known timestamp for `anchor`. When resuming from
 *   a checkpoint, pass the persisted lastComputedFixTime: it's at or after
 *   the anchor's true time, which only makes the teleport guard slightly
 *   stricter (never lets a glitch through that a single-pass run would have
 *   caught). Null disables the guard until the first accepted point.
 */
export function integrateDistance(
  points: RoutePoint[],
  anchor: Anchor | null,
  anchorFixTime: string | null = null,
): IntegrationResult {
  let addedMeters = 0;
  let lastProcessedFixTime: string | null = null;
  let anchorTimeMs: number | null = anchor && anchorFixTime ? Date.parse(anchorFixTime) : null;

  for (const point of points) {
    lastProcessedFixTime = point.fixTime;
    if (!point.valid) continue;

    if (!anchor) {
      anchor = { lat: point.latitude, lon: point.longitude };
      anchorTimeMs = Date.parse(point.fixTime);
      continue;
    }

    const segmentMeters = haversineMeters(anchor.lat, anchor.lon, point.latitude, point.longitude);

    // Jitter gate: scale with reported GPS accuracy when it's worse than the
    // floor, so a low-quality fix (accuracy 40m) can't fake 20m of movement.
    const minSegment = Math.max(MIN_SEGMENT_METERS, point.accuracy || 0);
    if (segmentMeters < minSegment) continue;

    // Speed gate (see MIN_MOVING_SPEED_KNOTS): the fix must claim actual
    // movement, unless displacement is too large to be stationary jitter.
    if (point.speed < MIN_MOVING_SPEED_KNOTS && segmentMeters < FALLBACK_SEGMENT_METERS) continue;

    if (anchorTimeMs !== null) {
      const elapsedSeconds = (Date.parse(point.fixTime) - anchorTimeMs) / 1000;
      if (elapsedSeconds > 0 && segmentMeters / elapsedSeconds > MAX_IMPLIED_SPEED_MPS) {
        // Teleport glitch: skip the point entirely. The anchor stays put, so
        // the return-to-reality fix that follows is measured against the real
        // path and the phantom excursion contributes nothing.
        continue;
      }
    }

    addedMeters += segmentMeters;
    anchor = { lat: point.latitude, lon: point.longitude };
    anchorTimeMs = Date.parse(point.fixTime);
  }

  return { addedMeters, anchor, lastProcessedFixTime };
}
