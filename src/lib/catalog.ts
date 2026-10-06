/*
 * Real lighting catalog, imported from the client's source documents:
 *   - functional fixtures: rawdata/ECO 25-26 (V 1.5).pdf, rawdata/Architectural Product list -Dec'25.pdf
 *   - decorative fixtures: rawdata/Geo Liting Hanging & Celliling Light Part 1.pdf, rawdata/Geo Liting Mix 1 Updated.pdf
 * Parsed once into catalog-data.json (see scripts used at import time — not part of the app).
 *
 * Decorative items (Geo Liting) are priced from the grey number after the SKU (listNumber / 10,
 * per the client). Items without one carry unitCost 0 and take a typed-in rate.
 *
 * `layer`, `mounting`, `style`, `indoorOutdoor` are not present in any source document — they're
 * either an inferred category→layer mapping (functional) or left null pending client tagging
 * (decorative). Accessory auto-add `rules` are empty for every real system: no accessory-trigger
 * data exists for the real catalog yet, unlike the old placeholder set.
 */

import catalogData from "./catalog-data.json";

export type Unit = "nos" | "mtr";

/** Built-in tags, plus any free-text interface a superadmin uploads (e.g. "Kasambi"). */
export type InterfaceTag =
  | "RF"
  | "DALI"
  | "BLE"
  | "PRO"
  | "TRIAC"
  | "DIMMABLE"
  | "TUNABLE"
  | (string & {});
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
  /** product photo file names (webp) served from CATALOG_IMAGE_BASE, or full URLs (uploaded items) */
  images?: string[];
  /** true for items a superadmin added from an Excel upload */
  uploaded?: boolean;
  /** brand, from the upload sheet's "Company Name" column */
  company?: string | null;
  /** Shahi Lites' own product code, when one is set (see skuOf) */
  slSku?: string | null;
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
  /** from the upload sheet; unset on the imported catalogue */
  glare?: "no-glare" | "some-glare" | null;
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
  images: string[];
  /**
   * Number printed in grey after the SKU in the Geo Liting catalogues. The
   * client confirmed: drop its last zero to get the price (see withListPrice).
   */
  listNumber?: number | null;
  /** where the item is printed, e.g. "Geo Liting Mix 1 Updated p.34" */
  catalogPage?: string;
}

export type LightingSystem = FunctionalSystem | DecorativeSystem;

/*
 * Geo Liting prints a number in grey after each SKU (e.g. "H7697HL 420000").
 * Per the client, dropping its last zero gives the price per product (42000).
 */
function withListPrice(sys: LightingSystem): LightingSystem {
  if (sys.kind === "decorative" && sys.unitCost <= 0 && sys.listNumber && sys.listNumber > 0) {
    return { ...sys, unitCost: Math.floor(sys.listNumber / 10) };
  }
  return sys;
}

/** The catalogue shipped with the app (catalog-data.json). Never mutated. */
export const BUILTIN_SYSTEMS: readonly LightingSystem[] = (
  catalogData as unknown as LightingSystem[]
).map(withListPrice);

/**
 * Every system employees can pick: the built-in catalogue plus whatever a
 * superadmin has uploaded, minus anything a superadmin removed (see
 * applyCatalogChanges). Mutated in place so existing imports see changes.
 */
export const LIGHTING_SYSTEMS: LightingSystem[] = [...BUILTIN_SYSTEMS];

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

// Every known system, removed ones included, so a draft that already uses a
// removed item still prices and renders.
const SYSTEM_BY_ID = new Map(LIGHTING_SYSTEMS.map((s) => [s.id, s]));
let changesKey = "";

/**
 * Apply the superadmin's catalogue changes: uploaded items are added (a
 * repeat call replaces the earlier set) and removed ids drop out of the
 * pickable list. Idempotent. Called on the server before pricing, and in
 * the browser by <CatalogHydrator> before any page renders.
 */
export function applyCatalogChanges(items: LightingSystem[], removed: string[] = []): void {
  const key =
    items.map((i) => `${i.id}:${i.unitCost}:${(i.images ?? []).length}`).join("|") +
    "#" +
    [...removed].sort().join("|");
  if (key === changesKey) return;
  changesKey = key;

  for (const [id, sys] of SYSTEM_BY_ID) if (sys.uploaded) SYSTEM_BY_ID.delete(id);
  const uploaded = items.map((item) => ({ ...item, uploaded: true }) as LightingSystem);
  for (const sys of uploaded) SYSTEM_BY_ID.set(sys.id, sys);

  const gone = new Set(removed);
  LIGHTING_SYSTEMS.length = 0;
  for (const sys of [...BUILTIN_SYSTEMS, ...uploaded]) {
    if (!gone.has(sys.id)) LIGHTING_SYSTEMS.push(sys);
  }
}

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
  // Uploaded items store their full URL.
  if (/^(https?:)?\/\//.test(file) || file.startsWith("/")) return file;
  return `${CATALOG_IMAGE_BASE}/${encodeURIComponent(file)}`;
}

export function systemImages(sys: LightingSystem): string[] {
  return (sys.images ?? []).map(catalogImageUrl);
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

/*
 * Shahi Lites SKUs: every product has a permanent code of its own,
 * "SL-F0001" (functional) or "SL-D0001" (decorative). Built-in items carry
 * theirs in catalog-data.json; uploaded items get the next free number when a
 * superadmin adds them (catalog-store.ts). Numbers are never reused or
 * renumbered. The SKU and clientName() are for the client's PDF only; inside
 * the app everyone sees the vendor's own names and codes.
 */
export const SKU_PREFIX = { functional: "SL-F", decorative: "SL-D" } as const;

export function formatSku(kind: LightingSystem["kind"], n: number): string {
  return `${SKU_PREFIX[kind]}${String(n).padStart(4, "0")}`;
}

/** The number in a Shahi Lites SKU of that kind, or null. */
export function skuNumber(kind: LightingSystem["kind"], sku: string | null | undefined): number | null {
  const m = sku?.match(new RegExp(`^${SKU_PREFIX[kind]}(\\d+)$`));
  return m ? Number(m[1]) : null;
}

/** The Shahi Lites SKU of a product (never the supplier code). */
export function skuOf(sys: LightingSystem): string {
  return (sys.slSku ?? "").trim() || `${SKU_PREFIX[sys.kind]}-${sys.id.slice(-6).toUpperCase()}`;
}

const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Title Case for all-caps catalogue text ("LED PANEL - RECESSED" -> "LED Panel - Recessed"). */
function tidy(v: string): string {
  if (v !== v.toUpperCase()) return v;
  return v
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Led|Cob|Mr16|Ip\d*)\b/gi, (w) => w.toUpperCase());
}

/*
 * What a client reads for a product: a plain description with no supplier
 * code, brand or model name ("COB Downlighter - Recessed, 7W";
 * "Chandelier, Modern"). Used on the PDF.
 */
export function clientName(sys: LightingSystem): string {
  if (sys.kind === "decorative") {
    const style = sys.styleTags?.[0];
    return [sys.decorType || "Decorative light", style ? tidy(style).replace(/^./, (c) => c.toUpperCase()) : null]
      .filter(Boolean)
      .join(", ");
  }
  const brandWords = [sys.company, "tisva", "eco", "geo"]
    .filter((w): w is string => !!w)
    .map((w) => w.toLowerCase());
  let type = sys.category || "Light";
  for (const w of brandWords) type = type.replace(new RegExp(`\\b${escapeRe(w)}\\b`, "gi"), "");
  type = type.replace(/\s{2,}/g, " ").replace(/^[\s-]+|[\s-]+$/g, "").trim();
  if (!type || /^uncategori[sz]ed$/i.test(type)) type = "Light";
  type = tidy(type);
  // Only a clean wattage ("12W"); the watt text sometimes holds notes.
  return sys.wattNum && sys.wattNum > 0 ? `${type}, ${sys.wattNum}W` : type;
}

/** Dimensions as shown to clients, e.g. "D90MM X H70MM · cut-out 60MM". */
export function dimensionsOf(sys: LightingSystem): string {
  const parts: string[] = [];
  if (sys.size) parts.push(sys.size.replace(/\s+/g, " ").trim());
  if (sys.kind === "functional" && sys.cutout) parts.push(`cut-out ${sys.cutout}`);
  return parts.join(" · ");
}

/*
 * Width of a product in mm, for the size filter: the largest diameter /
 * width / length in its size text ("D90MM X H70MM" -> 90). Heights only
 * count when nothing else is given. Null when the size is unknown.
 */
export function sizeMm(sys: LightingSystem): number | null {
  const text = (sys.size ?? "").toUpperCase();
  if (!text) return null;
  const across: number[] = [];
  const tall: number[] = [];
  // "D300,420,500,600MM" lists several sizes: the first one counts.
  for (const m of text.matchAll(/(FH|[DWLH])?\s*(\d+(?:\.\d+)?)(?:\s*,\s*\d+(?:\.\d+)?)*\s*(MM|CM|M)?/g)) {
    let n = Number(m[2]);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (m[3] === "CM") n *= 10;
    else if (m[3] === "M") n *= 1000;
    if (m[1] === "H" || m[1] === "FH") tall.push(n);
    else across.push(n);
  }
  const pool = across.length ? across : tall;
  return pool.length ? Math.max(...pool) : null;
}

export const UNIT_LABEL: Record<Unit, string> = { nos: "nos", mtr: "m" };
