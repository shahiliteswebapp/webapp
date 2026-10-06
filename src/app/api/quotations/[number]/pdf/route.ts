import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getQuotation } from "@/lib/store";
import { readQuotePdf } from "@/lib/quote-files";
import { canEditQuotation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The saved PDF of one quotation. ?download=1 saves it instead of opening it. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { number } = await params;
  const record = await getQuotation(number);
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canEditQuotation(session, record)) {
    return NextResponse.json({ error: "Not your quotation." }, { status: 403 });
  }

  const pdf = await readQuotePdf(record.number);
  if (!pdf) return NextResponse.json({ error: "No saved PDF for this quotation." }, { status: 404 });

  const download = new URL(req.url).searchParams.has("download");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${record.number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
