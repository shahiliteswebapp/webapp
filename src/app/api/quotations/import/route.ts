import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getQuotation } from "@/lib/store";
import { loadCatalogChanges } from "@/lib/catalog-store";
import { readQuoteDraft } from "@/lib/quote-files";
import { decodeDraftToken } from "@/lib/pdf/draft-token";
import { readQuotationPdf, type TextItem } from "@/lib/pdf-import";
import { canEditQuotation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Turns an uploaded quotation PDF back into an editable draft. The browser
 * reads the PDF (pdf.js) and sends its Keywords plus its text with positions.
 *
 *  1. The PDF is a quotation this person may edit and its saved copy exists:
 *     reopen that (exact, with the blueprint). Saving makes a new
 *     quotation, marked as edited from it.
 *  2. The PDF carries its own encrypted contents: use those.
 *  3. Otherwise read the printed text (older PDFs).
 *
 * A PDF of someone else's quotation (or one not in History) opens as a NEW
 * quotation that starts from its contents.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { keywords?: unknown; pages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const pages = Array.isArray(body.pages)
    ? (body.pages as unknown[]).slice(0, 200).map((p) =>
        Array.isArray(p)
          ? (p as TextItem[])
              .filter((i) => i && typeof i.s === "string" && Number.isFinite(i.x) && Number.isFinite(i.y))
              .slice(0, 5000)
          : [],
      )
    : [];

  await loadCatalogChanges({ fresh: true });

  const token = decodeDraftToken(typeof body.keywords === "string" ? body.keywords : null);
  const parsed = token ? null : readQuotationPdf(pages);
  const number = token?.number ?? parsed?.number;

  const record = number ? await getQuotation(number) : null;
  const editable = !!record && canEditQuotation(session, record);

  if (editable) {
    const saved = await readQuoteDraft(record.number);
    if (saved) {
      return NextResponse.json({
        source: "saved",
        editOf: record.number,
        draft: saved.draft,
        blueprintDataUrl: saved.blueprintDataUrl,
        warnings: [],
      });
    }
  }

  const draft = token
    ? { ...token.draft, warnings: [] as string[] }
    : parsed!;
  if (!token && draft.rooms.length === 0) {
    return NextResponse.json(
      { error: "This does not look like a Shahi Lites quotation PDF. No rooms were found." },
      { status: 422 },
    );
  }

  const notes = [...draft.warnings];
  if (number && record && !editable) {
    notes.unshift(`${number} belongs to someone else, so this opens as a new quotation with its contents.`);
  } else if (number && !record) {
    notes.unshift(`${number} is not in History, so this opens as a new quotation with its contents.`);
  }

  return NextResponse.json({
    source: token ? "embedded" : "text",
    editOf: editable ? record!.number : undefined,
    draft: {
      rooms: draft.rooms,
      applyGst: draft.applyGst,
      discount: draft.discount,
      optionCount: draft.optionCount,
      client: draft.client,
      validUntil: draft.validUntil,
      warranty: draft.warranty,
    },
    warnings: notes,
  });
}
