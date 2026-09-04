import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "./types";

/*
 * MOCK auth for local development.
 *
 * A single httpOnly cookie holds { name, email, role }. There is no password and
 * no Google OAuth yet. When real auth is wired (Auth.js / NextAuth + Google),
 * replace the body of this file — `getSession()` is the only interface the rest
 * of the app depends on.
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
      (obj.role === "employee" || obj.role === "manager")
    ) {
      return { name: obj.name, email: obj.email, role: obj.role };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function getSession(): Promise<Session | null> {
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

/** Manager-only guard. */
export async function requireManager(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "manager") redirect("/dashboard");
  return session;
}

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
