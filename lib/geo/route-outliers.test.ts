import { describe, it, expect } from "vitest";
import { filterRouteOutliers, type GeoFix } from "./route-outliers";

const BASE_LAT = 10.33;
const BASE_LON = 123.93;
const METERS_PER_DEG_LAT = 111_320;
const metersPerDegLon = (lat: number) => METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function fix(eastMeters: number, northMeters: number, secondsFromStart: number): GeoFix {
  return {
    latitude: BASE_LAT + northMeters / METERS_PER_DEG_LAT,
    longitude: BASE_LON + eastMeters / metersPerDegLon(BASE_LAT),
    fixTime: new Date(Date.parse("2026-07-10T00:00:00Z") + secondsFromStart * 1000).toISOString(),
  };
}

describe("filterRouteOutliers", () => {
  it("keeps a clean sequence of nearby points untouched", () => {
    const points = [fix(0, 0, 0), fix(200, 0, 20), fix(400, 0, 40), fix(600, 0, 60)];
    expect(filterRouteOutliers(points)).toEqual(points);
  });

  it("drops a single isolated spike far from the surrounding cluster", () => {
    const points = [
      fix(0, 0, 0),
      fix(200, 0, 20),
      fix(200, 1500, 40), // spike: 1.5km north in one 20s fix -- 75 m/s
      fix(400, 0, 60),
      fix(600, 0, 80),
    ];
    const kept = filterRouteOutliers(points);
    expect(kept).toEqual([points[0], points[1], points[3], points[4]]);
  });

  it("drops a short run of consecutive spikes as a unit", () => {
    // Each spike is checked against the same still-stuck anchor (point[1]),
    // and elapsed time from that anchor grows with every rejected point --
    // so later spikes in a run need to stay proportionally farther away to
    // remain implausible. ~4km keeps all three comfortably over threshold
    // even by the third check (60s elapsed).
    const points = [
      fix(0, 0, 0),
      fix(200, 0, 20),
      fix(200, 4000, 40), // spike 1: 4000m/20s = 200 m/s
      fix(250, 4050, 60), // spike 2: ~4050m/40s ~= 101 m/s
      fix(180, 3950, 80), // spike 3: ~3954m/60s ~= 66 m/s
      fix(400, 0, 100), // back on the real path
      fix(600, 0, 120),
    ];
    const kept = filterRouteOutliers(points);
    expect(kept).toEqual([points[0], points[1], points[5], points[6]]);
  });

  it("does not flag genuinely fast sustained travel", () => {
    // ~30 m/s (108 km/h) highway pace, well under the 70 m/s threshold, held
    // consistently for many consecutive fixes.
    const points: GeoFix[] = [];
    for (let i = 0; i <= 20; i++) points.push(fix(i * 600, 0, i * 20));
    expect(filterRouteOutliers(points)).toEqual(points);
  });

  it("keeps a same-timestamp near-duplicate fix instead of flagging it as a glitch", () => {
    const points = [fix(0, 0, 0), fix(5, 0, 0), fix(200, 0, 20)];
    expect(filterRouteOutliers(points)).toEqual(points);
  });

  it("drops a same-timestamp fix that also claims a large jump", () => {
    const points = [fix(0, 0, 0), fix(0, 5000, 0), fix(200, 0, 20)];
    expect(filterRouteOutliers(points)).toEqual([points[0], points[2]]);
  });

  it("handles trivial inputs", () => {
    expect(filterRouteOutliers([])).toEqual([]);
    expect(filterRouteOutliers([fix(0, 0, 0)])).toEqual([fix(0, 0, 0)]);
  });
});
