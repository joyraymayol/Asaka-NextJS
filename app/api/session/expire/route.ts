import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/session";

// Route Handlers (unlike Server Component renders) are allowed to mutate
// cookies, so lib/traccar/client.ts redirects here -- rather than deleting
// the cookie itself -- whenever Traccar rejects our stored session as
// expired/invalid. See lib/traccar/client.ts's 401 handling in traccarFetch.
export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.redirect(new URL("/login", request.url));
}
