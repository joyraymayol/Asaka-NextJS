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
