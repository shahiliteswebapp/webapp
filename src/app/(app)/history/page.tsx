import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listQuotations } from "@/lib/store";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import {
  historyQueryString,
  parseHistoryParams,
  toStoreFilter,
} from "@/lib/history-query";
import { HistoryFilters } from "@/components/history-filters";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { savedQuoteNumbers } from "@/lib/quote-files";
import { canEditQuotation, type QuotationRecord } from "@/lib/types";

function QuoteActions({ q, saved }: { q: QuotationRecord; saved: boolean }) {
  const n = encodeURIComponent(q.number);
  if (!saved) {
    // Made before quotations were saved: no PDF to open, but it can be rebuilt.
    return (
      <Link
        href={`/new/edit/${n}`}
        title="Made before quotations were saved. Rebuild it under the same number."
        className="inline-flex h-8 items-center rounded-full border border-gold px-3 text-xs font-medium text-gold-deep hover:bg-gold-tint"
      >
        Rebuild
      </Link>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <a
        href={`/api/quotations/${n}/pdf`}
        target="_blank"
        rel="noopener"
        className="inline-flex h-8 items-center rounded-full border border-hairline px-3 text-xs font-medium text-ink hover:border-gold hover:bg-gold-tint"
      >
        PDF
      </a>
      <Link
        href={`/new/edit/${n}`}
        className="inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-paper hover:opacity-90"
      >
        Edit
      </Link>
    </span>
  );
}

export const dynamic = "force-dynamic";
export const metadata = { title: "History · Shahi Lites" };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const session = await requireSession();
  const isSuperadmin = session.role === "superadmin";
  const raw = await searchParams;
  const params = parseHistoryParams(raw);

  const [all, saved] = await Promise.all([
    listQuotations(toStoreFilter(params, isSuperadmin ? undefined : session.email)),
    savedQuoteNumbers(),
  ]);
  // Superadmin: every quotation. Employee: only their own (already filtered).
  const rows = all.filter((q) => canEditQuotation(session, q));

  const qs = historyQueryString(params);
  const exportHref = qs ? `/history/export?${qs}` : "/history/export";

  const rangeText =
    params.from || params.to
      ? `${params.from ? fmtDate(params.from) : "start"} – ${
          params.to ? fmtDate(params.to) : "now"
        }`
      : "all time";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="History"
        title="Past quotations"
        actions={
          <a
            href={exportHref}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-paper px-5 text-sm font-medium text-ink hover:border-gold hover:bg-gold-tint"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download CSV
          </a>
        }
      />

      <p className="text-xs text-muted">
        {isSuperadmin ? "All employees, every status." : "Your quotations."} Open the PDF
        or edit any quotation, approved or rejected. Export respects the filters below.
      </p>

      <HistoryFilters />

      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">
          {rows.length} quotation{rows.length === 1 ? "" : "s"}
        </span>
        <span className="text-faint">{rangeText}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing in this range"
          hint="Adjust the filters, or generate a quotation to see it here."
        />
      ) : (
        <>
          {/* Phones: one card per quotation */}
          <ul className="space-y-2 md:hidden">
            {rows.map((q) => (
              <li key={q.id} className="rounded-[var(--radius-card)] border border-hairline p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {q.number}
                      {(q.revision ?? 1) > 1 && (
                        <span className="ml-1.5 text-xs font-normal text-faint">rev {q.revision}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[q.clientName, isSuperadmin ? q.employeeName : null].filter(Boolean).join(" · ") || "-"}
                    </p>
                    <p className="text-xs text-faint">{fmtDateTime(q.updatedAt ?? q.createdAt)}</p>
                  </div>
                  {isSuperadmin && (
                    <span className="shrink-0 text-right text-sm tabular-nums text-ink">
                      {money(q.totalAmount)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <StatusBadge status={q.status} />
                  <QuoteActions q={q} saved={saved.has(q.number)} />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-hairline md:block">
            <table className="w-full text-sm">
              <thead className="bg-panel text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Number</th>
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Generated</th>
                  {isSuperadmin && (
                    <th className="px-4 py-2.5 font-semibold">Employee</th>
                  )}
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  {isSuperadmin && (
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Grand total
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {q.number}
                      {(q.revision ?? 1) > 1 && (
                        <span className="block text-xs font-normal text-faint">rev {q.revision}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{q.clientName || "-"}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {fmtDateTime(q.createdAt)}
                      {q.updatedAt && (
                        <span className="block text-xs text-faint">
                          edited {fmtDateTime(q.updatedAt)}
                        </span>
                      )}
                    </td>
                    {isSuperadmin && (
                      <td className="px-4 py-2.5 text-muted">{q.employeeName}</td>
                    )}
                    <td className="px-4 py-2.5">
                      <StatusBadge status={q.status} />
                    </td>
                    {isSuperadmin && (
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                        {money(q.totalAmount)}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right">
                      <QuoteActions q={q} saved={saved.has(q.number)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
