import appliancesFile from "../../data/appliances.json";
import type { Appliance, Package, PackageSlot, SlotId } from "../types";
import { slotsOf } from "./packages";

/**
 * How a refrigerator installs, and so what stands round it. Round 89, Leo.
 *
 * From Leo using package C: its counter-depth T36FT820NS changed on the model
 * card to the built-in T36BT120NS, and the cabinets round it stayed as they
 * were — the 84" machine ran up behind the cabinet over C's 72" opening. What
 * stands round a refrigerator is the chosen model's to say, not the package's,
 * as what is under a cooking surface (D16, round 83) and over a hood (D16,
 * round 87) are:
 * - **built-in** — a built-in or a column: an enclosure the cabinetmaker builds
 *   to it, a finished panel each side as deep as the machine and a bridge over
 *   the head of its opening (D11 rule 11);
 * - **freestanding** — a counter-depth machine: counter-deep panels, a cabinet
 *   sitting on its own top, and against a return wall 3-1/2" for its doors
 *   (D11 rule 11).
 *
 * Read from the model's install type, never the word "freestanding", which the
 * importer gives to a row nothing else matched (D4). A refrigerator whose
 * install type says neither is refused loudly, not guessed.
 *
 * **The one answer** (D17's table, the fourteenth): the run's choice between
 * the two, the opening's height the cabinet over it stands on, whether the
 * machine fills round itself, and whether it can stand in a column bank all
 * ask this. Until round 89 every one of them read the package's slot.
 *
 * Kept with no imports from the room, as `hoodMount.ts` is, so the layout
 * template can ask it.
 */
export type FridgeMount = "built-in" | "freestanding";

export function fridgeMount(fridge: Pick<Appliance, "installType" | "id">): FridgeMount {
  const types = fridge.installType;
  if (types.includes("built-in") || types.includes("column")) return "built-in";
  if (types.includes("counter-depth")) return "freestanding";
  throw new Error(`${fridge.id}: no install type says how this refrigerator is built in (${types.join(", ")})`);
}

/**
 * The opening a refrigerator is built into, in inches high: its published
 * cutout, else its body. A built-in or a column asks 84"; T36FT820NS stands
 * 72" and the cabinet over it starts an inch above that (D11 rule 11).
 */
export function fridgeOpeningHeightIn(fridge: Pick<Appliance, "cutoutHeightIn" | "heightIn" | "id">): number {
  const height = fridge.cutoutHeightIn ?? fridge.heightIn;
  if (height === null) throw new Error(`${fridge.id}: no height to build its opening to`);
  return height;
}

/**
 * The refrigerator the customer chose, and the package it was chosen in.
 *
 * Tied to its package, as the range and the hood are (`rangeModelFor`,
 * `hoodModelFor`): a package switch builds the new room before the store
 * records the new package's refrigerator, and that room is built round its
 * own, not the one chosen in the package left.
 */
let CHOSEN: { packageId: string; appliance: Appliance } | null = null;

export function recordFridgeModel(appliance: Appliance | undefined, packageId: string) {
  CHOSEN = appliance ? { packageId, appliance } : null;
}

/** The refrigerator a package's room is built round: the one chosen in it, or its own. */
export function fridgeModelFor(pkg: Package): Appliance | undefined {
  if (CHOSEN && CHOSEN.packageId === pkg.id) return CHOSEN.appliance;
  const id = pkg.defaultSelection["slot-fridge"];
  if (!id) return undefined;
  const rows = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
  return rows.find((row) => row.id === id);
}

/**
 * The package's refrigerator slot as the chosen model is built in: an
 * enclosure or not, and the opening's height, the machine's. Every package's
 * own refrigerator gives back its slot exactly as `data/packages.json` writes
 * it (`fridgeSwap.test.ts`). The width is the slot's: the run keeps the
 * segment the package builds, and what a different surround needs is found
 * inside it (`fridge` in layoutTemplate.ts).
 */
export function fridgeSlotAsBuilt(pkg: Package, spec: PackageSlot): PackageSlot {
  const fridge = fridgeModelFor(pkg);
  if (!fridge) return spec;
  return {
    ...spec,
    enclosure: fridgeMount(fridge) === "built-in",
    heightIn: fridgeOpeningHeightIn(fridge),
  };
}

/** What a package says about each of its slots, the refrigerator's as its chosen model is built in. */
export function slotsAsBuilt(pkg: Package): Record<SlotId, PackageSlot> {
  const spec = slotsOf(pkg);
  const fridge = spec["slot-fridge"];
  return fridge ? { ...spec, "slot-fridge": fridgeSlotAsBuilt(pkg, fridge) } : spec;
}
