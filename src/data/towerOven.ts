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

/** The tower's slot as the chosen oven is built in: its opening's height. Any other slot as it is. */
export function towerSlotAsBuilt(pkg: Package, spec: PackageSlot): PackageSlot {
  if (!isOvenTower(spec) || spec.heightIn === null || spec.heightIn === undefined) return spec;
  const heightIn = towerOpeningHeightIn(spec.heightIn, towerOvenFor(pkg));
  return heightIn === spec.heightIn ? spec : { ...spec, heightIn };
}
