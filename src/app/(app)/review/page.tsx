import { requireManager } from "@/lib/session";
import { listQuotations } from "@/lib/store";
import { fmtDateTime, money } from "@/lib/format";
import { PageHeader, EmptyState, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue — Shahi Lites" };

export default async function ReviewPage() {
  await requireManager();
  const queue = await listQuotations({ status: "submitted_for_review" });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Manager" title="Review queue" />
      <p className="text-sm text-muted">
        Approve / reject actions land in the next build. The quotation PDF (sent
        to your Gmail) is the document under review.
      </p>

      {queue.length === 0 ? (
        <EmptyState
          title="Nothing awaiting review"
          hint="Submitted quotations from any employee show up here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {queue.map((q) => (
            <Card key={q.id}>
              <div className="font-display text-xl text-ink-deep">
                {q.number}
              </div>
              <div className="mt-1 text-xs text-muted">
                {fmtDateTime(q.createdAt)} · {q.employeeName}
              </div>
              <div className="mt-3 text-sm">
                Grand total{" "}
                <span className="font-medium text-ink">
                  {money(q.totalAmount)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
