import sharp from "sharp";
import { readLocalCatalogImage } from "@/lib/catalog-store";

/*
 * Product photos for the PDF. Catalogue photos are webp, which @react-pdf
 * cannot draw, so each one is fetched, shrunk and re-encoded as a small JPEG
 * data URI. A photo that fails to load is simply left out of the PDF.
 */

const PX = 240; // ~2x the printed thumbnail size
const TIMEOUT_MS = 8000;
const CONCURRENCY = 6;

async function load(url: string): Promise<Buffer | null> {
  if (url.startsWith("/api/catalog-image/")) {
    return readLocalCatalogImage(url.slice("/api/catalog-image/".length));
  }
  if (!/^https?:\/\//.test(url)) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function toJpegDataUri(url: string): Promise<string | null> {
  try {
    const src = await load(url);
    if (!src) return null;
    const jpg = await sharp(src)
      .resize(PX, PX, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch (err) {
    console.error("PDF photo failed", url, err);
    return null;
  }
}

/** url -> JPEG data URI, for every photo that could be loaded. */
export async function productPhotosForPdf(urls: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(urls.filter(Boolean))];
  const out: Record<string, string> = {};
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const url = unique[next++];
      const data = await toJpegDataUri(url);
      if (data) out[url] = data;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}
