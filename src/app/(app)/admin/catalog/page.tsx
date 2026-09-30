import { requireSuperadmin } from "@/lib/session";
import { loadCatalogChanges, r2Configured } from "@/lib/catalog-store";
import { PageHeader } from "@/components/ui";
import { CatalogUploader } from "@/components/catalog-uploader";
import { CatalogManager } from "@/components/catalog-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalogue · Shahi Lites" };

export default async function CatalogAdminPage() {
  await requireSuperadmin();
  const { items, removed } = await loadCatalogChanges({ fresh: true });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Superadmin" title="Catalogue" />
      {!r2Configured() && (
        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-ink-deep">
          Photo storage (Cloudflare R2) is not connected on this server, so uploads are saved
          on this computer only. Add the R2_* keys to the environment to store them online.
        </p>
      )}
      <CatalogUploader existing={items} />
      <CatalogManager uploaded={items} removed={removed} />
    </div>
  );
}
