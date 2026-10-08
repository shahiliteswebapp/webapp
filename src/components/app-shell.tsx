import Link from "next/link";
import type { ReactNode } from "react";
import type { Session } from "@/lib/session";
import { Wordmark } from "./brand";
import { HeaderMenu } from "./header-menu";
import { InstallApp } from "./install-app";

/* The same header and menu on phones, tablets and laptops. */
export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/dashboard" className="shrink-0">
            <Wordmark />
          </Link>
          <HeaderMenu
            name={session.name}
            role={session.role}
            isSuperadmin={session.role === "superadmin"}
          />
        </div>
        <InstallApp />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-10">{children}</main>
    </div>
  );
}
