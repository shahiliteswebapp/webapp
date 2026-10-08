import { requireSuperadmin } from "@/lib/session";
import { loadCatalogChanges, r2Configured } from "@/lib/catalog-store";
import { PageHeader } from "@/components/ui";
import { CatalogUploader } from "@/components/catalog-uploader";
import { CatalogManager } from "@/components/catalog-manager";
import { CatalogQuickAdd } from "@/components/catalog-quick-add";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalogue · Shahi Lites" };

export default async function CatalogAdminPage() {
  await requireSuperadmin();
  const { items, removed, edits, popular } = await loadCatalogChanges({ fresh: true });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Superadmin" title="Catalogue" />
      {!r2Configured() && (
        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-ink-deep">
          Photo storage (Cloudflare R2) is not connected on this server, so uploads are saved
          on this computer only. Add the R2_* keys to the environment to store them online.
        </p>
      )}
      <CatalogQuickAdd />
      <details className="group rounded-[var(--radius-card)] border border-hairline">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
          <span>
            <span className="font-medium text-ink">Bulk upload from Excel</span>
            <span className="block text-xs text-muted">
              For many products at once, plus the list of uploaded products.
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-gold-deep group-open:hidden">Open</span>
          <span className="hidden shrink-0 text-xs font-medium text-gold-deep group-open:inline">Close</span>
        </summary>
        <div className="border-t border-hairline p-4">
          <CatalogUploader existing={items} />
        </div>
      </details>
      <CatalogManager changes={{ items, removed, edits, popular }} />
    </div>
  );
}
