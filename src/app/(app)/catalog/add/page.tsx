import Link from "next/link";
import { requireSession } from "@/lib/session";
import { loadCatalogChanges } from "@/lib/catalog-store";
import { UNIT_LABEL } from "@/lib/catalog";
import { fmtDateTime, money } from "@/lib/format";
import { Eyebrow, PageHeader } from "@/components/ui";
import { CatalogQuickAdd } from "@/components/catalog-quick-add";
import { CatalogUploader } from "@/components/catalog-uploader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a product · Shahi Lites" };

/*
 * Any team member can add new arrivals to the catalogue. Products already in
 * the catalogue cannot be changed or removed here; only the superadmin does
 * that (/admin/catalog).
 */
export default async function AddProductPage() {
  const session = await requireSession();
  const { items } = await loadCatalogChanges({ fresh: true });
  const mine = items
    .filter((i) => i.addedBy?.toLowerCase() === session.email.toLowerCase())
    .sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""))
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Catalogue" title="Add a product" />
      <p className="-mt-3 text-sm text-muted">
        New products can be picked in quotations straight away. To change or remove a product
        already in the catalogue, ask the superadmin.
        {session.role === "superadmin" && (
          <>
            {" "}
            <Link href="/admin/catalog" className="font-medium text-gold-deep hover:underline">
              Open the full catalogue
            </Link>
          </>
        )}
      </p>
      <CatalogQuickAdd />
      <details className="group rounded-[var(--radius-card)] border border-hairline">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
          <span>
            <span className="font-medium text-ink">Bulk upload from Excel</span>
            <span className="block text-xs text-muted">Many new products at once, with photos.</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-gold-deep group-open:hidden">Open</span>
          <span className="hidden shrink-0 text-xs font-medium text-gold-deep group-open:inline">Close</span>
        </summary>
        <div className="border-t border-hairline p-4">
          <CatalogUploader />
        </div>
      </details>

      {mine.length > 0 && (
        <section className="space-y-2 border-t border-hairline pt-6">
          <Eyebrow>Added by you</Eyebrow>
          <ul className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline">
            {mine.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{s.name}</p>
                  <p className="truncate text-xs text-faint">
                    {s.kind === "functional" ? "Functional" : "Decorative"}
                    {s.slSku ? ` · ${s.slSku}` : ""}
                    {s.addedAt ? ` · ${fmtDateTime(s.addedAt)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-muted">
                  {s.unitCost > 0 ? `${money(s.unitCost)}/${UNIT_LABEL[s.unit]}` : "No price"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
