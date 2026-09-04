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
 * The ONLY thing persisted server-side. No blueprint, no rooms, no line items —
 * just the ledger entry for a quotation that was generated.
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
}

/* ---- In-browser wizard draft (never leaves the device until "send") ---- */

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

export interface RoomLine {
  id: string;
  systemId: string;
  qty: number;
}

export interface DraftRoom {
  id: string;
  name: string;
  lines: RoomLine[];
}

export interface QuoteDraft {
  createdAt: string;
  updatedAt: string;
  blueprint?: DraftBlueprint;
  rooms: DraftRoom[];
}
