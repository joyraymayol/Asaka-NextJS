import "server-only";
import { verifySession } from "@/lib/dal/session";
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
