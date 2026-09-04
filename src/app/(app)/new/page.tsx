"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { WizardSteps } from "@/components/wizard-steps";
import { Button, ButtonLink, Card, Eyebrow } from "@/components/ui";
import { UPLOAD } from "@/lib/config";
import { useDraft } from "@/lib/draft/context";
import { BlueprintError, renderBlueprint } from "@/lib/draft/render";
import { cx } from "@/lib/cx";

export default function BlueprintUploadPage() {
  const router = useRouter();
  const { loaded, draft, setBlueprint, discard } = useDraft();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setWarn(null);
      if (file.size > UPLOAD.softWarnBytes && file.size <= UPLOAD.maxBytes) {
        setWarn(
          `Large file (${(file.size / 1024 / 1024).toFixed(1)} MB). It may take a moment to render.`,
        );
      }
      setBusy(true);
      try {
        const r = await renderBlueprint(file);
        await setBlueprint({
          name: file.name,
          kind: r.kind,
          blob: file,
          previewDataUrl: r.previewDataUrl,
          width: r.width,
          height: r.height,
          pageCount: r.pageCount,
        });
        router.push("/new/rooms");
      } catch (e) {
        setBusy(false);
        setError(
          e instanceof BlueprintError
            ? e.message
            : "Something went wrong reading that file.",
        );
      }
    },
    [router, setBlueprint],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-4">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">New quotation</h1>
        <div className="mt-4">
          <WizardSteps current={1} />
        </div>
      </div>

      {!loaded ? (
        <div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-panel" />
      ) : draft?.blueprint ? (
        <Card className="space-y-4">
          <Eyebrow>Resume where you left off</Eyebrow>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-2xl text-ink-deep">
                {draft.blueprint.name}
              </p>
              <p className="mt-1 text-sm text-muted">
                {draft.blueprint.kind.toUpperCase()} ·{" "}
                {draft.blueprint.pageCount} page
                {draft.blueprint.pageCount === 1 ? "" : "s"} ·{" "}
                {draft.rooms.length} room
                {draft.rooms.length === 1 ? "" : "s"} so far
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  await discard();
                  setError(null);
                }}
              >
                Discard & start over
              </Button>
              <ButtonLink href="/new/rooms">Continue</ButtonLink>
            </div>
          </div>
          <p className="text-xs text-faint">
            This draft is saved only in this browser, on this device. It is
            cleared once you send the quotation.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cx(
              "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed px-6 py-16 text-center transition-colors",
              dragOver
                ? "border-gold bg-gold-tint"
                : "border-hairline bg-panel/50",
            )}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              className="text-gold-deep"
              aria-hidden
            >
              <path
                d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="font-display text-2xl text-ink-deep">
                Upload a blueprint
              </p>
              <p className="mt-1 text-sm text-muted">
                Drag a file here, or choose one. {UPLOAD.acceptedLabel}, up to
                20&nbsp;MB.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? "Reading…" : "Choose file"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {warn && (
            <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-xs text-ink-deep">
              {warn}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-xs text-rejected">
              {error}
            </p>
          )}
          <p className="text-xs text-faint">
            The blueprint stays on your device. It is never uploaded to a
            server or stored by Shahi Lites.
          </p>
        </div>
      )}
    </div>
  );
}
