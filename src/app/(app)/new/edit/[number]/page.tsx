"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Card, Eyebrow } from "@/components/ui";
import { useDraft } from "@/lib/draft/context";
import { isValidValidUntil } from "@/lib/format";
import type { SavedDraft } from "@/lib/quote-files";
import { draftStarted, type QuoteDraft } from "@/lib/types";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/*
 * Reopens a saved quotation in the wizard: loads its rooms, lights, options,
 * discounts, client details and blueprint into the draft, then goes straight
 * to the first room's lights. Saving it makes a NEW quotation with its own
 * number; the original stays as it was.
 */
export default function EditQuotationPage() {
  const { number } = useParams<{ number: string }>();
  const router = useRouter();
  const { loaded, draft, loadDraft } = useDraft();
  const [error, setError] = useState<string | null>(null);
  // Made before saving existed: offer to rebuild it (as a new quotation).
  const [notSaved, setNotSaved] = useState<{ clientName?: string } | null>(null);
  // An unsaved draft of something else is in progress: ask before replacing it.
  const [confirmReplace, setConfirmReplace] = useState(false);
  const started = useRef(false);

  const open = async () => {
    started.current = true;
    setConfirmReplace(false);
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(number)}/draft`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        error?: string;
        notSaved?: boolean;
        clientName?: string;
        draft?: SavedDraft;
        blueprintDataUrl?: string;
      };
      if (data.notSaved) {
        setNotSaved({ clientName: data.clientName });
        return;
      }
      if (!res.ok || !data.draft) {
        setError(data.error ?? "Could not open this quotation.");
        return;
      }
      const saved = data.draft;
      const now = new Date().toISOString();
      const next: QuoteDraft = {
        createdAt: now,
        updatedAt: now,
        rooms: saved.rooms,
        applyGst: saved.applyGst,
        discount: saved.discount,
        optionCount: saved.optionCount,
        client: saved.client,
        // Keep the chosen date while it is still ahead; else back to 60 days.
        validUntil: isValidValidUntil(saved.validUntil) ? saved.validUntil : undefined,
        editOf: number,
        noBlueprint: !saved.blueprint || !data.blueprintDataUrl,
      };
      if (saved.blueprint && data.blueprintDataUrl) {
        next.blueprint = {
          ...saved.blueprint,
          blob: await dataUrlToBlob(data.blueprintDataUrl),
          previewDataUrl: data.blueprintDataUrl,
        };
      }
      await loadDraft(next);
      const first = next.rooms[0];
      router.replace(first ? `/new/rooms/${first.id}` : "/new/rooms");
    } catch {
      setError("Network error. Could not open this quotation.");
    }
  };

  useEffect(() => {
    if (!loaded || started.current) return;
    const busyWithOther = draftStarted(draft) && draft.editOf !== number && draft.rooms.length > 0;
    if (busyWithOther) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmReplace(true);
      return;
    }
    void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const rebuild = async () => {
    const now = new Date().toISOString();
    await loadDraft({
      createdAt: now,
      updatedAt: now,
      rooms: [],
      editOf: number,
      client: notSaved?.clientName ? { name: notSaved.clientName } : undefined,
    });
    router.replace("/new");
  };

  if (notSaved) {
    return (
      <Card className="mx-auto max-w-lg space-y-3">
        <Eyebrow>Edit {number}</Eyebrow>
        <p className="text-sm text-muted">
          {number} was made before quotations were saved, so its rooms and lights were never
          stored. Rebuild it here: add the blueprint, rooms and lights again, and it is saved
          as a new quotation with a new number, marked as replacing {number}.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => void rebuild()}>Rebuild {number}</Button>
          <ButtonLink href="/history" variant="secondary">
            Back to history
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-lg space-y-3">
        <Eyebrow>Edit {number}</Eyebrow>
        <p className="text-sm text-rejected">{error}</p>
        <ButtonLink href="/history" variant="secondary">
          Back to history
        </ButtonLink>
      </Card>
    );
  }

  if (confirmReplace && draftStarted(draft)) {
    return (
      <Card className="mx-auto max-w-lg space-y-3">
        <Eyebrow>Edit {number}</Eyebrow>
        <p className="text-sm text-muted">
          You have another quotation in progress
          {draft.editOf ? ` (edit of ${draft.editOf})` : ""} with {draft.rooms.length} room
          {draft.rooms.length === 1 ? "" : "s"}. Opening {number} replaces it on this device.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => void open()}>Open {number}</Button>
          <ButtonLink href="/new/rooms" variant="secondary">
            Keep working on the other one
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-3 text-center">
      <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-panel" />
      <p className="text-sm text-muted">Opening {number}…</p>
    </div>
  );
}
