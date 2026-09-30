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

export function addDays(iso: string | Date, days: number): Date {
  const d = typeof iso === "string" ? new Date(iso) : new Date(iso.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
