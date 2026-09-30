import { readLocalCatalogImage } from "@/lib/catalog-store";

export const runtime = "nodejs";

const TYPE: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

/** Local mode only (no R2 keys): serves photos uploaded from /admin/catalog. */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const bytes = await readLocalCatalogImage(file);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": TYPE[file.split(".").pop() ?? ""] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
