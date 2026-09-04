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

/**
 * Role for a signed-in email. For now: anyone listed in MANAGER_EMAILS is a
 * manager, everyone else is an employee. (A superadmin UI will manage this
 * later.)
 */
export function roleForEmail(email: string): Role {
  const managers = (process.env.MANAGER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return managers.includes(email.trim().toLowerCase()) ? "manager" : "employee";
}
