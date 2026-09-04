import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { computeQuote } from "@/lib/quote";
import { createQuotation } from "@/lib/store";
import { sendQuotationEmail } from "@/lib/email";
import { renderQuotationPdf } from "@/lib/pdf/quotation-pdf";
import type { DraftRoom } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  rooms?: DraftRoom[];
  blueprintPreviewDataUrl?: string;
  blueprintName?: string;
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

  // Recompute totals server-side — never trust client numbers.
  const quote = computeQuote(rooms);
  if (quote.grandTotal <= 0) {
    return NextResponse.json(
      { error: "Add lighting to at least one room before sending." },
      { status: 400 },
    );
  }

  const record = await createQuotation({
    employeeName: session.name,
    employeeEmail: session.email,
    totalAmount: quote.grandTotal,
  });

  let pdf: Buffer;
  try {
    pdf = await renderQuotationPdf({
      number: record.number,
      createdAtISO: record.createdAt,
      employeeName: session.name,
      quote,
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

  const rel = `output/${record.number}.pdf`;
  await fs.mkdir(path.join(process.cwd(), "output"), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), rel), pdf);

  let transport: "smtp" | "stub" = "stub";
  let emailError: string | undefined;
  try {
    const r = await sendQuotationEmail({
      number: record.number,
      pdf,
      grandTotal: quote.grandTotal,
      employeeName: session.name,
    });
    transport = r.transport;
  } catch (err) {
    // Quotation is still recorded and the PDF saved — surface the email issue.
    console.error("Email send failed", err);
    emailError = "Email could not be sent; the PDF was saved locally.";
  }

  return NextResponse.json({
    number: record.number,
    createdAt: record.createdAt,
    grandTotal: quote.grandTotal,
    transport,
    savedTo: rel,
    emailError,
  });
}
