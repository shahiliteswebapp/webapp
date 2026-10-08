import { AppShell } from "@/components/app-shell";
import { CatalogHydrator } from "@/components/catalog-hydrator";
import { loadCatalogChanges } from "@/lib/catalog-store";
import { requireSession } from "@/lib/session";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, changes] = await Promise.all([requireSession(), loadCatalogChanges()]);
  return (
    <AppShell session={session}>
      <CatalogHydrator
        changes={{
          items: changes.items,
          removed: changes.removed,
          edits: changes.edits,
          popular: changes.popular,
        }}
      >{children}</CatalogHydrator>
    </AppShell>
  );
}
