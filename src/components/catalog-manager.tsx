"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Eyebrow } from "@/components/ui";
import {
  BUILTIN_SYSTEMS,
  UNIT_LABEL,
  systemImages,
  type LightingSystem,
} from "@/lib/catalog";
import { money } from "@/lib/format";
import { cx } from "@/lib/cx";

/*
 * Superadmin tool to take any product out of the picker, built-in or
 * uploaded. Built-in items are only hidden (and can be restored); uploaded
 * items are deleted. Quotations already in progress still price removed items.
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

export function CatalogManager({
  uploaded,
  removed,
}: {
  uploaded: LightingSystem[];
  removed: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "functional" | "decorative">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const removedSet = useMemo(() => new Set(removed), [removed]);
  const all = useMemo(
    () => [...BUILTIN_SYSTEMS, ...uploaded.map((u) => ({ ...u, uploaded: true }) as LightingSystem)],
    [uploaded],
  );
  const active = all.filter((s) => !removedSet.has(s.id));
  const removedItems = BUILTIN_SYSTEMS.filter((s) => removedSet.has(s.id));

  const q = query.trim().toLowerCase();
  const matches = active.filter(
    (s) => (kind === "all" || s.kind === kind) && (!q || haystack(s).includes(q)),
  );

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
          Remove any product so employees can no longer pick it. Built-in products can be
          restored below; uploaded products are deleted.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, code, brand or type"
          className="min-w-0 flex-1 rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <div className="flex overflow-hidden rounded-md border border-hairline text-xs font-medium">
          {(["all", "functional", "decorative"] as const).map((k) => (
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
          <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <Thumb sys={s} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink">{s.name}</p>
              <p className="truncate text-xs text-faint">
                {s.kind === "functional" ? "Functional" : "Decorative"} · {s.sourceCode}
                {s.uploaded ? " · uploaded" : ""}
              </p>
            </div>
            <span className="hidden shrink-0 tabular-nums text-muted sm:inline">
              {s.unitCost > 0 ? `${money(s.unitCost)}/${UNIT_LABEL[s.unit]}` : "No price"}
            </span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => remove(s)}
              className="shrink-0 rounded-full px-2 py-1 text-xs text-muted hover:bg-rejected/5 hover:text-rejected disabled:opacity-50"
            >
              {busy === s.id ? "Removing…" : "Remove"}
            </button>
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
