"use client";

import { cx } from "@/lib/cx";
import { MAX_OPTIONS } from "@/lib/types";

/*
 * "Options 1 | 2 | 3": how many alternative proposals the quotation offers.
 * With more than one, every light can carry a different product per option
 * and rooms + the final quotation are totalled per option.
 */
export function OptionCountControl({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center gap-2 text-xs text-muted", className)}>
      <span>Options</span>
      <span
        role="radiogroup"
        aria-label="Number of quotation options"
        className="flex overflow-hidden rounded-full border border-hairline"
      >
        {Array.from({ length: MAX_OPTIONS }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={cx(
              "h-7 w-8 text-xs font-medium transition-colors",
              n > 1 && "border-l border-hairline",
              value === n ? "bg-gold text-paper" : "bg-paper text-muted hover:bg-panel",
            )}
          >
            {n}
          </button>
        ))}
      </span>
    </div>
  );
}
