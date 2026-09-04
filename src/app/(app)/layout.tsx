import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return <AppShell session={session}>{children}</AppShell>;
}
