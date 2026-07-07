// No "server-only" import here on purpose: server.ts (the custom Node
// server hosting the /ws/live WebSocket upgrade) runs outside Next.js's
// bundler via tsx, and importing "server-only" in that plain-Node context
// throws unconditionally (its export map only no-ops under the "react-server"
// resolve condition, which only Next's own server compilation sets). This
// module holds the actual logic; lib/session.ts re-exports it with the
// server-only guard for use from Next.js app code (DAL/actions/proxy.ts).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "__session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  traccarSessionId: string;
  userId: number;
  name: string;
  administrator: boolean;
  readonly: boolean;
  deviceReadonly: boolean;
  limitCommands: boolean;
  disabled: boolean;
};

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

// Local signature/expiry check only -- no network or DB calls, so this is
// safe to call from proxy.ts (which must stay optimistic) as well as the DAL.
export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
