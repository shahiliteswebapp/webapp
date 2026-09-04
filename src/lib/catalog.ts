/*
 * PLACEHOLDER lighting catalog for local development.
 *
 * Shape matches what the real spreadsheet will provide:
 *   - a lighting system has a unit ("nos" / "mtr"), a unit cost, and zero or more
 *     accessory rules
 *   - an accessory rule = "1 <accessory> for every N units of this system,
 *     rounded up", quantified per room
 *
 * Replace the arrays below with the client's real data. Nothing else changes.
 */

export type Unit = "nos" | "mtr";

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

export interface LightingSystem {
  id: string;
  name: string;
  category: string;
  unit: Unit;
  unitCost: number; // INR
  rules: AccessoryRule[];
}

export const ACCESSORIES: Accessory[] = [
  { id: "drv-4", name: "LED Driver (up to 4 spots)", unit: "nos", unitCost: 380 },
  { id: "drv-3", name: "LED Driver (up to 3 spots)", unit: "nos", unitCost: 420 },
  { id: "drv-gimbal", name: "Gimbal LED Driver", unit: "nos", unitCost: 400 },
  { id: "drv-profile", name: "Profile LED Driver", unit: "nos", unitCost: 560 },
  { id: "con-profile", name: "Profile Straight Connector", unit: "nos", unitCost: 90 },
  { id: "drv-strip", name: "Strip LED Driver", unit: "nos", unitCost: 600 },
  { id: "con-strip", name: "Strip Joiner Connector", unit: "nos", unitCost: 70 },
  { id: "con-track", name: "Magnetic Track Connector", unit: "nos", unitCost: 160 },
  { id: "drv-track", name: "Magnetic Track Driver", unit: "nos", unitCost: 1450 },
  { id: "kit-canopy", name: "Ceiling Canopy Kit", unit: "nos", unitCost: 450 },
  { id: "kit-canopy-sm", name: "Pendant Canopy Kit", unit: "nos", unitCost: 300 },
  { id: "lead-link", name: "Link Lead", unit: "nos", unitCost: 55 },
];

export const LIGHTING_SYSTEMS: LightingSystem[] = [
  {
    id: "cob-7",
    name: "COB Spotlight 7W",
    category: "Recessed",
    unit: "nos",
    unitCost: 520,
    rules: [{ accessoryId: "drv-4", perUnits: 4 }],
  },
  {
    id: "cob-12",
    name: "COB Spotlight 12W",
    category: "Recessed",
    unit: "nos",
    unitCost: 740,
    rules: [{ accessoryId: "drv-3", perUnits: 3 }],
  },
  {
    id: "gimbal-10",
    name: "Gimbal Downlight 10W",
    category: "Recessed",
    unit: "nos",
    unitCost: 690,
    rules: [{ accessoryId: "drv-gimbal", perUnits: 4 }],
  },
  {
    id: "profile-1m",
    name: "Linear Profile Light (1 m)",
    category: "Linear",
    unit: "mtr",
    unitCost: 680,
    rules: [
      { accessoryId: "con-profile", perUnits: 2 },
      { accessoryId: "drv-profile", perUnits: 5 },
    ],
  },
  {
    id: "cove-1m",
    name: "Cove COB Strip (1 m)",
    category: "Linear",
    unit: "mtr",
    unitCost: 240,
    rules: [
      { accessoryId: "con-strip", perUnits: 3 },
      { accessoryId: "drv-strip", perUnits: 5 },
    ],
  },
  {
    id: "track-1m",
    name: "Magnetic Track (1 m)",
    category: "Track",
    unit: "mtr",
    unitCost: 1250,
    rules: [
      { accessoryId: "con-track", perUnits: 2 },
      { accessoryId: "drv-track", perUnits: 3 },
    ],
  },
  {
    id: "track-spot-6",
    name: "Magnetic Track Spot 6W",
    category: "Track",
    unit: "nos",
    unitCost: 640,
    rules: [],
  },
  {
    id: "panel-40",
    name: "Panel Light 600×600 40W",
    category: "Surface",
    unit: "nos",
    unitCost: 1180,
    rules: [],
  },
  {
    id: "sconce",
    name: "Wall Sconce",
    category: "Decorative",
    unit: "nos",
    unitCost: 1650,
    rules: [],
  },
  {
    id: "pendant",
    name: "Pendant Light",
    category: "Decorative",
    unit: "nos",
    unitCost: 2200,
    rules: [{ accessoryId: "kit-canopy-sm", perUnits: 1 }],
  },
  {
    id: "chandelier",
    name: "Chandelier (Decorative)",
    category: "Decorative",
    unit: "nos",
    unitCost: 8500,
    rules: [{ accessoryId: "kit-canopy", perUnits: 1 }],
  },
  {
    id: "undercab-30",
    name: "Under-cabinet Bar (30 cm)",
    category: "Task",
    unit: "nos",
    unitCost: 410,
    rules: [{ accessoryId: "lead-link", perUnits: 2 }],
  },
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
