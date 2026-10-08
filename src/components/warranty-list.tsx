"use client";

import { useState } from "react";
import type { QuotedLight } from "@/lib/quote";
import {
  MAX_LEAD_DAYS,
  MAX_LEAD_WEEKS,
  MAX_WARRANTY_YEARS,
  type LeadTime,
  type LeadTimes,
  type Warranty,
} from "@/lib/types";

/*
 * Warranty in years and delivery lead time for every distinct light in the
 * quotation. The list scrolls inside its own box so the summary page keeps
 * its length. Both are printed beside that light in the PDF.
 */
export function WarrantyList({
  lights,
  warranty,
  onChange,
  leadTime,
  onLeadTimeChange,
}: {
  lights: QuotedLight[];
  warranty?: Warranty;
  onChange: (systemId: string, years: number | undefined) => void;
  leadTime?: LeadTimes;
  onLeadTimeChange: (systemId: string, t: LeadTime | undefined) => void;
}) {
  if (lights.length === 0) return null;
  const inQuote = (id: string) => lights.some((l) => l.systemId === id);
  const setW = Object.keys(warranty ?? {}).filter(inQuote).length;
  const setL = Object.keys(leadTime ?? {}).filter(inQuote).length;

  return (
    <section className="rounded-[var(--radius-card)] border border-hairline">
      <div className="flex items-baseline justify-between gap-3 border-b border-hairline px-4 py-3">
        <div>
          <h2 className="font-display text-xl text-ink-deep">Warranty &amp; lead time</h2>
          <p className="text-xs text-muted">
            Per light, shown beside each light in the PDF. Lead time tells the client when to
            expect delivery.
          </p>
        </div>
        <span className="shrink-0 text-right text-xs text-faint">
          {setW}/{lights.length} warranty
          <span className="block">
            {setL}/{lights.length} lead time
          </span>
        </span>
      </div>
      <ul className="max-h-96 divide-y divide-hairline overflow-y-auto overscroll-contain">
        {lights.map((l) => (
          <li key={l.systemId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-hairline bg-paper">
              {l.image ? <Thumb src={l.image} alt={l.name} /> : null}
            </div>
            <span className="min-w-0 flex-1 basis-40 text-sm text-ink line-clamp-2">{l.name}</span>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted">
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
                  className="w-14 rounded-md border border-hairline bg-paper px-2 py-1.5 text-right text-sm tabular-nums text-ink outline-none focus:border-gold"
                />
                yrs warranty
              </label>
              <LeadTimeInput
                name={l.name}
                value={leadTime?.[l.systemId]}
                onChange={(t) => onLeadTimeChange(l.systemId, t)}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LeadTimeInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value?: LeadTime;
  onChange: (t: LeadTime | undefined) => void;
}) {
  // The unit picked before any number is typed.
  const [unitPick, setUnitPick] = useState<LeadTime["unit"]>("weeks");
  const unit = value?.unit ?? unitPick;
  const max = unit === "days" ? MAX_LEAD_DAYS : MAX_LEAD_WEEKS;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        step={1}
        value={value?.value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : { value: Number(e.target.value), unit })
        }
        placeholder="-"
        aria-label={`Lead time for ${name}`}
        className="w-14 rounded-md border border-hairline bg-paper px-2 py-1.5 text-right text-sm tabular-nums text-ink outline-none focus:border-gold"
      />
      <select
        value={unit}
        aria-label={`Lead time unit for ${name}`}
        onChange={(e) => {
          const u = e.target.value as LeadTime["unit"];
          setUnitPick(u);
          if (value) onChange({ value: value.value, unit: u });
        }}
        className="rounded-md border border-hairline bg-paper px-1.5 py-1.5 text-xs text-ink outline-none focus:border-gold"
      >
        <option value="days">days</option>
        <option value="weeks">weeks</option>
      </select>
      lead time
    </span>
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
