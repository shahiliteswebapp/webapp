const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const INR0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹1,23,456.00 */
export function money(n: number): string {
  return INR.format(Number.isFinite(n) ? n : 0);
}

/** ₹1,23,456 (no paise) */
export function money0(n: number): string {
  return INR0.format(Number.isFinite(n) ? n : 0);
}

/** Round to 2 decimal places, avoiding binary float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/*
 * Every date and time is shown in India Standard Time, whatever time zone the
 * server (Vercel runs in UTC) or the browser happens to be in.
 */
export const TIME_ZONE = "Asia/Kolkata";

const DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function fmtDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? "-" : DATE.format(d);
}

export function fmtTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? "-" : TIME.format(d);
}

const YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** IST calendar date as YYYY-MM-DD (for <input type="date"> and filters). */
export function ymd(d: Date): string {
  return YMD.format(d);
}

export function fmtDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? "-" : `${DATETIME.format(d)} IST`;
}

/*
 * Quotation validity: an IST calendar date (YYYY-MM-DD). Defaults to 60 days
 * after generation; the employee can pick any date from today up to a year out.
 */
export const MAX_VALIDITY_DAYS = 366;

export function defaultValidUntil(from: Date = new Date(), days = 60): string {
  return ymd(addDays(from, days));
}

export function isValidValidUntil(v: unknown, now: Date = new Date()): v is string {
  return (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    v >= ymd(now) &&
    v <= ymd(addDays(now, MAX_VALIDITY_DAYS))
  );
}

/** "06 Dec 2026" for a YYYY-MM-DD validity date. */
export function fmtYmd(v: string): string {
  return fmtDate(new Date(`${v}T12:00:00+05:30`));
}

/** Whole days from today (IST) to a YYYY-MM-DD date. */
export function daysUntil(v: string, now: Date = new Date()): number {
  const a = Date.parse(`${ymd(now)}T00:00:00Z`);
  const b = Date.parse(`${v}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string | Date, days: number): Date {
  const d = typeof iso === "string" ? new Date(iso) : new Date(iso.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
