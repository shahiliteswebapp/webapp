import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { computeOptions } from "@/lib/quote";
import { createQuotation, getQuotation, updateQuotation } from "@/lib/store";
import { saveQuoteFiles } from "@/lib/quote-files";
import { defaultValidUntil, isValidValidUntil } from "@/lib/format";
import { sendQuotationEmail } from "@/lib/email";
import { renderQuotationPdf } from "@/lib/pdf/quotation-pdf";
import { productPhotosForPdf } from "@/lib/pdf/product-images";
import { loadCatalogChanges } from "@/lib/catalog-store";
import { canEditQuotation, type ClientDetails, type Discount, type DraftRoom } from "@/lib/types";

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
  /** who the quotation is for (name required) */
  client?: ClientDetails;
  /** last valid day, YYYY-MM-DD (IST); unset = 60 days */
  validUntil?: string;
  /** set when saving an edit of an existing quotation */
  editOf?: string;
  /** larger blueprint preview, saved so the quotation can be reopened */
  blueprintSaveDataUrl?: string;
  blueprintMeta?: { kind: "pdf" | "png"; width: number; height: number; pageCount: number };
  noBlueprint?: boolean;
}

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanClient(c: unknown): ClientDetails | null {
  const o = (c ?? {}) as Record<string, unknown>;
  const name = str(o.name, 120);
  if (!name) return null;
  return {
    name,
    phone: str(o.phone, 40) || undefined,
    email: str(o.email, 120) || undefined,
    address: str(o.address, 300) || undefined,
  };
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
  const client = cleanClient(body.client);
  if (!client) {
    return NextResponse.json({ error: "Enter the client's name first." }, { status: 400 });
  }

  // Editing: the quotation must exist, and this person must be allowed to edit it.
  const existing = body.editOf ? await getQuotation(body.editOf) : null;
  if (body.editOf) {
    if (!existing) {
      return NextResponse.json({ error: "That quotation no longer exists." }, { status: 404 });
    }
    if (!canEditQuotation(session, existing)) {
      return NextResponse.json(
        { error: "You can only edit quotations you made." },
        { status: 403 },
      );
    }
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

  if (body.validUntil !== undefined && body.validUntil !== "" && !isValidValidUntil(body.validUntil)) {
    return NextResponse.json(
      { error: "Pick a valid-until date between today and one year from now." },
      { status: 400 },
    );
  }
  const validUntil = isValidValidUntil(body.validUntil) ? body.validUntil : defaultValidUntil();

  const forReview = body.action !== "download";

  // The ledger keeps one amount: Option 1's grand total.
  const status = forReview ? "submitted_for_review" : "downloaded";
  const record = existing
    ? await updateQuotation(existing.id, {
        totalAmount: quote.grandTotal,
        status,
        clientName: client.name,
        actorEmail: session.email,
      })
    : await createQuotation({
        employeeName: session.name,
        employeeEmail: session.email,
        totalAmount: quote.grandTotal,
        status,
        clientName: client.name,
      });
  if (!record) {
    return NextResponse.json({ error: "Could not save the quotation." }, { status: 500 });
  }

  let pdf: Buffer;
  try {
    const photos = await productPhotosForPdf(
      options.flatMap((q) => q.rooms.flatMap((r) => r.lines.map((l) => l.image ?? ""))),
    );
    pdf = await renderQuotationPdf({
      photos,
      number: record.number,
      createdAtISO: record.updatedAt ?? record.createdAt,
      // An edit keeps the original author's name on the quotation.
      employeeName: record.employeeName,
      client,
      validUntil,
      revision: record.revision,
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

  // Save the PDF and its editable contents, so it can be reopened later.
  let saved = false;
  try {
    const bp = body.blueprintMeta;
    saved = await saveQuoteFiles(record.number, {
      pdf,
      blueprintDataUrl: body.blueprintSaveDataUrl,
      draft: {
        rooms,
        applyGst: quote.applyGst,
        discount,
        optionCount: options.length,
        client,
        validUntil,
        noBlueprint: !body.blueprintSaveDataUrl,
        blueprint:
          body.blueprintSaveDataUrl && bp
            ? {
                name: str(body.blueprintName, 200) || "Blueprint",
                kind: bp.kind === "pdf" ? "pdf" : "png",
                width: Number(bp.width) || 0,
                height: Number(bp.height) || 0,
                pageCount: Number(bp.pageCount) || 1,
              }
            : undefined,
        savedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Could not save the quotation files", err);
  }

  let transport: "smtp" | "stub" = "stub";
  let emailError: string | undefined;

  if (forReview) {
    try {
      const r = await sendQuotationEmail({
        number: record.number,
        pdf,
        edited: !!existing,
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
    saved,
    edited: !!existing,
    revision: record.revision ?? 1,
    validUntil,
    emailError,
    // Offered as a download straight away (the saved copy is also at
    // /api/quotations/<number>/pdf).
    pdfBase64: pdf.toString("base64"),
  });
}
