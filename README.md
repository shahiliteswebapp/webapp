# Shahi Lites — Quotations (employee webapp)

Internal tool: turn a floor-plan blueprint into a room-by-room lighting
quotation and email it as a PDF for a manager's review.

**Local-first.** No database, no external accounts. See "How it's wired" below.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in (mock sign-in — any name + email, pick a
role). Nothing here talks to Google, Gmail, or a database yet.

## How it's wired (and what swaps later)

| Concern | Now (local) | Later |
| --- | --- | --- |
| Sign-in | Mock cookie session (`src/lib/session.ts`) | Google OAuth via Auth.js — replace that one file |
| Data | `data/quotations.json` behind `src/lib/store/` | Supabase/Postgres — new impl of the same interface |
| Catalog | `src/lib/catalog.ts` (placeholder systems + accessory rules) | Client's spreadsheet, dropped into the same shape |
| Email | Stub: PDF written to `output/`, send logged | Gmail SMTP (`GMAIL_APP_PASSWORD`) → `hanabiradesigns@gmail.com` → employee |
| PDF | (Phase 5) `@react-pdf/renderer`, transient, never stored | same |

Config that will become real client data lives in `src/lib/config.ts`
(company details, GST 18%, 60-day validity, disclaimer text).

## Build status

- [x] Phase 0 — scaffold, brand tokens (Cormorant Garamond + Montserrat; white/gold/rich-black), config, types, JSON store, pricing engine
- [x] Phase 1 — mock auth, app shell + "+" widget (Start New / History / Dashboard), dashboard
- [x] Phase 2 — blueprint upload (PDF via pdf.js / PNG), IndexedDB draft autosave, pan/zoom viewer, editable room list
- [x] Phase 3 — per-room lighting picker, live cost, auto connectors/drivers from rules, room switcher
- [x] Phase 4 — summary: room cards (edit / delete / add) + subtotal → GST → grand total
- [ ] Phase 5 — PDF generation + email (stub) + send for review
- [ ] Phase 6 — History table + CSV export (date range / day / all)
- [ ] Phase 7 — manager review queue + approve / reject + notifications

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript.
