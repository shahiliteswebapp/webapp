"use server";

import { redirect } from "next/navigation";
import { clearSession, setSession } from "@/lib/session";
import type { Role } from "@/lib/types";

export async function signInAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const roleRaw = String(formData.get("role") ?? "employee");
  const role: Role = roleRaw === "manager" ? "manager" : "employee";

  if (!name || !email) {
    redirect("/sign-in?error=missing");
  }

  await setSession({ name, email, role });
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/sign-in");
}
