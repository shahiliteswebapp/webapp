import { requireSuperadmin } from "@/lib/session";
import { listQuotations } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import { PageHeader, EmptyState, Eyebrow, StatusBadge } from "@/components/ui";
import { ReviewList } from "@/components/review-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue · Shahi Lites" };

export default async function ReviewPage() {
  await requireSuperadmin();

  const all = await listQuotations({});
  const pending = all.filter((q) => q.status === "submitted_for_review");
  const recent = all
    .filter((q) => q.status === "approved" || q.status === "rejected")
    .sort((a, b) => ((a.reviewedAt ?? "") < (b.reviewedAt ?? "") ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Superadmin" title="Review queue" />

      <p className="text-sm text-muted">
        Open each quotation&apos;s PDF here (or in your Gmail), then approve
        or reject it. Every quotation stays editable after a decision.
      </p>

      <section className="space-y-3">
        <Eyebrow>Awaiting review ({pending.length})</Eyebrow>
        {pending.length === 0 ? (
          <EmptyState
            title="Nothing awaiting review"
            hint="Submitted quotations from any employee show up here."
          />
        ) : (
          <ReviewList pending={pending} />
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <Eyebrow>Recent decisions</Eyebrow>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((q) => (
              <li
                key={q.id}
                className="space-y-2 rounded-[var(--radius-card)] border border-hairline bg-paper p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{q.number}</p>
                    <p className="truncate text-xs text-muted">
                      {[q.clientName, q.employeeName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <StatusBadge status={q.status} />
                </div>
                <p className="text-xs text-faint">
                  Decided {q.reviewedAt ? fmtDateTime(q.reviewedAt) : "-"}
                  {q.editedFrom ? ` · edited from ${q.editedFrom}` : ""}
                </p>
                {q.reviewNote && (
                  <p className="rounded-md bg-panel/60 px-2.5 py-1.5 text-sm text-ink">{q.reviewNote}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
