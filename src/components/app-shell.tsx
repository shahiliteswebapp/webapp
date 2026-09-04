import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/lib/actions/auth";
import type { Session } from "@/lib/session";
import { cx } from "@/lib/cx";
import { Wordmark } from "./brand";
import { PlusWidget } from "./plus-widget";

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

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm leading-tight text-ink">
                {session.name}
              </div>
              <div className="text-xs leading-tight text-muted capitalize">
                {session.role}
              </div>
            </div>
            <span
              className={cx(
                "grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold uppercase",
                session.role === "superadmin"
                  ? "border-gold bg-gold-tint text-ink-deep"
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-28 lg:pb-10">
        {children}
      </main>

      <PlusWidget isSuperadmin={session.role === "superadmin"} />
    </div>
  );
}
