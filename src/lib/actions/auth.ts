"use server";

import { redirect } from "next/navigation";
import { googleAuthConfigured } from "@/lib/auth-config";
import { clearSession, setSession } from "@/lib/session";
import type { Role } from "@/lib/types";

/** Local mock sign-in, only used when Google auth is not configured. */
export async function signInMockAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role: Role =
    String(formData.get("role") ?? "employee") === "superadmin"
      ? "superadmin"
      : "employee";

  if (!name || !email) {
    redirect("/sign-in?error=missing");
  }

  try {
    const { touchSignIn } = await import("@/lib/store");
    await touchSignIn(email, name);
  } catch {
    /* store not reachable in this dev environment, sign-in still proceeds */
  }

  await setSession({ name, email, role });
  redirect("/dashboard");
}

/** Start the Google OAuth flow. */
export async function signInGoogleAction(): Promise<void> {
  const { signIn } = await import("@/auth");
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signOutAction(): Promise<void> {
  if (googleAuthConfigured()) {
    const { signOut } = await import("@/auth");
    await signOut({ redirectTo: "/sign-in" });
    return;
  }
  await clearSession();
  redirect("/sign-in");
}
