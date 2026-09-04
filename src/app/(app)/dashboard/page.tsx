import { requireSession } from "@/lib/session";
import { listQuotations } from "@/lib/store";
import { fmtDateTime, money } from "@/lib/format";
import {
  ButtonLink,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Shahi Lites" };

export default async function DashboardPage() {
  const session = await requireSession();
  const mine = await listQuotations({ employeeEmail: session.email });
  const last = mine[0] ?? null;
  const awaiting = mine.filter((q) => q.status === "submitted_for_review");

  const forReview =
    session.role === "manager"
      ? await listQuotations({ status: "submitted_for_review" })
      : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Welcome, ${session.name.split(" ")[0]}`}
        title="Dashboard"
        actions={
          <ButtonLink href="/new" variant="primary">
            Start new quotation
          </ButtonLink>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        {/* Last generated */}
        <Card className="md:col-span-2">
          <Eyebrow>Last generated quotation</Eyebrow>
          {last ? (
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-display text-3xl text-ink-deep">
                  {last.number}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {fmtDateTime(last.createdAt)}
                </div>
                <div className="mt-3">
                  <StatusBadge status={last.status} />
                </div>
              </div>
              <div className="text-right">
                <div className="eyebrow">Grand total</div>
                <div className="font-display text-3xl text-ink-deep">
                  {money(last.totalAmount)}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState
                title="No quotations yet"
                hint="Your most recent quotation will appear here once you send one for review."
                action={
                  <ButtonLink href="/new" variant="secondary">
                    Start your first
                  </ButtonLink>
                }
              />
            </div>
          )}
        </Card>

        {/* Start new */}
        <Card className="flex flex-col justify-between bg-panel">
          <div>
            <Eyebrow>New</Eyebrow>
            <p className="mt-3 font-display text-2xl text-ink-deep">
              Start a new quotation
            </p>
            <p className="mt-1 text-sm text-muted">
              Upload a blueprint, lay out the rooms, cost the lighting.
            </p>
          </div>
          <ButtonLink href="/new" className="mt-5 w-full">
            Start new
          </ButtonLink>
        </Card>
      </div>

      {/* Awaiting approval */}
      <section className="space-y-3">
        <Eyebrow>Sent for approval</Eyebrow>
        {awaiting.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing of yours is currently awaiting a manager&rsquo;s review.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {awaiting.map((q) => (
              <Card key={q.id} className="bg-paper">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl text-ink-deep">
                    {q.number}
                  </span>
                  <StatusBadge status={q.status} />
                </div>
                <div className="mt-2 text-xs text-muted">
                  {fmtDateTime(q.createdAt)}
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
      </section>

      {/* Manager-only review queue */}
      {session.role === "manager" && (
        <section className="space-y-3">
          <Eyebrow>Review queue</Eyebrow>
          <Card className="flex flex-wrap items-center justify-between gap-4 bg-gold-tint/60">
            <div>
              <p className="font-display text-2xl text-ink-deep">
                {forReview.length} quotation{forReview.length === 1 ? "" : "s"}{" "}
                awaiting your review
              </p>
              <p className="mt-1 text-sm text-muted">
                Across all employees.
              </p>
            </div>
            <ButtonLink href="/review" variant="secondary">
              Open review queue
            </ButtonLink>
          </Card>
        </section>
      )}
    </div>
  );
}
