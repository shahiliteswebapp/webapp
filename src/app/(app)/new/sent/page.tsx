"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, ButtonLink, Card, Eyebrow } from "@/components/ui";
import { ShareQuoteButton } from "@/components/share-quote-button";
import { COMPANY, disclaimer } from "@/lib/config";
import { fmtYmd } from "@/lib/format";

function base64ToBlob(b64: string, type = "application/pdf"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function SentInner() {
  const params = useSearchParams();
  const number = params.get("number") ?? "-";
  const transport = params.get("transport");
  const status = params.get("status");
  const saved = params.get("saved");
  const emailError = params.get("emailError");
  const applyGst = params.get("gst") !== "0";
  const from = params.get("from");
  const valid = params.get("valid");
  const forReview = status === "submitted_for_review";

  const [pdf, setPdf] = useState<string | null>(null);
  useEffect(() => {
    try {
      const key = `sl-pdf:${number}`;
      const b64 = sessionStorage.getItem(key);
      if (b64) {
        // One-time read from sessionStorage (an external store), client-only.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPdf(b64);
        sessionStorage.removeItem(key); // one-time
      }
    } catch {
      /* storage blocked */
    }
  }, [number]);

  const download = () => {
    if (!pdf) return;
    const url = URL.createObjectURL(base64ToBlob(pdf));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold bg-gold-tint text-gold-deep">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="eyebrow mt-4">
          {from ? "New quotation number" : forReview ? "Submitted for review" : "Quotation generated"}
        </p>
        <h1 className="mt-1 font-display text-4xl text-ink-deep">{number}</h1>
      </div>

      <Card className="space-y-3 text-sm">
        <Eyebrow>What happened</Eyebrow>
        <ul className="space-y-2 text-muted">
          {forReview ? (
            <li>
              Quotation <span className="text-ink">{number}</span> was
              recorded as <em>submitted for review</em>. The reviewer will
              approve or reject it.
            </li>
          ) : (
            <li>
              Quotation <span className="text-ink">{number}</span> was
              recorded as <em>downloaded</em>. Nobody has been asked to review
              it.
            </li>
          )}
          {forReview &&
            (emailError ? (
              <li className="text-rejected">{emailError}</li>
            ) : transport === "smtp" ? (
              <li>The PDF was emailed to the reviewer, and a copy to you.</li>
            ) : (
              <li>Email is not set up yet. Download the PDF below.</li>
            ))}
          {saved ? (
            <li>
              The PDF and its rooms and lights are saved. Open it from History
              any time to view or edit it.
            </li>
          ) : (
            <li className="text-rejected">
              The quotation could not be saved for editing on this server. Download the PDF below.
            </li>
          )}
        </ul>

        {pdf ? (
          <Button onClick={download} variant="secondary" className="w-full">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download {number}.pdf
          </Button>
        ) : saved ? (
          <a
            href={`/api/quotations/${encodeURIComponent(number)}/pdf?download=1`}
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-hairline bg-paper px-5 text-sm font-medium text-ink hover:border-gold hover:bg-gold-tint"
          >
            Download {number}.pdf
          </a>
        ) : null}

        {saved && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2">
            <p className="text-xs text-muted">
              Hand it to a teammate: they open the link and edit it, rooms and lights filled in.
            </p>
            <ShareQuoteButton number={number} label="Share link" className="shrink-0" />
          </div>
        )}

        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-ink-deep">
          {disclaimer(applyGst, valid && /^\d{4}-\d{2}-\d{2}$/.test(valid) ? fmtYmd(valid) : undefined)}
        </p>
      </Card>

      <div className="flex flex-wrap justify-center gap-2">
        <ButtonLink href="/dashboard" variant="secondary">
          Dashboard
        </ButtonLink>
        <ButtonLink href="/history" variant="secondary">
          History
        </ButtonLink>
        <ButtonLink href="/new">Start another</ButtonLink>
      </div>

      <p className="text-center text-xs text-faint">
        {COMPANY.legalName} · internal use only
      </p>
    </div>
  );
}

export default function SentPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-panel" />
      }
    >
      <SentInner />
    </Suspense>
  );
}
