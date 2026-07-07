import "server-only";
import { redirect } from "next/navigation";
import type { TraccarUser } from "@/lib/traccar/types";

export class TraccarAuthError extends Error {
  constructor(message = "Invalid username or password") {
    super(message);
    this.name = "TraccarAuthError";
  }
}

export class TraccarRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "TraccarRequestError";
  }
}

function getBaseUrl(): string {
  const url = process.env.TRACCAR_API_URL;
  if (!url) throw new Error("TRACCAR_API_URL environment variable is not set");
  return url.replace(/\/$/, "");
}

function extractSessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const jsessionCookie = cookies.find((c) => c.startsWith("JSESSIONID="));
  if (!jsessionCookie) {
    throw new Error("Traccar response did not include a JSESSIONID cookie");
  }
  const value = jsessionCookie.split(";")[0];
  return value; // keep as "JSESSIONID=<value>", ready to forward verbatim
}

/**
 * Authenticates against Traccar's own session API. Never let the raw
 * response (password/token/etc.) or the JSESSIONID reach the browser --
 * callers must map the returned user through lib/traccar/dto.ts and store
 * traccarSessionId only inside our own encrypted session cookie.
 */
export async function traccarLogin(
  email: string,
  password: string,
): Promise<{ user: TraccarUser; traccarSessionId: string }> {
  const response = await fetch(`${getBaseUrl()}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new TraccarAuthError();
  }
  if (!response.ok) {
    throw new TraccarRequestError(`Traccar login failed (${response.status})`, response.status);
  }

  const traccarSessionId = extractSessionCookie(response);
  const user = (await response.json()) as TraccarUser;
  return { user, traccarSessionId };
}

/** Best-effort: closes the Traccar session server-side. Never let a failure here block our own logout. */
export async function traccarLogout(traccarSessionId: string): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/api/session`, {
      method: "DELETE",
      headers: { Cookie: traccarSessionId },
    });
  } catch {
    // ignore -- our cookie is cleared regardless
  }
}

type TraccarFetchOptions = {
  method?: string;
  searchParams?: Record<string, string | number | undefined>;
  body?: unknown;
};

/**
 * Generic authenticated Traccar REST call, reused by DAL modules (devices,
 * geofences, positions, events, ...). Forwards the real JSESSIONID
 * server-side only -- never accepts it from a client-supplied value.
 */
export async function traccarFetch<T>(
  traccarSessionId: string,
  path: string,
  options: TraccarFetchOptions = {},
): Promise<T> {
  const url = new URL(`${getBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) url.searchParams.append(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Cookie: traccarSessionId,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    // Our own cookie is still validly signed, but the JSESSIONID inside it
    // is no longer accepted by Traccar (expired, or the user was disabled/
    // logged out server-side). Treat this the same as "not logged in" and
    // send them back to the login screen instead of surfacing a raw 401 as
    // an unhandled error. Redirect through a Route Handler rather than
    // clearing the cookie here directly -- traccarFetch can be called from
    // a plain Server Component render (e.g. a page's data fetch), which is
    // not allowed to mutate cookies; only Server Actions/Route Handlers are.
    redirect("/api/session/expire");
  }
  if (!response.ok) {
    throw new TraccarRequestError(`Traccar request to ${path} failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
