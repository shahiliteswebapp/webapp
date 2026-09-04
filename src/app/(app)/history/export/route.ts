import { getSession } from "@/lib/session";
import { listQuotations } from "@/lib/store";
import { fmtDate, fmtTime } from "@/lib/format";
import { parseHistoryParams, toStoreFilter } from "@/lib/history-query";
import { toCsv } from "@/lib/csv";
import { STATUS_LABEL } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Not signed in.", { status: 401 });
  }

  const url = new URL(req.url);
  const params = parseHistoryParams({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  const isManager = session.role === "manager";
  const rows = await listQuotations(
    toStoreFilter(params, isManager ? undefined : session.email),
  );

  const csv = toCsv(
    [
      "Quotation Number",
      "Generated Date",
      "Generated Time",
      "Employee",
      "Email",
      "Status",
      "Grand Total (INR)",
    ],
    rows.map((r) => [
      r.number,
      fmtDate(r.createdAt),
      fmtTime(r.createdAt),
      r.employeeName,
      r.employeeEmail,
      STATUS_LABEL[r.status],
      r.totalAmount.toFixed(2),
    ]),
  );

  const label =
    params.from || params.to
      ? `${params.from ?? "start"}_to_${params.to ?? "now"}`
      : "all";
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="shahi-lites-quotations_${label}_${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
