"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
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

export interface LinePick {
  systemId: string;
  interfaceTag?: InterfaceTag;
  control?: ControlMode;
}

export function LightingFilterPicker({
  value,
  onChange,
  onPreview,
}: {
  value: LinePick & { unitPrice?: number };
  onChange: (pick: LinePick) => void;
  /** candidate under the pointer / focus while browsing, null when none */
  onPreview?: (systemId: string | null) => void;
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

  return (
    <div className="space-y-2 rounded-md border border-hairline bg-panel/30 p-2.5">
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
          query={query}
          setQuery={setQuery}
          onPick={pickFunctional}
          onPreview={onPreview}
        />
      ) : (
        <DecorativeFlow
          picks={dPicks}
          setPicks={setDPicks}
          candidates={dCandidates}
          query={query}
          setQuery={setQuery}
          onPick={pickDecorative}
          onPreview={onPreview}
        />
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

function matchesQuery(s: { name: string; sourceCode: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || s.name.toLowerCase().includes(q) || s.sourceCode.toLowerCase().includes(q);
}

/* --------------------------------- Functional --------------------------------- */

function FunctionalFlow({
  picks,
  setPicks,
  candidates,
  query,
  setQuery,
  onPick,
  onPreview,
}: {
  picks: Partial<FunctionalPicks>;
  setPicks: Dispatch<SetStateAction<Partial<FunctionalPicks>>>;
  candidates: FunctionalSystem[];
  query: string;
  setQuery: (q: string) => void;
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

  const filtered = candidates.filter((s) => matchesQuery(s, query));
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
        candidates={filtered}
        total={candidates.length}
        query={query}
        setQuery={setQuery}
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
  query,
  setQuery,
  onPick,
  onPreview,
}: {
  picks: Partial<DecorativePicks>;
  setPicks: Dispatch<SetStateAction<Partial<DecorativePicks>>>;
  candidates: DecorativeSystem[];
  query: string;
  setQuery: (q: string) => void;
  onPick: (id: string) => void;
  onPreview?: (id: string | null) => void;
}) {
  const set = <K extends keyof DecorativePicks>(key: K, val: DecorativePicks[K] | undefined) =>
    setPicks((prev) => ({ ...prev, [key]: val }));

  const mountings = decorativeTagOptions(candidates, "mountingTags");
  const styles = decorativeTagOptions(candidates, "styleTags");
  const showIndoorOutdoor = picks.decorType === "Wall light";

  const filtered = candidates.filter((s) => matchesQuery(s, query));

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
        candidates={filtered}
        total={candidates.length}
        query={query}
        setQuery={setQuery}
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
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded border border-hairline bg-panel/60">
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

function ResultList<T extends { id: string; name: string; unit: string }>({
  candidates,
  total,
  query,
  setQuery,
  onPick,
  onPreview,
  priceFor,
}: {
  candidates: T[];
  total: number;
  query: string;
  setQuery: (q: string) => void;
  onPick: (id: string) => void;
  onPreview?: (id: string | null) => void;
  priceFor: (s: T) => number;
}) {
  return (
    <div className="border-t border-hairline pt-2">
      <div className="flex items-center justify-between gap-2 pb-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
          Matches ({candidates.length}
          {candidates.length !== total ? ` of ${total}` : ""})
        </p>
        {total > 8 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or name"
            className="w-40 rounded-md border border-hairline bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
          />
        )}
      </div>
      {candidates.length === 0 ? (
        <p className="py-2 text-center text-xs text-faint">No systems match these filters.</p>
      ) : (
        <>
          <ul
            onMouseLeave={() => onPreview?.(null)}
            className="max-h-72 divide-y divide-hairline overflow-y-auto rounded-md border border-hairline bg-paper"
          >
            {candidates.slice(0, MAX_RESULTS).map((s) => {
              const price = priceFor(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onPick(s.id)}
                    onMouseEnter={() => onPreview?.(s.id)}
                    onFocus={() => onPreview?.(s.id)}
                    className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-gold-tint focus:bg-gold-tint focus:outline-none"
                  >
                    <Thumb id={s.id} />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 tabular-nums text-faint">
                      {price > 0 ? money(price) : "No price"}
                    </span>
                  </button>
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
