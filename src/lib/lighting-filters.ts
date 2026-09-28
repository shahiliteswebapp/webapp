/*
 * Filter-driven narrowing for the "select a lighting system" step, per the
 * client-approved flow (WhatsApp, 2026-09-10):
 *
 *   Filters -> Decorative | Functional
 *
 *   Decorative -> Type (Chandelier / Wall light / Hanging light / Bed side /
 *                 Mirror / Picture) -> type-specific sub-filter -> Style
 *                 (modern / classical / rustic, common to all types)
 *
 *   Functional -> Layer -> Glare -> Automatic?
 *                   -> yes: Dimmable / Dimmable+Tunable -> Interface (RF/TRIAC/PRO/BLE/DALI)
 *                   -> no: (skip)
 *                 -> Notes: Size -> Finish -> Cutout -> Watt
 *
 * Every step here only narrows on fields that exist in the real catalog data
 * (see catalog.ts). Decorative type / mounting / style come from the client's
 * chandeliers chart (scripts/merge-decorative.py). Glare isn't tagged on any
 * record yet, so that pick is accepted but doesn't remove candidates.
 */

import type {
  ControlMode,
  DecorativeSystem,
  FunctionalSystem,
  InterfaceTag,
  Layer,
  LightingSystem,
} from "./catalog";

export type Branch = "functional" | "decorative";

export interface FunctionalPicks {
  branch: "functional";
  layer?: Layer;
  glare?: "no-glare" | "some-glare"; // informational only, see file header
  automatic?: boolean;
  control?: ControlMode;
  interfaceTag?: InterfaceTag;
  size?: string;
  finish?: string;
  cutout?: string;
  watt?: string;
}

export interface DecorativePicks {
  branch: "decorative";
  decorType?: string;
  mounting?: string;
  indoorOutdoor?: "indoor" | "outdoor";
  style?: string;
}

export type FilterPicks = FunctionalPicks | DecorativePicks;

export function isFunctional(sys: LightingSystem): sys is FunctionalSystem {
  return sys.kind === "functional";
}

export function isDecorative(sys: LightingSystem): sys is DecorativeSystem {
  return sys.kind === "decorative";
}

function uniqueSorted<T>(values: (T | null | undefined)[]): T[] {
  const set = new Set<T>();
  for (const v of values) if (v !== null && v !== undefined && v !== "") set.add(v);
  return [...set].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
}

/** Narrow the functional pool by every pick that's been made so far. */
export function filterFunctional(
  systems: LightingSystem[],
  picks: Partial<FunctionalPicks>,
): FunctionalSystem[] {
  return systems.filter(isFunctional).filter((s) => {
    if (picks.layer !== undefined && s.layer !== picks.layer) return false;
    if (picks.automatic !== undefined && s.automatic !== picks.automatic) return false;
    if (picks.control !== undefined && !s.interfaceOptions.some((io) => io.control === picks.control))
      return false;
    if (
      picks.interfaceTag !== undefined &&
      !s.interfaceOptions.some(
        (io) => io.interface === picks.interfaceTag && (!picks.control || io.control === picks.control),
      )
    )
      return false;
    if (picks.size !== undefined && s.size !== picks.size) return false;
    if (picks.finish !== undefined && s.finish !== picks.finish) return false;
    if (picks.cutout !== undefined && s.cutout !== picks.cutout) return false;
    if (picks.watt !== undefined && s.watt !== picks.watt) return false;
    // glare has no data on any record yet — not filtered, see file header
    return true;
  });
}

/** Narrow the decorative pool by every pick that's been made so far. */
export function filterDecorative(
  systems: LightingSystem[],
  picks: Partial<DecorativePicks>,
): DecorativeSystem[] {
  return systems.filter(isDecorative).filter((s) => {
    if (picks.decorType !== undefined && s.decorType !== picks.decorType) return false;
    if (picks.mounting !== undefined && !(s.mountingTags ?? []).includes(picks.mounting)) return false;
    if (picks.indoorOutdoor !== undefined && s.indoorOutdoor !== picks.indoorOutdoor) return false;
    if (picks.style !== undefined && !(s.styleTags ?? []).includes(picks.style)) return false;
    return true;
  });
}

/** Values available for one functional field, given the candidates matching every OTHER pick so far. */
export function functionalOptions<K extends keyof FunctionalSystem>(
  candidates: FunctionalSystem[],
  field: K,
): NonNullable<FunctionalSystem[K]>[] {
  return uniqueSorted(candidates.map((s) => s[field])) as NonNullable<FunctionalSystem[K]>[];
}

export function decorativeOptions<K extends keyof DecorativeSystem>(
  candidates: DecorativeSystem[],
  field: K,
): NonNullable<DecorativeSystem[K]>[] {
  return uniqueSorted(candidates.map((s) => s[field])) as NonNullable<DecorativeSystem[K]>[];
}

/** Tag values (mounting / style) present in the current decorative pool. */
export function decorativeTagOptions(
  candidates: DecorativeSystem[],
  field: "mountingTags" | "styleTags",
): string[] {
  return uniqueSorted(candidates.flatMap((s) => s[field] ?? []));
}

/** Control modes (dimmable / tunable) actually offered by the current candidate pool. */
export function availableControls(candidates: FunctionalSystem[]): ControlMode[] {
  return uniqueSorted(candidates.flatMap((s) => s.interfaceOptions.map((io) => io.control)));
}

/** Interface tags actually offered by the current candidate pool (for automatic functional systems). */
export function availableInterfaces(
  candidates: FunctionalSystem[],
  control?: ControlMode,
): InterfaceTag[] {
  const tags = candidates.flatMap((s) =>
    s.interfaceOptions.filter((io) => !control || io.control === control).map((io) => io.interface),
  );
  return uniqueSorted(tags);
}

export const LAYER_OPTIONS: Layer[] = [1, 2, 3, 4, 5, 6];
