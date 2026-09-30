import { AppShell } from "@/components/app-shell";
import { CatalogHydrator } from "@/components/catalog-hydrator";
import { loadUploadedCatalog } from "@/lib/catalog-store";
import { requireSession } from "@/lib/session";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, uploaded] = await Promise.all([requireSession(), loadUploadedCatalog()]);
  return (
    <AppShell session={session}>
      <CatalogHydrator items={uploaded}>{children}</CatalogHydrator>
    </AppShell>
  );
}
