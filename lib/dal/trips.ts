import "server-only";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal/session";
import { assertWritable, ForbiddenError } from "@/lib/dal/authz";
import { assertDeviceVisible } from "@/lib/dal/devices";
import { listRawRoutePositions } from "@/lib/dal/positions";
import { retentionCutoff } from "@/lib/retention";
import { integrateDistance, type Anchor } from "@/lib/geo/trip-distance";
import type { Trip } from "@/app/generated/prisma/client";
import type { SessionPayload } from "@/lib/session";

// First Prisma-backed DAL in the app: trips are first-party data with no
// Traccar equivalent (see prisma/schema.prisma). Traccar remains the source
// of truth for positions; we only persist trip metadata + the checkpointed
// distance total.

const EXPIRED_REASON =
  "Position history expired before the distance was computed (trip left running past retention).";

// Traccar route queries are chunked to keep responses bounded: ~20s cadence
// is ~4.3k positions/day.
const FETCH_CHUNK_HOURS = 24;

export type TripDTO = {
  id: string;
  deviceId: number;
  name: string;
  status: "ACTIVE" | "COMPLETED" | "DISCARDED";
  startedAt: string;
  endedAt: string | null;
  distanceMeters: number;
  /** How current distanceMeters is; null = never computed yet. */
  lastComputedFixTime: string | null;
  invalidReason: string | null;
};

function toTripDto(trip: Trip): TripDTO {
  return {
    id: trip.id,
    deviceId: trip.traccarDeviceId,
    name: trip.name,
    status: trip.status,
    startedAt: trip.startedAt.toISOString(),
    endedAt: trip.endedAt?.toISOString() ?? null,
    distanceMeters: trip.distanceMeters,
    lastComputedFixTime: trip.lastComputedFixTime?.toISOString() ?? null,
    invalidReason: trip.invalidReason,
  };
}

// Lazy invalidation -- no cron: every list/count/advance sweeps ACTIVE trips
// whose next compute window start (last checkpoint, or trip start if never
// computed) has already fallen off Traccar's retention edge.
async function discardExpiredTrips(deviceId?: number): Promise<void> {
  const cutoff = retentionCutoff();
  await prisma.trip.updateMany({
    where: {
      status: "ACTIVE",
      ...(deviceId !== undefined ? { traccarDeviceId: deviceId } : {}),
      OR: [
        { lastComputedFixTime: { lt: cutoff } },
        { lastComputedFixTime: null, startedAt: { lt: cutoff } },
      ],
    },
    data: { status: "DISCARDED", invalidReason: EXPIRED_REASON, endedAt: new Date() },
  });
}

export async function startTrip(deviceId: number, name: string): Promise<TripDTO> {
  const session = await verifySession();
  assertWritable(session);
  await assertDeviceVisible(deviceId);

  const trip = await prisma.trip.create({
    data: {
      traccarDeviceId: deviceId,
      startedByUserId: session.userId,
      name,
      startedAt: new Date(),
    },
  });
  return toTripDto(trip);
}

export async function listTripsForDevice(deviceId: number): Promise<TripDTO[]> {
  await verifySession();
  await assertDeviceVisible(deviceId);
  await discardExpiredTrips(deviceId);

  const trips = await prisma.trip.findMany({
    where: { traccarDeviceId: deviceId },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  return trips.map(toTripDto);
}

/** deviceId -> ACTIVE trip count, for the devices-table badge column. */
export async function countActiveTrips(): Promise<Record<number, number>> {
  await verifySession();
  await discardExpiredTrips();

  const groups = await prisma.trip.groupBy({
    by: ["traccarDeviceId"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.traccarDeviceId, g._count._all]));
}

// Core incremental compute: integrate positions from the trip's checkpoint up
// to `until`, then persist via compare-and-swap on updatedAt so two
// concurrent refreshes can never double-count the same window. Returns the
// resulting row (fresh from DB on CAS conflict -- the other writer's result).
async function advanceTrip(session: SessionPayload, trip: Trip, until: Date): Promise<Trip> {
  if (trip.status !== "ACTIVE") return trip;

  const windowStart = trip.lastComputedFixTime ?? trip.startedAt;

  if (windowStart < retentionCutoff()) {
    await prisma.trip.updateMany({
      where: { id: trip.id, status: "ACTIVE" },
      data: { status: "DISCARDED", invalidReason: EXPIRED_REASON, endedAt: new Date() },
    });
    return (await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } }));
  }

  if (windowStart >= until) return trip;

  let addedMeters = 0;
  let anchor: Anchor | null =
    trip.lastAcceptedLat !== null && trip.lastAcceptedLon !== null
      ? { lat: trip.lastAcceptedLat, lon: trip.lastAcceptedLon }
      : null;
  // Anchor timestamp for the teleport guard; the persisted checkpoint time is
  // at/after the anchor's true fix time, which only makes the guard stricter.
  let anchorFixTime: string | null = trip.lastComputedFixTime?.toISOString() ?? null;
  let lastProcessed: Date | null = null;

  const chunkMs = FETCH_CHUNK_HOURS * 60 * 60 * 1000;
  for (let from = windowStart; from < until; ) {
    const to = new Date(Math.min(from.getTime() + chunkMs, until.getTime()));
    const positions = await listRawRoutePositions(session.traccarSessionId, trip.traccarDeviceId, from, to);
    const result = integrateDistance(positions, anchor, anchorFixTime);
    addedMeters += result.addedMeters;
    anchor = result.anchor;
    if (result.lastProcessedFixTime) {
      anchorFixTime = result.lastProcessedFixTime;
      lastProcessed = new Date(result.lastProcessedFixTime);
    }
    from = to;
  }

  // Only advance the checkpoint to data actually seen -- never to `until`.
  // Trackers can upload buffered history late; jumping the cursor past a
  // silent window would permanently skip those positions.
  if (!lastProcessed) return trip;

  await prisma.trip.updateMany({
    where: { id: trip.id, updatedAt: trip.updatedAt, status: "ACTIVE" },
    data: {
      distanceMeters: trip.distanceMeters + addedMeters,
      lastComputedFixTime: lastProcessed,
      lastAcceptedLat: anchor?.lat ?? null,
      lastAcceptedLon: anchor?.lon ?? null,
    },
  });
  // Re-read either way: on success this is our write; on a CAS miss (count 0,
  // a concurrent request advanced the trip first) it's the other writer's
  // result, which integrated the same window -- ours is simply discarded, so
  // the window can never be double-counted.
  return prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
}

async function loadAuthorizedTrip(tripId: string): Promise<Trip> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new ForbiddenError("Trip not found.");
  await assertDeviceVisible(trip.traccarDeviceId);
  return trip;
}

/** On-demand "distance so far" for a running trip. */
export async function refreshTripDistance(tripId: string): Promise<TripDTO> {
  const session = await verifySession();
  assertWritable(session);
  const trip = await loadAuthorizedTrip(tripId);
  return toTripDto(await advanceTrip(session, trip, new Date()));
}

export async function stopTrip(tripId: string): Promise<TripDTO> {
  const session = await verifySession();
  assertWritable(session);
  const trip = await loadAuthorizedTrip(tripId);
  if (trip.status !== "ACTIVE") return toTripDto(trip);

  const stoppedAt = new Date();
  const advanced = await advanceTrip(session, trip, stoppedAt);
  if (advanced.status !== "ACTIVE") return toTripDto(advanced); // discarded (expired)

  // Status-guarded flip: if a concurrent stop won, this is a no-op. A
  // concurrent *refresh* racing us can at most have integrated ~one extra
  // fix (~20s) past stoppedAt -- negligible, not worth a retry loop.
  await prisma.trip.updateMany({
    where: { id: trip.id, status: "ACTIVE" },
    data: { endedAt: stoppedAt, status: "COMPLETED" },
  });
  const final = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
  return toTripDto(final);
}
