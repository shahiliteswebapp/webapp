import { requireSession } from "@/lib/session";
import { listQuotations } from "@/lib/store";
import { fmtDateTime, money } from "@/lib/format";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "History — Shahi Lites" };

export default async function HistoryPage() {
  const session = await requireSession();
  // Employees see their own; managers see everyone's.
  const rows = await listQuotations(
    session.role === "manager" ? {} : { employeeEmail: session.email },
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="History"
        title="Past quotations"
      />

      <p className="text-sm text-muted">
        CSV export and date-range filtering land in the next build. Read-only.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="No quotations recorded yet"
          hint="Quotations you send for review will be listed here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Number</th>
                <th className="px-4 py-3 font-semibold">Generated</th>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Grand total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((q) => (
                <tr key={q.id}>
                  <td className="px-4 py-3 font-medium text-ink">{q.number}</td>
                  <td className="px-4 py-3 text-muted">
                    {fmtDateTime(q.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-muted">{q.employeeName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    {money(q.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
