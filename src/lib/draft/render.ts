"use client";

import { UPLOAD } from "@/lib/config";

/* Rendered blueprint preview: one raster image used by the on-screen viewer and
 * (later) embedded in the generated PDF.
 *
 * pdf.js is loaded via dynamic import so its browser-only module never runs
 * during SSR / build. */

const PREVIEW_MAX_PX = 2400; // longest edge of the rendered preview

type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

export interface RenderResult {
  kind: "pdf" | "png";
  previewDataUrl: string;
  width: number;
  height: number;
  pageCount: number;
}

export class BlueprintError extends Error {}

export async function renderBlueprint(file: File): Promise<RenderResult> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isPng =
    file.type === "image/png" || file.name.toLowerCase().endsWith(".png");

  if (!isPdf && !isPng) {
    throw new BlueprintError(`Unsupported file type. Upload ${UPLOAD.acceptedLabel}.`);
  }
  if (file.size > UPLOAD.maxBytes) {
    throw new BlueprintError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 20 MB.`,
    );
  }

  return isPdf ? renderPdf(file) : renderPng(file);
}

async function renderPng(file: File): Promise<RenderResult> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { canvas, width, height } = drawScaled(
      img,
      img.naturalWidth,
      img.naturalHeight,
      PREVIEW_MAX_PX,
    );
    return {
      kind: "png",
      previewDataUrl: canvas.toDataURL("image/png"),
      width,
      height,
      pageCount: 1,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderPdf(file: File): Promise<RenderResult> {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buf });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch {
    throw new BlueprintError(
      "Could not read that PDF. It may be corrupt or password-protected.",
    );
  }
  try {
    const pageCount = doc.numPages;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(
      PREVIEW_MAX_PX / Math.max(base.width, base.height),
      4,
    );
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    // pdf.js v6: pass the canvas element (not a context); default background
    // is opaque white, so transparent PDFs don't come out black.
    await page.render({ canvas, viewport, background: "#ffffff" }).promise;

    return {
      kind: "pdf",
      previewDataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      pageCount,
    };
  } finally {
    void loadingTask.destroy();
  }
}

/** Re-encode a data URL at a smaller size (for the PDF thumbnail payload). */
export async function downscaleDataUrl(
  dataUrl: string,
  maxPx: number,
  type: "image/png" | "image/jpeg" = "image/png",
): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const { canvas } = drawScaled(
      img,
      img.naturalWidth,
      img.naturalHeight,
      maxPx,
    );
    return type === "image/jpeg" ? canvas.toDataURL(type, 0.85) : canvas.toDataURL(type);
  } catch {
    return dataUrl; // fall back to the original on any failure
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new BlueprintError("Could not read that PNG."));
    img.src = src;
  });
}

function drawScaled(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxPx: number,
) {
  const scale = Math.min(maxPx / Math.max(srcW, srcH), 1);
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new BlueprintError("Canvas is unavailable in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, width, height };
}

/** What a quotation PDF holds, for re-opening it (see /api/quotations/import). */
export interface PdfText {
  keywords: string | null;
  /** every page's text pieces, with x and distance from the page top */
  pages: { s: string; x: number; y: number }[][];
}

export async function readPdfText(file: File): Promise<PdfText> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new BlueprintError("Choose a quotation PDF.");
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch {
    throw new BlueprintError("Could not read that PDF. It may be corrupt or password-protected.");
  }
  try {
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as { Keywords?: unknown };
    const pages: PdfText["pages"] = [];
    for (let n = 1; n <= Math.min(doc.numPages, 200); n++) {
      const page = await doc.getPage(n);
      const { height } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfText["pages"][number] = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        items.push({ s: it.str, x: it.transform[4], y: height - it.transform[5] });
      }
      pages.push(items);
    }
    return { keywords: typeof info.Keywords === "string" ? info.Keywords : null, pages };
  } finally {
    void loadingTask.destroy();
  }
}
