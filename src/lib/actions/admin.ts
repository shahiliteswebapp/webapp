"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/session";
import { addAccess, removeAccess, restoreAccess } from "@/lib/store";

export async function addAccessAction(formData: FormData): Promise<void> {
  const session = await requireSuperadmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || undefined;
  if (!email || !email.includes("@")) return;

  await addAccess(email, name, session.email);
  revalidatePath("/admin");
}

export async function removeAccessAction(formData: FormData): Promise<void> {
  const session = await requireSuperadmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email === session.email) return; // cannot remove yourself

  await removeAccess(email, session.email);
  revalidatePath("/admin");
}

export async function restoreAccessAction(formData: FormData): Promise<void> {
  const session = await requireSuperadmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  await restoreAccess(email, session.email);
  revalidatePath("/admin");
}
