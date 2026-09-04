import { getSupabase } from "@/lib/supabase";
import type {
  CreateQuotationInput,
  QuotationEvent,
  QuotationFilter,
  QuotationRecord,
  QuotationStatus,
} from "../types";

/*
 * Supabase (Postgres) implementation of the quotation store. Selected by
 * src/lib/store/index.ts when SUPABASE_SERVICE_ROLE_KEY is set.
 *
 * Schema + the create_quotation() RPC live in supabase/schema.sql — run that
 * once in the Supabase SQL editor.
 */

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
  if (error) throw error;
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
  if (error) throw error;
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
  if (error) throw error;
  return (data as EventRow[]).map(mapEvent);
}

export async function createQuotation(
  input: CreateQuotationInput,
): Promise<QuotationRecord> {
  const { data, error } = await getSupabase().rpc("create_quotation", {
    p_employee_name: input.employeeName,
    p_employee_email: input.employeeEmail.toLowerCase(),
    p_total_amount: input.totalAmount,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as QuotationRow;
  return mapRecord(row);
}

export async function setStatus(
  id: string,
  to: Exclude<QuotationStatus, "submitted_for_review">,
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

  if (error) throw error;
  if (!data) return null; // not found, or already decided

  const row = data as QuotationRow;
  const { error: evErr } = await sb.from("quotation_events").insert({
    quotation_id: row.id,
    actor_email: actorEmail,
    from_status: "submitted_for_review",
    to_status: to,
    note: note ?? null,
  });
  if (evErr) throw evErr;

  return mapRecord(row);
}
