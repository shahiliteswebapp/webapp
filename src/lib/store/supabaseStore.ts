import { getSupabase } from "@/lib/supabase";
import type {
  AccessEntry,
  AccessStatus,
  CreateQuotationInput,
  QuotationEvent,
  QuotationFilter,
  QuotationRecord,
  QuotationStatus,
  UpdateQuotationInput,
} from "../types";

/*
 * Supabase (Postgres) implementation of the quotation store. Selected by
 * src/lib/store/index.ts when a Supabase key is set.
 *
 * Schema + the create_quotation() RPC live in supabase/schema.sql. Run that
 * once (and again after updates) in the Supabase SQL editor.
 */

/*
 * supabase-js returns errors as plain objects. Thrown as-is they reach the
 * Next error boundary as "[object Object]" with no stack, so wrap them in a
 * real Error that keeps the Postgres code / message for the server logs.
 */
function dbError(e: { message?: string; code?: string; details?: string | null; hint?: string | null }): Error {
  const parts = [e.message || "Database request failed"];
  if (e.code) parts.push(`code ${e.code}`);
  if (e.details) parts.push(e.details);
  if (e.hint) parts.push(`hint: ${e.hint}`);
  return new Error(`Supabase: ${parts.join(" | ")}`, { cause: e });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QuotationRow {
  id: string;
  number: string;
  employee_name: string;
  employee_email: string;
  status: QuotationStatus;
  total_amount: number | string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

interface EventRow {
  id: string;
  quotation_id: string;
  at: string;
  actor_email: string;
  from_status: QuotationStatus | null;
  to_status: QuotationStatus;
  note: string | null;
}

interface AccessRow {
  email: string;
  name: string | null;
  status: AccessStatus;
  added_by: string;
  added_at: string;
  removed_by: string | null;
  removed_at: string | null;
  last_sign_in_at: string | null;
  sign_in_count: number;
}

function mapRecord(r: QuotationRow): QuotationRecord {
  return {
    id: r.id,
    number: r.number,
    employeeName: r.employee_name,
    employeeEmail: r.employee_email,
    status: r.status,
    totalAmount: Number(r.total_amount),
    createdAt: r.created_at,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    reviewNote: r.review_note ?? undefined,
  };
}

function mapEvent(e: EventRow): QuotationEvent {
  return {
    id: e.id,
    quotationId: e.quotation_id,
    at: e.at,
    actorEmail: e.actor_email,
    from: e.from_status ?? undefined,
    to: e.to_status,
    note: e.note ?? undefined,
  };
}

function mapAccess(a: AccessRow): AccessEntry {
  return {
    email: a.email,
    name: a.name ?? undefined,
    status: a.status,
    addedBy: a.added_by,
    addedAt: a.added_at,
    removedBy: a.removed_by ?? undefined,
    removedAt: a.removed_at ?? undefined,
    lastSignInAt: a.last_sign_in_at ?? undefined,
    signInCount: a.sign_in_count,
  };
}

export async function listQuotations(
  filter: QuotationFilter = {},
): Promise<QuotationRecord[]> {
  let q = getSupabase()
    .from("quotations")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter.employeeEmail) {
    q = q.eq("employee_email", filter.employeeEmail.toLowerCase());
  }
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.fromISO) q = q.gte("created_at", filter.fromISO);
  if (filter.toISO) q = q.lte("created_at", filter.toISO);

  const { data, error } = await q;
  if (error) throw dbError(error);
  return (data as QuotationRow[]).map(mapRecord);
}

export async function getQuotation(
  numberOrId: string,
): Promise<QuotationRecord | null> {
  const column = UUID_RE.test(numberOrId) ? "id" : "number";
  const { data, error } = await getSupabase()
    .from("quotations")
    .select("*")
    .eq(column, numberOrId)
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? mapRecord(data as QuotationRow) : null;
}

export async function listEvents(
  quotationId: string,
): Promise<QuotationEvent[]> {
  const { data, error } = await getSupabase()
    .from("quotation_events")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("at", { ascending: true });
  if (error) throw dbError(error);
  return (data as EventRow[]).map(mapEvent);
}

/** Rejections per employee (lower-case email -> count), from the event log. */
export async function rejectionCounts(): Promise<Map<string, number>> {
  const { data, error } = await getSupabase()
    .from("quotation_events")
    .select("quotation_id, quotations(employee_email)")
    .eq("to_status", "rejected");
  if (error) throw dbError(error);
  const out = new Map<string, number>();
  for (const row of (data ?? []) as { quotations: { employee_email: string } | { employee_email: string }[] | null }[]) {
    const q = Array.isArray(row.quotations) ? row.quotations[0] : row.quotations;
    const email = q?.employee_email?.toLowerCase();
    if (email) out.set(email, (out.get(email) ?? 0) + 1);
  }
  return out;
}

export async function createQuotation(
  input: CreateQuotationInput,
): Promise<QuotationRecord> {
  const { data, error } = await getSupabase().rpc("create_quotation", {
    p_employee_name: input.employeeName,
    p_employee_email: input.employeeEmail.toLowerCase(),
    p_total_amount: input.totalAmount,
    p_status: input.status,
  });
  if (error) throw dbError(error);
  const row = (Array.isArray(data) ? data[0] : data) as QuotationRow;
  return mapRecord(row);
}

/*
 * Record an edit. The live schema has no client / revision columns yet, so
 * only the total and status change here (the JSON store keeps the rest).
 */
export async function updateQuotation(
  id: string,
  input: UpdateQuotationInput,
): Promise<QuotationRecord | null> {
  const column = UUID_RE.test(id) ? "id" : "number";
  const sb = getSupabase();
  const current = await getQuotation(id);
  if (!current) return null;

  const { data, error } = await sb
    .from("quotations")
    .update({
      total_amount: input.totalAmount,
      status: input.status,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    })
    .eq(column, id)
    .select("*")
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) return null;

  const row = data as QuotationRow;
  const { error: evErr } = await sb.from("quotation_events").insert({
    quotation_id: row.id,
    actor_email: input.actorEmail.toLowerCase(),
    from_status: current.status,
    to_status: input.status,
    note: "Edited",
  });
  if (evErr) throw dbError(evErr);
  return mapRecord(row);
}

export async function setStatus(
  id: string,
  to: Exclude<QuotationStatus, "submitted_for_review" | "downloaded">,
  actorEmail: string,
  note?: string,
): Promise<QuotationRecord | null> {
  const column = UUID_RE.test(id) ? "id" : "number";
  const sb = getSupabase();

  // Atomic guard: only transitions a row that is still awaiting review.
  const { data, error } = await sb
    .from("quotations")
    .update({
      status: to,
      reviewed_by: actorEmail,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq(column, id)
    .eq("status", "submitted_for_review")
    .select("*")
    .maybeSingle();

  if (error) throw dbError(error);
  if (!data) return null; // not found, or already decided

  const row = data as QuotationRow;
  const { error: evErr } = await sb.from("quotation_events").insert({
    quotation_id: row.id,
    actor_email: actorEmail,
    from_status: "submitted_for_review",
    to_status: to,
    note: note ?? null,
  });
  if (evErr) throw dbError(evErr);

  return mapRecord(row);
}

/* ---- access control ---- */

export async function isAllowed(email: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("app_users")
    .select("status")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw dbError(error);
  return data?.status === "active";
}

export async function touchSignIn(email: string, name: string): Promise<void> {
  const { error } = await getSupabase().rpc("touch_sign_in", {
    p_email: email.toLowerCase(),
    p_name: name || null,
  });
  if (error) throw dbError(error);
}

export async function listAccess(): Promise<AccessEntry[]> {
  const { data, error } = await getSupabase()
    .from("app_users")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw dbError(error);
  return (data as AccessRow[]).map(mapAccess);
}

export async function addAccess(
  email: string,
  name: string | undefined,
  byEmail: string,
): Promise<AccessEntry> {
  const sb = getSupabase();
  const e = email.trim().toLowerCase();
  const { data: existing } = await sb
    .from("app_users")
    .select("email")
    .eq("email", e)
    .maybeSingle();

  if (existing) {
    const { data, error } = await sb
      .from("app_users")
      .update({
        status: "active",
        removed_at: null,
        removed_by: null,
        ...(name ? { name } : {}),
      })
      .eq("email", e)
      .select("*")
      .single();
    if (error) throw dbError(error);
    return mapAccess(data as AccessRow);
  }

  const { data, error } = await sb
    .from("app_users")
    .insert({
      email: e,
      name: name ?? null,
      status: "active",
      added_by: byEmail.toLowerCase(),
      sign_in_count: 0,
    })
    .select("*")
    .single();
  if (error) throw dbError(error);
  return mapAccess(data as AccessRow);
}

export async function removeAccess(
  email: string,
  byEmail: string,
): Promise<AccessEntry | null> {
  const { data, error } = await getSupabase()
    .from("app_users")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
      removed_by: byEmail.toLowerCase(),
    })
    .eq("email", email.trim().toLowerCase())
    .select("*")
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? mapAccess(data as AccessRow) : null;
}

export async function restoreAccess(
  email: string,
  _byEmail: string,
): Promise<AccessEntry | null> {
  void _byEmail;
  const { data, error } = await getSupabase()
    .from("app_users")
    .update({ status: "active", removed_at: null, removed_by: null })
    .eq("email", email.trim().toLowerCase())
    .select("*")
    .maybeSingle();
  if (error) throw dbError(error);
  return data ? mapAccess(data as AccessRow) : null;
}
