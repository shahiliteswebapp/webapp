"use client";

import { useMemo, useState } from "react";
import {
  DECOR_TYPES,
  DECOR_STYLES,
  LAYER_LABEL,
  LIGHTING_SYSTEMS,
  UNIT_LABEL,
  getSystem,
  type DecorativeSystem,
  type FunctionalSystem,
} from "@/lib/catalog";
import {
  LAYER_OPTIONS,
  availableControls,
  availableInterfaces,
  decorativeOptions,
  filterDecorative,
  filterFunctional,
  functionalOptions,
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

function priceForFunctional(sys: FunctionalSystem, picks: FunctionalPicks): number {
  if (picks.automatic && (picks.interfaceTag || picks.control)) {
    const match = sys.interfaceOptions.find(
      (io) =>
        (!picks.interfaceTag || io.interface === picks.interfaceTag) &&
        (!picks.control || io.control === picks.control),
    );
    if (match?.price != null) return match.price;
  }
  return sys.unitCost;
}

export function LightingFilterPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (systemId: string) => void;
}) {
  const selected = value ? getSystem(value) : undefined;
  const [editing, setEditing] = useState(!value);
  const [branch, setBranch] = useState<Branch>("functional");
  const [fPicks, setFPicks] = useState<Partial<FunctionalPicks>>({});
  const [dPicks, setDPicks] = useState<Partial<DecorativePicks>>({});
  const [query, setQuery] = useState("");

  const fCandidates = useMemo(
    () => filterFunctional(LIGHTING_SYSTEMS, fPicks),
    [fPicks],
  );
  const dCandidates = useMemo(
    () => filterDecorative(LIGHTING_SYSTEMS, dPicks),
    [dPicks],
  );

  if (selected && !editing) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-hairline bg-panel/40 px-2 py-1.5 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {selected.name}{" "}
          <span className="text-faint">({money(selected.unitCost)}/{UNIT_LABEL[selected.unit]})</span>
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
  };

  const pick = (id: string) => {
    onChange(id);
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
          onPick={pick}
        />
      ) : (
        <DecorativeFlow
          picks={dPicks}
          setPicks={setDPicks}
          candidates={dCandidates}
          query={query}
          setQuery={setQuery}
          onPick={pick}
        />
      )}

      {value && (
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

/* --------------------------------- Functional --------------------------------- */

function FunctionalFlow({
  picks,
  setPicks,
  candidates,
  query,
  setQuery,
  onPick,
}: {
  picks: Partial<FunctionalPicks>;
  setPicks: (p: Partial<FunctionalPicks>) => void;
  candidates: FunctionalSystem[];
  query: string;
  setQuery: (q: string) => void;
  onPick: (id: string) => void;
}) {
  const set = <K extends keyof FunctionalPicks>(key: K, val: FunctionalPicks[K] | undefined) =>
    setPicks({ ...picks, [key]: val });

  const controls = picks.automatic ? availableControls(candidates) : [];
  const interfaces = picks.automatic ? availableInterfaces(candidates, picks.control) : [];
  const sizes = functionalOptions(candidates, "size");
  const finishes = functionalOptions(candidates, "finish");
  const cutouts = functionalOptions(candidates, "cutout");
  const watts = functionalOptions(candidates, "watt");

  const filtered = query
    ? candidates.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.sourceCode.toLowerCase().includes(query.toLowerCase()),
      )
    : candidates;

  return (
    <div className="space-y-2">
      <FieldRow label="Layer">
        <select
          className={selectClass}
          value={picks.layer ?? ""}
          onChange={(e) => set("layer", e.target.value ? (Number(e.target.value) as FunctionalPicks["layer"]) : undefined)}
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
            set("automatic", v === "" ? undefined : v === "yes");
            set("control", undefined);
            set("interfaceTag", undefined);
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
              onChange={(e) => set("control", (e.target.value || undefined) as FunctionalPicks["control"])}
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
              onChange={(e) => set("interfaceTag", (e.target.value || undefined) as FunctionalPicks["interfaceTag"])}
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

      <div className="border-t border-hairline pt-2">
        <p className="pb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          Size &middot; Finish &middot; Cutout &middot; Watt
        </p>
        <div className="space-y-1.5">
          <FieldRow label="Size">
            <select className={selectClass} value={picks.size ?? ""} onChange={(e) => set("size", e.target.value || undefined)}>
              <option value="">Any ({sizes.length})</option>
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Finish">
            <select className={selectClass} value={picks.finish ?? ""} onChange={(e) => set("finish", e.target.value || undefined)}>
              <option value="">Any ({finishes.length})</option>
              {finishes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Cutout">
            <select className={selectClass} value={picks.cutout ?? ""} onChange={(e) => set("cutout", e.target.value || undefined)}>
              <option value="">Any ({cutouts.length})</option>
              {cutouts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Watt">
            <select className={selectClass} value={picks.watt ?? ""} onChange={(e) => set("watt", e.target.value || undefined)}>
              <option value="">Any ({watts.length})</option>
              {watts.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </FieldRow>
        </div>
      </div>

      <ResultList
        candidates={filtered}
        total={candidates.length}
        query={query}
        setQuery={setQuery}
        onPick={onPick}
        priceFor={(s) => priceForFunctional(s, picks as FunctionalPicks)}
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
}: {
  picks: Partial<DecorativePicks>;
  setPicks: (p: Partial<DecorativePicks>) => void;
  candidates: DecorativeSystem[];
  query: string;
  setQuery: (q: string) => void;
  onPick: (id: string) => void;
}) {
  const set = <K extends keyof DecorativePicks>(key: K, val: DecorativePicks[K] | undefined) =>
    setPicks({ ...picks, [key]: val });

  const mountings = decorativeOptions(candidates, "mounting");
  const styles = decorativeOptions(candidates, "style");
  const showIndoorOutdoor = picks.decorType === "Wall light";
  const showMounting = !showIndoorOutdoor && mountings.length > 0;

  const filtered = query
    ? candidates.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.sourceCode.toLowerCase().includes(query.toLowerCase()),
      )
    : candidates;

  return (
    <div className="space-y-2">
      <FieldRow label="Type">
        <select
          className={selectClass}
          value={picks.decorType ?? ""}
          onChange={(e) => {
            set("decorType", e.target.value || undefined);
            set("mounting", undefined);
            set("indoorOutdoor", undefined);
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
            onChange={(e) => set("indoorOutdoor", (e.target.value || undefined) as DecorativePicks["indoorOutdoor"])}
          >
            <option value="">Any</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </FieldRow>
      )}

      {showMounting && (
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

      {styles.length > 0 && (
        <FieldRow label="Style">
          <select className={selectClass} value={picks.style ?? ""} onChange={(e) => set("style", e.target.value || undefined)}>
            <option value="">Any</option>
            {styles.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FieldRow>
      )}

      {candidates.length > 0 && candidates.every((c) => c.unitCost === 0) && (
        <p className="text-[11px] text-faint">
          No price on file for these yet — client hasn&rsquo;t supplied a priced decorative sheet.
        </p>
      )}

      <ResultList
        candidates={filtered}
        total={candidates.length}
        query={query}
        setQuery={setQuery}
        onPick={onPick}
        priceFor={(s) => s.unitCost}
      />
    </div>
  );
}

/* ----------------------------------- Results ----------------------------------- */

function ResultList<T extends { id: string; name: string; unit: string }>({
  candidates,
  total,
  query,
  setQuery,
  onPick,
  priceFor,
}: {
  candidates: T[];
  total: number;
  query: string;
  setQuery: (q: string) => void;
  onPick: (id: string) => void;
  priceFor: (s: T) => number;
}) {
  return (
    <div className="border-t border-hairline pt-2">
      <div className="flex items-center justify-between pb-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
          Matches ({total})
        </p>
        {total > 8 && (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or name…"
            className="w-36 rounded-md border border-hairline bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
          />
        )}
      </div>
      {candidates.length === 0 ? (
        <p className="py-2 text-center text-xs text-faint">No systems match these filters.</p>
      ) : (
        <ul className="max-h-56 divide-y divide-hairline overflow-y-auto rounded-md border border-hairline bg-paper">
          {candidates.slice(0, 200).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s.id)}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-gold-tint"
              >
                <span className="min-w-0 truncate">{s.name}</span>
                <span className="shrink-0 tabular-nums text-faint">{money(priceFor(s))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
