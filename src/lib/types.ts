export type Role = "employee" | "manager";

export type QuotationStatus =
  | "submitted_for_review"
  | "approved"
  | "rejected";

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  submitted_for_review: "Submitted for review",
  approved: "Generated successfully",
  rejected: "Rejected",
};

/*
 * The ONLY thing persisted server-side. No blueprint, no rooms, no line items —
 * just the ledger entry for a quotation that was sent for review.
 */
export interface QuotationRecord {
  id: string;
  number: string; // e.g. SL-2026-0001
  employeeName: string;
  employeeEmail: string;
  status: QuotationStatus;
  totalAmount: number; // grand total incl. GST, INR
  createdAt: string; // ISO timestamp (generation date & time)
  reviewedBy?: string; // manager email
  reviewedAt?: string; // ISO timestamp
  reviewNote?: string;
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
