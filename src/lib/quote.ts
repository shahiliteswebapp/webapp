import {
  dimensionsOf,
  skuOf,
  getAccessory,
  getSystem,
  systemImages,
  unitPriceFor,
  variantLabel,
  UNIT_LABEL,
  type Unit,
} from "./catalog";
import { QUOTE } from "./config";
import { money0, round2 } from "./format";
import { choiceFor, optionCountOf, type DraftRoom, type Discount, type QuoteDraft } from "./types";

/*
 * Pure pricing engine. No IO. Given the wizard's rooms, produce a fully costed
 * breakdown (systems + rule-derived accessories + discounts + GST). Used live
 * in the UI and again when building the PDF so the two never disagree.
 *
 * Discounts stack in order: per line (qty x rate), then per room (on the room
 * total after line discounts), then per quotation (on the sum of rooms).
 * GST is charged on what is left.
 *
 * A quotation can offer up to three options (alternative lights for the same
 * rooms). Each option is priced on its own: computeRoom / computeQuote take
 * the 0-based option index; computeOptions prices them all.
 */

/** Rupee amount a discount takes off `base`, never more than `base`. */
export function discountAmount(base: number, d: Discount | undefined): number {
  if (!d || !(base > 0)) return 0;
  const v = Number(d.value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const amt = d.kind === "pct" ? (base * Math.min(v, 100)) / 100 : v;
  return round2(Math.min(amt, base));
}

/** "10%" or "₹500", for labels. Empty when there is no discount. */
export function discountLabel(d: Discount | undefined): string {
  if (!d || !(Number(d.value) > 0)) return "";
  return d.kind === "pct" ? `${Math.min(Number(d.value), 100)}%` : money0(Number(d.value));
}

export interface ComputedSystemLine {
  /** systemId + variant + price: unique within a room */
  key: string;
  systemId: string;
  name: string;
  unit: Unit;
  unitLabel: string;
  qty: number;
  unitCost: number;
  /** qty x rate, before the line discount */
  gross: number;
  /** rupees taken off by the line discount */
  discount: number;
  /** e.g. "10%" or "₹500"; empty when none */
  discountLabel: string;
  /** after the line discount */
  total: number;
  /** first product photo URL, if the catalogue has one */
  image?: string;
}

/** One light in a room, in one option, before any merging. */
export interface ComputedLine {
  lineId: string;
  systemId: string;
  name: string;
  unitLabel: string;
  qty: number;
  unitCost: number;
  gross: number;
  discount: number;
  discountLabel: string;
  total: number;
  image?: string;
  /** product code shown on the quotation (see skuOf) */
  sku: string;
  /** size text, e.g. "D90MM X H70MM · cut-out 60MM"; empty when unknown */
  dimensions: string;
  /** same light as Option 1 (no alternative picked) */
  inherited: boolean;
}

export interface ComputedAccessory {
  accessoryId: string;
  name: string;
  qty: number;
  unitCost: number;
  total: number;
  /** which systems in the room triggered this accessory */
  from: string[];
}

export interface ComputedRoom {
  roomId: string;
  name: string;
  /** every light line in entry order (the PDF lists these) */
  lines: ComputedLine[];
  /** lines merged by system + variant + price + discount, A-Z */
  systems: ComputedSystemLine[];
  accessories: ComputedAccessory[];
  systemsTotal: number;
  accessoriesTotal: number;
  /** lighting + accessories, after line discounts, before the room discount */
  beforeDiscount: number;
  /** rupees taken off by the room discount */
  discount: number;
  discountLabel: string;
  /** after the room discount */
  subtotal: number;
}

export interface ComputedQuote {
  rooms: ComputedRoom[];
  /** sum of room subtotals, before the quotation discount */
  roomsTotal: number;
  /** rupees taken off by the quotation discount */
  discount: number;
  discountLabel: string;
  /** every discount on the quotation added up (lines + rooms + quotation) */
  totalSavings: number;
  /** taxable amount: rooms total minus the quotation discount */
  subtotal: number;
  /** false when the employee chose not to charge GST */
  applyGst: boolean;
  gstRatePct: number;
  gstAmount: number;
  grandTotal: number;
}

export function computeRoom(room: DraftRoom, opt = 0): ComputedRoom {
  // Aggregate line quantities by system + variant + price (the same system can
  // be added on several lines; different automation variants stay separate).
  const groups = new Map<
    string,
    {
      systemId: string;
      label: string;
      unitCost: number;
      qty: number;
      disc?: Discount;
      gross: number;
      discount: number;
    }
  >();
  const qtyBySystem = new Map<string, number>();
  const lines: ComputedLine[] = [];
  for (const line of room.lines) {
    const qty = Number(line.qty);
    const choice = choiceFor(line, opt);
    if (!choice.systemId || !Number.isFinite(qty) || qty <= 0) continue;
    const sys = getSystem(choice.systemId);
    if (!sys) continue;
    const unitCost = unitPriceFor(sys, choice);
    const label = variantLabel(choice);
    const d = line.discount && Number(line.discount.value) > 0 ? line.discount : undefined;
    // Each line is discounted on its own, then lines merge for display.
    const gross = round2(unitCost * qty);
    const discount = discountAmount(gross, d);
    lines.push({
      lineId: line.id,
      systemId: choice.systemId,
      name: label ? `${sys.name} (${label})` : sys.name,
      unitLabel: UNIT_LABEL[sys.unit],
      qty,
      unitCost,
      gross,
      discount,
      discountLabel: discount > 0 ? discountLabel(d) : "",
      total: round2(gross - discount),
      image: systemImages(sys)[0],
      sku: skuOf(sys),
      dimensions: dimensionsOf(sys),
      inherited: choice.inherited,
    });
    // Lines only merge when their discount matches too.
    const key = `${choice.systemId}|${label}|${unitCost}|${d ? `${d.kind}:${d.value}` : ""}`;
    const g =
      groups.get(key) ??
      { systemId: choice.systemId, label, unitCost, qty: 0, disc: d, gross: 0, discount: 0 };
    g.qty += qty;
    g.gross = round2(g.gross + gross);
    g.discount = round2(g.discount + discount);
    groups.set(key, g);
    qtyBySystem.set(choice.systemId, (qtyBySystem.get(choice.systemId) ?? 0) + qty);
  }

  const systems: ComputedSystemLine[] = [];
  const accMap = new Map<
    string,
    { qty: number; unitCost: number; name: string; from: Set<string> }
  >();

  for (const [key, g] of groups) {
    const sys = getSystem(g.systemId)!;
    const { gross, discount } = g;
    systems.push({
      key,
      systemId: g.systemId,
      name: g.label ? `${sys.name} (${g.label})` : sys.name,
      unit: sys.unit,
      unitLabel: UNIT_LABEL[sys.unit],
      qty: g.qty,
      unitCost: g.unitCost,
      gross,
      discount,
      discountLabel: discount > 0 ? discountLabel(g.disc) : "",
      total: round2(gross - discount),
      image: systemImages(sys)[0],
    });
  }

  // Accessories are per system, regardless of variant.
  for (const [systemId, qty] of qtyBySystem) {
    const sys = getSystem(systemId);
    if (!sys) continue;
    for (const rule of sys.rules) {
      const acc = getAccessory(rule.accessoryId);
      if (!acc || rule.perUnits <= 0) continue;
      const need = Math.ceil(qty / rule.perUnits);
      if (need <= 0) continue;
      const entry =
        accMap.get(acc.id) ??
        { qty: 0, unitCost: acc.unitCost, name: acc.name, from: new Set<string>() };
      entry.qty += need;
      entry.from.add(sys.name);
      accMap.set(acc.id, entry);
    }
  }

  systems.sort((a, b) => a.name.localeCompare(b.name));

  const accessories: ComputedAccessory[] = [...accMap.entries()]
    .map(([accessoryId, e]) => ({
      accessoryId,
      name: e.name,
      qty: e.qty,
      unitCost: e.unitCost,
      total: round2(e.unitCost * e.qty),
      from: [...e.from].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const systemsTotal = round2(systems.reduce((s, l) => s + l.total, 0));
  const accessoriesTotal = round2(accessories.reduce((s, l) => s + l.total, 0));
  const beforeDiscount = round2(systemsTotal + accessoriesTotal);
  const discount = discountAmount(beforeDiscount, room.discount);

  return {
    roomId: room.id,
    name: room.name,
    lines,
    systems,
    accessories,
    systemsTotal,
    accessoriesTotal,
    beforeDiscount,
    discount,
    discountLabel: discount > 0 ? discountLabel(room.discount) : "",
    subtotal: round2(beforeDiscount - discount),
  };
}

export function computeQuote(
  rooms: DraftRoom[],
  opts: { applyGst?: boolean; discount?: Discount; option?: number } = {},
): ComputedQuote {
  const applyGst = opts.applyGst !== false;
  const computed = rooms.map((r) => computeRoom(r, opts.option ?? 0));
  const roomsTotal = round2(computed.reduce((s, r) => s + r.subtotal, 0));
  const discount = discountAmount(roomsTotal, opts.discount);
  const subtotal = round2(roomsTotal - discount);
  const gstAmount = applyGst ? round2((subtotal * QUOTE.gstRatePct) / 100) : 0;
  const totalSavings = round2(
    discount +
      computed.reduce(
        (s, r) => s + r.discount + r.systems.reduce((t, l) => t + l.discount, 0),
        0,
      ),
  );
  return {
    rooms: computed,
    roomsTotal,
    discount,
    discountLabel: discount > 0 ? discountLabel(opts.discount) : "",
    totalSavings,
    subtotal,
    applyGst,
    gstRatePct: QUOTE.gstRatePct,
    gstAmount,
    grandTotal: round2(subtotal + gstAmount),
  };
}

/** Every option of a draft, priced: one ComputedQuote per option. */
export function computeOptions(
  draft: Pick<QuoteDraft, "rooms" | "applyGst" | "discount" | "optionCount">,
): ComputedQuote[] {
  return Array.from({ length: optionCountOf(draft) }, (_, option) =>
    computeQuote(draft.rooms, { applyGst: draft.applyGst, discount: draft.discount, option }),
  );
}

/** "Option 2" */
export function optionLabel(opt: number): string {
  return `Option ${opt + 1}`;
}

/** Systems used in a room, names only, A–Z (for the summary cards). */
export function roomSystemNames(room: DraftRoom): string[] {
  const names = new Set<string>();
  for (const line of room.lines) {
    const qty = Number(line.qty);
    if (!line.systemId || qty <= 0) continue;
    const sys = getSystem(line.systemId);
    if (sys) names.add(sys.name);
  }
  return [...names].sort();
}
