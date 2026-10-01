"use client";

import type { Discount } from "@/lib/types";
import { cx } from "@/lib/cx";

/*
 * Compact "Discount [ 10 ] [% | ₹]" control, used per line, per room and per
 * quotation. An empty or zero value means no discount.
 */
export function DiscountInput({
  value,
  onChange,
  label = "Discount",
  className,
  disabled,
}: {
  value: Discount | undefined;
  onChange: (d: Discount | undefined) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const kind = value?.kind ?? "pct";
  const set = (k: Discount["kind"], raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      // Keep the chosen unit while the box is empty.
      onChange(raw === "" && value ? { kind: k, value: 0 } : undefined);
      return;
    }
    onChange({ kind: k, value: k === "pct" ? Math.min(n, 100) : n });
  };

  return (
    <label className={cx("flex items-center gap-2 text-xs text-muted", className)}>
      {label}
      <span className="flex items-stretch overflow-hidden rounded-md border border-hairline bg-paper focus-within:border-gold">
        <input
          type="number"
          min={0}
          max={kind === "pct" ? 100 : undefined}
          step={kind === "pct" ? 0.5 : 1}
          inputMode="decimal"
          disabled={disabled}
          value={value && value.value > 0 ? value.value : ""}
          placeholder="0"
          onChange={(e) => set(kind, e.target.value)}
          className="w-16 bg-transparent px-2 py-1 text-sm text-ink outline-none"
        />
        {(["pct", "amt"] as const).map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value && value.value > 0 ? { kind: k, value: value.value } : { kind: k, value: 0 })}
            aria-pressed={kind === k}
            className={cx(
              "border-l border-hairline px-2 text-xs font-medium",
              kind === k ? "bg-gold text-paper" : "text-muted hover:bg-panel",
            )}
          >
            {k === "pct" ? "%" : "₹"}
          </button>
        ))}
      </span>
    </label>
  );
}
