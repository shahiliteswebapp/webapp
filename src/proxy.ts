import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { googleAuthConfigured } from "@/lib/auth-config";

/*
 * Optimistic auth routing (Next 16 "Proxy", formerly Middleware).
 * Only checks cookie presence — the real session check happens in
 * src/app/(app)/layout.tsx via requireSession().
 *
 * In Google mode only the Auth.js cookie counts (so a leftover mock cookie
 * can't cause a redirect loop); in local mock mode only `sl_session` counts.
 */

const AUTHJS_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth.js endpoints (and other API routes, which do their own auth checks)
  // must stay reachable while signed out.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const cookieNames = googleAuthConfigured() ? AUTHJS_COOKIES : ["sl_session"];
  const hasSession = cookieNames.some((c) => request.cookies.has(c));

  if (pathname === "/sign-in") {
    return hasSession
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and files with an extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
