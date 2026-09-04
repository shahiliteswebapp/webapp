"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ymd } from "@/lib/format";
import { STATUS_LABEL, type QuotationStatus } from "@/lib/types";
import { cx } from "@/lib/cx";

function rangeFor(preset: string): { from?: string; to?: string } {
  const now = new Date();
  const today = ymd(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: ymd(d), to: today };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: ymd(d), to: today };
    }
    case "month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: ymd(d), to: today };
    }
    default:
      return {};
  }
}

const PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
];

const STATUS_OPTIONS: Array<{ value: "" | QuotationStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "submitted_for_review", label: STATUS_LABEL.submitted_for_review },
  { value: "approved", label: STATUS_LABEL.approved },
  { value: "rejected", label: STATUS_LABEL.rejected },
];

export function HistoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const curFrom = sp.get("from") ?? "";
  const curTo = sp.get("to") ?? "";
  const curStatus = sp.get("status") ?? "";

  const [from, setFrom] = useState(curFrom);
  const [to, setTo] = useState(curTo);

  const push = (next: {
    from?: string;
    to?: string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (next.from) q.set("from", next.from);
    if (next.to) q.set("to", next.to);
    if (next.status) q.set("status", next.status);
    const qs = q.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const activePreset =
    PRESETS.find((p) => {
      const r = rangeFor(p.key);
      return (r.from ?? "") === curFrom && (r.to ?? "") === curTo;
    })?.key ?? (curFrom || curTo ? "custom" : "all");

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-hairline bg-panel/40 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              const r = rangeFor(p.key);
              setFrom(r.from ?? "");
              setTo(r.to ?? "");
              push({ ...r, status: curStatus });
            }}
            className={cx(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              activePreset === p.key
                ? "border-gold bg-gold text-paper"
                : "border-hairline text-muted hover:border-gold hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted">
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-md border border-hairline bg-paper px-2 py-1.5 text-sm outline-none focus:border-gold"
          />
        </label>
        <label className="text-xs text-muted">
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-md border border-hairline bg-paper px-2 py-1.5 text-sm outline-none focus:border-gold"
          />
        </label>
        <label className="text-xs text-muted">
          Status
          <select
            value={curStatus}
            onChange={(e) =>
              push({ from: curFrom, to: curTo, status: e.target.value })
            }
            className="mt-1 block rounded-md border border-hairline bg-paper px-2 py-1.5 text-sm outline-none focus:border-gold"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => push({ from, to, status: curStatus })}
          className="rounded-full bg-ink-deep px-4 py-1.5 text-xs font-medium text-paper hover:bg-ink"
        >
          Apply
        </button>
        {(curFrom || curTo || curStatus) && (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              push({});
            }}
            className="rounded-full px-3 py-1.5 text-xs text-muted hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
