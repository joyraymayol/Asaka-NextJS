import { describe, it, expect } from "vitest";
import { haversineMeters } from "./haversine";
import { integrateDistance, type RoutePoint, type Anchor } from "./trip-distance";

// ~1 degree of latitude is ~111.32km everywhere; near the equator 1 degree of
// longitude is about the same. Helpers below build synthetic GPS tracks in
// meter-offsets from a base coordinate (Cebu-ish, matching the real fleet).
const BASE_LAT = 10.33;
const BASE_LON = 123.93;
const METERS_PER_DEG_LAT = 111_320;
const metersPerDegLon = (lat: number) => METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function point(
  eastMeters: number,
  northMeters: number,
  secondsFromStart: number,
  overrides: Partial<RoutePoint> = {},
): RoutePoint {
  return {
    latitude: BASE_LAT + northMeters / METERS_PER_DEG_LAT,
    longitude: BASE_LON + eastMeters / metersPerDegLon(BASE_LAT),
    fixTime: new Date(Date.parse("2026-07-09T00:00:00Z") + secondsFromStart * 1000).toISOString(),
    valid: true,
    accuracy: 5,
    speed: 10, // knots -- a moving vehicle unless a test overrides it
    ...overrides,
  };
}

// Deterministic pseudo-random in [-1, 1] -- keeps the drift test reproducible.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

describe("haversineMeters", () => {
  it("matches a known city-pair distance within 0.5%", () => {
    // Manila (14.5995, 120.9842) to Cebu City (10.3157, 123.8854):
    // great-circle distance ~572.8km (WGS84 geodesic ~571.6km; haversine on a
    // sphere is within a fraction of a percent).
    const d = haversineMeters(14.5995, 120.9842, 10.3157, 123.8854);
    expect(d).toBeGreaterThan(569_000);
    expect(d).toBeLessThan(576_000);
  });

  it("is zero for identical points", () => {
    expect(haversineMeters(BASE_LAT, BASE_LON, BASE_LAT, BASE_LON)).toBe(0);
  });
});

describe("integrateDistance", () => {
  it("accumulates ~0 for hours of parked GPS jitter", () => {
    // 4 hours parked at 20s cadence = 720 fixes, jitter within +/-10m,
    // doppler speed ~0 as a real parked GPS reports.
    const points: RoutePoint[] = [];
    for (let i = 0; i < 720; i++) {
      points.push(point(pseudoRandom(i) * 10, pseudoRandom(i + 1000) * 10, i * 20, { speed: 0 }));
    }
    const { addedMeters } = integrateDistance(points, null);
    // Naive summing of consecutive fixes would be tens of km here.
    expect(addedMeters).toBeLessThan(100);
  });

  it("still counts large displacement when the protocol reports no speed", () => {
    // Speed stuck at 0 (broken protocol) but the vehicle really moves 1km:
    // the 150m displacement fallback should accumulate it in coarse steps.
    const points: RoutePoint[] = [point(0, 0, 0, { speed: 0 })];
    for (let i = 1; i <= 50; i++) points.push(point(i * 20, 0, i * 20, { speed: 0 }));
    const { addedMeters } = integrateDistance(points, null);
    // Coarse 150m-quantized accumulation: expect most of the 1000m, not 0.
    expect(addedMeters).toBeGreaterThan(800);
    expect(addedMeters).toBeLessThanOrEqual(1000);
  });

  it("measures a roundtrip as the full path, not displacement", () => {
    // Drive a 2km x 1km rectangle back to the start at ~10m/s (36km/h),
    // one fix every 20s (i.e. every 200m).
    const points: RoutePoint[] = [];
    let t = 0;
    const leg = (fromE: number, fromN: number, toE: number, toN: number) => {
      const dist = Math.hypot(toE - fromE, toN - fromN);
      const steps = Math.round(dist / 200);
      for (let i = 1; i <= steps; i++) {
        t += 20;
        points.push(point(fromE + ((toE - fromE) * i) / steps, fromN + ((toN - fromN) * i) / steps, t));
      }
    };
    points.push(point(0, 0, 0));
    leg(0, 0, 2000, 0);
    leg(2000, 0, 2000, 1000);
    leg(2000, 1000, 0, 1000);
    leg(0, 1000, 0, 0);

    const { addedMeters, anchor } = integrateDistance(points, null);
    // Perimeter = 6000m. Displacement = 0. Path integration must return ~6km.
    expect(addedMeters).toBeGreaterThan(5900);
    expect(addedMeters).toBeLessThan(6100);
    // Ends where it started.
    expect(anchor).not.toBeNull();
    expect(haversineMeters(anchor!.lat, anchor!.lon, BASE_LAT, BASE_LON)).toBeLessThan(1);
  });

  it("rejects a teleport glitch and does not pay for the return either", () => {
    const points: RoutePoint[] = [
      point(0, 0, 0),
      point(200, 0, 20),
      point(50_000, 0, 40), // glitch: 49.8km in 20s = ~2490 m/s
      point(400, 0, 60),
      point(600, 0, 80),
    ];
    const { addedMeters } = integrateDistance(points, null);
    // Clean path: 0 -> 200 -> 400 -> 600 = 600m. The glitch would have added
    // ~99km roundtrip if unguarded.
    expect(addedMeters).toBeGreaterThan(590);
    expect(addedMeters).toBeLessThan(610);
  });

  it("skips fixes marked invalid by Traccar", () => {
    const points: RoutePoint[] = [
      point(0, 0, 0),
      point(5000, 0, 20, { valid: false }), // would also be a teleport, but valid=false wins first
      point(200, 0, 40),
    ];
    const { addedMeters } = integrateDistance(points, null);
    expect(addedMeters).toBeGreaterThan(190);
    expect(addedMeters).toBeLessThan(210);
  });

  it("holds the anchor so a low-accuracy fix can't fake movement", () => {
    const points: RoutePoint[] = [
      point(0, 0, 0),
      point(30, 0, 20, { accuracy: 50 }), // 30m move but accuracy says +/-50m -> rejected
      point(30, 0, 40, { accuracy: 5 }), // same spot, good accuracy -> accepted (30m)
    ];
    const { addedMeters } = integrateDistance(points, null);
    expect(addedMeters).toBeGreaterThan(29);
    expect(addedMeters).toBeLessThan(31);
  });

  it("produces identical totals in one pass vs checkpointed chunks", () => {
    // A realistic mixed track: drive, park with jitter, drive again.
    const points: RoutePoint[] = [];
    let t = 0;
    for (let i = 0; i <= 20; i++) points.push(point(i * 200, 0, (t += 20))); // 4km east
    for (let i = 0; i < 90; i++)
      points.push(point(4000 + pseudoRandom(i) * 8, pseudoRandom(i + 500) * 8, (t += 20))); // 30min parked
    for (let i = 1; i <= 20; i++) points.push(point(4000, i * 200, (t += 20))); // 4km north

    const single = integrateDistance(points, null);

    // Same stream split into 5 uneven chunks, threading the checkpoint
    // (anchor + lastProcessedFixTime) through exactly like the DAL does.
    let total = 0;
    let anchor: Anchor | null = null;
    let anchorFixTime: string | null = null;
    const cuts = [0, 7, 45, 46, 100, points.length];
    for (let c = 0; c < cuts.length - 1; c++) {
      const chunk = points.slice(cuts[c], cuts[c + 1]);
      const result = integrateDistance(chunk, anchor, anchorFixTime);
      total += result.addedMeters;
      anchor = result.anchor;
      if (result.lastProcessedFixTime) anchorFixTime = result.lastProcessedFixTime;
    }

    expect(total).toBeCloseTo(single.addedMeters, 6);
    expect(anchor).toEqual(single.anchor);
  });
});
