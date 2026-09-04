import type { QuotationFilter } from "@/lib/store";
import type { QuotationStatus } from "@/lib/types";

const STATUSES = ["submitted_for_review", "approved", "rejected"] as const;

export interface HistoryParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  status?: QuotationStatus;
}

const isYmd = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function parseHistoryParams(raw: {
  from?: string;
  to?: string;
  status?: string;
}): HistoryParams {
  return {
    from: isYmd(raw.from) ? raw.from : undefined,
    to: isYmd(raw.to) ? raw.to : undefined,
    status: (STATUSES as readonly string[]).includes(raw.status ?? "")
      ? (raw.status as QuotationStatus)
      : undefined,
  };
}

export function toStoreFilter(
  p: HistoryParams,
  employeeEmail?: string,
): QuotationFilter {
  return {
    employeeEmail,
    status: p.status,
    // Interpret the calendar dates in the server's local time, then to UTC ISO
    // (the store compares ISO strings on createdAt).
    fromISO: p.from
      ? new Date(`${p.from}T00:00:00`).toISOString()
      : undefined,
    toISO: p.to ? new Date(`${p.to}T23:59:59.999`).toISOString() : undefined,
  };
}

export function historyQueryString(p: HistoryParams): string {
  const q = new URLSearchParams();
  if (p.from) q.set("from", p.from);
  if (p.to) q.set("to", p.to);
  if (p.status) q.set("status", p.status);
  return q.toString();
}
