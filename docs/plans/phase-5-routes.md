# Phase 5 — Route history (period picker + clickable route map)

## Context

Users need to see where a device travelled: a Routes button beside the existing Trips button (devices
table + map popup), a period picker (Today / Yesterday / Custom date+time range via shadcn calendar),
and a dedicated full-screen route page drawing the path with clickable points/direction arrows whose
popups show device name, date-time, address, speed. User chose a **dedicated page**
(`/routes?deviceId=…&from=…&to=…`) over a dialog: back-button + shareable URL.

Also fixes a UX complaint: base-mira's `outline` button variant has no background and a ~92%-lightness
border, so outline buttons (Trips trigger, table Edit, etc.) don't read as buttons at first glance.

Constraint carried from Phase 4: Traccar's positions retention is ~7 days (`TRIP_MAX_AGE_DAYS`), so
route history is only available within that window — the calendar must disable older dates.

## 1. Button outline fix — `components/ui/button.tsx`

Strengthen the `outline` variant (one line): `border-border` → `border-foreground/20`, and add
`bg-background shadow-xs` (stock shadcn has these; base-mira dropped them). Keep existing hover/dark
behaviors (`hover:bg-input/50`, `dark:bg-input/30`). This crisps up every outline button app-wide
consistently — verify visually in the devices table and map popup.

## 2. Shared map support — extract from `app/(dashboard)/map/live-map.tsx`

New `app/(dashboard)/map/map-support.tsx` (client): move `MAPTILER_KEY`/`LIGHT_TILE_URL`/
`DARK_TILE_URL`/`ATTRIBUTION`, `useIsDarkMode()`, and `InvalidateSizeOnMount` there verbatim;
`live-map.tsx` imports them. The route map reuses all three (same tiles, dark-mode swap, resize fix).

## 3. Retention + units helpers

- `lib/retention.ts` (server): `positionsRetentionDays()` = `Number(process.env.TRIP_MAX_AGE_DAYS) || 7`
  — extracted from `lib/dal/trips.ts` (which now imports it) and reused by the new route DAL clamp.
- `lib/route-limits.ts` (client-safe): `export const ROUTE_HISTORY_DAYS = 7` with a comment to keep it
  in sync with `TRIP_MAX_AGE_DAYS` — the calendar (client) needs the bound without an env read.
- `lib/units.ts`: `KNOTS_TO_KMH = 1.852` — extracted from `device-popup-content.tsx` (which imports it)
  and reused by the route-point popup.

## 4. DAL

- `lib/dal/devices.ts`: export `assertDeviceVisible(deviceId)` (move the private helper out of
  `lib/dal/trips.ts`; trips imports it).
- `lib/dal/positions.ts`: add `listRoutePositions(deviceId, from, to): Promise<PositionDTO[]>` —
  `verifySession()` + `assertDeviceVisible`, validate `from < to`, clamp `from` to
  `now − positionsRetentionDays()`, fetch via existing `listRawRoutePositions`, map through
  `toPositionDto` (already carries `course` for arrows). **Server-side decimation**: if the window
  returns more than ~5,000 points (7 days ≈ 30k at 20s cadence ≈ multi-MB payload), keep every
  ceil(n/5000)th point plus first and last — visually indistinguishable on a polyline.

## 5. shadcn calendar install

`npx shadcn@latest add calendar` (brings `react-day-picker`). Per [[feedback-shadcn-registry-conflicts]]:
review what the CLI wants to write and **decline overwrites** of existing customized files (button.tsx
especially, since §1 edits it) — only accept net-new files.

## 6. RouteDialog — `app/(dashboard)/devices/route-dialog.tsx` (client, shared)

Same shape as TripsDialog (Base UI `render` prop, outline trigger "Route"). Content:
- Period choice: three options — Today / Yesterday / Custom (Tabs or segmented buttons).
- Custom: `Calendar` `mode="range"`, disabled dates outside `[today − ROUTE_HISTORY_DAYS, today]`,
  plus two `<Input type="time">` (defaults 00:00 / 23:59) for start/end time-of-day.
- Today/Yesterday compute local-midnight boundaries **client-side** (browser knows the user's
  timezone; the server shouldn't guess) → ISO strings.
- "View route" → `router.push(\`/routes?deviceId=${id}&from=${fromIso}&to=${toIso}\`)`.

## 7. Entry points

- `app/(dashboard)/devices/columns.tsx`: the Trips cell becomes a `flex gap-2` with both
  `<TripsDialog …/>` and `<RouteDialog …/>` triggers.
- `app/(dashboard)/map/device-popup-content.tsx`: the trips row becomes a two-button row
  (grid-cols-2): Trips + Route.

## 8. Route page — `app/(dashboard)/routes/page.tsx` (Server Component)

- `searchParams` is a **Promise in Next 16 — await it** (per node_modules/next/dist/docs).
- zod-validate `deviceId`/`from`/`to`; invalid → `redirect("/devices")`.
- Fetch `listDevices()` (for the device name + visibility) and `listRoutePositions(...)` in parallel.
- Layout: flex column filling the dashboard content area — compact header (device name, formatted
  period, "← Back" link to /devices) + `flex-1 relative` map container (same `absolute inset-0`
  technique as `map/page.tsx`).
- Empty window: friendly "No recorded positions in this period" state instead of a blank map.
- `components/site-header.tsx`: add `"/routes": "Route"` to TITLES.

## 9. Route map — `app/(dashboard)/routes/route-map.tsx` + `route-map-view.tsx`

`route-map-view.tsx` = thin `next/dynamic(..., { ssr: false })` wrapper (same reason as
`map/map-view.tsx`: Leaflet touches `window` at module eval). `route-map.tsx` (client):

- `MapContainer` with `preferCanvas` (canvas renderer keeps thousands of clickable points cheap),
  shared `TileLayer`/dark-mode/`InvalidateSizeOnMount` from map-support.
- **Fit to route**: `L.latLngBounds(points)` → `map.fitBounds(bounds, { padding: [40, 40] })` once on
  mount (small `FitRouteBounds` helper using `useMap()`).
- **Line**: `<Polyline positions={latlngs} weight={4} opacity={0.8} />` (react-leaflet export
  confirmed in v5).
- **Clickable points**: `<CircleMarker>` per position (radius ~4) with `<Popup>` showing a new
  `RoutePointPopup` — device name, `fixTime` toLocaleString, address ?? fallback, speed × KNOTS_TO_KMH.
- **Direction arrows**: every Nth point (sampled so the whole route shows ~30–40 arrows), replace the
  circle with a small `L.divIcon` arrow rotated by `position.course` (CSS
  `transform: rotate(<course>deg)`; plain divIcon HTML like device-icon.tsx, reuse its escape-free
  static markup approach — no user text is interpolated here). Same popup on click.
- **Start / end markers**: distinct divIcons (e.g. green "start" dot, dark "end" flag), same popup.

## 10. Docs

- Save this plan to `docs/plans/phase-5-routes.md`.
- PROGRESS.md: mark Phase 5 implemented-pending-verification (same convention as Phase 4).

## Verification

1. `npm run test` (existing geo tests), `npx tsc --noEmit`, `npx eslint` on touched files — clean.
2. Dev server smoke: `/routes` (unauthenticated) 307s; with bogus params redirects to `/devices`.
3. User click-through (auth required): outline buttons now visibly buttons in table + popup; Route →
   Today on a device with data draws the line; clicking points/arrows pops the details card; custom
   range with calendar disables dates older than 7 days; dark-mode tiles swap; empty period shows the
   friendly message; browser back returns to the previous page. Even a parked fleet works for this —
   any device with any recorded positions today will draw (a tight cluster), and yesterday's data
   exists regardless of current movement.
