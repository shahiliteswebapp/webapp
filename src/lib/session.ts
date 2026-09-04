import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleAuthConfigured, isSuperadminEmail, roleForEmail } from "./auth-config";
import type { Role } from "./types";

/*
 * Session layer. Two modes, chosen automatically:
 *
 *  - Google mode (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET all set):
 *    reads the Auth.js session; role comes from SUPERADMIN_EMAILS.
 *  - Local mock mode (default): a single httpOnly cookie holds { name, email,
 *    role } chosen on the mock sign-in form.
 *
 * `getSession` / `requireSession` / `requireSuperadmin` are the only
 * interface the rest of the app uses -- both modes return the same `Session`.
 */

const COOKIE = "sl_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface Session {
  name: string;
  email: string;
  role: Role;
}

function encode(s: Session): string {
  return Buffer.from(JSON.stringify(s), "utf8").toString("base64url");
}

function decode(raw: string): Session | null {
  try {
    const obj = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      obj &&
      typeof obj.name === "string" &&
      typeof obj.email === "string" &&
      (obj.role === "employee" || obj.role === "superadmin")
    ) {
      return { name: obj.name, email: obj.email, role: obj.role };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function getSession(): Promise<Session | null> {
  if (googleAuthConfigured()) {
    const { auth } = await import("@/auth");
    const s = await auth();
    const email = s?.user?.email?.trim().toLowerCase();
    if (!email) return null;

    // Defense in depth: a superadmin who removes someone mid-session should
    // lose access on their very next request, not just their next sign-in.
    if (!isSuperadminEmail(email)) {
      const { isAllowed } = await import("@/lib/store");
      if (!(await isAllowed(email))) return null;
    }

    return {
      name: s?.user?.name?.trim() || email,
      email,
      role: roleForEmail(email),
    };
  }

  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  return raw ? decode(raw) : null;
}

/**
 * Use in any protected page/layout. If there's no valid session this redirects
 * to /sign-in (which throws), so the return type is a plain non-null Session.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Superadmin-only guard (review queue, access list). */
export async function requireSuperadmin(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "superadmin") redirect("/dashboard");
  return session;
}

/* ---- mock mode only ---- */

export async function setSession(s: Session): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, encode(s), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
