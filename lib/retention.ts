import "server-only";

// Traccar auto-cleans its positions table; anything older than this window is
// gone for good. Used both to invalidate forgotten trips (lib/dal/trips.ts)
// and to clamp route-history queries (lib/dal/positions.ts). Must be <= the
// real Traccar retention -- see .env.example. Keep lib/route-limits.ts's
// client-side ROUTE_HISTORY_DAYS in sync.
export function positionsRetentionDays(): number {
  return Number(process.env.TRIP_MAX_AGE_DAYS) || 7;
}

export function retentionCutoff(): Date {
  return new Date(Date.now() - positionsRetentionDays() * 24 * 60 * 60 * 1000);
}
