# Phase 4 — Trips (manual, named, checkpointed distance)

## Context

Manually started/stopped named trips per device, with accurate path-integrated distance ("home →
school → home" counts the full roundtrip, not displacement). Devices report every ~20s. Traccar
auto-cleans its positions table (**7-day retention** per user), so distance is computed
**incrementally with persisted checkpoints**: each computation resumes from the last processed
position, the running total is stored on the trip row, and a trip stays accurate for weeks as long
as its distance is refreshed at least once within the retention window. Trips whose un-computed
window has fallen off the retention edge are auto-invalidated (DISCARDED).

**Why compute-from-REST-at-refresh-time, not live WS accumulation**: our `/ws/live` relay only has
an upstream Traccar socket while a browser has the map open — a multi-day trip with no dashboard
open would silently lose data. Traccar's REST `/api/positions?deviceId&from&to` has the full
history regardless.

**Permissions**: any non-readonly user, on devices visible to their Traccar account (Traccar
filters `/api/devices` per session already). The devices table moves out of `/admin` so
non-admins get it too (minus CRUD).

## 1. Schema + first migration

Update `prisma/schema.prisma` `Trip` model (keep existing comment/enum; model is scaffolded, never
migrated — no data to preserve):

```prisma
model Trip {
  id                  String     @id @default(cuid())
  traccarDeviceId     Int
  startedByUserId     Int
  name                String
  status              TripStatus @default(ACTIVE)
  startedAt           DateTime
  endedAt             DateTime?
  distanceMeters      Float      @default(0)   // persisted running total
  lastComputedFixTime DateTime?  // fixTime of last *processed* raw position (resume point)
  lastAcceptedLat     Float?     // noise-filter anchor: last *accepted* point
  lastAcceptedLon     Float?
  invalidReason       String?    // set when status becomes DISCARDED
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  @@index([traccarDeviceId, status])
  @@index([startedAt])
}
```

First-ever migration: `npx prisma migrate dev --name init-trips`. **Wrinkle**: `prisma.config.ts`
loads env via `dotenv/config`, which reads `.env` — but `DIRECT_URL` lives in `.env.local`. If
migrate can't find it, run `export DIRECT_URL=$(grep '^DIRECT_URL=' .env.local | cut -d= -f2-)`
first (don't echo the value). Runtime client (`lib/prisma.ts`, pooled `DATABASE_URL`) already
works — Next loads `.env.local`.

## 2. Distance math — `lib/geo/` (new, pure, unit-tested)

- `lib/geo/haversine.ts`: `haversineMeters(lat1, lon1, lat2, lon2)`, R = 6371008.8 m.
- `lib/geo/trip-distance.ts`: `integrateDistance(points, anchor)` →
  `{ addedMeters, anchor, lastProcessedFixTime }`. `points` are raw Traccar positions (needs
  `valid`, `accuracy`, `latitude`, `longitude`, `fixTime`) sorted by fixTime; `anchor` is the
  persisted `{lat, lon}` checkpoint or null (first call seeds anchor from first valid point).

Filter rules (the "smart" part — each defensible and unit-tested):
1. **Skip invalid fixes** (`valid === false`).
2. **Anchor gating for parked drift**: a candidate point only counts if it is ≥
   `max(15 m, accuracy sum of anchor+candidate)` from the **last accepted point** (the anchor).
   Parked GPS jitter (±5–15 m at 20 s cadence would naively sum to km/hour) stays inside the 15 m
   ball and contributes ~0; real movement at even ~3 km/h covers >15 m per 20 s tick and passes.
   Crucially the anchor does NOT advance on rejected points — drift can't ratchet.
3. **Teleport guard**: reject a candidate whose implied speed from the anchor exceeds 70 m/s
   (~250 km/h) — GPS glitches that jump kilometers don't pollute the total. Long offline gaps
   (ferry/tunnel/parking garage) pass naturally because the elapsed time is large.
4. **Chunk-safe**: anchor + lastProcessedFixTime round-trip through the DB, so splitting one
   position stream across many calls (checkpointed refreshes, 24 h fetch chunks) yields the same
   total as one pass — this is a unit test.

## 3. DAL

**`lib/dal/positions.ts`** — add `listRawRoutePositions(traccarSessionId, deviceId, from, to)`:
`GET /api/positions` with `deviceId`/`from`/`to` search params via existing `traccarFetch`,
returning raw `TraccarPosition[]` (needs `valid`/`accuracy`, which `PositionDTO` strips —
server-only, never crosses the client boundary).

**`lib/dal/trips.ts`** (new — first Prisma-backed DAL; import `prisma` from `@/lib/prisma`):
- Shared authz: `verifySession()` + `assertWritable(session)` (mutations) + device-visibility
  check via existing `listDevices()` membership (Traccar filters per user).
- `startTrip(deviceId, name)` — create, `startedAt: new Date()`. Multiple ACTIVE trips per device
  allowed by design.
- `advanceTrip(trip, until)` — the core incremental compute:
  - Window = `[lastComputedFixTime ?? startedAt, until]` (until = now for refresh, stop-click time
    for stop).
  - **Staleness check first**: if window start < now − `TRIP_MAX_AGE_DAYS` (env, default 7) →
    UPDATE to DISCARDED with `invalidReason: "Position history expired before distance was
    computed"` and skip computation. (A 20-day trip refreshed every few days never trips this.)
  - Fetch positions in 24 h chunks, stream through `integrateDistance` carrying the anchor.
  - **Concurrency guard (no double-count)**: compare-and-swap —
    `updateMany({ where: { id, updatedAt: <as-read> }, data: {...} })`; if 0 rows matched another
    request computed concurrently → re-read and return the fresh row without applying ours.
- `refreshTripDistance(tripId)` — advance to now (the on-demand running total).
- `stopTrip(tripId)` — advance to now, then set `endedAt`, status COMPLETED.
- `listTripsForDevice(deviceId)` — active + history, with a **lazy sweep**: bulk-DISCARD any
  ACTIVE trips whose `coalesce(lastComputedFixTime, startedAt)` is past the retention edge (no
  cron needed; every list/refresh/stop touch sweeps).
- `countActiveTrips(deviceIds)` — `groupBy` for the devices-table badge column.
- `TripDTO`: id, deviceId, name, status, startedAt, endedAt, distanceMeters,
  lastComputedFixTime, invalidReason. Lists show the persisted total instantly ("running total
  must be shown"); a Refresh button brings it current.

## 4. Server actions — `app/(dashboard)/devices/actions.ts`

Move the existing device CRUD actions here (route move below) and add: `startTripAction`
(zod: name `z.string().trim().min(1).max(80)`), `stopTripAction`, `refreshTripDistanceAction`,
`getTripsForDeviceAction` (data-returning, used for lazy dialog/popup loads). Follow the existing
`toActionError` pattern (extend for trip errors); `revalidatePath("/devices")` after mutations
(update the old `/admin/devices` strings).

## 5. Route move + UI

- **Move `app/(dashboard)/admin/devices/` → `app/(dashboard)/devices/`** (all users). Sidebar
  (`components/app-sidebar.tsx`): "Devices" → `/devices` for everyone; "Users" stays admin-only.
- `devices/page.tsx`: fetch session (`verifySession`), devices, `countActiveTrips`; pass
  `isAdmin` + per-device active-trip counts to the client table.
- `columns.tsx` → `getColumns(isAdmin)`: create-dialog button and edit/delete actions column
  render only for admins (DAL still enforces server-side); new **Trips column** for everyone —
  badge with active count, opens `TripsDialog`.
- **`trips-dialog.tsx`** (new, client): per-device dialog, lazy-loads via
  `getTripsForDeviceAction` on open. Tabs (existing `tabs` component): **Active** — name,
  started-at, elapsed, running total km, Refresh button, Stop button (AlertDialog confirm);
  **History** — name, start → end datetimes, total km, status badge (DISCARDED shows
  invalidReason). Plus a "Start trip" name-input form (start allowed even with others running).
- **Map popup** (`device-popup-content.tsx`): add a compact trips row — active-trip count + a
  button that opens the same `TripsDialog` (dialogs portal to `<body>`, so opening one from
  inside a Leaflet popup works; reusing the dialog avoids cramming a form into a ~300 px popup
  while still satisfying "start/stop/view multiple from the popup").
- Follow existing conventions: Base UI `render` prop (not `asChild`), `toast` from sonner,
  `useTransition` + `{error}` action results, columns never cross the server/client boundary.

## 6. Tests (calculation accuracy)

Add `vitest` (devDependency) + `"test": "vitest run"` script — first test infra in the repo,
justified by "make sure we are accurate on our calculations". `lib/geo/trip-distance.test.ts`:
- haversine sanity vs a known city-pair distance (±0.5%).
- **Parked drift**: hours of synthetic ±10 m jitter around a fixed point ⇒ ≈ 0 km.
- **Roundtrip**: square path returning to start ⇒ ≈ perimeter (proves path-integration, not
  displacement).
- **Teleport spike**: one glitch point 50 km away for one fix ⇒ excluded from total.
- **Checkpoint equivalence**: same stream integrated in one pass vs split across N calls with
  persisted anchor ⇒ identical totals.
- Invalid-fix skipping.

## 7. Env

`.env.example` + `.env.local`: `TRIP_MAX_AGE_DAYS=7` (server-only; must be ≤ Traccar's real
positions retention window — noted in comment).

## Verification

1. `npm run test` — geo unit tests pass.
2. `npx prisma migrate dev --name init-trips` succeeds (first migration; DIRECT_URL wrinkle above).
3. `npm run dev`, sign in as admin: `/devices` shows table with Trips column + CRUD intact; start
   a named trip on the currently-moving Canter from the map popup; wait a few minutes of movement;
   Refresh shows a growing running total; drive-away-and-back style movement accumulates roundtrip
   distance; Stop completes it; History tab shows start/end datetimes + total km.
4. Start a second concurrent trip on the same device — both accumulate independently.
5. Sign in as a non-admin user: sidebar shows Devices; `/devices` lists only their devices, no
   create/edit/delete controls; trips start/stop works.
6. Sanity-check a completed trip's km against the same window in Traccar's own reports UI
   (expect close agreement; ours may read slightly lower due to drift filtering).
