/*
 * Central config. Everything here is a PLACEHOLDER for local development and is
 * meant to be edited in one place. When the client provides real details,
 * replace the values below (or move them to env vars).
 */

export const COMPANY = {
  legalName: "Shahi Lites",
  tagline: "Lighting Design & Supply",
  addressLines: [
    "[Address line 1 — placeholder]",
    "[Address line 2 — placeholder]",
    "[City, State — PIN placeholder]",
  ],
  phones: ["[+91 00000 00000 — placeholder]"],
  email: "hanabiradesigns@gmail.com",
  // No website for now (per client).
  gstin: "[GSTIN — placeholder]",
} as const;

export const QUOTE = {
  currency: "INR",
  currencySymbol: "₹", // ₹
  gstRatePct: 18,
  gstMode: "exclusive" as const, // GST added on top of the rooms subtotal
  validityDays: 60, // 2 months
  numberPrefix: "SL",
} as const;

/*
 * Email routing. For now every quotation / notification email is sent from a
 * single Gmail account to a single fixed recipient, regardless of who is
 * signed in. Change `recipientOverride` to `null` later to send to the actual
 * signed-in employee instead.
 */
export const EMAIL = {
  senderName: "Shahi Lites",
  senderEmail: "hanabiradesigns@gmail.com",
  recipientOverride: "stuti.ghoshal61@gmail.com",
  // When GMAIL_APP_PASSWORD is not set, sending is stubbed: the PDF is written
  // to ./output and the "send" is logged instead of transmitted.
} as const;

export const DISCLAIMER =
  "This PDF is the only copy of this quotation. Shahi Lites does not store or retain " +
  "this document or its line items — please keep this file safe, as it cannot be " +
  "reissued or reconstructed. All amounts are in Indian Rupees (INR); GST is charged " +
  "at 18% as shown. This quotation is valid for 2 months (60 days) from the date and " +
  "time of generation.";

export const UPLOAD = {
  acceptedTypes: ["application/pdf", "image/png"],
  acceptedLabel: "PDF or PNG",
  maxBytes: 20 * 1024 * 1024, // 20 MB hard cap
  softWarnBytes: 10 * 1024 * 1024, // warn above 10 MB
  displayMaxPx: 3000, // downscale blueprint for on-screen display
  pdfThumbMaxPx: 1200, // downscale blueprint thumbnail embedded in the PDF
} as const;

// Quick-add chips on the room-list screen. Covers residential + commercial,
// since the client does both.
export const COMMON_ROOM_NAMES = [
  // Residential
  "Living Room",
  "Drawing Room",
  "Master Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Kitchen",
  "Dining",
  "Foyer",
  "Passage",
  "Balcony",
  "Study",
  "Pooja Room",
  "Powder Room",
  "Master Bath",
  "Common Bath",
  "Utility",
  "Store",
  // Commercial
  "Reception",
  "Entrance Lobby",
  "Office",
  "Cabin",
  "Workstation Area",
  "Conference Room",
  "Meeting Room",
  "Staff Room",
  "Pantry",
  "Server Room",
  "Toilet",
  "Corridor",
] as const;
