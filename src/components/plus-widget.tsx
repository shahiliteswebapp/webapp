"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";

const ITEMS = [
  { href: "/new", label: "Start New", desc: "Upload a blueprint" },
  { href: "/history", label: "History", desc: "Past quotations" },
  { href: "/dashboard", label: "Dashboard", desc: "Overview" },
];

const SUPERADMIN_ITEMS = [
  { href: "/review", label: "Review queue", desc: "Approve or reject" },
  { href: "/admin", label: "Access", desc: "Add or remove Gmail IDs" },
];

export function PlusWidget({ isSuperadmin = false }: { isSuperadmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const items = isSuperadmin ? [...ITEMS, ...SUPERADMIN_ITEMS] : ITEMS;

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
    >
      {open && (
        <div className="w-60 overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-paper shadow-lg shadow-black/5">
          <ul className="divide-y divide-hairline">
            {items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="flex flex-col px-4 py-2.5 hover:bg-gold-tint"
                >
                  <span className="text-sm font-medium text-ink">
                    {it.label}
                  </span>
                  <span className="text-xs text-muted">{it.desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "grid h-14 w-14 place-items-center rounded-full border border-gold bg-ink-deep text-paper",
          "shadow-lg shadow-black/10 transition-transform",
          open && "rotate-45",
        )}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
