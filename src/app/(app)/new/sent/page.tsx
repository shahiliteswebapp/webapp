"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { COMPANY, DISCLAIMER } from "@/lib/config";

function SentInner() {
  const params = useSearchParams();
  const number = params.get("number") ?? "—";
  const transport = params.get("transport");
  const saved = params.get("saved");
  const emailError = params.get("emailError");

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
        <p className="eyebrow mt-4">Submitted for review</p>
        <h1 className="mt-1 font-display text-4xl text-ink-deep">{number}</h1>
      </div>

      <Card className="space-y-3 text-sm">
        <Eyebrow>What happened</Eyebrow>
        <ul className="space-y-2 text-muted">
          <li>
            Quotation <span className="text-ink">{number}</span> was recorded
            with status <em>submitted for review</em>. A manager will approve or
            reject it.
          </li>
          {emailError ? (
            <li className="text-rejected">{emailError}</li>
          ) : transport === "smtp" ? (
            <li>The PDF was emailed.</li>
          ) : (
            <li>
              Email isn&rsquo;t configured yet — the PDF was saved to{" "}
              <code className="rounded bg-panel px-1">
                {saved || "output/"}
              </code>{" "}
              on the server.
            </li>
          )}
        </ul>
        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-gold-deep">
          {DISCLAIMER}
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
