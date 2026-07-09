// Client-safe mirror of the server-side retention window (lib/retention.ts
// reads TRIP_MAX_AGE_DAYS, which isn't exposed to the browser). The route
// dialog's calendar uses this to disable dates with no recorded positions
// left. Keep in sync with TRIP_MAX_AGE_DAYS in .env.local / .env.example.
export const ROUTE_HISTORY_DAYS = 7;
