"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { WizardSteps } from "@/components/wizard-steps";
import { ButtonLink, Eyebrow, EmptyState } from "@/components/ui";
import { useDraft } from "@/lib/draft/context";

export default function RoomLightingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { loaded, draft } = useDraft();

  if (!loaded) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const room = draft?.rooms.find((r) => r.id === roomId);

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">
          {room ? room.name : "Room"}
        </h1>
        <div className="mt-4">
          <WizardSteps current={3} />
        </div>
      </div>

      <EmptyState
        title="Per-room lighting — coming in Phase 3"
        hint="Blueprint on the left, a room dropdown and lighting picker on the right, with live cost and auto-calculated connectors."
        action={
          <ButtonLink href="/new/rooms" variant="secondary">
            Back to room list
          </ButtonLink>
        }
      />

      <p className="text-center text-xs text-faint">
        <Link href="/new" className="underline hover:text-ink">
          Start over
        </Link>
      </p>
    </div>
  );
}
