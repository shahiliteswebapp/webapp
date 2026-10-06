import { requireSession } from "@/lib/session";
import { listQuotations } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import {
  historyQueryString,
  parseHistoryParams,
  toStoreFilter,
} from "@/lib/history-query";
import { HistoryFilters } from "@/components/history-filters";
import { PageHeader, EmptyState } from "@/components/ui";
import { HistoryList } from "@/components/history-list";
import { savedQuoteNumbers } from "@/lib/quote-files";
import { canEditQuotation } from "@/lib/types";

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
        <HistoryList rows={rows} saved={[...saved]} isSuperadmin={isSuperadmin} />
      )}
    </div>
  );
}
