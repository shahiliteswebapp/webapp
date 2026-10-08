"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { zipSync } from "fflate";
import { Button, StatusBadge } from "@/components/ui";
import { ShareQuoteButton } from "@/components/share-quote-button";
import { fmtDateTime, money } from "@/lib/format";
import { cx } from "@/lib/cx";
import type { QuotationRecord } from "@/lib/types";

function QuoteActions({ q, saved }: { q: QuotationRecord; saved: boolean }) {
  const n = encodeURIComponent(q.number);
  if (!saved) {
    // Made before quotations were saved: no PDF to open, but it can be rebuilt.
    return (
      <Link
        href={`/new/edit/${n}`}
        title="Made before quotations were saved. Rebuild it as a new quotation."
        className="inline-flex h-8 items-center rounded-full border border-gold px-3 text-xs font-medium text-gold-deep hover:bg-gold-tint"
      >
        Rebuild
      </Link>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <a
        href={`/api/quotations/${n}/pdf`}
        target="_blank"
        rel="noopener"
        className="inline-flex h-8 items-center rounded-full border border-hairline px-3 text-xs font-medium text-ink hover:border-gold hover:bg-gold-tint"
      >
        PDF
      </a>
      <ShareQuoteButton number={q.number} />
      <Link
        href={`/new/edit/${n}`}
        className="inline-flex h-8 items-center rounded-full bg-gold px-3 text-xs font-medium text-paper hover:opacity-90"
      >
        Edit
      </Link>
    </span>
  );
}

function Check({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-5 w-5 shrink-0 accent-[var(--color-gold)] disabled:opacity-30"
    />
  );
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/*
 * The History list. Everyone sees cards (phones) or a table (larger screens).
 * The superadmin can also tick quotations to download their PDFs as one ZIP,
 * or to delete them permanently.
 */
export function HistoryList({
  rows,
  saved: savedList,
  isSuperadmin,
}: {
  rows: QuotationRecord[];
  saved: string[];
  isSuperadmin: boolean;
}) {
  const router = useRouter();
  const saved = useMemo(() => new Set(savedList), [savedList]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"zip" | "delete" | null>(null);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  // Only quotations still on screen count (filters may have changed).
  const selected = rows.filter((r) => picked.has(r.number));
  const selectedWithPdf = selected.filter((r) => saved.has(r.number));
  const allOn = rows.length > 0 && selected.length === rows.length;

  const toggle = (n: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(n);
      else next.delete(n);
      return next;
    });

  const downloadZip = async () => {
    if (selectedWithPdf.length === 0) return;
    setBusy("zip");
    setMessage(null);
    const files: Record<string, Uint8Array> = {};
    const failed: string[] = [];
    let i = 0;
    for (const q of selectedWithPdf) {
      setProgress(`${++i}/${selectedWithPdf.length}`);
      try {
        const res = await fetch(`/api/quotations/${encodeURIComponent(q.number)}/pdf`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        files[`${q.number}.pdf`] = new Uint8Array(await res.arrayBuffer());
      } catch {
        failed.push(q.number);
      }
    }
    const count = Object.keys(files).length;
    if (count > 0) {
      // PDFs are already compressed: store them as they are (level 0).
      const zip = zipSync(files, { level: 0 });
      const stamp = new Date().toISOString().slice(0, 10);
      saveBlob(new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), `shahi-lites-quotations_${stamp}.zip`);
    }
    const skipped = selected.length - selectedWithPdf.length;
    setMessage(
      `Downloaded ${count} PDF${count === 1 ? "" : "s"} as a ZIP.` +
        (skipped ? ` ${skipped} selected had no saved PDF.` : "") +
        (failed.length ? ` Could not fetch: ${failed.join(", ")}.` : ""),
    );
    setBusy(null);
    setProgress("");
  };

  const deleteForever = async () => {
    setBusy("delete");
    setMessage(null);
    try {
      const res = await fetch("/api/quotations/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ numbers: selected.map((q) => q.number), confirm: typed.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Delete failed (${res.status})`);
      setMessage(
        `Permanently deleted ${data.deleted} quotation${data.deleted === 1 ? "" : "s"}.` +
          (data.failed?.length ? ` Could not delete: ${data.failed.join(", ")}.` : ""),
      );
      setPicked(new Set());
      setConfirmOpen(false);
      setTyped("");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {isSuperadmin && (
        <div className="sticky top-14 z-30 -mx-1 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-hairline bg-paper/95 px-3 py-2 backdrop-blur">
          <label className="flex items-center gap-2 text-sm text-muted">
            <Check
              checked={allOn}
              label="Select all"
              onChange={(on) => setPicked(on ? new Set(rows.map((r) => r.number)) : new Set())}
            />
            {selected.length ? `${selected.length} selected` : "Select all"}
          </label>
          <span className="flex-1" />
          <Button
            variant="secondary"
            className="h-9 px-4"
            disabled={busy !== null || selectedWithPdf.length === 0}
            onClick={() => void downloadZip()}
          >
            {busy === "zip" ? `Zipping ${progress}…` : "Download ZIP"}
          </Button>
          <Button
            variant="danger"
            className="h-9 px-4"
            disabled={busy !== null || selected.length === 0}
            onClick={() => {
              setTyped("");
              setConfirmOpen(true);
            }}
          >
            Delete permanently
          </Button>
        </div>
      )}

      {message && (
        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-sm text-ink-deep">{message}</p>
      )}

      {/* Phones: one card per quotation */}
      <ul className="space-y-2 md:hidden">
        {rows.map((q) => (
          <li
            key={q.id}
            className={cx(
              "rounded-[var(--radius-card)] border p-3",
              picked.has(q.number) ? "border-gold bg-gold-tint/40" : "border-hairline",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              {isSuperadmin && (
                <Check
                  checked={picked.has(q.number)}
                  label={`Select ${q.number}`}
                  onChange={(on) => toggle(q.number, on)}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  {q.number}
                  {isSuperadmin && q.editedFrom && (
                    <span className="ml-1.5 text-xs font-normal text-faint">from {q.editedFrom}</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {[q.clientName, isSuperadmin ? q.employeeName : null].filter(Boolean).join(" · ") || "-"}
                </p>
                <p className="text-xs text-faint">{fmtDateTime(q.createdAt)}</p>
              </div>
              {isSuperadmin && (
                <span className="shrink-0 text-right text-sm tabular-nums text-ink">{money(q.totalAmount)}</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <StatusBadge status={q.status} />
              <QuoteActions q={q} saved={saved.has(q.number)} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-hairline md:block">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              {isSuperadmin && <th className="w-10 px-4 py-2.5" />}
              <th className="px-4 py-2.5 font-semibold">Number</th>
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Generated</th>
              {isSuperadmin && <th className="px-4 py-2.5 font-semibold">Employee</th>}
              <th className="px-4 py-2.5 font-semibold">Status</th>
              {isSuperadmin && <th className="px-4 py-2.5 text-right font-semibold">Grand total</th>}
              <th className="px-4 py-2.5 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((q) => (
              <tr key={q.id} className={picked.has(q.number) ? "bg-gold-tint/40" : undefined}>
                {isSuperadmin && (
                  <td className="px-4 py-2.5">
                    <Check
                      checked={picked.has(q.number)}
                      label={`Select ${q.number}`}
                      onChange={(on) => toggle(q.number, on)}
                    />
                  </td>
                )}
                <td className="px-4 py-2.5 font-medium text-ink">
                  {q.number}
                  {isSuperadmin && q.editedFrom && (
                    <span className="block text-xs font-normal text-faint">edited from {q.editedFrom}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted">{q.clientName || "-"}</td>
                <td className="px-4 py-2.5 text-muted">
                  {fmtDateTime(q.createdAt)}
                </td>
                {isSuperadmin && <td className="px-4 py-2.5 text-muted">{q.employeeName}</td>}
                <td className="px-4 py-2.5">
                  <StatusBadge status={q.status} />
                </td>
                {isSuperadmin && (
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink">{money(q.totalAmount)}</td>
                )}
                <td className="px-4 py-2.5 text-right">
                  <QuoteActions q={q} saved={saved.has(q.number)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          className="fixed inset-0 z-[60] grid place-items-center bg-ink-deep/40 p-4"
        >
          <div className="w-full max-w-md space-y-3 rounded-[var(--radius-card)] border border-rejected/40 bg-paper p-5 shadow-xl">
            <h2 id="delete-title" className="font-display text-2xl text-rejected">
              Delete {selected.length} quotation{selected.length === 1 ? "" : "s"} forever?
            </h2>
            <div className="space-y-2 text-sm text-ink">
              <p>
                This <strong>permanently deletes everything</strong> for the selected quotations:
                the PDF, rooms and lights, client details, blueprint, and the History record.
              </p>
              <p className="rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-rejected">
                There is <strong>no backup</strong>. Nothing can be recovered afterwards, not even by
                the developer.
              </p>
              <p className="text-muted">
                If you might need them later, download them as a ZIP first and keep that file safe.
              </p>
              <p className="max-h-20 overflow-y-auto text-xs text-faint">
                {selected.map((q) => q.number).join(", ")}
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy !== null || selectedWithPdf.length === 0}
              onClick={() => void downloadZip()}
            >
              {busy === "zip" ? `Zipping ${progress}…` : "Download ZIP first"}
            </Button>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">
                Type <span className="font-semibold text-rejected">DELETE</span> to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-base outline-none focus:border-rejected"
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" disabled={busy === "delete"} onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={typed.trim() !== "DELETE" || busy !== null}
                onClick={() => void deleteForever()}
              >
                {busy === "delete" ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
