"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import {
  DECOR_TYPES,
  LAYER_LABEL,
  LIGHTING_SYSTEMS,
  UNIT_LABEL,
  getSystem,
  systemImages,
  unitPriceFor,
  variantLabel,
  type ControlMode,
  type DecorativeSystem,
  type FunctionalSystem,
  type InterfaceTag,
} from "@/lib/catalog";
import {
  LAYER_OPTIONS,
  availableControls,
  availableInterfaces,
  decorativeTagOptions,
  filterDecorative,
  filterFunctional,
  type Branch,
  type DecorativePicks,
  type FunctionalPicks,
} from "@/lib/lighting-filters";
import { money } from "@/lib/format";
import { cx } from "@/lib/cx";

const selectClass =
  "min-w-0 flex-1 rounded-md border border-hairline bg-paper px-2 py-1.5 text-sm outline-none focus:border-gold";

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/*
 * Laptops (mouse / trackpad): a click highlights a light, the arrow keys move
 * the highlight inside the list, and Select / Enter / double-click picks it.
 * Phones and tablets: scroll the list and tap a light to pick it.
 */
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

function useFinePointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(FINE_POINTER);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(FINE_POINTER).matches,
    () => false,
  );
}

export interface LinePick {
  systemId: string;
  interfaceTag?: InterfaceTag;
  control?: ControlMode;
}

export function LightingFilterPicker({
  value,
  onChange,
  onPreview,
  autoFocus,
}: {
  value: LinePick & { unitPrice?: number };
  onChange: (pick: LinePick) => void;
  /** candidate under the pointer / focus while browsing, null when none */
  onPreview?: (systemId: string | null) => void;
  /** focus the search box when the picker opens */
  autoFocus?: boolean;
}) {
  const selected = value.systemId ? getSystem(value.systemId) : undefined;
  const [editing, setEditingState] = useState(!value.systemId);
  const [branch, setBranch] = useState<Branch>("functional");
  const [fPicks, setFPicks] = useState<Partial<FunctionalPicks>>({});
  const [dPicks, setDPicks] = useState<Partial<DecorativePicks>>({});
  const [query, setQuery] = useState("");

  const setEditing = (v: boolean) => {
    setEditingState(v);
    if (!v) onPreview?.(null);
  };

  const fCandidates = useMemo(
    () => filterFunctional(LIGHTING_SYSTEMS, fPicks),
    [fPicks],
  );
  const searchResults = useMemo(
    () => (query.trim() ? searchAll(query) : []),
    [query],
  );
  const dCandidates = useMemo(
    // Items with catalogue photos first (stable sort keeps catalogue order).
    () =>
      filterDecorative(LIGHTING_SYSTEMS, dPicks).sort(
        (x, y) => Number(y.images.length > 0) - Number(x.images.length > 0),
      ),
    [dPicks],
  );

  if (selected && !editing) {
    const variant = variantLabel(value);
    const price = unitPriceFor(selected, value);
    return (
      <div className="flex items-center gap-2 rounded-md border border-hairline bg-panel/40 px-2 py-1.5 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {selected.name}
          {variant && <span className="text-muted"> · {variant}</span>}{" "}
          <span className="text-faint">
            ({price > 0 ? money(price) : "no price"}/{UNIT_LABEL[selected.unit]})
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setQuery("");
          }}
          className="shrink-0 text-xs font-medium text-gold hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  const reset = () => {
    setFPicks({});
    setDPicks({});
    setQuery("");
    onPreview?.(null);
  };

  const pickFunctional = (id: string) => {
    onChange({
      systemId: id,
      interfaceTag: fPicks.automatic ? fPicks.interfaceTag : undefined,
      control: fPicks.automatic ? fPicks.control : undefined,
    });
    setEditing(false);
  };

  const pickDecorative = (id: string) => {
    onChange({ systemId: id });
    setEditing(false);
  };

  const searching = query.trim().length > 0;

  return (
    <div className="space-y-2 rounded-md border border-hairline bg-panel/30 p-2.5">
      {/* One search over the whole catalogue: the fastest way to a known code. */}
      <div className="relative">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any light by code or name"
          className="w-full rounded-md border border-hairline bg-paper py-2 pl-8 pr-2 text-sm outline-none focus:border-gold"
        />
      </div>

      {searching ? (
        <ResultList
          candidates={searchResults}
          total={LIGHTING_SYSTEMS.length}
          onPick={(id) => (getSystem(id)?.kind === "functional" ? pickFunctional(id) : pickDecorative(id))}
          onPreview={onPreview}
          priceFor={(s) => s.unitCost}
          heading="Search results"
        />
      ) : (
        <>
      {/* Branch toggle */}
      <div className="flex overflow-hidden rounded-md border border-hairline text-xs font-medium">
        {(["functional", "decorative"] as Branch[]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => {
              setBranch(b);
              reset();
            }}
            className={cx(
              "flex-1 px-2 py-1.5 capitalize transition-colors",
              branch === b ? "bg-gold text-paper" : "bg-paper text-muted hover:bg-panel",
            )}
          >
            {b}
          </button>
        ))}
      </div>

      {branch === "functional" ? (
        <FunctionalFlow
          picks={fPicks}
          setPicks={setFPicks}
          candidates={fCandidates}
          onPick={pickFunctional}
          onPreview={onPreview}
        />
      ) : (
        <DecorativeFlow
          picks={dPicks}
          setPicks={setDPicks}
          candidates={dCandidates}
          onPick={pickDecorative}
          onPreview={onPreview}
        />
      )}
        </>
      )}

      {value.systemId && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-faint hover:text-muted"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/** Every system whose code or name contains the query; code matches first. */
function searchAll(query: string) {
  const q = query.trim().toLowerCase();
  const compact = q.replace(/[\s-]+/g, "");
  const hits: { s: (typeof LIGHTING_SYSTEMS)[number]; rank: number }[] = [];
  for (const s of LIGHTING_SYSTEMS) {
    const code = s.sourceCode.toLowerCase().replace(/[\s-]+/g, "");
    const name = s.name.toLowerCase();
    const rank = code.startsWith(compact) ? 0 : code.includes(compact) ? 1 : name.includes(q) ? 2 : -1;
    if (rank >= 0) hits.push({ s, rank });
  }
  return hits.sort((a, b) => a.rank - b.rank).map((h) => h.s);
}

/* --------------------------------- Functional --------------------------------- */

function FunctionalFlow({
  picks,
  setPicks,
  candidates,
  onPick,
  onPreview,
}: {
  picks: Partial<FunctionalPicks>;
  setPicks: Dispatch<SetStateAction<Partial<FunctionalPicks>>>;
  candidates: FunctionalSystem[];
  onPick: (id: string) => void;
  onPreview?: (id: string | null) => void;
}) {
  // Functional updates: a handler may change several fields, and spreading a
  // stale `picks` would keep only the last one.
  const set = <K extends keyof FunctionalPicks>(key: K, val: FunctionalPicks[K] | undefined) =>
    setPicks((prev) => ({ ...prev, [key]: val }));

  const controls = picks.automatic ? availableControls(candidates) : [];
  const interfaces = picks.automatic ? availableInterfaces(candidates, picks.control) : [];
  // Size / finish / cutout / watt are not filters: they show as specs under
  // the product photo (light-details.tsx).

  const variant = picks.automatic
    ? { interfaceTag: picks.interfaceTag, control: picks.control }
    : {};

  return (
    <div className="space-y-2">
      <FieldRow label="Layer">
        <select
          className={selectClass}
          value={picks.layer ?? ""}
          onChange={(e) =>
            set("layer", e.target.value ? (Number(e.target.value) as FunctionalPicks["layer"]) : undefined)
          }
        >
          <option value="">Any</option>
          {LAYER_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}. {LAYER_LABEL[l]}
            </option>
          ))}
        </select>
      </FieldRow>

      <FieldRow label="Glare">
        <select
          className={selectClass}
          value={picks.glare ?? ""}
          onChange={(e) => set("glare", (e.target.value || undefined) as FunctionalPicks["glare"])}
        >
          <option value="">Not specified</option>
          <option value="no-glare">No glare</option>
          <option value="some-glare">Some glare acceptable</option>
        </select>
      </FieldRow>

      <FieldRow label="Automatic">
        <select
          className={selectClass}
          value={picks.automatic === undefined ? "" : picks.automatic ? "yes" : "no"}
          onChange={(e) => {
            const v = e.target.value;
            setPicks((prev) => ({
              ...prev,
              automatic: v === "" ? undefined : v === "yes",
              control: undefined,
              interfaceTag: undefined,
            }));
          }}
        >
          <option value="">Any</option>
          <option value="yes">Automatic</option>
          <option value="no">Non-automatic</option>
        </select>
      </FieldRow>

      {picks.automatic && (
        <>
          <FieldRow label="Control">
            <select
              className={selectClass}
              value={picks.control ?? ""}
              onChange={(e) =>
                setPicks((prev) => ({
                  ...prev,
                  control: (e.target.value || undefined) as FunctionalPicks["control"],
                  interfaceTag: undefined,
                }))
              }
            >
              <option value="">Any</option>
              {controls.map((c) => (
                <option key={c} value={c}>
                  {c === "dimmable" ? "Dimmable" : "Dimmable + Tunable"}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Interface">
            <select
              className={selectClass}
              value={picks.interfaceTag ?? ""}
              onChange={(e) =>
                set("interfaceTag", (e.target.value || undefined) as FunctionalPicks["interfaceTag"])
              }
            >
              <option value="">Any</option>
              {interfaces.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </FieldRow>
        </>
      )}

      <ResultList
        candidates={candidates}
        total={candidates.length}
        onPick={onPick}
        onPreview={onPreview}
        priceFor={(s) => unitPriceFor(s, variant)}
      />
    </div>
  );
}

/* --------------------------------- Decorative --------------------------------- */

function DecorativeFlow({
  picks,
  setPicks,
  candidates,
  onPick,
  onPreview,
}: {
  picks: Partial<DecorativePicks>;
  setPicks: Dispatch<SetStateAction<Partial<DecorativePicks>>>;
  candidates: DecorativeSystem[];
  onPick: (id: string) => void;
  onPreview?: (id: string | null) => void;
}) {
  const set = <K extends keyof DecorativePicks>(key: K, val: DecorativePicks[K] | undefined) =>
    setPicks((prev) => ({ ...prev, [key]: val }));

  const mountings = decorativeTagOptions(candidates, "mountingTags");
  const styles = decorativeTagOptions(candidates, "styleTags");
  const showIndoorOutdoor = picks.decorType === "Wall light";

  return (
    <div className="space-y-2">
      <FieldRow label="Type">
        <select
          className={selectClass}
          value={picks.decorType ?? ""}
          onChange={(e) => {
            const v = e.target.value || undefined;
            setPicks((prev) => ({
              ...prev,
              decorType: v,
              mounting: undefined,
              indoorOutdoor: undefined,
            }));
          }}
        >
          <option value="">Any</option>
          {DECOR_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FieldRow>

      {showIndoorOutdoor && (
        <FieldRow label="Location">
          <select
            className={selectClass}
            value={picks.indoorOutdoor ?? ""}
            onChange={(e) =>
              set("indoorOutdoor", (e.target.value || undefined) as DecorativePicks["indoorOutdoor"])
            }
          >
            <option value="">Any</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </FieldRow>
      )}

      {(mountings.length > 0 || picks.mounting) && (
        <FieldRow label="Mounting">
          <select className={selectClass} value={picks.mounting ?? ""} onChange={(e) => set("mounting", e.target.value || undefined)}>
            <option value="">Any</option>
            {mountings.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </FieldRow>
      )}

      {(styles.length > 0 || picks.style) && (
        <FieldRow label="Style">
          <select className={selectClass} value={picks.style ?? ""} onChange={(e) => set("style", e.target.value || undefined)}>
            <option value="">Any</option>
            {styles.map((s) => (
              <option key={s} value={s}>
                {capitalize(s)}
              </option>
            ))}
          </select>
        </FieldRow>
      )}

      {candidates.some((c) => c.unitCost === 0) && (
        <p className="text-[11px] text-faint">
          Most decorative items have no catalogue price yet. Enter the rate on the line after
          picking one.
        </p>
      )}

      <ResultList
        candidates={candidates}
        total={candidates.length}
        onPick={onPick}
        onPreview={onPreview}
        priceFor={(s) => s.unitCost}
      />
    </div>
  );
}

/* ----------------------------------- Results ----------------------------------- */

/** Small product photo in the match list (hover preview does not exist on touch screens). */
function Thumb({ id }: { id: string }) {
  const sys = getSystem(id);
  const src = sys ? systemImages(sys)[0] : undefined;
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded border border-hairline bg-paper">
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
      ) : null}
    </span>
  );
}

const MAX_RESULTS = 300;

function ResultList<T extends { id: string; name: string; unit: string; sourceCode: string }>({
  candidates,
  total,
  onPick,
  onPreview,
  priceFor,
  heading = "Matches",
}: {
  candidates: T[];
  total: number;
  onPick: (id: string) => void;
  onPreview?: (id: string | null) => void;
  priceFor: (s: T) => number;
  heading?: string;
}) {
  const shown = candidates.slice(0, MAX_RESULTS);
  const fine = useFinePointer();
  const listRef = useRef<HTMLUListElement>(null);
  // Highlighted row; it belongs to one list of candidates, so new filters or a
  // new search start with nothing highlighted.
  const [cursor, setCursor] = useState<{ list: T[]; i: number }>({ list: candidates, i: -1 });
  const hi = cursor.list === candidates ? cursor.i : -1;
  const highlight = (i: number) => {
    setCursor({ list: candidates, i });
    onPreview?.(shown[i]?.id ?? null);
  };

  // Arrow keys only act while the list itself has focus.
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (shown.length === 0) return;
    if (e.key === "ArrowDown") highlight(Math.min(hi + 1, shown.length - 1));
    else if (e.key === "ArrowUp") highlight(Math.max(hi - 1, 0));
    else if (e.key === "Enter" && hi >= 0) onPick(shown[hi].id);
    else return;
    e.preventDefault();
  };

  // Keep the highlighted row inside the list's scroll area.
  useEffect(() => {
    if (hi < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-i="${hi}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  return (
    <div className="border-t border-hairline pt-2">
      <p className="flex items-baseline justify-between gap-2 pb-1 text-[11px] text-faint">
        <span className="font-medium uppercase tracking-wide">
          {heading} ({candidates.length}
          {candidates.length !== total ? ` of ${total}` : ""})
        </span>
        {fine && shown.length > 0 && <span>Click to highlight · ↑ ↓ to move · Enter to select</span>}
      </p>
      {candidates.length === 0 ? (
        <p className="py-2 text-center text-xs text-faint">No lights match.</p>
      ) : (
        <>
          <ul
            ref={listRef}
            role="listbox"
            aria-label={heading}
            aria-activedescendant={hi >= 0 ? `opt-${shown[hi].id}` : undefined}
            tabIndex={fine ? 0 : undefined}
            onKeyDown={fine ? onKeyDown : undefined}
            onMouseLeave={() => onPreview?.(hi >= 0 ? shown[hi].id : null)}
            className="picker-list max-h-[min(26rem,55vh)] divide-y divide-hairline overflow-y-scroll overscroll-contain rounded-md border border-hairline bg-paper outline-none focus-visible:border-gold focus:border-gold"
          >
            {shown.map((s, i) => {
              const price = priceFor(s);
              const on = i === hi;
              return (
                <li
                  key={s.id}
                  id={`opt-${s.id}`}
                  data-i={i}
                  role="option"
                  aria-selected={on}
                  onMouseEnter={() => onPreview?.(s.id)}
                  onClick={() => {
                    if (!fine) return onPick(s.id); // touch: tap selects
                    highlight(i);
                    listRef.current?.focus({ preventScroll: true });
                  }}
                  onDoubleClick={() => fine && onPick(s.id)}
                  className={cx(
                    "flex cursor-pointer select-none items-center justify-between gap-2 px-2 py-1.5 text-left text-xs",
                    on ? "bg-gold-tint ring-1 ring-inset ring-gold" : "hover:bg-panel",
                  )}
                >
                  <Thumb id={s.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{s.name}</span>
                    <span className="block truncate text-[11px] text-faint">{s.sourceCode}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-faint">
                    {price > 0 ? money(price) : "No price"}
                  </span>
                  {fine && on && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPick(s.id);
                      }}
                      className="shrink-0 rounded-full bg-gold px-3 py-1 text-[11px] font-medium text-paper hover:opacity-90"
                    >
                      Select
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {candidates.length > MAX_RESULTS && (
            <p className="pt-1 text-[11px] text-faint">
              Showing the first {MAX_RESULTS}. Narrow the filters or search to see the rest.
            </p>
          )}
        </>
      )}
    </div>
  );
}
