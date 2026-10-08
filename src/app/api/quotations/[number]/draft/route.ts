import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getQuotation } from "@/lib/store";
import { readQuoteDraft } from "@/lib/quote-files";
import { isValidShareKey } from "@/lib/share-link";
import { canEditQuotation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The saved, editable contents of one quotation (to reopen it in the wizard). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { number } = await params;
  const record = await getQuotation(number);
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // A share link (?share=<key>) lets any signed-in teammate open it.
  const shared = isValidShareKey(record.number, new URL(req.url).searchParams.get("share"));
  if (!shared && !canEditQuotation(session, record)) {
    return NextResponse.json({ error: "You can only edit quotations you made." }, { status: 403 });
  }

  const saved = await readQuoteDraft(record.number);
  if (!saved) {
    // Made before quotations were saved: its rooms and lights were never
    // stored. The editor can rebuild it as a new quotation.
    return NextResponse.json(
      {
        notSaved: true,
        number: record.number,
        clientName: record.clientName,
        error: "This quotation was made before quotations were saved.",
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ number: record.number, ...saved });
}
