import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/session";

// Optimistic gate only: presence/signature check, zero network or DB calls
// (this also runs on prefetch). Real authorization always happens in the DAL
// (lib/dal/session.ts's verifySession), which every Server Action and Route
// Handler must call independently -- this matcher excludes /api/** and a
// Proxy matcher exclusion silently skips Server Actions on that path too.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!session && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/map", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
