"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useDraft } from "@/lib/draft/context";
import { BlueprintError, readPdfText } from "@/lib/draft/render";
import type { SavedDraft } from "@/lib/quote-files";
import { draftStarted, type QuoteDraft } from "@/lib/types";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/*
 * "Open an existing quotation PDF": reads an old quotation back into the
 * draft (rooms, lights, options, discounts, client details), then stays on
 * the blueprint step so a blueprint can be added, replaced or removed before
 * moving on to the rooms.
 */
export function PdfImport({ onWarnings }: { onWarnings: (w: string[]) => void }) {
  const { draft, loadDraft } = useDraft();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async (file: File) => {
    setError(null);
    onWarnings([]);
    if (
      draftStarted(draft) &&
      draft.rooms.length > 0 &&
      !confirm("This replaces the quotation in progress on this device. Continue?")
    ) {
      return;
    }
    setBusy(true);
    try {
      const text = await readPdfText(file);
      const res = await fetch("/api/quotations/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(text),
      });
      const data = (await res.json()) as {
        error?: string;
        editOf?: string;
        draft?: Partial<SavedDraft>;
        blueprintDataUrl?: string;
        warnings?: string[];
      };
      if (!res.ok || !data.draft) throw new Error(data.error ?? "Could not open that PDF.");
      const d = data.draft;
      const now = new Date().toISOString();
      const next: QuoteDraft = {
        createdAt: now,
        updatedAt: now,
        rooms: d.rooms ?? [],
        applyGst: d.applyGst,
        discount: d.discount,
        optionCount: d.optionCount,
        client: d.client,
        validUntil: d.validUntil,
        editOf: data.editOf,
        noBlueprint: true,
      };
      if (d.blueprint && data.blueprintDataUrl) {
        next.noBlueprint = false;
        next.blueprint = {
          ...d.blueprint,
          blob: await dataUrlToBlob(data.blueprintDataUrl),
          previewDataUrl: data.blueprintDataUrl,
        };
      }
      await loadDraft(next);
      onWarnings(data.warnings ?? []);
    } catch (e) {
      setError(e instanceof BlueprintError || e instanceof Error ? e.message : "Could not open that PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Reading PDF…" : "Open an existing quotation PDF"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void open(f);
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs text-rejected">{error}</p>}
    </div>
  );
}
