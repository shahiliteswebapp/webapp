import { getAccessory, getSystem, UNIT_LABEL, type Unit } from "./catalog";
import { QUOTE } from "./config";
import { round2 } from "./format";
import type { DraftRoom } from "./types";

/*
 * Pure pricing engine. No IO. Given the wizard's rooms, produce a fully costed
 * breakdown (systems + rule-derived accessories + GST). Used live in the UI and
 * again when building the PDF so the two never disagree.
 */

export interface ComputedSystemLine {
  systemId: string;
  name: string;
  unit: Unit;
  unitLabel: string;
  qty: number;
  unitCost: number;
  total: number;
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
  systems: ComputedSystemLine[];
  accessories: ComputedAccessory[];
  systemsTotal: number;
  accessoriesTotal: number;
  subtotal: number;
}

export interface ComputedQuote {
  rooms: ComputedRoom[];
  subtotal: number;
  gstRatePct: number;
  gstAmount: number;
  grandTotal: number;
}

export function computeRoom(room: DraftRoom): ComputedRoom {
  // Aggregate line quantities by system (a system can be added on multiple lines).
  const qtyBySystem = new Map<string, number>();
  for (const line of room.lines) {
    const qty = Number(line.qty);
    if (!line.systemId || !Number.isFinite(qty) || qty <= 0) continue;
    qtyBySystem.set(line.systemId, (qtyBySystem.get(line.systemId) ?? 0) + qty);
  }

  const systems: ComputedSystemLine[] = [];
  const accMap = new Map<
    string,
    { qty: number; unitCost: number; name: string; from: Set<string> }
  >();

  for (const [systemId, qty] of qtyBySystem) {
    const sys = getSystem(systemId);
    if (!sys) continue;

    systems.push({
      systemId,
      name: sys.name,
      unit: sys.unit,
      unitLabel: UNIT_LABEL[sys.unit],
      qty,
      unitCost: sys.unitCost,
      total: round2(sys.unitCost * qty),
    });

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

  return {
    roomId: room.id,
    name: room.name,
    systems,
    accessories,
    systemsTotal,
    accessoriesTotal,
    subtotal: round2(systemsTotal + accessoriesTotal),
  };
}

export function computeQuote(rooms: DraftRoom[]): ComputedQuote {
  const computed = rooms.map(computeRoom);
  const subtotal = round2(computed.reduce((s, r) => s + r.subtotal, 0));
  const gstAmount = round2((subtotal * QUOTE.gstRatePct) / 100);
  return {
    rooms: computed,
    subtotal,
    gstRatePct: QUOTE.gstRatePct,
    gstAmount,
    grandTotal: round2(subtotal + gstAmount),
  };
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
