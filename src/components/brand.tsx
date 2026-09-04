import { cx } from "@/lib/cx";

/** Placeholder wordmark. Swap for the real logo (SVG) when provided. */
export function Wordmark({
  className,
  subtitle = true,
}: {
  className?: string;
  subtitle?: boolean;
}) {
  return (
    <span className={cx("inline-flex items-baseline gap-2", className)}>
      <span className="font-display text-xl tracking-[0.28em] text-ink-deep uppercase">
        Shahi&nbsp;Lites
      </span>
      {subtitle && (
        <span className="eyebrow hidden sm:inline" aria-hidden>
          Quotations
        </span>
      )}
    </span>
  );
}

/** Faint diagonal watermark word — mirrors what the PDF pages will carry. */
export function WatermarkField({ text = "SHAHI LITES" }: { text?: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04] select-none"
    >
      <div className="absolute -inset-1/4 flex flex-col justify-around -rotate-[24deg]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap font-display text-6xl tracking-[0.4em] uppercase"
          >
            {`${text}   `.repeat(8)}
          </div>
        ))}
      </div>
    </div>
  );
}
