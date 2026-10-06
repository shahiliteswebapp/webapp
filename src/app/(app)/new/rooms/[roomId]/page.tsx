"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlueprintViewer } from "@/components/blueprint-viewer";
import { WizardSteps } from "@/components/wizard-steps";
import { LightDetails } from "@/components/light-details";
import { LightingFilterPicker, type LinePick } from "@/components/lighting-filter-picker";
import { OptionCountControl } from "@/components/option-count";
import { RoomNavigator } from "@/components/room-navigator";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { UNIT_LABEL, getSystem, systemImages, unitPriceFor, variantLabel } from "@/lib/catalog";
import { useDraft } from "@/lib/draft/context";
import { money } from "@/lib/format";
import { computeRoom, optionLabel, type ComputedLine, type ComputedRoom } from "@/lib/quote";
import { DiscountInput } from "@/components/discount-input";
import { cx } from "@/lib/cx";
import {
  choiceFor,
  draftStarted,
  optionCountOf,
  type RoomLine,
} from "@/lib/types";

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/** Light id from a "#line-<id>" hash (set when jumping here from another room). */
function lineFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/^#line-(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/* What an option tab says about a light. */
function choiceSummary(line: RoomLine, opt: number): string {
  const c = choiceFor(line, opt);
  if (opt > 0 && c.inherited) return "Same as Option 1";
  if (!c.systemId) return opt > 0 ? "Left out" : "Not chosen";
  return getSystem(c.systemId)?.name ?? "Not chosen";
}

function Trash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RowThumb({ systemId }: { systemId: string }) {
  const sys = systemId ? getSystem(systemId) : undefined;
  const src = sys ? systemImages(sys)[0] : undefined;
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-hairline bg-paper">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-lg text-faint">+</span>
      )}
    </span>
  );
}

export default function RoomLightingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { loaded, draft, setRoomLines, setRoomDiscount, setOptionCount } = useDraft();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeLineId, setActiveLineId] = useState<string | null>(lineFromHash);
  const [activeOpt, setActiveOpt] = useState(0);
  // Below xl the blueprint sits above the lights; it starts open.
  const [showBlueprint, setShowBlueprint] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  // Which option of the active light is being re-picked from "Same as Option 1".
  const [pickingAlt, setPickingAlt] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    if (!draftStarted(draft)) {
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
    setActiveLineId(lineFromHash());
    setPickingAlt(false);
    setNavOpen(false);
  }

  // Bring the active light into view (after a jump from the navigator).
  useEffect(() => {
    if (!activeLineId || !loaded) return;
    document
      .getElementById(`line-${activeLineId}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLineId, loaded]);

  if (!loaded || !draftStarted(draft) || draft.rooms.length === 0) {
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

  const optionCount = optionCountOf(draft);
  const opt = Math.min(activeOpt, optionCount - 1);
  const lines = room.lines;
  const perOption: ComputedRoom[] = Array.from({ length: optionCount }, (_, o) =>
    computeRoom(room, o),
  );
  const lineTotals = perOption.map(
    (c) => new Map<string, ComputedLine>(c.lines.map((l) => [l.lineId, l])),
  );
  const computed = perOption[opt];
  const isLast = index === rooms.length - 1;
  const previewSys = previewId ? getSystem(previewId) : undefined;
  const activeLine = lines.find((l) => l.id === activeLineId);

  const update = (next: RoomLine[]) => setRoomLines(room.id, next);
  const patchLine = (id: string, fn: (l: RoomLine) => RoomLine) =>
    update(lines.map((l) => (l.id === id ? fn(l) : l)));

  const selectLine = (id: string | null) => {
    setActiveLineId(id);
    setPickingAlt(false);
    setPreviewId(null);
  };
  const addLine = () => {
    const id = uid();
    update([...lines, { id, systemId: "", qty: 1 }]);
    selectLine(id);
    setActiveOpt(0);
  };
  const removeLine = (id: string) => {
    update(lines.filter((l) => l.id !== id));
    if (activeLineId === id) selectLine(null);
  };
  const jumpTo = (targetRoom: string, lineId: string) => {
    if (targetRoom === room.id) {
      selectLine(lineId);
      setNavOpen(false);
    } else {
      router.push(`/new/rooms/${targetRoom}#line-${encodeURIComponent(lineId)}`);
    }
  };

  /* Set the product for option `o` of a line. `null` = same as Option 1,
   * "omit" = leave this light out of that option. */
  const setChoice = (lineId: string, o: number, pick: LinePick | null | "omit") =>
    patchLine(lineId, (l) => {
      if (o === 0) {
        if (!pick || pick === "omit") return l;
        return {
          ...l,
          systemId: pick.systemId,
          interfaceTag: pick.interfaceTag,
          control: pick.control,
          // A typed-in rate belongs to the old system; keep it only if unchanged.
          unitPrice: l.systemId === pick.systemId ? l.unitPrice : undefined,
        };
      }
      const alts = [...(l.alts ?? [])];
      while (alts.length < o) alts.push(null);
      const prev = alts[o - 1];
      alts[o - 1] =
        pick === null
          ? null
          : pick === "omit"
            ? { systemId: "" }
            : {
                systemId: pick.systemId,
                interfaceTag: pick.interfaceTag,
                control: pick.control,
                unitPrice: prev?.systemId === pick.systemId ? prev.unitPrice : undefined,
              };
      return { ...l, alts };
    });
  const setChoiceRate = (lineId: string, o: number, unitPrice: number | undefined) =>
    patchLine(lineId, (l) => {
      if (o === 0) return { ...l, unitPrice };
      const alts = [...(l.alts ?? [])];
      const prev = alts[o - 1];
      if (!prev) return { ...l, unitPrice }; // inherited: the rate lives on Option 1
      alts[o - 1] = { ...prev, unitPrice };
      return { ...l, alts };
    });

  /* ------------------------------ right column ------------------------------ */

  const activeCards = activeLine
    ? Array.from({ length: optionCount }, (_, o) => ({ o, c: choiceFor(activeLine, o) }))
        .filter(({ c }) => getSystem(c.systemId))
        // Options that reuse Option 1's light don't need a second card.
        .filter(({ o, c }) => o === 0 || !c.inherited)
    : [];

  const detailsPanel = (
    <div className="space-y-3">
      {previewSys && (
        <LightDetails
          key={`preview-${previewSys.id}`}
          sys={previewSys}
          unitPrice={previewSys.unitCost}
          badge="Preview"
          active
        />
      )}
      {!previewSys && activeCards.length === 0 && (
        <div className="rounded-[var(--radius-card)] border border-dashed border-hairline bg-panel/50 p-5 text-center text-sm text-muted">
          {activeLine
            ? "Pick a light to see its photos and size specs here. Hover a match in the list to preview it."
            : "Select a light on the left to see its photos and size specs."}
        </div>
      )}
      {!previewSys &&
        activeLine &&
        activeCards.map(({ o, c }) => {
          const sys = getSystem(c.systemId)!;
          return (
            <div key={`${o}-${c.systemId}`} onClick={() => setActiveOpt(o)}>
              <LightDetails
                sys={sys}
                qty={activeLine.qty}
                unitPrice={unitPriceFor(sys, c)}
                variant={variantLabel(c)}
                badge={optionCount > 1 ? optionLabel(o) : undefined}
                active={o === opt}
              />
            </div>
          );
        })}
    </div>
  );

  /* -------------------------------- line rows -------------------------------- */

  const renderCollapsed = (line: RoomLine, n: number) => {
    const first = lineTotals[0].get(line.id);
    const sys = getSystem(line.systemId);
    const alts =
      optionCount > 1
        ? Array.from({ length: optionCount - 1 }, (_, k) => `O${k + 2}: ${choiceSummary(line, k + 1)}`)
        : [];
    return (
      <button
        type="button"
        onClick={() => selectLine(line.id)}
        className="flex w-full items-center gap-3 p-2 text-left"
      >
        <RowThumb systemId={line.systemId} />
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate text-sm", sys ? "text-ink" : "italic text-faint")}>
            {sys ? sys.name : "Choose a light"}
            {sys && variantLabel(line) && (
              <span className="text-muted"> · {variantLabel(line)}</span>
            )}
          </span>
          <span className="block truncate text-xs text-faint">
            Light {n} · Qty {line.qty || 0}
            {sys ? ` ${UNIT_LABEL[sys.unit]}` : ""}
            {alts.length > 0 && ` · ${alts.join(" · ")}`}
          </span>
        </span>
        <span className="shrink-0 text-right text-sm tabular-nums">
          {optionCount > 1 ? (
            <span className="block space-y-0.5 text-xs">
              {lineTotals.map((m, o) => (
                <span key={o} className="block">
                  <span className="text-faint">O{o + 1} </span>
                  <span className={(m.get(line.id)?.total ?? 0) > 0 ? "text-ink" : "text-faint"}>
                    {money(m.get(line.id)?.total ?? 0)}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span className={(first?.total ?? 0) > 0 ? "text-ink" : "text-faint"}>
              {money(first?.total ?? 0)}
            </span>
          )}
        </span>
      </button>
    );
  };

  const renderExpanded = (line: RoomLine, n: number) => {
    const choice = choiceFor(line, opt);
    const sys = getSystem(choice.systemId);
    const unit = sys ? unitPriceFor(sys, choice) : 0;
    const needsRate =
      !!sys && sys.unitCost <= 0 && unitPriceFor(sys, { ...choice, unitPrice: 0 }) <= 0;
    const lineCalc = lineTotals[opt].get(line.id);
    const first = getSystem(line.systemId);
    const alt = opt > 0 ? line.alts?.[opt - 1] : undefined;

    return (
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-gold-deep">
            Light {n}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => selectLine(null)}
            className="rounded-full border border-hairline px-3 py-1 text-xs text-muted hover:border-gold hover:text-ink"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => removeLine(line.id)}
            aria-label="Remove light"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-rejected/5 hover:text-rejected"
          >
            <Trash />
          </button>
        </div>

        {optionCount > 1 && (
          <div role="tablist" aria-label="Options for this light" className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: optionCount }, (_, o) => (
              <button
                key={o}
                type="button"
                role="tab"
                aria-selected={o === opt}
                onClick={() => {
                  setActiveOpt(o);
                  setPickingAlt(false);
                }}
                className={cx(
                  "min-w-0 rounded-md border px-2 py-1.5 text-left transition-colors",
                  o === opt ? "border-gold bg-gold-tint" : "border-hairline hover:border-muted",
                )}
              >
                <span className="block text-[11px] font-medium uppercase tracking-wider text-ink">
                  {optionLabel(o)}
                </span>
                <span className="block truncate text-[11px] text-muted">{choiceSummary(line, o)}</span>
              </button>
            ))}
          </div>
        )}

        {/* The product for the selected option */}
        {opt === 0 ? (
          <LightingFilterPicker
            key={`${line.id}-0`}
            value={line}
            onChange={(pick) => setChoice(line.id, 0, pick)}
            onPreview={setPreviewId}
            autoFocus={!line.systemId}
          />
        ) : alt && alt.systemId ? (
          <div className="space-y-1.5">
            <LightingFilterPicker
              key={`${line.id}-${opt}`}
              value={alt}
              onChange={(pick) => setChoice(line.id, opt, pick)}
              onPreview={setPreviewId}
            />
            <AltActions
              onSame={() => setChoice(line.id, opt, null)}
              onOmit={() => setChoice(line.id, opt, "omit")}
              opt={opt}
            />
          </div>
        ) : pickingAlt ? (
          <div className="space-y-1.5">
            <LightingFilterPicker
              key={`${line.id}-${opt}-new`}
              value={{ systemId: "" }}
              onChange={(pick) => {
                setChoice(line.id, opt, pick);
                setPickingAlt(false);
              }}
              onPreview={setPreviewId}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setPickingAlt(false)}
              className="text-xs text-faint hover:text-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-hairline bg-panel/40 p-3 text-sm">
            <p className="text-muted">
              {alt && !alt.systemId ? (
                <>This light is left out of {optionLabel(opt)}.</>
              ) : (
                <>
                  Same light as Option 1
                  {first ? <span className="text-ink">: {first.name}</span> : null}.
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPickingAlt(true)}
                className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-paper hover:opacity-90"
              >
                Choose a different light
              </button>
              {alt && !alt.systemId ? (
                <button
                  type="button"
                  onClick={() => setChoice(line.id, opt, null)}
                  className="rounded-full border border-hairline px-3 py-1 text-xs text-muted hover:border-gold hover:text-ink"
                >
                  Same as Option 1
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setChoice(line.id, opt, "omit")}
                  className="rounded-full border border-hairline px-3 py-1 text-xs text-muted hover:border-gold hover:text-ink"
                >
                  Leave out of {optionLabel(opt)}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quantity and discount apply to every option */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              Qty
              <input
                type="number"
                min={0}
                step={sys?.unit === "mtr" ? 0.5 : 1}
                value={line.qty || ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  patchLine(line.id, (l) => ({ ...l, qty: Number.isFinite(v) ? Math.max(0, v) : 0 }));
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
                  value={choice.unitPrice || ""}
                  placeholder="Enter"
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setChoiceRate(line.id, opt, Number.isFinite(v) ? Math.max(0, v) : undefined);
                  }}
                  className={cx(
                    "w-24 rounded-md border bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-gold",
                    choice.unitPrice ? "border-hairline" : "border-gold/60",
                  )}
                />
              </label>
            )}
            {(sys || first) && (
              <DiscountInput
                label={optionCount > 1 ? "Discount (all options)" : "Discount"}
                value={line.discount}
                onChange={(d) => patchLine(line.id, (l) => ({ ...l, discount: d }))}
              />
            )}
          </div>
          <span className="text-right text-sm tabular-nums">
            {lineCalc && lineCalc.discount > 0 && (
              <span className="mr-1.5 text-xs text-faint line-through">{money(lineCalc.gross)}</span>
            )}
            <span className={(lineCalc?.total ?? 0) > 0 ? "text-ink" : "text-faint"}>
              {money(lineCalc?.total ?? 0)}
            </span>
          </span>
        </div>
        {needsRate && !choice.unitPrice && (
          <p className="-mt-1 text-[11px] text-faint">
            No catalogue price for this item. Enter the rate to include it.
          </p>
        )}

        {/* Photo + specs right on the light: always when the blueprint takes the
            wide column, otherwise only below xl (the side column has them). */}
        {(previewSys || sys) && (
          <div className={draft.blueprint ? undefined : "xl:hidden"}>
            {previewSys ? (
              <LightDetails
                key={`preview-${previewSys.id}`}
                sys={previewSys}
                unitPrice={previewSys.unitCost}
                badge="Preview"
                compact
              />
            ) : (
              <LightDetails
                key={choice.systemId}
                sys={sys!}
                qty={line.qty}
                unitPrice={unit}
                variant={variantLabel(choice)}
                compact
              />
            )}
          </div>
        )}
      </div>
    );
  };

  /* ---------------------------------- page ---------------------------------- */

  const navigator = (
    <RoomNavigator
      rooms={rooms}
      currentRoomId={room.id}
      activeLineId={activeLineId}
      onSelectLine={jumpTo}
      onAddLine={addLine}
    />
  );

  return (
    <div className="space-y-5 lg:relative lg:left-1/2 lg:w-[min(96rem,calc(100vw-3rem))] lg:-translate-x-1/2">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">Lighting</h1>
        {draft.editOf && (
          <p className="mt-1 text-sm text-muted">
            Editing <span className="font-medium text-ink">{draft.editOf}</span> ·{" "}
            <Link href="/new" className="font-medium text-gold-deep hover:underline">
              {draft.blueprint ? "Change blueprint" : "Add a blueprint"}
            </Link>
          </p>
        )}
        <div className="mt-4">
          <WizardSteps current={3} />
        </div>
      </div>

      <div
        className={cx(
          "grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]",
          draft.blueprint
            ? "xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,460px)]"
            : "xl:grid-cols-[260px_minmax(0,1fr)_380px]",
        )}
      >
        {/* Left: rooms and their lights */}
        <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-1">
          <Eyebrow>Rooms &amp; lights</Eyebrow>
          <div className="mt-2">{navigator}</div>
        </aside>

        {/* Centre (xl): the blueprint, always in view */}
        {draft.blueprint && (
          <div className="hidden min-w-0 xl:sticky xl:top-24 xl:block xl:h-[calc(100dvh-8rem)]">
            <BlueprintViewer src={draft.blueprint.previewDataUrl} className="h-full w-full" />
          </div>
        )}

        {/* Middle: the room being edited */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Phones / tablets: the navigator folds out from here */}
          <div className="rounded-[var(--radius-card)] border border-hairline lg:hidden">
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              aria-expanded={navOpen}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="text-faint">Rooms &amp; lights · </span>
                <span className="text-ink">
                  {index + 1}/{rooms.length} {room.name}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-gold-deep">
                {navOpen ? "Close" : "Open"}
              </span>
            </button>
            {navOpen && <div className="border-t border-hairline p-2">{navigator}</div>}
          </div>

          {/* Room header */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 basis-full sm:basis-0">
              <p className="text-xs text-faint">
                Room {index + 1} of {rooms.length}
              </p>
              <h2 className="truncate font-display text-3xl leading-tight text-ink-deep">
                {room.name}
              </h2>
            </div>
            <OptionCountControl
              value={optionCount}
              onChange={(n) => {
                setOptionCount(n);
                if (activeOpt >= n) setActiveOpt(0);
              }}
            />
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
          {optionCount > 1 && (
            <p className="-mt-2 text-xs text-muted">
              Each light can show a different product in every option. Lights you leave
              alone use the Option 1 product in all options.
            </p>
          )}

          {/* Blueprint, below xl (the side column holds it on wide screens) */}
          {draft.blueprint && (
            <div className="xl:hidden">
              <button
                type="button"
                onClick={() => setShowBlueprint((v) => !v)}
                className="text-xs font-medium text-gold-deep hover:underline"
              >
                {showBlueprint ? "Hide blueprint" : "Show blueprint"}
              </button>
              {showBlueprint && (
                <div className="mt-2 h-[45vh] min-h-64">
                  <BlueprintViewer src={draft.blueprint.previewDataUrl} className="h-full w-full" />
                </div>
              )}
            </div>
          )}

          {/* Lights */}
          <div className="space-y-2">
            {lines.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-hairline bg-panel/50 p-5 text-center text-sm text-muted">
                No lighting added to this room yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {lines.map((line, i) => {
                  const active = line.id === activeLineId;
                  return (
                    <li
                      key={line.id}
                      id={`line-${line.id}`}
                      className={cx(
                        "scroll-mt-24 rounded-[var(--radius-card)] border transition-colors",
                        active ? "border-gold shadow-sm" : "border-hairline hover:border-muted",
                      )}
                    >
                      {active ? renderExpanded(line, i + 1) : renderCollapsed(line, i + 1)}
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={addLine}
              className="flex h-11 w-full items-center justify-center rounded-[var(--radius-card)] border border-dashed border-gold/60 text-sm font-medium text-gold-deep hover:bg-gold-tint/60"
            >
              + Add light
            </button>
          </div>

          {/* Auto accessories */}
          {computed.accessories.length > 0 && (
            <div className="space-y-2">
              <Eyebrow>
                Connectors &amp; drivers (auto){optionCount > 1 ? `, ${optionLabel(opt)}` : ""}
              </Eyebrow>
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

          {/* Room subtotal, per option */}
          <div className="rounded-[var(--radius-card)] border border-gold/40 bg-gold-tint/50 p-4">
            {optionCount === 1 ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl text-ink-deep">Room subtotal</span>
                  <span className="font-display text-xl tabular-nums text-ink-deep">
                    {money(computed.subtotal)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  Lighting {money(computed.systemsTotal)} · Connectors/drivers{" "}
                  {money(computed.accessoriesTotal)}
                  {computed.discount > 0 && (
                    <>
                      {" "}
                      · Room discount
                      {computed.discountLabel.endsWith("%") ? ` (${computed.discountLabel})` : ""} −
                      {money(computed.discount)}
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="font-display text-xl text-ink-deep">Room subtotal</span>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  {perOption.map((c, o) => (
                    <div
                      key={o}
                      className={cx(
                        "rounded-md border bg-paper px-2 py-1.5",
                        o === opt ? "border-gold" : "border-hairline",
                      )}
                    >
                      <dt className="text-[11px] uppercase tracking-wider text-faint">
                        {optionLabel(o)}
                      </dt>
                      <dd className="font-display text-lg tabular-nums text-ink-deep">
                        {money(c.subtotal)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <DiscountInput
              label={optionCount > 1 ? "Room discount (all options)" : "Room discount"}
              className="mt-2"
              value={room.discount}
              onChange={(d) => setRoomDiscount(room.id, d)}
            />
            <p className="mt-1 text-xs text-faint">GST is added once, on the final quotation.</p>
          </div>

          {/* Nav */}
          <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
            <ButtonLink href="/new/rooms" variant="ghost">
              Room list
            </ButtonLink>
            {isLast ? (
              <ButtonLink href="/new/summary">Review summary</ButtonLink>
            ) : (
              <ButtonLink href={`/new/rooms/${rooms[index + 1].id}`}>Next room →</ButtonLink>
            )}
          </div>
        </div>

        {/* Right (xl, no blueprint): photos + specs of the selected light */}
        {!draft.blueprint && (
          <aside className="hidden min-w-0 xl:sticky xl:top-24 xl:block xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:pr-1">
            <div className="mb-3">
              <Eyebrow>Photos &amp; specs</Eyebrow>
            </div>
            {detailsPanel}
          </aside>
        )}
      </div>
    </div>
  );
}

function AltActions({ onSame, onOmit, opt }: { onSame: () => void; onOmit: () => void; opt: number }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <button type="button" onClick={onSame} className="text-muted hover:text-ink hover:underline">
        Use Option 1&apos;s light
      </button>
      <button type="button" onClick={onOmit} className="text-muted hover:text-ink hover:underline">
        Leave out of {optionLabel(opt)}
      </button>
    </div>
  );
}

