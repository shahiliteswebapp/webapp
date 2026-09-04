"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardSteps } from "@/components/wizard-steps";
import { ButtonLink, Eyebrow, EmptyState } from "@/components/ui";
import { EMAIL } from "@/lib/config";
import { useDraft } from "@/lib/draft/context";
import { money } from "@/lib/format";
import { computeQuote } from "@/lib/quote";

export default function SendPage() {
  const router = useRouter();
  const { loaded, draft } = useDraft();

  useEffect(() => {
    if (loaded && !draft?.blueprint) router.replace("/new");
  }, [loaded, draft?.blueprint, router]);

  if (!loaded || !draft?.blueprint) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const quote = computeQuote(draft.rooms);

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">Send for review</h1>
        <div className="mt-4">
          <WizardSteps current={4} />
        </div>
      </div>

      <EmptyState
        title="PDF generation + email — coming in Phase 5"
        hint={`Grand total ${money(quote.grandTotal)} · will email to ${EMAIL.recipientOverride} (stubbed to ./output until the Gmail app password is set) and record the quotation number.`}
        action={
          <ButtonLink href="/new/summary" variant="secondary">
            Back to summary
          </ButtonLink>
        }
      />
    </div>
  );
}
