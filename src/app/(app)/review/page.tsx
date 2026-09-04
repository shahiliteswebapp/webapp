import { requireManager } from "@/lib/session";
import { listQuotations } from "@/lib/store";
import { fmtDateTime, money } from "@/lib/format";
import { PageHeader, EmptyState, Eyebrow, StatusBadge } from "@/components/ui";
import { ReviewList } from "@/components/review-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue — Shahi Lites" };

export default async function ReviewPage() {
  await requireManager();

  const all = await listQuotations({});
  const pending = all.filter((q) => q.status === "submitted_for_review");
  const recent = all
    .filter((q) => q.status !== "submitted_for_review")
    .sort((a, b) => (a.reviewedAt ?? "") < (b.reviewedAt ?? "") ? 1 : -1)
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Manager" title="Review queue" />

      <p className="text-sm text-muted">
        The quotation PDF (sent to your Gmail) is the document under review.
        Quotation contents aren&rsquo;t stored here — decide by number.
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
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-panel text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Number</th>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Decision</th>
                  <th className="px-4 py-3 font-semibold">Decided</th>
                  <th className="px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {recent.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-3 font-medium text-ink">
                      {q.number}
                    </td>
                    <td className="px-4 py-3 text-muted">{q.employeeName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {q.reviewedAt ? fmtDateTime(q.reviewedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {q.reviewNote || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
