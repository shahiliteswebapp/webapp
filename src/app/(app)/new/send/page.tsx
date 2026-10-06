"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardSteps } from "@/components/wizard-steps";
import { Button, ButtonLink, Card, Eyebrow } from "@/components/ui";
import { COMPANY, EMAIL, QUOTE, disclaimer } from "@/lib/config";
import { useDraft } from "@/lib/draft/context";
import { downscaleDataUrl } from "@/lib/draft/render";
import {
  MAX_VALIDITY_DAYS,
  addDays,
  daysUntil,
  defaultValidUntil,
  fmtYmd,
  isValidValidUntil,
  money,
  ymd,
} from "@/lib/format";
import { computeOptions, optionLabel } from "@/lib/quote";
import { cx } from "@/lib/cx";
import { draftStarted, type ClientDetails } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-hairline bg-paper px-3 py-2 text-base text-ink outline-none focus:border-gold sm:text-sm";

type Action = "review" | "download";

export default function SendPage() {
  const router = useRouter();
  const { loaded, draft, discard, setApplyGst, setClient, setValidUntil } = useDraft();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (!draftStarted(draft)) router.replace("/new");
    else if (draft.rooms.length === 0) router.replace("/new/rooms");
  }, [loaded, draft, router]);

  if (!loaded || !draftStarted(draft) || draft.rooms.length === 0) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const options = computeOptions(draft);
  const quote = options[0];
  const multi = options.length > 1;
  const client: ClientDetails = draft.client ?? { name: "" };
  const hasClient = client.name.trim().length > 0;
  const canSend = options.every((q) => q.grandTotal > 0) && hasClient;
  const editing = draft.editOf;
  const today = ymd(new Date());
  const maxValid = ymd(addDays(new Date(), MAX_VALIDITY_DAYS));
  // A date saved on an earlier version may have passed: fall back to 60 days.
  const untilYmd = isValidValidUntil(draft.validUntil) ? draft.validUntil : defaultValidUntil();
  const validUntil = fmtYmd(untilYmd);
  const validDays = daysUntil(untilYmd);
  const patchClient = (patch: Partial<ClientDetails>) => setClient({ ...client, ...patch });

  const submit = async (action: Action) => {
    setBusy(action);
    setError(null);
    try {
      const bp = draft.blueprint;
      const thumb = bp ? await downscaleDataUrl(bp.previewDataUrl, 1000) : undefined;
      // A sharper copy is saved with the quotation, for editing it later.
      // JPEG keeps the request well under the hosting's 4.5 MB body limit.
      const keep = bp ? await downscaleDataUrl(bp.previewDataUrl, 1800, "image/jpeg") : undefined;
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rooms: draft.rooms,
          blueprintPreviewDataUrl: thumb,
          blueprintName: draft.blueprint?.name,
          applyGst: quote.applyGst,
          discount: draft.discount,
          optionCount: options.length,
          client,
          validUntil: untilYmd,
          editOf: editing,
          blueprintSaveDataUrl: keep,
          blueprintMeta: bp
            ? { kind: bp.kind, width: bp.width, height: bp.height, pageCount: bp.pageCount }
            : undefined,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setBusy(null);
        return;
      }
      // Hand the PDF to the confirmation page for download (too large for the URL).
      try {
        if (data.pdfBase64) {
          sessionStorage.setItem(`sl-pdf:${data.number}`, data.pdfBase64);
        }
      } catch {
        /* storage blocked, the confirmation page just will not offer a download */
      }
      await discard();
      const q = new URLSearchParams({
        number: data.number,
        transport: data.transport,
        status: data.status ?? "",
      });
      if (data.saved) q.set("saved", "1");
      if (data.edited) q.set("rev", String(data.revision ?? 2));
      if (!quote.applyGst) q.set("gst", "0");
      if (data.validUntil) q.set("valid", data.validUntil);
      if (data.emailError) q.set("emailError", data.emailError);
      router.replace(`/new/sent?${q.toString()}`);
    } catch {
      setError("Network error. The quotation was not generated.");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">Finish up</h1>
        {editing && (
          <p className="mt-1 text-sm text-muted">
            Editing <span className="font-medium text-ink">{editing}</span>. It keeps its number.
          </p>
        )}
        <div className="mt-4">
          <WizardSteps current={4} />
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-5">
        <Card className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>Client details</Eyebrow>
            <span className="text-xs text-faint">Printed on the PDF</span>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-muted">
              Client name <span className="text-gold-deep">*</span>
            </span>
            <input
              value={client.name}
              onChange={(e) => patchClient({ name: e.target.value })}
              placeholder="e.g. Mr. Rajesh Mathur"
              autoComplete="off"
              className={inputClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-muted">Phone</span>
              <input
                type="tel"
                inputMode="tel"
                value={client.phone ?? ""}
                onChange={(e) => patchClient({ phone: e.target.value })}
                placeholder="+91"
                autoComplete="off"
                className={inputClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Email</span>
              <input
                type="email"
                inputMode="email"
                value={client.email ?? ""}
                onChange={(e) => patchClient({ email: e.target.value })}
                autoComplete="off"
                className={inputClass}
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-muted">Site address</span>
            <textarea
              rows={2}
              value={client.address ?? ""}
              onChange={(e) => patchClient({ address: e.target.value })}
              className={cx(inputClass, "resize-none")}
            />
          </label>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Quotation</Eyebrow>
            <span className="text-xs text-faint">
              {editing ? editing : "Number assigned when you continue"}
            </span>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">
                <label htmlFor="valid-until">Valid until</label>
                <span className="block text-xs text-faint">
                  {validDays} day{validDays === 1 ? "" : "s"} from today
                </span>
              </dt>
              <dd className="flex flex-col items-end gap-1">
                <input
                  id="valid-until"
                  type="date"
                  value={untilYmd}
                  min={today}
                  max={maxValid}
                  disabled={busy !== null}
                  onChange={(e) =>
                    setValidUntil(isValidValidUntil(e.target.value) ? e.target.value : undefined)
                  }
                  className="rounded-md border border-hairline bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-gold"
                />
                {draft.validUntil && draft.validUntil !== defaultValidUntil() && (
                  <button
                    type="button"
                    onClick={() => setValidUntil(undefined)}
                    className="text-xs text-gold-deep hover:underline"
                  >
                    Reset to {QUOTE.validityDays} days
                  </button>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Rooms</dt>
              <dd className="text-ink">{draft.rooms.length}</dd>
            </div>
            {multi && (
              <div className="flex justify-between">
                <dt className="text-muted">Options</dt>
                <dd className="text-ink">{options.length}</dd>
              </div>
            )}
            {!multi && quote.totalSavings > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Discounts (lines, rooms, quotation)</dt>
                <dd className="tabular-nums text-ink">−{money(quote.totalSavings)}</dd>
              </div>
            )}
            {!multi && (
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums text-ink">{money(quote.subtotal)}</dd>
              </div>
            )}
              <div className="flex items-center justify-between gap-3">
                <dt>
                  <label className="flex cursor-pointer items-center gap-2 text-muted">
                    <input
                      type="checkbox"
                      checked={quote.applyGst}
                      onChange={(e) => setApplyGst(e.target.checked)}
                      disabled={busy !== null}
                      className="h-4 w-4 accent-[var(--color-gold)]"
                    />
                    Charge GST @ {quote.gstRatePct}%
                  </label>
                </dt>
                <dd className={cx("tabular-nums", quote.applyGst ? "text-ink" : "text-faint")}>
                  {quote.applyGst ? (multi ? "Added to each option" : money(quote.gstAmount)) : "Not included"}
                </dd>
              </div>
            {options.map((q, k) => (
              <div
                key={k}
                className={cx("flex justify-between", k === 0 && "border-t border-hairline pt-2")}
              >
                <dt className="font-display text-xl text-ink-deep">
                  {multi ? `${optionLabel(k)} total` : "Grand total"}
                </dt>
                <dd className="font-display text-xl tabular-nums text-ink-deep">
                  {money(q.grandTotal)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="space-y-2 bg-panel">
          <Eyebrow>Two ways to finish</Eyebrow>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>
              <span className="text-ink">Send for review</span>: a quotation
              number ({QUOTE.numberPrefix}-YYYY-NNNN) is logged, and the PDF is
              emailed to the reviewer for approval.
            </li>
            <li>
              <span className="text-ink">Download only</span>: a number is
              still logged, but the PDF comes straight to you and nobody is
              asked to review it.
            </li>
            <li>
              Either way, the PDF and its rooms and lights are saved. Open it
              from History to view or edit it later.
            </li>
          </ul>
        </Card>

        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-ink-deep">
          {disclaimer(quote.applyGst, validUntil)}
        </p>

        {!hasClient && (
          <p className="text-center text-xs text-gold-deep">Enter the client&apos;s name to continue.</p>
        )}
        {hasClient && !canSend && (
          <p className="text-center text-xs text-faint">
            {multi
              ? "Every option needs at least one priced light before it can be generated."
              : "Add a priced light to at least one room first."}
          </p>
        )}

        {error && (
          <p className="rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <ButtonLink href="/new/summary" variant="ghost">
            Back to summary
          </ButtonLink>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => submit("download")}
              disabled={busy !== null || !canSend}
            >
              {busy === "download" ? "Generating…" : "Download only"}
            </Button>
            <Button
              onClick={() => submit("review")}
              disabled={busy !== null || !canSend}
            >
              {busy === "review" ? "Generating & sending…" : "Send for review"}
            </Button>
          </div>
        </div>
        <p className="text-center text-xs text-faint">
          From {COMPANY.legalName} · {EMAIL.senderEmail}
        </p>
      </div>
    </div>
  );
}
