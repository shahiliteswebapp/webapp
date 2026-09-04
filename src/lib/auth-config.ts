import type { Role } from "./types";

/*
 * Small, dependency-free helpers so the sign-in page and session layer can
 * decide "Google mode vs local mock mode" without importing next-auth.
 */

/** True once the Google OAuth env vars are present (see .env.local). */
export function googleAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET &&
      process.env.AUTH_SECRET,
  );
}

function splitList(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function superadminEmails(): string[] {
  // SUPERADMIN_EMAILS is the current name; MANAGER_EMAILS is kept as an
  // alias so an already-deployed env var keeps working.
  return [
    ...splitList(process.env.SUPERADMIN_EMAILS),
    ...splitList(process.env.MANAGER_EMAILS),
  ];
}

/** Role for a signed-in email. Everyone not listed is an employee. */
export function roleForEmail(email: string): Role {
  return superadminEmails().includes(email.trim().toLowerCase())
    ? "superadmin"
    : "employee";
}

export function isSuperadminEmail(email: string): boolean {
  return superadminEmails().includes(email.trim().toLowerCase());
}

/**
 * The single reviewer's Gmail — where "send for review" emails land.
 * QUOTE_RECIPIENT overrides it if set; otherwise the first configured
 * superadmin email.
 */
export function reviewerEmail(): string | undefined {
  return process.env.QUOTE_RECIPIENT || superadminEmails()[0];
}
