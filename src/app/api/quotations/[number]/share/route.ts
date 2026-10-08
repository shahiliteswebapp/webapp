import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getQuotation } from "@/lib/store";
import { sharePath } from "@/lib/share-link";
import { canEditQuotation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A link a teammate can open to edit this quotation (creator or superadmin only). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { number } = await params;
  const record = await getQuotation(number);
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canEditQuotation(session, record)) {
    return NextResponse.json({ error: "You can only share quotations you made." }, { status: 403 });
  }
  return NextResponse.json({ path: sharePath(record.number) });
}
