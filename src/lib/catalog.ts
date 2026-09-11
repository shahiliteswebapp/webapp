/*
 * Real lighting catalog, imported from the client's source documents:
 *   - functional fixtures: rawdata/ECO 25-26 (V 1.5).pdf, rawdata/Architectural Product list -Dec'25.pdf
 *   - decorative fixtures: rawdata/Geo Liting Hanging & Celliling Light Part 1.pdf, rawdata/Geo Liting Mix 1 Updated.pdf
 * Parsed once into catalog-data.json (see scripts used at import time — not part of the app).
 *
 * Decorative items (Geo Liting) carry unitCost 0: the source catalogue has no price column,
 * only item no / lamp / size / finish / material. Needs a priced sheet from the client before
 * decorative lines can go into a real quotation.
 *
 * `layer`, `mounting`, `style`, `indoorOutdoor` are not present in any source document — they're
 * either an inferred category→layer mapping (functional) or left null pending client tagging
 * (decorative). Accessory auto-add `rules` are empty for every real system: no accessory-trigger
 * data exists for the real catalog yet, unlike the old placeholder set.
 */

import catalogData from "./catalog-data.json";

export type Unit = "nos" | "mtr";

export type InterfaceTag = "RF" | "DALI" | "BLE" | "PRO" | "TRIAC" | "DIMMABLE" | "TUNABLE";
export type ControlMode = "dimmable" | "tunable";

/** One automation upsell for a system: total price when that interface/control is chosen. */
export interface InterfaceOption {
  interface: InterfaceTag;
  control: ControlMode;
  price: number | null;
}

/** One finish/colour price variant (distinct from automation upsells). */
export interface FinishOption {
  label: string;
  price: number;
}

export interface Accessory {
  id: string;
  name: string;
  unit: Unit;
  unitCost: number; // INR
}

export interface AccessoryRule {
  accessoryId: string;
  /** one accessory is added per this many units of the parent system (ceil) */
  perUnits: number;
}

/** Layer 1 Ambient/Direct · 2 Indirect · 3 Accent · 4 Task · 5 Outdoor · 6 Facade */
export type Layer = 1 | 2 | 3 | 4 | 5 | 6;

export const LAYER_LABEL: Record<Layer, string> = {
  1: "Ambient / Direct",
  2: "Indirect",
  3: "Accent",
  4: "Task",
  5: "Outdoor",
  6: "Facade",
};

interface BaseSystem {
  id: string;
  sourceCode: string;
  name: string;
  unit: Unit;
  unitCost: number; // INR, base (on/off) price
  rules: AccessoryRule[];
  automatic: boolean;
  interfaceOptions: InterfaceOption[];
  source: string;
}

export interface FunctionalSystem extends BaseSystem {
  kind: "functional";
  category: string;
  layer: Layer | null;
  finishOptions: FinishOption[];
  size: string | null;
  cutout: string | null;
  finish: string | null;
  watt: string | null;
  wattNum: number | null;
  ledSource: string | null;
  ipRating: string | null;
  colour: string | null;
}

export const DECOR_TYPES = [
  "Chandelier",
  "Wall light",
  "Hanging light",
  "Bed side light",
  "Mirror light",
  "Picture light",
] as const;
export type DecorType = (typeof DECOR_TYPES)[number];

export const DECOR_STYLES = ["modern", "classical", "rustic"] as const;
export type DecorStyle = (typeof DECOR_STYLES)[number];

export interface DecorativeSystem extends BaseSystem {
  kind: "decorative";
  decorType: string;
  mounting: string | null; // e.g. ceiling mounted / suspended / staircase / double height (chandeliers)
  style: string | null; // modern / classical / rustic
  indoorOutdoor: "indoor" | "outdoor" | null;
  size: string | null;
  finish: string | null;
  material: string | null;
  lamp: string | null;
  sku: string | null;
}

export type LightingSystem = FunctionalSystem | DecorativeSystem;

export const LIGHTING_SYSTEMS = catalogData as unknown as LightingSystem[];

export const ACCESSORIES: Accessory[] = [
  { id: "drv-4", name: "LED Driver (up to 4 spots)", unit: "nos", unitCost: 380 },
  { id: "drv-3", name: "LED Driver (up to 3 spots)", unit: "nos", unitCost: 420 },
  { id: "drv-profile", name: "Profile LED Driver", unit: "nos", unitCost: 560 },
  { id: "con-profile", name: "Profile Straight Connector", unit: "nos", unitCost: 90 },
  { id: "drv-strip", name: "Strip LED Driver", unit: "nos", unitCost: 600 },
  { id: "con-strip", name: "Strip Joiner Connector", unit: "nos", unitCost: 70 },
  { id: "con-track", name: "Magnetic Track Connector", unit: "nos", unitCost: 160 },
  { id: "drv-track", name: "Magnetic Track Driver", unit: "nos", unitCost: 1450 },
  { id: "kit-canopy", name: "Ceiling Canopy Kit", unit: "nos", unitCost: 450 },
  { id: "kit-canopy-sm", name: "Pendant Canopy Kit", unit: "nos", unitCost: 300 },
];

const SYSTEM_BY_ID = new Map(LIGHTING_SYSTEMS.map((s) => [s.id, s]));
const ACCESSORY_BY_ID = new Map(ACCESSORIES.map((a) => [a.id, a]));

export function getSystem(id: string): LightingSystem | undefined {
  return SYSTEM_BY_ID.get(id);
}

export function getAccessory(id: string): Accessory | undefined {
  return ACCESSORY_BY_ID.get(id);
}

export const UNIT_LABEL: Record<Unit, string> = { nos: "nos", mtr: "m" };
