"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button, Eyebrow } from "@/components/ui";
import { CatalogQuickAdd, type QuickAddMode } from "@/components/catalog-quick-add";
import {
  UNIT_LABEL,
  mergeCatalog,
  systemImages,
  type CatalogDelta,
  type LightingSystem,
} from "@/lib/catalog";
import { money } from "@/lib/format";
import { cx } from "@/lib/cx";

/*
 * Superadmin tool for every product, built-in or uploaded: edit it, duplicate
 * it (a quick start for a variant), mark it popular (listed first, with a
 * badge, in the picker), or take it out of the picker. Built-in items are
 * only hidden (and can be restored); uploaded items are deleted. Quotations
 * already in progress still price removed items.
 */

const MAX_SHOWN = 60;

function haystack(s: LightingSystem): string {
  return [
    s.name,
    s.sourceCode,
    s.company,
    s.kind === "functional" ? s.category : s.decorType,
    s.kind === "decorative" ? s.sku : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function Thumb({ sys }: { sys: LightingSystem }) {
  const src = systemImages(sys)[0];
  const [failed, setFailed] = useState(false);
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-hairline bg-panel/60">
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

function StarIcon({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CatalogManager({ changes }: { changes: Required<CatalogDelta> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "functional" | "decorative" | "popular">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The product open in the edit / duplicate form.
  const [open, setOpen] = useState<{ sys: LightingSystem; mode: QuickAddMode } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const removedSet = useMemo(() => new Set(changes.removed), [changes.removed]);
  const all = useMemo(() => mergeCatalog(changes), [changes]);
  const active = all.filter((s) => !removedSet.has(s.id));
  const removedItems = all.filter((s) => !s.uploaded && removedSet.has(s.id));

  const q = query.trim().toLowerCase();
  const matches = active
    .filter(
      (s) =>
        (kind === "all" || (kind === "popular" ? s.popular : s.kind === kind)) &&
        (!q || haystack(s).includes(q)),
    )
    // Popular products first; the rest keep catalogue order.
    .sort((a, b) => Number(!!b.popular) - Number(!!a.popular));

  const openForm = (sys: LightingSystem, mode: QuickAddMode) => {
    setNotice(null);
    setOpen({ sys, mode });
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const call = async (id: string, method: "PATCH" | "DELETE", body: object) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalog", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = (s: LightingSystem) => {
    if (!confirm(`Remove "${s.name}" from the catalogue?`)) return;
    if (s.uploaded) void call(s.id, "DELETE", { ids: [s.id] });
    else void call(s.id, "PATCH", { remove: [s.id] });
  };

  return (
    <section className="space-y-4 border-t border-hairline pt-6">
      <div>
        <Eyebrow>All products</Eyebrow>
        <p className="text-sm text-muted">
          Edit or duplicate any product, or mark the common choices as popular (star) so
          employees see them first. Remove a product so it can no longer be picked: built-in
          products can be restored below; uploaded products are deleted.
        </p>
      </div>

      {open && (
        <div
          ref={formRef}
          className="scroll-mt-20 rounded-[var(--radius-card)] border border-gold/50 bg-gold-tint/20 p-4"
        >
          <CatalogQuickAdd
            key={`${open.mode}-${open.sys.id}`}
            initial={open.sys}
            mode={open.mode}
            onCancel={() => setOpen(null)}
            onDone={(message) => {
              setOpen(null);
              setNotice(message);
            }}
          />
        </div>
      )}
      {notice && (
        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-sm text-ink-deep">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, code, brand or type"
          className="min-w-0 flex-1 rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <div className="flex overflow-hidden rounded-md border border-hairline text-xs font-medium">
          {(["all", "functional", "decorative", "popular"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cx(
                "px-3 py-2 capitalize",
                kind === k ? "bg-gold text-paper" : "bg-paper text-muted hover:bg-panel",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
          {error}
        </p>
      )}

      <p className="text-xs text-faint">
        {matches.length} product{matches.length === 1 ? "" : "s"}
        {matches.length > MAX_SHOWN ? `, showing the first ${MAX_SHOWN}. Search to narrow down.` : ""}
      </p>

      <ul className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline">
        {matches.slice(0, MAX_SHOWN).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <button
              type="button"
              disabled={busy !== null}
              aria-pressed={!!s.popular}
              aria-label={s.popular ? `Unmark ${s.name} as popular` : `Mark ${s.name} as popular`}
              title={s.popular ? "Popular. Click to unmark." : "Mark as popular"}
              onClick={() =>
                void call(s.id, "PATCH", s.popular ? { unpopular: [s.id] } : { popular: [s.id] })
              }
              className={cx(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full disabled:opacity-50",
                s.popular ? "text-gold hover:bg-gold-tint" : "text-faint hover:bg-panel hover:text-gold",
              )}
            >
              <StarIcon on={!!s.popular} />
            </button>
            <Thumb sys={s} />
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-ink">{s.name}</p>
              <p className="truncate text-xs text-faint">
                {s.kind === "functional" ? "Functional" : "Decorative"} · {s.sourceCode}
                {s.uploaded ? ` · added${s.addedBy ? ` by ${s.addedBy}` : ""}` : ""}
                {s.edited ? " · edited" : ""}
              </p>
            </div>
            <span className="hidden shrink-0 tabular-nums text-muted sm:inline">
              {s.unitCost > 0 ? `${money(s.unitCost)}/${UNIT_LABEL[s.unit]}` : "No price"}
            </span>
            <span className="ml-auto flex shrink-0 items-center">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => openForm(s, "edit")}
                className="rounded-full px-2 py-1 text-xs font-medium text-gold-deep hover:bg-gold-tint disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => openForm(s, "duplicate")}
                className="rounded-full px-2 py-1 text-xs text-muted hover:bg-panel hover:text-ink disabled:opacity-50"
              >
                Duplicate
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => remove(s)}
                className="rounded-full px-2 py-1 text-xs text-muted hover:bg-rejected/5 hover:text-rejected disabled:opacity-50"
              >
                {busy === s.id ? "Working…" : "Remove"}
              </button>
            </span>
          </li>
        ))}
        {matches.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-faint">No products match.</li>
        )}
      </ul>

      {removedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <Eyebrow>Removed ({removedItems.length})</Eyebrow>
            <Button
              variant="ghost"
              disabled={busy !== null}
              onClick={() => void call("all", "PATCH", { restore: removedItems.map((s) => s.id) })}
            >
              Restore all
            </Button>
          </div>
          <ul className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline bg-panel/40">
            {removedItems.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Thumb sys={s} />
                <p className="min-w-0 flex-1 truncate text-muted">{s.name}</p>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void call(s.id, "PATCH", { restore: [s.id] })}
                  className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-gold hover:underline disabled:opacity-50"
                >
                  {busy === s.id ? "Restoring…" : "Restore"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
