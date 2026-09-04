import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/lib/actions/auth";
import type { Session } from "@/lib/session";
import { cx } from "@/lib/cx";
import { Wordmark } from "./brand";
import { PlusWidget } from "./plus-widget";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/new", label: "Start New" },
  { href: "/history", label: "History" },
];

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
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="shrink-0">
              <Wordmark />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-panel hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm text-ink">{session.name}</div>
              <div className="text-xs text-muted capitalize">
                {session.role}
              </div>
            </div>
            <span
              className={cx(
                "grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold uppercase",
                session.role === "manager"
                  ? "border-gold bg-gold-tint text-gold-deep"
                  : "border-hairline bg-panel text-muted",
              )}
              aria-hidden
            >
              {session.name.slice(0, 2)}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full border border-hairline px-3 py-1.5 text-xs text-muted hover:border-gold hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-28 lg:pb-12">
        {children}
      </main>

      <PlusWidget />
    </div>
  );
}
