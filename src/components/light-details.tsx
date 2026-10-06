"use client";

import { useState } from "react";
import {
  LAYER_LABEL,
  UNIT_LABEL,
  systemImages,
  type LightingSystem,
} from "@/lib/catalog";
import { money } from "@/lib/format";
import { cx } from "@/lib/cx";

/*
 * Photo + size/spec card for one catalogue system. Used in the right-hand
 * column of the per-room lighting step.
 */

function specRows(sys: LightingSystem): [string, string][] {
  const rows: [string, string | null | undefined][] =
    sys.kind === "functional"
      ? [
          ["Code", sys.sourceCode],
          ["Size", sys.size],
          ["Cutout", sys.cutout],
          ["Watt", sys.watt],
          ["Finish", sys.finish],
          ["Colour", sys.colour],
          ["LED", sys.ledSource],
          ["IP rating", sys.ipRating],
          ["Brand", sys.company],
          ["Category", sys.category],
          ["Layer", sys.layer ? `${sys.layer}. ${LAYER_LABEL[sys.layer]}` : null],
        ]
      : [
          ["Code", sys.sourceCode],
          ["Size", sys.size],
          ["Lamp", sys.lamp],
          ["Finish", sys.finish],
          ["Material", sys.material],
          ["Type", sys.decorType],
          ["Mounting", sys.mounting],
          ["Style", sys.style],
          ["Brand", sys.company],
          ["SKU", sys.sku],
        ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}

function Photo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <NoPhoto />;
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

function NoPhoto() {
  return (
    <div className="grid h-full w-full place-items-center text-faint">
      <div className="flex flex-col items-center gap-1.5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[11px]">No photo in catalogue</span>
      </div>
    </div>
  );
}

export function LightDetails({
  sys,
  qty,
  unitPrice,
  variant,
  badge,
  active,
  compact,
}: {
  sys: LightingSystem;
  qty?: number;
  unitPrice?: number;
  variant?: string;
  badge?: string;
  active?: boolean;
  /** small side-by-side layout, used inline on phones */
  compact?: boolean;
}) {
  const photos = systemImages(sys);
  const [shown, setShown] = useState(0);
  const current = photos[Math.min(shown, photos.length - 1)];
  const specs = specRows(sys);

  if (compact) {
    return (
      <div className="flex gap-3 rounded-md border border-hairline bg-paper p-2">
        <div className="flex w-40 shrink-0 flex-col gap-1">
          <div className="aspect-square overflow-hidden rounded bg-panel/60">
            {current ? <Photo key={current} src={current} alt={sys.name} /> : <NoPhoto />}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              {photos.map((p, i) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setShown(i)}
                  aria-label={`Photo ${i + 1}`}
                  className={cx(
                    "h-7 w-7 shrink-0 overflow-hidden rounded border bg-panel/60",
                    i === shown ? "border-gold" : "border-hairline",
                  )}
                >
                  <Photo src={p} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        {specs.length > 0 ? (
          <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] content-start gap-x-2 gap-y-0.5 text-[11px]">
            {specs.slice(0, 7).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-faint">{k}</dt>
                <dd className="break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[11px] text-faint">{variant || sys.name}</p>
        )}
      </div>
    );
  }

  return (
    <article
      className={cx(
        "overflow-hidden rounded-[var(--radius-card)] border bg-paper",
        active ? "border-gold shadow-sm" : "border-hairline",
      )}
    >
      <div className="relative aspect-[4/3] bg-panel/60">
        {current ? <Photo key={current} src={current} alt={sys.name} /> : <NoPhoto />}
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-ink-deep/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-paper">
            {badge}
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-hairline p-1.5">
          {photos.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setShown(i)}
              aria-label={`Photo ${i + 1}`}
              className={cx(
                "h-12 w-12 shrink-0 overflow-hidden rounded border bg-panel/60",
                i === shown ? "border-gold" : "border-hairline hover:border-muted",
              )}
            >
              <Photo src={p} alt="" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-lg leading-tight text-ink-deep">{sys.name}</h3>
            {variant && <p className="text-xs text-muted">{variant}</p>}
          </div>
          <div className="shrink-0 text-right text-sm tabular-nums">
            <div className="text-ink">
              {unitPrice && unitPrice > 0 ? money(unitPrice) : "No price"}
            </div>
            <div className="text-[11px] text-faint">per {UNIT_LABEL[sys.unit]}</div>
          </div>
        </div>

        {specs.length > 0 && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-hairline pt-2 text-xs">
            {specs.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-faint">{k}</dt>
                <dd className="break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {sys.kind === "functional" && sys.interfaceOptions.some((o) => o.price != null) && (
          <div className="border-t border-hairline pt-2 text-xs">
            <p className="pb-1 text-faint">Automation options</p>
            <ul className="space-y-0.5">
              {sys.interfaceOptions
                .filter((o) => o.price != null)
                .map((o) => (
                  <li key={`${o.interface}-${o.control}`} className="flex justify-between gap-2">
                    <span className="text-muted">
                      {o.interface} {o.control === "tunable" ? "Dimmable + Tunable" : "Dimmable"}
                    </span>
                    <span className="tabular-nums text-ink">{money(o.price!)}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {qty !== undefined && qty > 0 && unitPrice !== undefined && unitPrice > 0 && (
          <p className="flex justify-between border-t border-hairline pt-2 text-xs">
            <span className="text-faint">
              {qty} {UNIT_LABEL[sys.unit]} in this room
            </span>
            <span className="tabular-nums text-ink">{money(unitPrice * qty)}</span>
          </p>
        )}
      </div>
    </article>
  );
}
