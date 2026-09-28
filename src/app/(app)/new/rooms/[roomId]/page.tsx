"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BlueprintViewer } from "@/components/blueprint-viewer";
import { WizardSteps } from "@/components/wizard-steps";
import { LightDetails } from "@/components/light-details";
import { LightingFilterPicker, type LinePick } from "@/components/lighting-filter-picker";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import { UNIT_LABEL, getSystem, unitPriceFor, variantLabel } from "@/lib/catalog";
import { useDraft } from "@/lib/draft/context";
import { money } from "@/lib/format";
import { computeRoom } from "@/lib/quote";
import { cx } from "@/lib/cx";
import type { RoomLine } from "@/lib/types";

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function RoomLightingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { loaded, draft, setRoomLines } = useDraft();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const detailRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!loaded) return;
    if (!draft?.blueprint) {
      router.replace("/new");
      return;
    }
    if (draft.rooms.length === 0) {
      router.replace("/new/rooms");
      return;
    }
    if (!draft.rooms.some((r) => r.id === roomId)) {
      router.replace(`/new/rooms/${draft.rooms[0].id}`);
    }
  }, [loaded, draft, roomId, router]);

  // Room changed: drop per-room UI state (reset during render, not in an effect).
  const [stateRoom, setStateRoom] = useState(roomId);
  if (stateRoom !== roomId) {
    setStateRoom(roomId);
    setPreviewId(null);
    setActiveLineId(null);
  }

  // Keep the active line's detail card in view.
  useEffect(() => {
    if (!activeLineId) return;
    detailRefs.current
      .get(activeLineId)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLineId]);

  if (!loaded || !draft?.blueprint || draft.rooms.length === 0) {
    return (
      <div className="h-[60vh] animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const rooms = draft.rooms;
  const index = rooms.findIndex((r) => r.id === roomId);
  const room = rooms[index];
  if (!room) {
    return (
      <div className="h-[60vh] animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const lines = room.lines;
  const computed = computeRoom(room);
  const isLast = index === rooms.length - 1;
  const previewSys = previewId ? getSystem(previewId) : undefined;
  const pickedLines = lines.filter((l) => getSystem(l.systemId));

  const update = (next: RoomLine[]) => setRoomLines(room.id, next);
  const addLine = () => {
    const id = uid();
    update([...lines, { id, systemId: "", qty: 1 }]);
    setActiveLineId(id);
  };
  const setPick = (id: string, pick: LinePick) =>
    update(
      lines.map((l) =>
        l.id === id
          ? {
              id: l.id,
              qty: l.qty,
              systemId: pick.systemId,
              interfaceTag: pick.interfaceTag,
              control: pick.control,
              // A typed-in rate belongs to the old system; keep it only if unchanged.
              unitPrice: l.systemId === pick.systemId ? l.unitPrice : undefined,
            }
          : l,
      ),
    );
  const patchLine = (id: string, patch: Partial<RoomLine>) =>
    update(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => {
    update(lines.filter((l) => l.id !== id));
    if (activeLineId === id) setActiveLineId(null);
  };

  return (
    <div className="space-y-6 xl:relative xl:left-1/2 xl:w-[min(96rem,calc(100vw-4rem))] xl:-translate-x-1/2">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">Lighting</h1>
        <div className="mt-4">
          <WizardSteps current={3} />
        </div>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_400px_340px]">
        {/* Left: blueprint */}
        <div className="h-[50vh] min-w-0 lg:sticky lg:top-24 lg:h-[calc(100dvh-14rem)]">
          <BlueprintViewer
            src={draft.blueprint.previewDataUrl}
            className="h-full w-full"
          />
        </div>

        {/* Middle: room + lighting editor */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* Room switcher */}
          <div className="flex items-center gap-2">
            <select
              value={room.id}
              onChange={(e) => router.push(`/new/rooms/${e.target.value}`)}
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm font-medium outline-none focus:border-gold"
              aria-label="Switch room"
            >
              {rooms.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {i + 1}. {r.name}
                </option>
              ))}
            </select>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Previous room"
                disabled={index === 0}
                onClick={() => router.push(`/new/rooms/${rooms[index - 1].id}`)}
                className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-muted disabled:opacity-30 hover:border-gold hover:text-ink"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next room"
                disabled={isLast}
                onClick={() => router.push(`/new/rooms/${rooms[index + 1].id}`)}
                className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-muted disabled:opacity-30 hover:border-gold hover:text-ink"
              >
                ›
              </button>
            </div>
          </div>
          <p className="-mt-3 text-xs text-faint">
            Room {index + 1} of {rooms.length}
          </p>

          {/* Lines */}
          <div className="space-y-2">
            <Eyebrow>Lighting systems</Eyebrow>
            {lines.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-hairline bg-panel/50 p-5 text-center text-sm text-muted">
                No lighting added to this room yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {lines.map((line) => {
                  const sys = getSystem(line.systemId);
                  const unit = sys ? unitPriceFor(sys, line) : 0;
                  const needsRate =
                    !!sys && sys.unitCost <= 0 && unitPriceFor(sys, { ...line, unitPrice: 0 }) <= 0;
                  const lineTotal = unit * (line.qty || 0);
                  return (
                    <li
                      key={line.id}
                      onClickCapture={() => setActiveLineId(line.id)}
                      onFocusCapture={() => setActiveLineId(line.id)}
                      className={cx(
                        "rounded-[var(--radius-card)] border p-3 transition-colors",
                        activeLineId === line.id ? "border-gold" : "border-hairline",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <LightingFilterPicker
                            value={line}
                            onChange={(pick) => setPick(line.id, pick)}
                            onPreview={setPreviewId}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          aria-label="Remove line"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-rejected/5 hover:text-rejected"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 pl-0.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-muted">
                            Qty
                            <input
                              type="number"
                              min={0}
                              step={sys?.unit === "mtr" ? 0.5 : 1}
                              value={line.qty || ""}
                              onChange={(e) => {
                                const n = parseFloat(e.target.value);
                                patchLine(line.id, {
                                  qty: Number.isFinite(n) ? Math.max(0, n) : 0,
                                });
                              }}
                              className="w-20 rounded-md border border-hairline bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-gold"
                            />
                            {sys && <span className="text-faint">{UNIT_LABEL[sys.unit]}</span>}
                          </label>
                          {needsRate && (
                            <label className="flex items-center gap-2 text-xs text-muted">
                              Rate ₹
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={line.unitPrice || ""}
                                placeholder="Enter"
                                onChange={(e) => {
                                  const n = parseFloat(e.target.value);
                                  patchLine(line.id, {
                                    unitPrice: Number.isFinite(n) ? Math.max(0, n) : undefined,
                                  });
                                }}
                                className={cx(
                                  "w-24 rounded-md border bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-gold",
                                  line.unitPrice ? "border-hairline" : "border-gold/60",
                                )}
                              />
                            </label>
                          )}
                        </div>
                        <span
                          className={cx(
                            "text-sm tabular-nums",
                            lineTotal > 0 ? "text-ink" : "text-faint",
                          )}
                        >
                          {money(lineTotal)}
                        </span>
                      </div>
                      {needsRate && !line.unitPrice && (
                        <p className="mt-1 pl-0.5 text-[11px] text-faint">
                          No catalogue price for this item. Enter the rate to include it.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <Button variant="secondary" onClick={addLine} className="w-full">
              + Add lighting
            </Button>
          </div>

          {/* Auto accessories */}
          {computed.accessories.length > 0 && (
            <div className="space-y-2">
              <Eyebrow>Connectors &amp; drivers (auto)</Eyebrow>
              <ul className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline bg-panel/40 text-sm">
                {computed.accessories.map((a) => (
                  <li
                    key={a.accessoryId}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="text-ink">{a.name}</span>{" "}
                      <span className="text-faint">
                        × {a.qty} · {money(a.unitCost)} ea
                      </span>
                      <span className="block truncate text-xs text-faint">
                        from {a.from.join(", ")}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink">
                      {money(a.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Room subtotal */}
          <div className="rounded-[var(--radius-card)] border border-gold/40 bg-gold-tint/50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-xl text-ink-deep">
                Room subtotal
              </span>
              <span className="font-display text-xl tabular-nums text-ink-deep">
                {money(computed.subtotal)}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>
                Lighting {money(computed.systemsTotal)} · Connectors/drivers{" "}
                {money(computed.accessoriesTotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-faint">
              GST is added once, on the final quotation.
            </p>
          </div>

          {/* Nav */}
          <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
            <ButtonLink href="/new/rooms" variant="ghost">
              Room list
            </ButtonLink>
            {isLast ? (
              <ButtonLink href="/new/summary">Review summary</ButtonLink>
            ) : (
              <ButtonLink href={`/new/rooms/${rooms[index + 1].id}`}>
                Next room →
              </ButtonLink>
            )}
          </div>
        </div>

        {/* Right: photos + size specs per light */}
        <aside className="min-w-0 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-24 xl:h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:pr-1">
          <div className="space-y-3">
            <Eyebrow>Photos &amp; specs</Eyebrow>
            {previewSys && (
              <div className="sticky top-0 z-10 bg-paper pb-1">
                <LightDetails
                  key={`preview-${previewSys.id}`}
                  sys={previewSys}
                  unitPrice={previewSys.unitCost}
                  badge="Preview"
                  active
                />
              </div>
            )}
            {pickedLines.length === 0 && !previewSys ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-hairline bg-panel/50 p-5 text-center text-sm text-muted">
                Pick a light to see its photos and size specs here. Hover a match
                in the list to preview it.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {pickedLines.map((line) => {
                  const sys = getSystem(line.systemId)!;
                  return (
                    <div
                      key={line.id}
                      ref={(el) => {
                        if (el) detailRefs.current.set(line.id, el);
                        else detailRefs.current.delete(line.id);
                      }}
                      onClick={() => setActiveLineId(line.id)}
                    >
                      <LightDetails
                        key={line.systemId}
                        sys={sys}
                        qty={line.qty}
                        unitPrice={unitPriceFor(sys, line)}
                        variant={variantLabel(line)}
                        badge={`Line ${lines.indexOf(line) + 1}`}
                        active={activeLineId === line.id && !previewSys}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
