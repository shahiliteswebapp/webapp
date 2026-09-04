"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/session";
import { getQuotation, setStatus } from "@/lib/store";
import { sendDecisionEmail } from "@/lib/email";

export interface DecideState {
  ok?: boolean;
  error?: string;
  number?: string;
  decision?: "approved" | "rejected";
  transport?: "smtp" | "stub";
}

export async function decideAction(
  _prev: DecideState,
  formData: FormData,
): Promise<DecideState> {
  const session = await requireManager();

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim() || undefined;

  if (decision !== "approved" && decision !== "rejected") {
    return { error: "Choose approve or reject." };
  }

  const current = await getQuotation(id);
  if (!current) return { error: "Quotation not found." };
  if (current.status !== "submitted_for_review") {
    return {
      error: `Already ${current.status.replace(/_/g, " ")}.`,
    };
  }

  const updated = await setStatus(id, decision, session.email, note);
  if (!updated) return { error: "Could not update the quotation." };

  let transport: "smtp" | "stub" = "stub";
  try {
    const r = await sendDecisionEmail({
      number: updated.number,
      decision,
      note,
      managerName: session.name,
      employeeName: updated.employeeName,
      employeeEmail: updated.employeeEmail,
    });
    transport = r.transport;
  } catch (err) {
    console.error("Decision email failed", err);
  }

  revalidatePath("/review");
  revalidatePath("/dashboard");
  revalidatePath("/history");

  return { ok: true, number: updated.number, decision, transport };
}
