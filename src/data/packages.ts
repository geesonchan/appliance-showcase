import packagesFile from "../../data/packages.json";
import type { Package, PackageSlot, SlotId } from "../types";
import { packagesFileSchema, parseDataFile } from "./schema";

/**
 * The packages on offer, and which one the room is currently built to.
 *
 * A package is the third half of a slot. `data/slots.json` carries the product
 * side — the label, the utilities, the rough-in — because that does not change
 * when the model does: a 30" range and a 36" range both want gas in the same
 * place. `room.ts` carries the placement, because where a thing stands is
 * scene construction. And this carries what *this* package puts there: how wide
 * it is, how it installs, whether it is a full-height unit and whether the
 * cabinetmaker builds around it.
 *
 * Which means the generator no longer knows the six appliances by name. It asks
 * the package what is on the list and packs what it is told, so a second
 * package is a data file rather than a branch.
 */
const parsed = parseDataFile(packagesFileSchema, packagesFile, "data/packages.json");

/** Best first. The picker shows them in this order. */
export const PACKAGES: Package[] = [...parsed.packages].sort((a, b) => a.tier - b.tier);

export const PACKAGE_BY_ID: Record<string, Package> = Object.fromEntries(
  PACKAGES.map((entry) => [entry.id, entry]),
);

/** The ones you can actually build. A registered package is named, not offered. */
export const BUILDABLE_PACKAGES = PACKAGES.filter((entry) => entry.available);

if (BUILDABLE_PACKAGES.length === 0) {
  throw new Error("data/packages.json: every package is marked unavailable");
}

export const DEFAULT_PACKAGE = BUILDABLE_PACKAGES[0];

/**
 * The package the room is built to.
 *
 * A live binding, like the room itself, and for the same reason: it is read by
 * geometry that runs inside the render loop. `setPackage` moves it; the rebuild
 * order in `layoutState.ts` is what makes the move take effect.
 */
export let PACKAGE: Package = DEFAULT_PACKAGE;
export let PACKAGE_SLOTS: Record<SlotId, PackageSlot>;

/** What a package says about each of its slots, by id. */
export function slotsOf(entry: Package): Record<SlotId, PackageSlot> {
  return Object.fromEntries(entry.slots.map((slot) => [slot.slotId, slot])) as Record<
    SlotId,
    PackageSlot
  >;
}

/** The order the slots are packed and listed in, as the package writes them. */
export const slotOrderOf = (entry: Package): SlotId[] => entry.slots.map((slot) => slot.slotId);

export function setPackage(id: string) {
  const next = PACKAGE_BY_ID[id];
  if (!next) throw new Error(`No package "${id}"`);
  if (!next.available) throw new Error(`Package "${id}" is registered but has no slots`);
  PACKAGE = next;
  PACKAGE_SLOTS = slotsOf(next);
}

setPackage(DEFAULT_PACKAGE.id);
