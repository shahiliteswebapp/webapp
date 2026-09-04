"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardSteps } from "@/components/wizard-steps";
import { ButtonLink, Eyebrow, EmptyState } from "@/components/ui";
import { useDraft } from "@/lib/draft/context";
import { money } from "@/lib/format";
import { computeQuote } from "@/lib/quote";

export default function SummaryPage() {
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
        <h1 className="font-display text-4xl text-ink-deep">Summary</h1>
        <div className="mt-4">
          <WizardSteps current={4} />
        </div>
      </div>

      <EmptyState
        title="Room cards + send for review — coming in Phase 4 & 5"
        hint={`Running total so far: ${money(quote.grandTotal)} incl. ${quote.gstRatePct}% GST (${money(quote.subtotal)} + ${money(quote.gstAmount)}).`}
        action={
          draft.rooms[0] ? (
            <ButtonLink
              href={`/new/rooms/${draft.rooms[0].id}`}
              variant="secondary"
            >
              Back to rooms
            </ButtonLink>
          ) : undefined
        }
      />
    </div>
  );
}
