# Asaka — Build Progress

Traccar fleet-tracking BFF built on Next.js 16. Full architecture/rationale lives in the original plan at
`~/.claude/plans/i-have-an-existing-adaptive-platypus.md` — this file just tracks what's done vs. pending so a new
session can pick up quickly.

## Done (verified working against the real Traccar server, in-browser)

- **Phase 0 — Setup**: deps installed, Prisma 7 configured with driver adapter (`lib/prisma.ts`), custom `server.ts`
  boots in dev + prod.
- **Phase 1 — Auth**: `lib/session.ts` / `lib/session-core.ts` (encrypted cookie via `jose`), `lib/traccar/client.ts`
  (login/logout/generic fetch), `lib/dal/session.ts` (`verifySession`), `proxy.ts` (optimistic gate), login/logout UI
  with "Asaka" branding.
- **Phase 2 — Live map**: `/ws/live` relay in `server.ts` (upstream WS to Traccar's `/api/socket`, messages mapped
  through DTOs before reaching the browser), `react-leaflet` + MapTiler "bright" tiles (light/dark variants, swapped
  in from CARTO Voyager for POI/building labels — see `app/(dashboard)/map/live-map.tsx`, needs
  `NEXT_PUBLIC_MAPTILER_API_KEY` in `.env.local`), device markers colored by status, click-to-popup
  (time/address/speed), live status badge. Verified in-browser 2026-07-09.
- **Phase 3 — Admin dashboard**: Users + Devices CRUD (list/create/edit/delete) via `lib/dal/users.ts` /
  `lib/dal/devices.ts`, all writes gated on `session.administrator`, delete requires confirmation dialog, sortable
  columns (TanStack Table), admin nav in the dashboard header.
- **Extras added on request**: icon-only dark/light theme toggle (hand-rolled, no `next-themes`), shadcn/ui fully
  wired (`base-mira` style, Base UI primitives, not Radix).

## Pending — pick up here next

- [ ] **Phase 4 — Trips (implemented 2026-07-09, in-browser verification pending)**: manually started/stopped named
  trips, multiple concurrent per device, checkpointed path-integrated distance. Full design doc:
  `docs/plans/phase-4-trips.md`. Built: first Prisma migration (`prisma/migrations/`), `lib/geo/`
  (haversine + `integrateDistance` noise filter — anchor gating, doppler-speed gate, teleport guard; unit-tested via
  `npm run test`/vitest), `lib/dal/trips.ts` (incremental compute resuming from `lastComputedFixTime`, CAS on
  `updatedAt` against double-counting, lazy invalidation past `TRIP_MAX_AGE_DAYS`), trips server actions, shared
  `TripsDialog`, devices table moved `/admin/devices` → `/devices` (all users; CRUD still admin-only), map popup
  Trips button.
  - [ ] **Verify trips against a really-moving vehicle** (blocked 2026-07-09: whole fleet was parked). When one
    moves: start a named trip from the map popup → let it drive a few minutes → "Update" shows a growing running
    total → drive-away-and-back accumulates roundtrip distance (not displacement) → Stop → History shows start/end +
    total km. Sanity-check the km against Traccar's own report for the same window (ours should read slightly lower
    — drift filtering). Also confirm a parked device's active trip stays at ~0 km after hours, and check `/devices`
    as a non-admin (only their devices, no CRUD buttons).
- [ ] **Phase 5 — Route history (implemented 2026-07-10, in-browser verification pending)**: design doc
  `docs/plans/phase-5-routes.md`. Built: `RouteDialog` (Today / Yesterday / Custom via shadcn calendar +
  time inputs; period boundaries computed client-side for correct timezone) beside the Trips button in both the
  devices table and the map popup; `/routes?deviceId&from&to` page (Next 16: `searchParams` is a Promise — await
  it) drawing the route with a polyline, canvas-rendered clickable position dots, sampled direction arrows
  (rotated by `course`), and start/end markers — every one popping the device/time/address/speed card.
  `listRoutePositions()` in the positions DAL clamps to retention and decimates >5k-point windows. Shared map
  plumbing extracted to `app/(dashboard)/map/map-support.tsx`; `outline` button variant strengthened
  (base-mira's was invisible — user feedback). Calendar installed per the registry-conflict caution (declined
  the `button.tsx` overwrite).
  - [ ] **Verify routes in-browser**: outline buttons readable in table + popup; Today/Yesterday/Custom each
    draw; calendar disables dates older than 7 days; point/arrow clicks pop details; dark tiles swap; empty
    period shows the friendly message; back button returns.
- [ ] **Phase 6 — Geofencing + notifications**: geofence CRUD (`lib/dal/geofences.ts` doesn't exist yet) with
  circle/polygon/polyline drawing (Leaflet.draw, already installed but unused), device↔geofence linking via
  `/api/permissions`, in-app notification center sourced from Traccar's native `geofenceEnter`/`geofenceExit` events
  (extend the `/ws/live` relay's `toLiveFeedMessage` in `lib/traccar/dto.ts` to also map an `events` array — currently
  dropped on purpose until this phase).

## Known gotchas hit during this build (don't re-discover these)

- **Prisma 7** removed `url`/`directUrl` from `schema.prisma` entirely — connection strings live in `prisma.config.ts`
  (Migrate) and the runtime `PrismaClient` needs a driver adapter (`@prisma/adapter-pg`), not env-var auto-wiring.
- **`server.ts` runs outside Next's bundler** (via `tsx`, plain Node) — anything it imports transitively must not pull
  in the `server-only` package, since that throws unconditionally outside Next's `react-server` resolve condition.
  This is why `lib/session-core.ts` (no `server-only`) exists separately from `lib/session.ts` (has the guard, used by
  everything else).
- **`next-themes` v0.4.6 is broken under React 19.2** in this Next 16.2.10 project — it (and even a raw `next/script`
  `beforeInteractive` script) trips a new React 19.2 dev warning ("script tag encountered while rendering") during
  hydration. Fixed by dropping the dependency and using a `useLayoutEffect`-based toggle instead
  (`components/theme-init.tsx`, `components/theme-toggle.tsx`) — no `<script>` element anywhere.
- **shadcn in this project uses Base UI (`@base-ui/react`), not Radix** — composition uses a `render` prop
  (`<DialogTrigger render={<Button/>}>Label</DialogTrigger>`), not `asChild`.
- **Passing TanStack Table `columns` (function-valued) from a Server Component page into a Client Component throws
  at runtime** ("Functions cannot be passed directly to Client Components") — but only when the page actually
  renders with real data, so `next build`/`tsc` won't catch it. Fixed by never letting `columns` cross that boundary:
  each admin page has a thin client wrapper (`users-table.tsx` / `devices-table.tsx`) that imports `columns` itself
  and only receives plain serializable `data` as a prop.
- **Cookies can only be mutated in a Server Action or Route Handler**, not during a plain page render. This bit us
  when handling an expired Traccar session (401) from `lib/traccar/client.ts::traccarFetch`, which can be called
  from a Server Component's data fetch. Fixed by redirecting to `app/api/session/expire/route.ts` (a Route Handler)
  to clear the cookie, rather than trying to clear it inline.
- **If `/ws/live` shows "Live" but markers never move**: previously misdiagnosed here as a reverse-proxy not
  forwarding WebSocket upgrade headers — it wasn't. The real bug (fixed): `session.traccarSessionId` is already the
  full `"JSESSIONID=<value>"` cookie pair (see `extractSessionCookie` in `lib/traccar/client.ts`), but `server.ts`'s
  upstream WS connection re-prefixed it into `Cookie: JSESSIONID=JSESSIONID=<value>`, which Traccar's Jetty server
  can't match to any session, so it unconditionally rejected the WS upgrade with HTTP 503 on every attempt (confirmed
  via a direct `curl` probe of `/api/socket` — no proxy in the response, straight from Jetty). Also fixed in the same
  pass: the `unexpected-response` handler wasn't closing the browser-side socket on a rejected handshake, so the
  client's "Live" badge stayed green forever with zero data and no reconnect ever firing — check server logs for
  `[ws/live] upstream handshake rejected: HTTP ...` if this regresses.

## Environment

`.env.local` needs `TRACCAR_API_URL`, `SESSION_SECRET`, `DATABASE_URL`, `DIRECT_URL` (see `.env.example`). All four
are already filled in for this environment.

## To resume

```
npm run dev
```

Custom server (`server.ts`) via `tsx`, not `next dev` directly — required for the `/ws/live` WebSocket relay.
