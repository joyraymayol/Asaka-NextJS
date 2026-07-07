import "server-only";

// Simple in-memory fixed-window limiter for the login endpoint. Good enough
// for a single self-hosted instance at v1 scale; swap for a Redis-backed
// limiter if this ever sits behind multiple instances/a CDN.
const attempts = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS_PER_WINDOW;
}
