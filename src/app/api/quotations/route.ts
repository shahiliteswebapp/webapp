import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { computeOptions } from "@/lib/quote";
import { createQuotation } from "@/lib/store";
import { sendQuotationEmail } from "@/lib/email";
import { renderQuotationPdf } from "@/lib/pdf/quotation-pdf";
import { productPhotosForPdf } from "@/lib/pdf/product-images";
import { loadCatalogChanges } from "@/lib/catalog-store";
import type { Discount, DraftRoom } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for fetching product photos for the PDF.
export const maxDuration = 60;

interface Body {
  rooms?: DraftRoom[];
  blueprintPreviewDataUrl?: string;
  blueprintName?: string;
  /** "review" (send it on) or "download" (keep it, no review requested) */
  action?: "review" | "download";
  /** charge GST (default true) */
  applyGst?: boolean;
  /** quotation-level discount (line and room discounts ride on `rooms`) */
  discount?: Discount;
  /** how many options (1 to 3); alternative lights ride on `rooms` */
  optionCount?: number;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rooms = Array.isArray(body.rooms) ? body.rooms : [];
  if (rooms.length === 0) {
    return NextResponse.json({ error: "No rooms to quote." }, { status: 400 });
  }

  // Uploaded catalogue items must be known before pricing.
  await loadCatalogChanges({ fresh: true });

  // Recompute totals server-side. Client numbers are never trusted.
  const discount =
    body.discount && (body.discount.kind === "pct" || body.discount.kind === "amt")
      ? { kind: body.discount.kind, value: Number(body.discount.value) }
      : undefined;
  const options = computeOptions({
    rooms,
    applyGst: body.applyGst !== false,
    discount,
    optionCount: body.optionCount,
  });
  const quote = options[0];
  if (options.some((q) => q.grandTotal <= 0)) {
    return NextResponse.json(
      {
        error:
          options.length > 1
            ? "Every option needs at least one priced light."
            : "Add lighting to at least one room first.",
      },
      { status: 400 },
    );
  }

  const forReview = body.action !== "download";

  // The ledger keeps one amount: Option 1's grand total.
  const record = await createQuotation({
    employeeName: session.name,
    employeeEmail: session.email,
    totalAmount: quote.grandTotal,
    status: forReview ? "submitted_for_review" : "downloaded",
  });

  let pdf: Buffer;
  try {
    const photos = await productPhotosForPdf(
      options.flatMap((q) => q.rooms.flatMap((r) => r.lines.map((l) => l.image ?? ""))),
    );
    pdf = await renderQuotationPdf({
      photos,
      number: record.number,
      createdAtISO: record.createdAt,
      employeeName: session.name,
      options,
      blueprintDataUrl: body.blueprintPreviewDataUrl,
      blueprintName: body.blueprintName,
    });
  } catch (err) {
    console.error("PDF render failed", err);
    return NextResponse.json(
      { error: "Could not generate the PDF.", number: record.number },
      { status: 500 },
    );
  }

  // Local convenience only: drop a copy in ./output. Skipped on serverless
  // (read-only FS); the PDF still reaches the client via `pdfBase64` below.
  let savedTo: string | undefined;
  if (!process.env.VERCEL) {
    try {
      const rel = `output/${record.number}.pdf`;
      await fs.mkdir(path.join(process.cwd(), "output"), { recursive: true });
      await fs.writeFile(path.join(process.cwd(), rel), pdf);
      savedTo = rel;
    } catch (err) {
      console.error("Could not write PDF to ./output", err);
    }
  }

  let transport: "smtp" | "stub" = "stub";
  let emailError: string | undefined;

  if (forReview) {
    try {
      const r = await sendQuotationEmail({
        number: record.number,
        pdf,
        optionTotals: options.map((q) => q.grandTotal),
        applyGst: quote.applyGst,
        employeeName: session.name,
        employeeEmail: session.email,
      });
      transport = r.transport;
    } catch (err) {
      // Quotation is still recorded. Surface the email issue; the client can
      // still download the PDF from the response.
      console.error("Email send failed", err);
      emailError = "Email could not be sent. Download the PDF below and keep it safe.";
    }
  }

  return NextResponse.json({
    number: record.number,
    createdAt: record.createdAt,
    grandTotal: quote.grandTotal,
    status: record.status,
    transport,
    savedTo,
    emailError,
    // The recipient's only copy. The client offers it as a download.
    pdfBase64: pdf.toString("base64"),
  });
}
