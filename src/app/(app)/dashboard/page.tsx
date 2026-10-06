import { requireSession } from "@/lib/session";
import { listQuotations, rejectionCounts } from "@/lib/store";
import { fmtDateTime, money } from "@/lib/format";
import type { QuotationStatus } from "@/lib/types";
import { cx } from "@/lib/cx";
import {
  ButtonLink,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Shahi Lites" };

export default async function DashboardPage() {
  const session = await requireSession();
  const mine = await listQuotations({ employeeEmail: session.email });
  const last = mine[0] ?? null;
  const awaiting = mine.filter((q) => q.status === "submitted_for_review");

  const isSuperadmin = session.role === "superadmin";
  const [everyone, rejections] = await Promise.all([
    isSuperadmin ? listQuotations({}) : Promise.resolve([]),
    rejectionCounts(),
  ]);
  const forReview = everyone.filter((q) => q.status === "submitted_for_review");

  const count = (status: QuotationStatus) => mine.filter((q) => q.status === status).length;
  const stats = [
    { label: "Quotations made", value: mine.length, tone: "ink" },
    // Every rejection, including quotations since edited and resubmitted.
    { label: "Rejected", value: rejections.get(session.email.toLowerCase()) ?? 0, tone: "rejected" },
    { label: "Approved", value: count("approved"), tone: "ink" },
    { label: "Awaiting review", value: count("submitted_for_review"), tone: "gold" },
  ] as const;

  // Superadmin: the same two numbers for every employee.
  const byEmployee = new Map<string, { name: string; made: number; rejected: number }>();
  for (const q of everyone) {
    const email = q.employeeEmail.toLowerCase();
    const e = byEmployee.get(email) ?? { name: q.employeeName, made: 0, rejected: rejections.get(email) ?? 0 };
    e.made += 1;
    byEmployee.set(email, e);
  }
  const team = [...byEmployee.values()].sort((a, b) => b.made - a.made);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Welcome, ${session.name.split(" ")[0]}`}
        title="Dashboard"
        actions={
          <ButtonLink href="/new" variant="primary">
            Start new quotation
          </ButtonLink>
        }
      />

      <section aria-label="Your quotations" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((st) => (
          <Card key={st.label} className={cx(st.tone === "gold" && "bg-gold-tint/60")}>
            <p className="text-xs text-muted">{st.label}</p>
            <p
              className={cx(
                "mt-1 font-display text-4xl tabular-nums leading-none",
                st.tone === "rejected" && st.value > 0 ? "text-rejected" : "text-ink-deep",
              )}
            >
              {st.value}
            </p>
          </Card>
        ))}
      </section>

      <Card>
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
            {/* Totals are for the superadmin only. */}
            {isSuperadmin ? (
              <div className="sm:text-right">
                <div className="eyebrow">Grand total</div>
                <div className="font-display text-3xl text-ink-deep">
                  {money(last.totalAmount)}
                </div>
              </div>
            ) : last.clientName ? (
              <div className="sm:text-right">
                <div className="eyebrow">Client</div>
                <div className="font-display text-2xl text-ink-deep">{last.clientName}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState
              title="No quotations yet"
              hint="Your most recent quotation will appear here once you generate one."
            />
          </div>
        )}
      </Card>

      <section className="space-y-2.5">
        <Eyebrow>Sent for approval</Eyebrow>
        {awaiting.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing of yours is currently awaiting review.
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
                {isSuperadmin ? (
                  <div className="mt-2 text-sm">
                    Grand total{" "}
                    <span className="font-medium text-ink">
                      {money(q.totalAmount)}
                    </span>
                  </div>
                ) : q.clientName ? (
                  <div className="mt-2 text-sm text-muted">For {q.clientName}</div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      {isSuperadmin && team.length > 0 && (
        <section className="space-y-2.5">
          <Eyebrow>By employee</Eyebrow>
          <ul className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline">
            {team.map((e) => (
              <li key={e.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate text-ink">{e.name}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {e.made} made ·{" "}
                  <span className={e.rejected > 0 ? "text-rejected" : undefined}>
                    {e.rejected} rejected
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isSuperadmin && (
        <section className="space-y-2.5">
          <Eyebrow>Review queue</Eyebrow>
          <Card className="flex flex-wrap items-center justify-between gap-4 bg-gold-tint/60">
            <div>
              <p className="font-display text-2xl text-ink-deep">
                {forReview.length} quotation{forReview.length === 1 ? "" : "s"}{" "}
                awaiting review
              </p>
              <p className="mt-1 text-sm text-muted">Across all employees.</p>
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
