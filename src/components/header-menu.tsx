"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { cx } from "@/lib/cx";
import { MENU_ITEMS, SUPERADMIN_MENU_ITEMS } from "./plus-widget";
import { SHOW_INSTALL_EVENT } from "./install-app";

/*
 * Phones only: the menu sits top right in the header (where Sign out is on
 * larger screens), and Sign out lives inside it. Laptops and tablets keep the
 * floating "+" menu.
 */
export function HeaderMenu({
  name,
  role,
  isSuperadmin = false,
}: {
  name: string;
  role: string;
  isSuperadmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const items = isSuperadmin ? [...MENU_ITEMS, ...SUPERADMIN_MENU_ITEMS] : MENU_ITEMS;

  // Close on route change (reset during render, not in an effect).
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "grid h-10 w-10 place-items-center rounded-full border text-ink",
          open ? "border-gold bg-gold-tint" : "border-hairline",
        )}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-paper shadow-lg shadow-black/5">
          <div className="border-b border-hairline px-4 py-2.5">
            <p className="truncate text-sm text-ink">{name}</p>
            <p className="text-xs capitalize text-muted">{role}</p>
          </div>
          <ul className="divide-y divide-hairline">
            {items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cx(
                    "flex flex-col px-4 py-2.5 hover:bg-gold-tint",
                    pathname === it.href && "bg-gold-tint/60",
                  )}
                >
                  <span className="text-sm font-medium text-ink">{it.label}</span>
                  <span className="text-xs text-muted">{it.desc}</span>
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new Event(SHOW_INSTALL_EVENT));
                }}
                className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-gold-tint"
              >
                <span className="text-sm font-medium text-ink">Add to home screen</span>
                <span className="text-xs text-muted">Open it like an app</span>
              </button>
            </li>
            <li>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full px-4 py-3 text-left text-sm font-medium text-muted hover:bg-panel hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
