"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardSteps } from "@/components/wizard-steps";
import { Button, ButtonLink, Card, Eyebrow } from "@/components/ui";
import { COMPANY, EMAIL, QUOTE, disclaimer } from "@/lib/config";
import { useDraft } from "@/lib/draft/context";
import { downscaleDataUrl } from "@/lib/draft/render";
import { money } from "@/lib/format";
import { computeQuote } from "@/lib/quote";
import { cx } from "@/lib/cx";
import { draftStarted } from "@/lib/types";

type Action = "review" | "download";

export default function SendPage() {
  const router = useRouter();
  const { loaded, draft, discard, setApplyGst } = useDraft();
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

  const quote = computeQuote(draft.rooms, {
    applyGst: draft.applyGst,
    discount: draft.discount,
  });
  const canSend = quote.grandTotal > 0;

  const submit = async (action: Action) => {
    setBusy(action);
    setError(null);
    try {
      const thumb = draft.blueprint
        ? await downscaleDataUrl(draft.blueprint.previewDataUrl, 1000)
        : undefined;
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rooms: draft.rooms,
          blueprintPreviewDataUrl: thumb,
          blueprintName: draft.blueprint?.name,
          applyGst: quote.applyGst,
          discount: draft.discount,
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
        saved: data.savedTo ?? "",
      });
      if (!quote.applyGst) q.set("gst", "0");
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
        <div className="mt-4">
          <WizardSteps current={4} />
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-5">
        <Card className="space-y-4">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Quotation</Eyebrow>
            <span className="text-xs text-faint">
              Number assigned when you continue
            </span>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Rooms</dt>
              <dd className="text-ink">{draft.rooms.length}</dd>
            </div>
            {quote.totalSavings > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Discounts (lines, rooms, quotation)</dt>
                <dd className="tabular-nums text-ink">−{money(quote.totalSavings)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums text-ink">{money(quote.subtotal)}</dd>
            </div>
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
                  {quote.applyGst ? money(quote.gstAmount) : "Not included"}
                </dd>
              </div>
            <div className="flex justify-between border-t border-hairline pt-2">
              <dt className="font-display text-xl text-ink-deep">Grand total</dt>
              <dd className="font-display text-xl tabular-nums text-ink-deep">
                {money(quote.grandTotal)}
              </dd>
            </div>
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
              Either way, this draft (any blueprint and the line items) is cleared
              from this device. It is never stored on a server.
            </li>
          </ul>
        </Card>

        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-ink-deep">
          {disclaimer(quote.applyGst)}
        </p>

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
