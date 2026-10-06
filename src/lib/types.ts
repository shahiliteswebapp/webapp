/*
 * Two roles: an employee builds and sends quotations; the superadmin does
 * everything an employee can, plus reviews (approve/reject), sees every
 * quotation regardless of status, and controls who may sign in at all.
 */
export type Role = "employee" | "superadmin";

export type QuotationStatus =
  | "downloaded" // generated + downloaded, never sent for review
  | "submitted_for_review"
  | "approved"
  | "rejected";

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  downloaded: "Downloaded only",
  submitted_for_review: "Submitted for review",
  approved: "Generated successfully",
  rejected: "Rejected",
};

/*
 * The ledger entry for a quotation. The PDF and the editable contents
 * (rooms, lights, client details, blueprint) are saved beside it by
 * src/lib/quote-files.ts, so a quotation can be reopened and edited.
 */
export interface QuotationRecord {
  id: string;
  number: string; // e.g. SL-2026-0001
  employeeName: string;
  employeeEmail: string;
  status: QuotationStatus;
  totalAmount: number; // grand total incl. GST, INR
  createdAt: string; // ISO timestamp (generation date & time)
  reviewedBy?: string; // reviewer email
  reviewedAt?: string; // ISO timestamp
  reviewNote?: string;
  /** client the quotation is for (from the client details form) */
  clientName?: string;
  /** ISO timestamp of the last edit; unset until the first edit */
  updatedAt?: string;
  /** 1 for the first version, +1 per edit */
  revision?: number;
}

/** Who may reopen and edit a quotation: the superadmin always, an employee only their own. */
export function canEditQuotation(
  session: { email: string; role: Role },
  record: Pick<QuotationRecord, "employeeEmail">,
): boolean {
  return (
    session.role === "superadmin" ||
    record.employeeEmail.toLowerCase() === session.email.toLowerCase()
  );
}

/* ---- access control: who may sign in at all ---- */

export type AccessStatus = "active" | "removed";

export interface AccessEntry {
  email: string;
  name?: string;
  status: AccessStatus;
  addedBy: string;
  addedAt: string;
  removedBy?: string;
  removedAt?: string;
  lastSignInAt?: string;
  signInCount: number;
}

export interface QuotationEvent {
  id: string;
  quotationId: string;
  at: string;
  actorEmail: string;
  from?: QuotationStatus;
  to: QuotationStatus;
  note?: string;
}

/* ---- store interface (shared by the JSON and Supabase implementations) ---- */

export interface QuotationFilter {
  employeeEmail?: string;
  status?: QuotationStatus;
  /** inclusive lower bound, ISO date or datetime */
  fromISO?: string;
  /** inclusive upper bound, ISO date or datetime */
  toISO?: string;
}

export interface CreateQuotationInput {
  employeeName: string;
  employeeEmail: string;
  totalAmount: number;
  /** "downloaded" (no review requested) or "submitted_for_review" */
  status: Extract<QuotationStatus, "downloaded" | "submitted_for_review">;
  clientName?: string;
}

export interface UpdateQuotationInput {
  totalAmount: number;
  status: Extract<QuotationStatus, "downloaded" | "submitted_for_review">;
  clientName?: string;
  actorEmail: string;
}

/* ---- client details, typed in just before the PDF is generated ---- */

export interface ClientDetails {
  name: string;
  phone?: string;
  email?: string;
  /** site / delivery address */
  address?: string;
}

/* ---- In-browser wizard draft (sent to the server when the PDF is generated) ---- */

export interface DraftBlueprint {
  name: string;
  kind: "pdf" | "png";
  /** original uploaded file, kept for reference */
  blob: Blob;
  /** rendered raster (PNG data URL): PDF page 1, or the PNG itself, downscaled.
   *  Used for the on-screen viewer and later embedded in the PDF. */
  previewDataUrl: string;
  width: number;
  height: number;
  pageCount: number;
}

/** A discount: a percentage, or a fixed rupee amount. */
export interface Discount {
  kind: "pct" | "amt";
  value: number;
}

/** The product picked for one light, in one quotation option. */
export interface LineChoice {
  /** "" in an alternative = this light is left out of that option */
  systemId: string;
  /** chosen automation variant (functional systems with interface options) */
  interfaceTag?: string;
  control?: "dimmable" | "tunable";
  /** employee-entered rate, only used when the catalogue has no price */
  unitPrice?: number;
}

/** The most options (alternative proposals) one quotation can carry. */
export const MAX_OPTIONS = 3;

/*
 * One light in a room. Its own LineChoice fields are Option 1; `alts` holds
 * Options 2 and 3. A missing alt means "same light as Option 1". Quantity and
 * discount are shared by every option.
 */
export interface RoomLine extends LineChoice {
  id: string;
  qty: number;
  /** discount on this line (qty x rate) */
  discount?: Discount;
  /** alts[0] = Option 2, alts[1] = Option 3 */
  alts?: (LineChoice | null)[];
}

export interface DraftRoom {
  id: string;
  name: string;
  lines: RoomLine[];
  /** discount on the room total, after line discounts */
  discount?: Discount;
}

export interface QuoteDraft {
  createdAt: string;
  updatedAt: string;
  blueprint?: DraftBlueprint;
  /** set when the employee chose to quote without a blueprint */
  noBlueprint?: boolean;
  /** charge GST on the quotation (default true) */
  applyGst?: boolean;
  /** discount on the whole quotation, after room discounts, before GST */
  discount?: Discount;
  /** how many options (1 to MAX_OPTIONS) the quotation offers; default 1 */
  optionCount?: number;
  /** who the quotation is for */
  client?: ClientDetails;
  /** last valid day, IST, YYYY-MM-DD; unset = 60 days from generation */
  validUntil?: string;
  /** set when this draft is an edit of a saved quotation (its number) */
  editOf?: string;
  rooms: DraftRoom[];
}

/** True once the employee has started (blueprint uploaded, or skipped). */
export function draftStarted(d: QuoteDraft | null | undefined): d is QuoteDraft {
  return !!d && (!!d.blueprint || !!d.noBlueprint);
}

/** Number of options a draft offers, clamped to 1..MAX_OPTIONS. */
export function optionCountOf(d: { optionCount?: number } | null | undefined): number {
  const n = Math.round(Number(d?.optionCount) || 1);
  return Math.min(Math.max(n, 1), MAX_OPTIONS);
}

/**
 * The product a line uses in option `opt` (0-based). Option 1 is the line
 * itself; an unset alternative falls back to it.
 */
export function choiceFor(line: RoomLine, opt: number): LineChoice & { inherited: boolean } {
  const own = {
    systemId: line.systemId,
    interfaceTag: line.interfaceTag,
    control: line.control,
    unitPrice: line.unitPrice,
  };
  if (opt <= 0) return { ...own, inherited: false };
  const alt = line.alts?.[opt - 1];
  return alt ? { ...alt, inherited: false } : { ...own, inherited: true };
}
