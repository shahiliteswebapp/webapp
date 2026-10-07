"use client";

import { useState } from "react";
import type { QuotedLight } from "@/lib/quote";
import { MAX_WARRANTY_YEARS, type Warranty } from "@/lib/types";

/*
 * Warranty in years for every distinct light in the quotation. The list
 * scrolls inside its own box so the summary page keeps its length. Each value
 * is printed beside that light in the PDF.
 */
export function WarrantyList({
  lights,
  warranty,
  onChange,
}: {
  lights: QuotedLight[];
  warranty?: Warranty;
  onChange: (systemId: string, years: number | undefined) => void;
}) {
  if (lights.length === 0) return null;
  const set = Object.keys(warranty ?? {}).filter((id) =>
    lights.some((l) => l.systemId === id),
  ).length;

  return (
    <section className="rounded-[var(--radius-card)] border border-hairline">
      <div className="flex items-baseline justify-between gap-3 border-b border-hairline px-4 py-3">
        <div>
          <h2 className="font-display text-xl text-ink-deep">Warranty</h2>
          <p className="text-xs text-muted">Years per light, shown beside each light in the PDF.</p>
        </div>
        <span className="shrink-0 text-xs text-faint">
          {set}/{lights.length} set
        </span>
      </div>
      <ul className="max-h-80 divide-y divide-hairline overflow-y-auto overscroll-contain">
        {lights.map((l) => (
          <li key={l.systemId} className="flex items-center gap-3 px-4 py-2.5">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-hairline bg-paper">
              {l.image ? <Thumb src={l.image} alt={l.name} /> : null}
            </div>
            <span className="min-w-0 flex-1 text-sm text-ink line-clamp-2">{l.name}</span>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_WARRANTY_YEARS}
                step={1}
                value={warranty?.[l.systemId] ?? ""}
                onChange={(e) =>
                  onChange(l.systemId, e.target.value === "" ? undefined : Number(e.target.value))
                }
                placeholder="-"
                aria-label={`Warranty in years for ${l.name}`}
                className="w-16 rounded-md border border-hairline bg-paper px-2 py-1.5 text-right text-sm tabular-nums text-ink outline-none focus:border-gold"
              />
              years
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Plain <img>: photos come from the R2 bucket, no Next image optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-full w-full object-contain"
    />
  );
}
