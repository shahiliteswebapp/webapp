/*
 * Central config. Everything here is a PLACEHOLDER for local development and is
 * meant to be edited in one place. When the client provides real details,
 * replace the values below (or move them to env vars).
 */

export const COMPANY = {
  legalName: "Shahi Lites",
  tagline: "Lighting Design & Supply",
  addressLines: [
    "2/1, near Mithai Wala Chauraha, Vijay Khand",
    "Ujariyaon, Vijay Khand 2, Gomti Nagar",
    "Lucknow, Uttar Pradesh 226010",
  ],
  phones: ["+91 94150 04693"],
  email: "shahiliteswebapp@gmail.com",
  // No website or GSTIN on the quotation (per client).
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
 * Email routing. Every quotation email is sent from a single Gmail account.
 * The recipient for "send for review" is resolved dynamically to the actual
 * reviewer's Gmail (see reviewerEmail() in auth-config.ts) — there is one
 * reviewer (the superadmin). QUOTE_RECIPIENT in .env.local overrides it if set.
 * When GMAIL_APP_PASSWORD is not set, sending is stubbed: the PDF is written
 * to ./output (local only) and handed to the browser as a download instead.
 */
export const EMAIL = {
  senderName: "Shahi Lites",
  senderEmail: "shahiliteswebapp@gmail.com",
} as const;

export function disclaimer(applyGst = true): string {
  return (
    "This PDF is the only copy of this quotation. Shahi Lites does not store or retain " +
    "this document or its line items. Please keep this file safe, as it cannot be " +
    "reissued or reconstructed. All amounts are in Indian Rupees (INR); " +
    (applyGst ? "GST is charged at 18% as shown. " : "GST is not included. ") +
    "This quotation is valid for 2 months (60 days) from the date and time of generation " +
    "(India Standard Time)."
  );
}

export const DISCLAIMER = disclaimer(true);

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
