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
  "Hanging light",
  "Ceiling light",
  "Wall light",
  "Mirror light",
  "Picture light",
  "Bed side light",
  "Table / floor lamp",
] as const;
export type DecorType = (typeof DECOR_TYPES)[number];

export const DECOR_STYLES = ["modern", "classical", "crystal"] as const;
export type DecorStyle = (typeof DECOR_STYLES)[number];

export interface DecorativeSystem extends BaseSystem {
  kind: "decorative";
  decorType: string;
  mounting: string | null; // display text, e.g. "Hanging / Staircase"
  mountingTags: string[]; // filterable, from the client's chandeliers chart
  style: string | null; // display text, e.g. "modern / classical"
  styleTags: string[]; // filterable: modern / classical / crystal
  indoorOutdoor: "indoor" | "outdoor" | null;
  size: string | null;
  finish: string | null;
  material: string | null;
  lamp: string | null;
  sku: string | null;
  /** product photo file names (webp), served from CATALOG_IMAGE_BASE */
  images: string[];
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

/*
 * Product photos live in Cloudflare R2 (bucket "shahi-lites-catalog"), uploaded
 * by scripts/upload-catalog-images.mjs. The default is the bucket's public
 * r2.dev URL; NEXT_PUBLIC_CATALOG_IMAGE_BASE overrides it (e.g. a custom
 * domain later, or "/catalog" to serve a local copy from public/catalog/).
 */
const CATALOG_IMAGE_BASE = (
  process.env.NEXT_PUBLIC_CATALOG_IMAGE_BASE ||
  "https://pub-76400aed69e24fb282d2f078fbf133f2.r2.dev"
).replace(/\/+$/, "");

export function catalogImageUrl(file: string): string {
  return `${CATALOG_IMAGE_BASE}/${encodeURIComponent(file)}`;
}

export function systemImages(sys: LightingSystem): string[] {
  return sys.kind === "decorative" ? (sys.images ?? []).map(catalogImageUrl) : [];
}

/**
 * Unit price for one line: the chosen automation variant's price when it has
 * one, else the catalogue price, else (unpriced decorative items only) the
 * rate the employee typed in.
 */
export function unitPriceFor(
  sys: LightingSystem,
  pick: { interfaceTag?: InterfaceTag; control?: ControlMode; unitPrice?: number },
): number {
  if (pick.interfaceTag || pick.control) {
    const match = sys.interfaceOptions.find(
      (io) =>
        (!pick.interfaceTag || io.interface === pick.interfaceTag) &&
        (!pick.control || io.control === pick.control),
    );
    if (match?.price != null) return match.price;
  }
  if (sys.unitCost > 0) return sys.unitCost;
  const manual = Number(pick.unitPrice);
  return Number.isFinite(manual) && manual > 0 ? manual : 0;
}

export function variantLabel(pick: { interfaceTag?: InterfaceTag; control?: ControlMode }): string {
  const parts: string[] = [];
  if (pick.interfaceTag && pick.interfaceTag !== "DIMMABLE" && pick.interfaceTag !== "TUNABLE") {
    parts.push(pick.interfaceTag);
  }
  if (pick.control) parts.push(pick.control === "tunable" ? "Dimmable + Tunable" : "Dimmable");
  return parts.join(" ");
}

export const UNIT_LABEL: Record<Unit, string> = { nos: "nos", mtr: "m" };
