import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { putCatalogImage } from "@/lib/catalog-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);
// The browser converts each photo to a ~1200px webp first, so real uploads
// are a few hundred KB. Stays under Vercel's 4.5 MB request cap.
const MAX_BYTES = 4 * 1024 * 1024;

/** Store one product photo (multipart field "file"); returns its public URL. */
export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "superadmin") {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!(file instanceof Blob) || !TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only webp, jpeg or png photos." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo too large (4 MB max)." }, { status: 413 });
  }
  try {
    const url = await putCatalogImage(new Uint8Array(await file.arrayBuffer()), file.type);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Photo upload failed", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
