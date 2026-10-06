import { allSystems, type ControlMode, type LightingSystem } from "./catalog";
import type { ClientDetails, Discount, DraftRoom, LineChoice, RoomLine } from "./types";

/*
 * Reads a Shahi Lites quotation PDF back into an editable draft, for PDFs
 * made before quotations carried their own contents (see draft-token.ts).
 * Pure: it works on the text the browser extracts with pdf.js (each piece of
 * text with its position), so it only knows what the PDF prints:
 *
 *   rooms ("ROOM 1 OF 3" + name), lights ("LIGHT 1" + product + SKU line +
 *   "2 nos × ₹1,400.00"), options (side-by-side columns), line / room /
 *   quotation discounts, GST on or off, validity, and the client block.
 *
 * Products are matched by SKU (Shahi Lites or vendor code), then by the exact
 * vendor product name. Anything it cannot match is reported, not guessed.
 */

export interface TextItem {
  s: string;
  x: number;
  /** distance from the top of the page */
  y: number;
}

export interface ImportedDraft {
  number?: string;
  rooms: DraftRoom[];
  applyGst: boolean;
  discount?: Discount;
  optionCount: number;
  client?: ClientDetails;
  validUntil?: string;
  /** things the reader could not match, for the person to fix */
  warnings: string[];
}

interface Line {
  text: string;
  items: TextItem[];
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

const num = (v: string) => Number(v.replace(/[,\s]/g, ""));

/*
 * Letter-spaced headings come out of pdf.js one letter at a time
 * ("R O O M"); put the letters back together.
 */
function tidyText(s: string): string {
  const t = s.trim();
  return /^(?:\S ){1,}\S$/.test(t) ? t.replace(/ /g, "") : t;
}

function toLines(items: TextItem[]): Line[] {
  const sorted = items
    .map((i) => ({ ...i, s: tidyText(i.s) }))
    // the diagonal "SHAHI LITES" watermark is not content
    .filter((i) => i.s && !/^SHAHI ?LITES$/.test(i.s))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.items[0].y - it.y) <= 2.5) last.items.push(it);
    else lines.push({ text: "", items: [it] });
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.s.trim()).join(" ").replace(/\s+/g, " ").trim();
  }
  return lines;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------ product matching ------------------------------ */

function index() {
  const bySku = new Map<string, LightingSystem>();
  const byName = new Map<string, LightingSystem>();
  for (const s of allSystems()) {
    if (s.slSku) bySku.set(s.slSku.toUpperCase(), s);
    if (!bySku.has(s.sourceCode.toUpperCase())) bySku.set(s.sourceCode.toUpperCase(), s);
    const n = s.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (!byName.has(n)) byName.set(n, s);
  }
  return { bySku, byName };
}

/** "Spotlight GCL-110 (RF Dimmable + Tunable)" -> name + variant. */
function splitVariant(name: string): { base: string; interfaceTag?: string; control?: ControlMode } {
  const m = name.match(/^(.*)\s+\((?:(\S+)\s+)?(Dimmable \+ Tunable|Dimmable)\)$/);
  if (!m) return { base: name };
  return {
    base: m[1],
    interfaceTag: m[2],
    control: m[3].includes("Tunable") ? "tunable" : "dimmable",
  };
}

interface Cell {
  name?: string;
  sku?: string;
  qty?: number;
  rate?: number;
  discount?: Discount;
  inherited?: boolean;
  omitted?: boolean;
}

/** Reads one light (or one option column of it) from its lines of text. */
function readCell(texts: string[]): Cell {
  const cell: Cell = {};
  for (const raw of texts) {
    const t = raw.replace(/₹\s+/g, "₹").trim();
    if (!t || /^OPTION \d$/i.test(t) || /^LIGHT \d+/i.test(t)) continue;
    if (/^Same as Option 1$/i.test(t)) {
      cell.inherited = true;
      continue;
    }
    if (/^Not included$/i.test(t)) {
      cell.omitted = true;
      continue;
    }
    const sku = t.match(/^SKU\s+(\S+)/i);
    if (sku) {
      cell.sku = sku[1].toUpperCase();
      continue;
    }
    const meta = t.match(/([\d.]+)\s*(?:nos|m)\s*×\s*₹([\d,.]+)/i);
    if (meta) {
      cell.qty = num(meta[1]);
      cell.rate = num(meta[2]);
    }
    const disc = t.match(/Discount\s+(?:(\d+(?:\.\d+)?)%|₹([\d,.]+))/i);
    if (disc) cell.discount = disc[1] ? { kind: "pct", value: num(disc[1]) } : { kind: "amt", value: num(disc[2]) };
    if (meta || disc) continue;
    if (/^[−-]?₹[\d,.]+$/.test(t)) continue; // an amount on its own
    // The name can wrap onto a second line in a narrow option column.
    const part = t.replace(/\s+₹[\d,.]+$/, "").trim(); // amount on the same row
    if (!cell.name) cell.name = part;
    else if (!cell.sku && cell.qty === undefined) cell.name = `${cell.name} ${part}`;
  }
  return cell;
}

/* ---------------------------------- the reader ---------------------------------- */

export function readQuotationPdf(pages: TextItem[][]): ImportedDraft {
  const { bySku, byName } = index();
  const warnings: string[] = [];
  const all = pages.map(toLines);
  const flat = all.flat();
  const fullText = flat.map((l) => l.text).join("\n");

  const out: ImportedDraft = {
    rooms: [],
    applyGst: !/GST is not included/i.test(fullText),
    optionCount: 1,
    warnings,
  };

  out.number = fullText.match(/\b[A-Z]{1,6}-\d{4}-\d{4,}\b/)?.[0];
  const opts = fullText.match(/(\d) options, priced side by side/i);
  if (opts) out.optionCount = Math.min(Math.max(Number(opts[1]), 1), 3);

  const valid = fullText.match(/Valid until\s+(\d{1,2}) ([A-Za-z]{3,4}) (\d{4})/i);
  if (valid && MONTHS[valid[2].toLowerCase()]) {
    out.validUntil = `${valid[3]}-${MONTHS[valid[2].toLowerCase()]}-${valid[1].padStart(2, "0")}`;
  }

  // Client block on the cover: "PREPARED FOR", name, then address / contact lines.
  const cover = all[0] ?? [];
  const pf = cover.findIndex((l) => /^PREPARED FOR$/i.test(l.text));
  if (pf >= 0 && cover[pf + 1]) {
    const client: ClientDetails = { name: cover[pf + 1].text };
    for (const l of cover.slice(pf + 2)) {
      if (/^QUOTATION NO\./i.test(l.text)) break;
      if (/@|^\+?[\d\s()-]{7,}/.test(l.text)) {
        for (const part of l.text.split("·").map((p) => p.trim())) {
          if (part.includes("@")) client.email = part;
          else if (part) client.phone = part;
        }
      } else client.address = client.address ? `${client.address}, ${l.text}` : l.text;
    }
    out.client = client;
  }

  const resolve = (cell: Cell, where: string): LineChoice | null => {
    let sys = cell.sku ? bySku.get(cell.sku) : undefined;
    const v = splitVariant(cell.name ?? "");
    if (!sys && cell.name) sys = byName.get(v.base.toLowerCase().replace(/\s+/g, " "));
    if (!sys) {
      warnings.push(`${where}: could not find "${cell.name ?? cell.sku ?? "?"}" in the catalogue. Pick it again.`);
      return null;
    }
    const choice: LineChoice = { systemId: sys.id };
    if (v.control) {
      choice.control = v.control;
      choice.interfaceTag = v.interfaceTag ?? (v.control === "tunable" ? "TUNABLE" : "DIMMABLE");
    }
    // Keep a typed-in rate for items the catalogue has no price for.
    if (sys.unitCost <= 0 && cell.rate) choice.unitPrice = cell.rate;
    return choice;
  };

  let room: DraftRoom | null = null;
  let inSummary = false;

  for (let p = 1; p < all.length; p++) {
    const lines = all[p];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].text;

      if (/^(SUMMARY )?Total Cost Estimate$/i.test(t) || /^SUMMARY$/i.test(t)) {
        inSummary = true;
        room = null;
        continue;
      }
      if (inSummary) {
        const d = t.match(/^Discount(?:\s*\((\d+(?:\.\d+)?)%\))?\s+[−-]?₹\s?([\d,.]+)/i);
        if (d && !out.discount) {
          out.discount = d[1] ? { kind: "pct", value: num(d[1]) } : { kind: "amt", value: num(d[2]) };
        }
        continue;
      }

      const r = t.match(/^ROOM (\d+) OF (\d+)$/i);
      if (r) {
        const name = lines[i + 1]?.text ?? `Room ${r[1]}`;
        room = out.rooms.find((x) => x.name === name && out.rooms.indexOf(x) === Number(r[1]) - 1) ?? null;
        if (!room) {
          room = { id: uid(), name, lines: [] };
          out.rooms.push(room);
        }
        i++;
        continue;
      }
      if (!room) continue;

      const rd = t.match(/Room discount(?:\s*\((\d+(?:\.\d+)?)%\))?.*?[−-]₹\s?([\d,.]+)/i);
      if (rd && !room.discount) {
        room.discount = rd[1] ? { kind: "pct", value: num(rd[1]) } : { kind: "amt", value: num(rd[2]) };
        continue;
      }

      // Oldest layout: a table "ITEM | QTY | UNIT | RATE | DISCOUNT | AMOUNT".
      if (/^ITEM QTY UNIT RATE/i.test(t)) {
        const colX = (label: string) =>
          lines[i].items.find((it) => it.s.toUpperCase() === label)?.x ?? Number.NaN;
        const qtyX = colX("QTY");
        const rateX = colX("RATE");
        const discX = colX("DISCOUNT");
        const amtX = colX("AMOUNT");
        let j = i + 1;
        for (; j < lines.length; j++) {
          const row = lines[j];
          if (/^(Room subtotal|Total ₹|Connectors|Room \d+ of|ROOM \d+ OF)/i.test(row.text)) break;
          const name = row.items.filter((it) => it.x < qtyX - 6).map((it) => it.s).join(" ").trim();
          const at = (x: number, nextX: number) =>
            row.items.filter((it) => it.x >= x - 30 && it.x < nextX - 6).map((it) => it.s).join(" ").trim();
          const qty = num(at(qtyX, qtyX + 25) || "0");
          if (!name || !(qty > 0)) continue;
          const rate = num(at(rateX, discX).replace(/[₹]/g, "") || "0");
          const d = at(discX, amtX);
          const dm = d.match(/(\d+(?:\.\d+)?)%|₹([\d,.]+)/);
          const cell: Cell = {
            name,
            qty,
            rate,
            discount: dm ? (dm[1] ? { kind: "pct", value: num(dm[1]) } : { kind: "amt", value: num(dm[2]) }) : undefined,
          };
          const choice = resolve(cell, `${room.name}, "${name}"`);
          room.lines.push({ id: uid(), ...(choice ?? { systemId: "" }), qty, discount: cell.discount });
        }
        i = j - 1;
        continue;
      }

      const head = t.match(/^LIGHT (\d+)(?:\s*·\s*QTY\s+([\d.]+))?/i);
      if (!head) continue;

      // The light's lines run until the next light, room total or table.
      let j = i + 1;
      while (
        j < lines.length &&
        !/^LIGHT \d+/i.test(lines[j].text) &&
        !/^(Room subtotal|Total ₹|Connectors \/ drivers|Room discount)/i.test(lines[j].text)
      ) j++;
      const block = lines.slice(i + 1, j);
      const where = `${room.name}, light ${head[1]}`;
      i = j - 1;

      if (head[2] === undefined) {
        // One option: name, SKU, "qty × rate".
        const cell = readCell(block.map((l) => l.text));
        const choice = resolve(cell, where);
        room.lines.push({
          id: uid(),
          ...(choice ?? { systemId: "" }),
          qty: cell.qty ?? 1,
          discount: cell.discount,
        });
        continue;
      }

      // Several options: one column per option, side by side.
      const header = block.find((l) => /OPTION 1/i.test(l.text));
      const starts = (header?.items ?? [])
        .filter((it) => /^OPTION$/i.test(it.s.trim()))
        .map((it) => it.x)
        .sort((a, b) => a - b);
      if (starts.length === 0) {
        warnings.push(`${where}: could not read the options.`);
        continue;
      }
      const cols: string[][] = starts.map(() => []);
      for (const l of block) {
        if (l === header) continue;
        const parts: string[][] = starts.map(() => []);
        for (const it of l.items) {
          let c = 0;
          while (c + 1 < starts.length && it.x >= starts[c + 1] - 4) c++;
          parts[c].push(it.s.trim());
        }
        parts.forEach((ps, c) => {
          const txt = ps.join(" ").replace(/\s+/g, " ").trim();
          if (txt) cols[c].push(txt);
        });
      }
      const cells = cols.map(readCell);
      const first = cells[0];
      const firstChoice = first.omitted ? null : resolve(first, `${where}, option 1`);
      const line: RoomLine = {
        id: uid(),
        ...(firstChoice ?? { systemId: "" }),
        qty: Number(head[2]) || first.qty || 1,
        discount: cells.find((c) => c.discount)?.discount,
      };
      const alts: (LineChoice | null)[] = [];
      for (let o = 1; o < cells.length; o++) {
        const c = cells[o];
        if (c.omitted) alts.push({ systemId: "" });
        else if (c.inherited) alts.push(null);
        else alts.push(resolve(c, `${where}, option ${o + 1}`) ?? { systemId: "" });
      }
      if (alts.some((a) => a !== null)) line.alts = alts;
      room.lines.push(line);
    }
  }

  if (out.rooms.length === 0) warnings.push("No rooms found. Is this a Shahi Lites quotation PDF?");
  return out;
}
