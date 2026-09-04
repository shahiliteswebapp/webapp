import { cx } from "@/lib/cx";

const STEPS = ["Blueprint", "Rooms", "Lighting", "Summary"] as const;

export function WizardSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state =
          n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className={cx(
                  "grid h-5 w-5 place-items-center rounded-full border text-[0.65rem] font-semibold",
                  state === "current" &&
                    "border-gold bg-gold text-paper",
                  state === "done" && "border-gold-deep text-gold-deep",
                  state === "todo" && "border-hairline text-faint",
                )}
              >
                {n}
              </span>
              <span
                className={cx(
                  "uppercase tracking-wider",
                  state === "current"
                    ? "text-ink"
                    : state === "done"
                      ? "text-gold-deep"
                      : "text-faint",
                )}
              >
                {label}
              </span>
            </span>
            {n < STEPS.length && (
              <span className="h-px w-6 bg-hairline" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
