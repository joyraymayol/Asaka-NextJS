import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decryptSession, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/session";

// Memoized per-request: the real authority for auth, unlike proxy.ts's
// optimistic cookie-presence check. Every DAL/Server Action/Route Handler
// must call one of these -- proxy.ts's matcher excludes /api/**, and even on
// included routes it only redirects, it never protects Server Actions on its own.
export const verifySessionOrNull = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE_NAME)?.value);
});

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await verifySessionOrNull();
  if (!session) redirect("/login");
  return session;
});
