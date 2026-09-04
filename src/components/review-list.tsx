"use client";

import { useActionState } from "react";
import { decideAction, type DecideState } from "@/lib/actions/review";
import { fmtDateTime, money } from "@/lib/format";
import type { QuotationRecord } from "@/lib/types";
import { cx } from "@/lib/cx";

function ReviewCard({ q }: { q: QuotationRecord }) {
  const [state, action, pending] = useActionState<DecideState, FormData>(
    decideAction,
    {},
  );

  return (
    <form
      action={action}
      className="rounded-[var(--radius-card)] border border-hairline bg-paper p-4"
    >
      <input type="hidden" name="id" value={q.id} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-2xl text-ink-deep">{q.number}</div>
          <div className="mt-1 text-xs text-muted">
            {fmtDateTime(q.createdAt)} · {q.employeeName}
          </div>
        </div>
        <div className="text-right">
          <div className="eyebrow">Grand total</div>
          <div className="font-display text-2xl text-ink-deep">
            {money(q.totalAmount)}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-faint">
        Review the PDF in your inbox, then decide here.
      </p>

      <textarea
        name="note"
        rows={2}
        placeholder="Optional note to the employee…"
        className="mt-3 w-full resize-none rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
      />

      {state.error && (
        <p className="mt-2 text-xs text-rejected">{state.error}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          className={cx(
            "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium",
            "bg-approved text-paper hover:opacity-90 disabled:opacity-50",
          )}
        >
          {pending ? "Saving…" : "Approve"}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className={cx(
            "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium",
            "border-rejected/50 text-rejected hover:bg-rejected/5 disabled:opacity-50",
          )}
        >
          Reject
        </button>
      </div>
    </form>
  );
}

export function ReviewList({ pending }: { pending: QuotationRecord[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pending.map((q) => (
        <ReviewCard key={q.id} q={q} />
      ))}
    </div>
  );
}
