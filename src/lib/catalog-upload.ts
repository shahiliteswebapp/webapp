/*
 * Turns the client's product spreadsheet into catalogue items. Pure: no IO,
 * runs in the browser on the superadmin's upload page.
 *
 * Expected workbook (the client's "Shahi Lites" Google Sheet, File > Download
 * > .xlsx): one tab per branch, header row first.
 *
 *   Functional: S. No. | Company Name | Product Type | Watts | Layer | Glare |
 *               Auto/Non auto | Control | Interface | Date
 *   Decorative: S. No. | Company Name | Product Type | Watts | Decor type |
 *               Size | Decor mounting | Style | Date
 *
 * Optional extra columns on either tab: Price (or Rate / MRP), Shahi Lites
 * SKU, Code (or SKU / Model), Name, Size, Cutout, Finish, Colour, Material, IP, Image (photo file
 * names or direct https photo links, comma separated), Unit (nos / mtr).
 *
 * Photos are matched to rows by, in order: the Image column; a file named
 * after the row's Code; a file named "<tab>-<S. No.>" such as "functional-1",
 * "F-1", "decorative-3" or "D-3". Extra photos of one product can add a
 * suffix: "F-1_2", "F-1 (2)".
 */

import {
  DECOR_TYPES,
  LAYER_LABEL,
  type DecorativeSystem,
  type FunctionalSystem,
  type InterfaceOption,
  type AccessoryRule,
  type Layer,
  type LightingSystem,
  type Unit,
} from "./catalog";

export type Cell = unknown;
export interface SheetInput {
  sheet: string;
  data: readonly (readonly Cell[])[];
}

export interface ParsedRow {
  sheet: string;
  rowNumber: number; // 1-based, as in Excel
  item: LightingSystem;
  /** file names asked for in the Image column */
  imageNames: string[];
  /** normalised keys a photo file name may match */
  matchKeys: string[];
  warnings: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

function text(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function num(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = text(v).replace(/[,₹\s]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Header aliases, all normalised with norm(). */
const COLUMNS = {
  sno: ["sno", "srno", "serialno", "no", "sl", "slno"],
  company: ["companyname", "company", "brand", "make"],
  type: ["producttype", "product", "type"],
  watts: ["watts", "watt", "wattage", "w"],
  layer: ["layer"],
  glare: ["glare"],
  auto: ["autononauto", "automatic", "auto", "autonon"],
  control: ["control"],
  interface: ["interface", "interfaces", "protocol"],
  date: ["date"],
  decorType: ["decortype", "decorativetype"],
  size: ["size", "dimension", "dimensions"],
  mounting: ["decormounting", "mounting"],
  style: ["style"],
  price: ["price", "rate", "mrp", "unitprice", "cost", "priceperproduct"],
  slSku: ["shahilitessku", "slsku", "shahisku", "shahilitescode", "slcode"],
  code: ["code", "sku", "model", "modelno", "itemcode", "productcode", "itemno"],
  name: ["name", "productname"],
  cutout: ["cutout"],
  finish: ["finish"],
  colour: ["colour", "color", "cct"],
  material: ["material"],
  ip: ["ip", "iprating"],
  image: ["image", "images", "photo", "photos", "picture", "pictures", "imagefile"],
  unit: ["unit", "uom"],
} as const;
type Col = keyof typeof COLUMNS;

function headerMap(header: readonly Cell[]): Partial<Record<Col, number>> {
  const out: Partial<Record<Col, number>> = {};
  header.forEach((h, i) => {
    const key = norm(text(h));
    if (!key) return;
    for (const [col, aliases] of Object.entries(COLUMNS) as [Col, readonly string[]][]) {
      if (out[col] === undefined && aliases.includes(key)) {
        out[col] = i;
        return;
      }
    }
  });
  return out;
}

function branchOf(sheet: string, cols: Partial<Record<Col, number>>): "functional" | "decorative" | null {
  const n = norm(sheet);
  if (n.includes("decor")) return "decorative";
  if (n.includes("func")) return "functional";
  if (cols.decorType !== undefined || cols.mounting !== undefined) return "decorative";
  if (cols.layer !== undefined || cols.glare !== undefined || cols.control !== undefined) return "functional";
  return null;
}

function slug(parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseLayer(v: string): Layer | null {
  const n = num(v);
  if (n !== null && n >= 1 && n <= 6) return n as Layer;
  const t = norm(v);
  if (!t) return null;
  // Longest words first, so "Indirect" is not read as "Direct".
  const words = Object.entries(LAYER_LABEL)
    .flatMap(([k, label]) => label.split("/").map((part) => [norm(part), Number(k)] as const))
    .sort((a, b) => b[0].length - a[0].length);
  const hit = words.find(([w]) => t.includes(w));
  return hit ? (hit[1] as Layer) : null;
}

function parseAuto(v: string): boolean | null {
  const t = norm(v);
  if (!t) return null;
  if (t.startsWith("non") || t === "no" || t === "manual") return false;
  if (t.startsWith("auto") || t === "yes") return true;
  return null;
}

function splitList(v: string): string[] {
  return v
    .split(/[,;\n/|]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function decorTypeOf(v: string): string {
  const t = norm(v);
  const hit = DECOR_TYPES.find((d) => norm(d) === t || norm(d).startsWith(t) || t.startsWith(norm(d)));
  if (hit) return hit;
  if (t.includes("chandel")) return "Chandelier";
  if (t.includes("hang") || t.includes("pendant")) return "Hanging light";
  if (t.includes("wall")) return "Wall light";
  if (t.includes("ceil")) return "Ceiling light";
  if (t.includes("mirror")) return "Mirror light";
  if (t.includes("picture")) return "Picture light";
  if (t.includes("bed")) return "Bed side light";
  if (t.includes("lamp") || t.includes("floor") || t.includes("table")) return "Table / floor lamp";
  return v || "Decorative";
}

export function parseCatalogWorkbook(sheets: SheetInput[], sourceName: string): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const { sheet, data } of sheets) {
    // Header = first row with at least two non-empty cells.
    const headerIdx = data.findIndex((r) => r.filter((c) => text(c)).length >= 2);
    if (headerIdx < 0) continue;
    const cols = headerMap(data[headerIdx]);
    const branch = branchOf(sheet, cols);
    if (!branch) {
      errors.push(`Tab "${sheet}" skipped: could not tell if it is Functional or Decorative.`);
      continue;
    }
    if (cols.type === undefined && cols.name === undefined && cols.code === undefined) {
      errors.push(`Tab "${sheet}" skipped: no "Product Type" column.`);
      continue;
    }
    const tabKey = branch === "functional" ? ["functional", "f", "func"] : ["decorative", "d", "decor"];

    for (let r = headerIdx + 1; r < data.length; r++) {
      const row = data[r];
      const get = (c: Col) => (cols[c] === undefined ? "" : text(row[cols[c]!]));
      const company = get("company");
      const type = get("type");
      const code = get("code");
      const name0 = get("name");
      if (!company && !type && !code && !name0) continue; // blank / template row

      const warnings: string[] = [];
      const sno = get("sno") || String(r - headerIdx);
      const wattNum = num(get("watts"));
      const watt = wattNum !== null ? `${wattNum}W` : get("watts") || null;
      const price = num(get("price"));
      if (price === null || price <= 0) warnings.push("No price: employees type the rate in.");

      const name =
        name0 ||
        [company, type, code || (watt ? watt : "")].filter(Boolean).join(" ") ||
        `Item ${sno}`;
      let id = `up-${branch[0]}-${slug([company, type, code || watt || "", sno])}`;
      while (seen.has(id)) id += "-x";
      seen.add(id);

      const unit: Unit = norm(get("unit")).startsWith("m") ? "mtr" : "nos";
      // Image column: photo file names, or direct https links to a photo.
      const imageCells = get("image")
        .split(/[,;\n]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const imageUrls = imageCells.filter((x) => /^https:\/\//i.test(x));
      const imageNames = imageCells.filter((x) => !/^https?:\/\//i.test(x));
      const matchKeys = [
        ...(code ? [norm(code)] : []),
        ...tabKey.map((t) => norm(`${t}-${sno}`)),
      ];

      const base = {
        id,
        sourceCode: code || `${branch === "functional" ? "F" : "D"}-${sno}`,
        name,
        unit,
        unitCost: price && price > 0 ? price : 0,
        rules: [] as AccessoryRule[],
        source: `${sourceName} · ${sheet} row ${r + 1}`,
        images: imageUrls,
        uploaded: true,
        company: company || null,
        slSku: get("slSku") || null,
      };

      if (branch === "functional") {
        const auto = parseAuto(get("auto"));
        const controlText = norm(get("control"));
        const control = controlText.includes("tun") ? "tunable" : controlText ? "dimmable" : null;
        const interfaces = splitList(get("interface"));
        const interfaceOptions: InterfaceOption[] =
          auto !== false && control
            ? interfaces.map((i) => ({ interface: i, control, price: null }))
            : [];
        const layer = parseLayer(get("layer"));
        if (!layer) warnings.push("No layer: shows under every layer.");
        const glareText = norm(get("glare"));
        const item: FunctionalSystem = {
          ...base,
          kind: "functional",
          category: type || "Functional",
          layer,
          glare: glareText ? (glareText.startsWith("no") ? "no-glare" : "some-glare") : null,
          automatic: auto ?? interfaceOptions.length > 0,
          interfaceOptions,
          finishOptions: [],
          size: get("size") || null,
          cutout: get("cutout") || null,
          finish: get("finish") || null,
          watt,
          wattNum,
          ledSource: null,
          ipRating: get("ip") || null,
          colour: get("colour") || null,
        };
        rows.push({ sheet, rowNumber: r + 1, item, imageNames, matchKeys, warnings });
      } else {
        const styles = splitList(get("style")).map((s) => s.toLowerCase());
        const mountings = splitList(get("mounting"));
        const item: DecorativeSystem = {
          ...base,
          kind: "decorative",
          automatic: false,
          interfaceOptions: [],
          decorType: decorTypeOf(get("decorType") || type),
          mounting: mountings.join(" / ") || null,
          mountingTags: mountings,
          style: styles.join(" / ") || null,
          styleTags: styles,
          indoorOutdoor: null,
          size: get("size") || null,
          finish: get("finish") || null,
          material: get("material") || null,
          lamp: watt,
          sku: code || null,
          listNumber: null,
        };
        rows.push({ sheet, rowNumber: r + 1, item, imageNames, matchKeys, warnings });
      }
    }
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No product rows found. Check the tabs are named Functional / Decorative.");
  }
  return { rows, errors };
}

/** Normalised stem of a photo file name, with any "_2" / " (2)" suffix dropped. */
function photoKeys(fileName: string): string[] {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, "");
  const trimmed = stem.replace(/(\s*\(\d+\)|[_\s]\d+)$/, "");
  return [...new Set([norm(stem), norm(trimmed)])];
}

/**
 * Assign photo files to rows. Returns, per row index, the files to upload
 * (in order), plus the files that matched nothing.
 */
export function matchPhotos<F extends { name: string }>(
  rows: ParsedRow[],
  files: F[],
): { byRow: F[][]; unmatched: F[] } {
  const byName = new Map(files.map((f) => [f.name.toLowerCase(), f]));
  const byKey = new Map<string, F[]>();
  for (const f of files) {
    for (const k of photoKeys(f.name)) {
      const list = byKey.get(k) ?? [];
      list.push(f);
      byKey.set(k, list);
    }
  }
  const used = new Set<F>();
  const byRow = rows.map((row) => {
    const picked: F[] = [];
    const add = (f: F | undefined) => {
      if (f && !picked.includes(f)) picked.push(f);
    };
    for (const n of row.imageNames) {
      add(byName.get(n.toLowerCase()));
      // Allow "F-1" in the Image column without an extension.
      for (const f of byKey.get(norm(n)) ?? []) add(f);
    }
    if (picked.length === 0) {
      for (const k of row.matchKeys) for (const f of byKey.get(k) ?? []) add(f);
    }
    // "F-1.jpg" before "F-1_2.jpg" before "F-1_10.jpg".
    const stem = (f: F) => f.name.replace(/\.[a-z0-9]+$/i, "");
    picked.sort(
      (a, b) =>
        stem(a).length - stem(b).length ||
        a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    picked.forEach((f) => used.add(f));
    return picked;
  });
  return { byRow, unmatched: files.filter((f) => !used.has(f)) };
}
