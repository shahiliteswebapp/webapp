"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardSteps } from "@/components/wizard-steps";
import { Button, ButtonLink, Card, Eyebrow } from "@/components/ui";
import { COMPANY, DISCLAIMER, EMAIL, QUOTE } from "@/lib/config";
import { useDraft } from "@/lib/draft/context";
import { downscaleDataUrl } from "@/lib/draft/render";
import { money } from "@/lib/format";
import { computeQuote } from "@/lib/quote";

export default function SendPage() {
  const router = useRouter();
  const { loaded, draft, discard } = useDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (!draft?.blueprint) router.replace("/new");
    else if (draft.rooms.length === 0) router.replace("/new/rooms");
  }, [loaded, draft, router]);

  if (!loaded || !draft?.blueprint || draft.rooms.length === 0) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const quote = computeQuote(draft.rooms);
  const canSend = quote.grandTotal > 0;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const thumb = await downscaleDataUrl(
        draft.blueprint!.previewDataUrl,
        1000,
      );
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rooms: draft.rooms,
          blueprintPreviewDataUrl: thumb,
          blueprintName: draft.blueprint!.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      await discard();
      const q = new URLSearchParams({
        number: data.number,
        transport: data.transport,
        saved: data.savedTo ?? "",
      });
      if (data.emailError) q.set("emailError", data.emailError);
      router.replace(`/new/sent?${q.toString()}`);
    } catch {
      setError("Network error — the quotation was not sent.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">Send for review</h1>
        <div className="mt-4">
          <WizardSteps current={4} />
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-5">
        <Card className="space-y-4">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Quotation</Eyebrow>
            <span className="text-xs text-faint">
              Number assigned on send
            </span>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Rooms</dt>
              <dd className="text-ink">{draft.rooms.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums text-ink">{money(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">GST @ {quote.gstRatePct}%</dt>
              <dd className="tabular-nums text-ink">{money(quote.gstAmount)}</dd>
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
          <Eyebrow>What happens next</Eyebrow>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>
              A quotation number ({QUOTE.numberPrefix}-YYYY-NNNN) is assigned and
              logged with status <em>submitted for review</em>.
            </li>
            <li>
              The PDF is emailed to{" "}
              <span className="text-ink">{EMAIL.recipientOverride}</span>{" "}
              <span className="text-faint">
                (until the Gmail app password is set, it&rsquo;s saved to{" "}
                <code>output/</code> instead).
              </span>
            </li>
            <li>
              This draft — blueprint and line items — is cleared from this
              device. It is never stored on a server.
            </li>
          </ul>
        </Card>

        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-gold-deep">
          {DISCLAIMER}
        </p>

        {error && (
          <p className="rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <ButtonLink href="/new/summary" variant="ghost">
            Back to summary
          </ButtonLink>
          <Button onClick={send} disabled={busy || !canSend}>
            {busy ? "Generating & sending…" : "Send for review"}
          </Button>
        </div>
        <p className="text-center text-xs text-faint">
          From {COMPANY.legalName} · {EMAIL.senderEmail}
        </p>
      </div>
    </div>
  );
}
