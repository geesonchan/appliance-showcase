import appliancesFile from "../../data/appliances.json";
import type { Appliance, Package, PackageSlot, SlotId } from "../types";
import type { LayoutShape } from "./layoutShape";
import { isOvenTower } from "./ovenTower";
import { PACKAGE_SHAPE, shapeOfChoice, shapeOfPackage, slotsOf } from "./packages";

/**
 * The oven chosen for a package's oven tower, and the opening it needs.
 *
 * Leo, 2026-11-09, the ovens' plan, 5-2 (甲): 「PO302W 在 B 里照甲：选这台时开口长到
 * 50"，上面的柜门短 1-1/2"。」 B's tower is built for MEM301WS's 48-1/2"; PO302W's
 * standard cutout is at least 50" (po302w-spec.pdf p. 1), and in 48-1/2" its
 * control panel stood behind the door over the tower. Written once, for every
 * tower: the opening grows to the chosen oven's standard cutout where that is
 * taller than the tower was built for, and never shrinks — ME301YP keeps the
 * tower's hole and the panel over it (D20: the joiner builds the tower to the
 * machine). The sill stays where the reach rule puts it, so what grows is the
 * opening's head and the cabinet over it is that much shorter.
 *
 * Tied to its package and shape, as the refrigerator is (`fridgeMount.ts`).
 */
let CHOSEN: { packageId: string; shape: LayoutShape; appliance: Appliance } | null = null;

export function recordTowerOven(appliance: Appliance | undefined, packageId: string, shape: LayoutShape = PACKAGE_SHAPE) {
  CHOSEN = appliance ? { packageId, shape: shapeOfChoice(packageId, shape), appliance } : null;
}

/** The package's oven tower slot, or null where it has none. */
export function towerSlotOf(pkg: Package): SlotId | null {
  const spec = Object.values(slotsOf(pkg)).find(isOvenTower);
  return spec ? spec.slotId : null;
}

/** The oven a package's tower is built round: the one chosen in it, or its own. */
export function towerOvenFor(pkg: Package): Appliance | undefined {
  if (CHOSEN && CHOSEN.packageId === pkg.id && CHOSEN.shape === shapeOfPackage(pkg)) return CHOSEN.appliance;
  const slot = towerSlotOf(pkg);
  const id = slot ? pkg.defaultSelection[slot] : undefined;
  if (!id) return undefined;
  const rows = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
  return rows.find((row) => row.id === id);
}

/** The opening's height: the tower's own, grown to the oven's standard cutout where that is taller. */
export function towerOpeningHeightIn(builtIn: number, oven: Pick<Appliance, "cutoutHeightIn"> | undefined): number {
  const needs = oven?.cutoutHeightIn ?? null;
  return needs !== null && needs > builtIn ? needs : builtIn;
}

/**
 * How far off the floor each oven's own sheet lets its opening start, wall
 * mounted: the wall-mount drawing on p. 2 of each spec sheet (printed "Page 2
 * of 3"), read from the floor (Leo, 2026-11-16, 12b, F: 「还按切口底离地」 —
 * read strictly, the drawing's upper end is the underside of the shelf under
 * the opening, a shelf's thickness lower, which it does not give; the
 * installation guide's p. 24 calls the figures under the oven a general
 * guideline).
 */
export const OVEN_SILL_RANGE_IN: Record<string, { min: number; max: number }> = {
  // pods302b-spec.pdf p. 2: 4-3/4"-18-3/4" (121-476 mm).
  PODS302B: { min: 4.75, max: 18.75 },
  // po302w-spec.pdf p. 2: 4-3/4"-14-7/8" (121-378 mm).
  PO302W: { min: 4.75, max: 14.875 },
  // me301yp-spec.pdf p. 2: 4-3/4"-38" (121-964 mm).
  ME301YP: { min: 4.75, max: 38 },
  // mem301ws-spec.pdf p. 2: 4-3/4"-18" (121-457 mm); `COMBO_OVEN.sillIn`.
  MEM301WS: { min: 4.75, max: 18 },
};

/**
 * Package D's oven height in Layout (12b): 5" to 18" by the inch, and within
 * that what the chosen oven's own sheet allows (Leo, 2026-11-16, C, 乙:
 * 「换型号时范围跟着型号变」 — PO302W to 14"; ME301YP's sheet allows 38" and the
 * slider still stops at 18"). An oven with no range here keeps the slider's.
 */
export const STEAM_SILL_LIMITS = { min: 5, max: 18, step: 1 } as const;

export function ovenSillLimits(oven: Pick<Appliance, "model"> | undefined): { min: number; max: number; step: number } {
  const sheet = oven ? OVEN_SILL_RANGE_IN[oven.model] : undefined;
  if (!sheet) return { ...STEAM_SILL_LIMITS };
  return {
    min: Math.max(STEAM_SILL_LIMITS.min, Math.ceil(sheet.min)),
    max: Math.min(STEAM_SILL_LIMITS.max, Math.floor(sheet.max)),
    step: STEAM_SILL_LIMITS.step,
  };
}

/**
 * Where D's opening starts for the height asked: what was asked, held to the
 * chosen oven's ends. Held is a real answer rather than an error, as B's
 * microwave handle is (`comboSillFor`): the slider keeps what was asked, the
 * tower is built at the end, and the install list says so (Leo, C: 「和 B 的
 * 滑杆到头停住并提示是同一种做法」).
 */
export function steamSillFor(askedIn: number, oven: Pick<Appliance, "model"> | undefined): { sillIn: number; held: boolean } {
  const { min, max } = ovenSillLimits(oven);
  const sillIn = Math.min(max, Math.max(min, askedIn));
  return { sillIn, held: sillIn !== askedIn };
}

/** The tower's slot as the chosen oven is built in: its opening's height. Any other slot as it is. */
export function towerSlotAsBuilt(pkg: Package, spec: PackageSlot): PackageSlot {
  if (!isOvenTower(spec) || spec.heightIn === null || spec.heightIn === undefined) return spec;
  const heightIn = towerOpeningHeightIn(spec.heightIn, towerOvenFor(pkg));
  return heightIn === spec.heightIn ? spec : { ...spec, heightIn };
}
