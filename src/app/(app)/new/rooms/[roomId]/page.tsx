"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BlueprintViewer } from "@/components/blueprint-viewer";
import { WizardSteps } from "@/components/wizard-steps";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import {
  LIGHTING_SYSTEMS,
  UNIT_LABEL,
  getSystem,
} from "@/lib/catalog";
import { useDraft } from "@/lib/draft/context";
import { money } from "@/lib/format";
import { computeRoom } from "@/lib/quote";
import { cx } from "@/lib/cx";
import type { RoomLine } from "@/lib/types";

const CATEGORIES = [...new Set(LIGHTING_SYSTEMS.map((s) => s.category))];

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function RoomLightingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { loaded, draft, setRoomLines } = useDraft();

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

  const update = (next: RoomLine[]) => setRoomLines(room.id, next);
  const addLine = () =>
    update([...lines, { id: uid(), systemId: "", qty: 1 }]);
  const setSystem = (id: string, systemId: string) =>
    update(lines.map((l) => (l.id === id ? { ...l, systemId } : l)));
  const setQty = (id: string, qty: number) =>
    update(lines.map((l) => (l.id === id ? { ...l, qty } : l)));
  const removeLine = (id: string) =>
    update(lines.filter((l) => l.id !== id));

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">Lighting</h1>
        <div className="mt-4">
          <WizardSteps current={3} />
        </div>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Blueprint */}
        <div className="h-[50vh] min-w-0 lg:sticky lg:top-24 lg:h-[calc(100dvh-14rem)]">
          <BlueprintViewer
            src={draft.blueprint.previewDataUrl}
            className="h-full w-full"
          />
        </div>

        {/* Lighting editor */}
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
                  const lineTotal = sys ? sys.unitCost * (line.qty || 0) : 0;
                  return (
                    <li
                      key={line.id}
                      className="rounded-[var(--radius-card)] border border-hairline p-3"
                    >
                      <div className="flex items-center gap-2">
                        <select
                          value={line.systemId}
                          onChange={(e) => setSystem(line.id, e.target.value)}
                          className="min-w-0 flex-1 rounded-md border border-hairline bg-paper px-2 py-1.5 text-sm outline-none focus:border-gold"
                        >
                          <option value="">Select a system…</option>
                          {CATEGORIES.map((cat) => (
                            <optgroup key={cat} label={cat}>
                              {LIGHTING_SYSTEMS.filter(
                                (s) => s.category === cat,
                              ).map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} — {money(s.unitCost)}/
                                  {UNIT_LABEL[s.unit]}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
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
                      <div className="mt-2 flex items-center justify-between gap-3 pl-0.5">
                        <label className="flex items-center gap-2 text-xs text-muted">
                          Qty
                          <input
                            type="number"
                            min={0}
                            step={sys?.unit === "mtr" ? 0.5 : 1}
                            value={line.qty || ""}
                            onChange={(e) => {
                              const n = parseFloat(e.target.value);
                              setQty(line.id, Number.isFinite(n) ? Math.max(0, n) : 0);
                            }}
                            className="w-20 rounded-md border border-hairline bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-gold"
                          />
                          {sys && (
                            <span className="text-faint">
                              {UNIT_LABEL[sys.unit]}
                            </span>
                          )}
                        </label>
                        <span
                          className={cx(
                            "text-sm tabular-nums",
                            lineTotal > 0 ? "text-ink" : "text-faint",
                          )}
                        >
                          {money(lineTotal)}
                        </span>
                      </div>
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
              <ul className="rounded-[var(--radius-card)] border border-hairline bg-panel/40 divide-y divide-hairline text-sm">
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
      </div>
    </div>
  );
}
