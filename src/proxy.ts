import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/*
 * Optimistic auth routing (Next 16 "Proxy", formerly Middleware).
 * Only checks cookie presence — the real session check happens in
 * src/app/(app)/layout.tsx via requireSession().
 */

const SESSION_COOKIES = [
  "sl_session", // local mock
  "authjs.session-token", // Auth.js (http)
  "__Secure-authjs.session-token", // Auth.js (https)
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth.js endpoints (and other API routes, which do their own auth checks)
  // must stay reachable while signed out.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));

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
