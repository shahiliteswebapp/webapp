"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import { Button, Eyebrow } from "@/components/ui";
import { catalogImageUrl, type LightingSystem } from "@/lib/catalog";
import { matchPhotos, parseCatalogWorkbook, type ParseResult } from "@/lib/catalog-upload";
import { money } from "@/lib/format";
import { cx } from "@/lib/cx";

const MAX_PHOTOS = 1000;
const PHOTO_MAX_PX = 1200;
const CONCURRENCY = 4;

/** Downscale to <= 1200px and re-encode as webp, so uploads stay small. */
async function toWebp(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_PX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
  if (!blob) throw new Error("Could not convert photo");
  // Browsers without webp encoding hand back a PNG; the server accepts both.
  return blob;
}

async function uploadPhoto(file: File): Promise<string> {
  const blob = await toWebp(file);
  const fd = new FormData();
  fd.append("file", blob, file.name);
  const res = await fetch("/api/admin/catalog/image", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.url as string;
}

export function CatalogUploader({ existing }: { existing: LightingSystem[] }) {
  const router = useRouter();
  const excelRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const [excelName, setExcelName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const match = useMemo(
    () => (parsed ? matchPhotos(parsed.rows, photos) : null),
    [parsed, photos],
  );

  const onExcel = async (file: File) => {
    setError(null);
    setDone(null);
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Choose an Excel file (.xlsx). In Google Sheets: File > Download > Microsoft Excel.");
      return;
    }
    try {
      const sheets = await readXlsxFile(file);
      setExcelName(file.name);
      setParsed(parseCatalogWorkbook(sheets, file.name));
    } catch (e) {
      console.error(e);
      setError("Could not read that Excel file.");
    }
  };

  const onPhotos = (list: FileList) => {
    setError(null);
    setDone(null);
    const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name));
    if (files.length > MAX_PHOTOS) {
      setError(`Up to ${MAX_PHOTOS} photos at a time. You chose ${files.length}.`);
      return;
    }
    setPhotos(files);
  };

  const save = async () => {
    if (!parsed || !match) return;
    setBusy(true);
    setError(null);
    setDone(null);

    // Upload each distinct photo once.
    const needed = [...new Set(match.byRow.flat())];
    const urls = new Map<File, string>();
    const failed: string[] = [];
    setProgress({ done: 0, total: needed.length });
    let next = 0;
    let count = 0;
    const worker = async () => {
      while (next < needed.length) {
        const f = needed[next++];
        try {
          urls.set(f, await uploadPhoto(f));
        } catch (e) {
          console.error(f.name, e);
          failed.push(f.name);
        }
        setProgress({ done: ++count, total: needed.length });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const items = parsed.rows.map((row, i) => ({
      ...row.item,
      images: match.byRow[i].map((f) => urls.get(f)).filter((u): u is string => !!u),
    }));

    try {
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      setDone(
        `Saved ${data.saved} product${data.saved === 1 ? "" : "s"} with ${urls.size} photo${
          urls.size === 1 ? "" : "s"
        }.` + (failed.length ? ` ${failed.length} photo(s) failed: ${failed.slice(0, 5).join(", ")}.` : ""),
      );
      setParsed(null);
      setPhotos([]);
      setExcelName(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const remove = async (body: { ids: string[] } | { all: true }) => {
    setError(null);
    const res = await fetch("/api/admin/catalog", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not delete.");
      return;
    }
    router.refresh();
  };

  const matchedPhotoCount = match ? new Set(match.byRow.flat()).size : 0;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-1 text-sm text-muted">
          <p>
            Add products from the Excel sheet plus their photos. Tabs named{" "}
            <span className="text-ink">Functional</span> and{" "}
            <span className="text-ink">Decorative</span>, header row first, with the same
            columns as the Shahi Lites sheet (Company Name, Product Type, Watts, Layer, Glare,
            Auto/Non auto, Control, Interface / Decor type, Size, Decor mounting, Style).
          </p>
          <p className="text-xs text-faint">
            Optional columns: Price, Code, Name, Cutout, Finish, Colour, Material, IP, Unit, Image.
            Photos match a row by the Image column, by Code (GCL-110.jpg), or by tab and S. No.
            (F-1.jpg, D-3.jpg; F-1_2.jpg for a second photo). Up to {MAX_PHOTOS} photos at a time.
            Re-uploading the same row updates it.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => excelRef.current?.click()}
            disabled={busy}
            className="rounded-[var(--radius-card)] border-2 border-dashed border-hairline bg-panel/50 p-5 text-left hover:border-gold disabled:opacity-50"
          >
            <Eyebrow>1. Excel sheet</Eyebrow>
            <p className="mt-1 truncate font-display text-xl text-ink-deep">
              {excelName ?? "Choose .xlsx"}
            </p>
            {parsed && (
              <p className="text-xs text-muted">{parsed.rows.length} product rows found</p>
            )}
          </button>
          <button
            type="button"
            onClick={() => photosRef.current?.click()}
            disabled={busy}
            className="rounded-[var(--radius-card)] border-2 border-dashed border-hairline bg-panel/50 p-5 text-left hover:border-gold disabled:opacity-50"
          >
            <Eyebrow>2. Product photos</Eyebrow>
            <p className="mt-1 font-display text-xl text-ink-deep">
              {photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : "Choose images"}
            </p>
            {match && photos.length > 0 && (
              <p className="text-xs text-muted">
                {matchedPhotoCount} matched · {match.unmatched.length} unmatched
              </p>
            )}
          </button>
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onExcel(f);
              e.target.value = "";
            }}
          />
          <input
            ref={photosRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onPhotos(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {error && (
          <p className="rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
            {error}
          </p>
        )}
        {done && (
          <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-sm text-ink-deep">
            {done}
          </p>
        )}

        {parsed && (
          <div className="space-y-3">
            {parsed.errors.map((e) => (
              <p key={e} className="text-xs text-rejected">
                {e}
              </p>
            ))}
            {parsed.rows.length > 0 && (
              <div className="max-h-[28rem] overflow-auto rounded-[var(--radius-card)] border border-hairline">
                <table className="w-full min-w-[40rem] text-left text-xs">
                  <thead className="sticky top-0 bg-panel text-faint">
                    <tr>
                      <th className="px-3 py-2 font-medium">Tab / row</th>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Details</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-right font-medium">Photos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {parsed.rows.map((row, i) => {
                      const it = row.item;
                      const details =
                        it.kind === "functional"
                          ? [it.watt, it.layer ? `Layer ${it.layer}` : null, it.glare, it.automatic ? "Auto" : "Non auto", it.interfaceOptions.map((o) => o.interface).join(", ")]
                          : [it.decorType, it.size, it.mounting, it.style];
                      const n = match?.byRow[i].length ?? 0;
                      return (
                        <tr key={it.id} className="align-top">
                          <td className="px-3 py-2 text-faint">
                            {row.sheet} {row.rowNumber}
                          </td>
                          <td className="px-3 py-2 text-ink">
                            {it.name}
                            {row.warnings.map((w) => (
                              <span key={w} className="block text-[11px] text-faint">
                                {w}
                              </span>
                            ))}
                          </td>
                          <td className="px-3 py-2 text-muted">{details.filter(Boolean).join(" · ")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.unitCost > 0 ? money(it.unitCost) : "-"}
                          </td>
                          <td className={cx("px-3 py-2 text-right tabular-nums", n ? "text-ink" : "text-faint")}>
                            {n}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {match && match.unmatched.length > 0 && (
              <p className="text-xs text-faint">
                Not matched to any row (will not be uploaded):{" "}
                {match.unmatched.slice(0, 12).map((f) => f.name).join(", ")}
                {match.unmatched.length > 12 ? ` and ${match.unmatched.length - 12} more` : ""}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={busy || parsed.rows.length === 0}>
                {busy
                  ? progress && progress.total > 0
                    ? `Uploading photos ${progress.done}/${progress.total}…`
                    : "Saving…"
                  : `Add ${parsed.rows.length} product${parsed.rows.length === 1 ? "" : "s"}`}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setParsed(null);
                  setExcelName(null);
                  setPhotos([]);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Uploaded products</Eyebrow>
            <p className="text-sm text-muted">
              {existing.length} added from uploads, on top of the built-in catalogue.
            </p>
          </div>
          {existing.length > 0 && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(`Delete all ${existing.length} uploaded products?`)) void remove({ all: true });
              }}
            >
              Delete all uploaded
            </Button>
          )}
        </div>
        {existing.length > 0 && (
          <ul className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline">
            {existing.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-hairline bg-panel/60">
                  {it.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={catalogImageUrl(it.images[0])} alt="" className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{it.name}</p>
                  <p className="truncate text-xs text-faint">
                    {it.kind === "functional" ? "Functional" : "Decorative"} · {(it.images ?? []).length} photo
                    {(it.images ?? []).length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-muted">
                  {it.unitCost > 0 ? money(it.unitCost) : "No price"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete "${it.name}"?`)) void remove({ ids: [it.id] });
                  }}
                  className="shrink-0 rounded-full px-2 py-1 text-xs text-muted hover:bg-rejected/5 hover:text-rejected"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
