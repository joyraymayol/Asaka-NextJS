import "server-only";
import { verifySession } from "@/lib/dal/session";
import { assertDeviceVisible } from "@/lib/dal/devices";
import { retentionCutoff } from "@/lib/retention";
import { filterRouteOutliers } from "@/lib/geo/route-outliers";
import { traccarFetch } from "@/lib/traccar/client";
import { toPositionDto, type PositionDTO } from "@/lib/traccar/dto";
import type { TraccarPosition } from "@/lib/traccar/types";

// No params returns each visible device's latest known position -- used to
// paint the map before the first /ws/live message arrives.
export async function listLatestPositions(): Promise<PositionDTO[]> {
  const session = await verifySession();
  const positions = await traccarFetch<TraccarPosition[]>(session.traccarSessionId, "/api/positions");
  return positions.map(toPositionDto);
}

// Historical route window for one device, RAW (not DTO-mapped): trip distance
// integration (lib/dal/trips.ts) needs `valid`/`accuracy`/`speed`, which
// PositionDTO strips. Server-only by module guard above -- raw positions must
// never cross the Server/Client Component boundary. Traccar returns them
// sorted by fixTime ascending. Callers authorize device visibility first;
// Traccar additionally 4xxes if the session can't see the device.
export async function listRawRoutePositions(
  traccarSessionId: string,
  deviceId: number,
  from: Date,
  to: Date,
): Promise<TraccarPosition[]> {
  return traccarFetch<TraccarPosition[]>(traccarSessionId, "/api/positions", {
    searchParams: { deviceId, from: from.toISOString(), to: to.toISOString() },
  });
}

// A full retention window at ~20s cadence is ~30k positions (multi-MB as
// JSON); a polyline is visually identical at a few thousand vertices, so
// larger results are decimated evenly (always keeping first + last).
const MAX_ROUTE_POINTS = 5000;

// DTO-mapped route window for the route-history page. Clamps `from` to the
// retention edge (older positions no longer exist in Traccar's DB anyway).
export async function listRoutePositions(deviceId: number, from: Date, to: Date): Promise<PositionDTO[]> {
  const session = await verifySession();
  await assertDeviceVisible(deviceId);

  const cutoff = retentionCutoff();
  const clampedFrom = from < cutoff ? cutoff : from;
  if (clampedFrom >= to) return [];

  const raw = await listRawRoutePositions(session.traccarSessionId, deviceId, clampedFrom, to);
  // Drop GPS glitch spikes (lib/geo/route-outliers.ts) before decimating, so
  // a rare bad fix can never survive sampling and land in the drawn route,
  // and so the decimation step count reflects the real point count.
  const positions = filterRouteOutliers(raw.map(toPositionDto));

  if (positions.length <= MAX_ROUTE_POINTS) return positions;
  const step = Math.ceil(positions.length / MAX_ROUTE_POINTS);
  const decimated = positions.filter((_, i) => i % step === 0);
  if (decimated[decimated.length - 1] !== positions[positions.length - 1]) {
    decimated.push(positions[positions.length - 1]);
  }
  return decimated;
}
