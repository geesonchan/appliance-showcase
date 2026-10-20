import packagesFile from "../../data/packages.json";
import type { Package, PackageSlot, SlotId } from "../types";
import { packagesFileSchema, parseDataFile } from "./schema";
import type { LayoutShape } from "./layoutShape";

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

/** The package as written, for one made in a shape: its own list in the L. */
const BASES = new WeakMap<Package, Package>();
const SHAPED = new WeakMap<Package, Map<LayoutShape, Package>>();

/**
 * A package as it is built in a shape. Round 98b.
 *
 * The package's own list is the L's. A shape it writes differently
 * (`shapes` in data/packages.json, `packageShapeSchema`) leaves slots out,
 * writes others in full, and opens them with its own models; a shape it does
 * not write is the L's list unchanged. The same object every time it is asked
 * for, and the same answer whichever shape the package it is given was made
 * in: the L's list is always where it starts.
 */
export function packageInShape(entry: Package, shape: LayoutShape): Package {
  const base = BASES.get(entry) ?? entry;
  const over = shape === "L" ? undefined : base.shapes?.[shape];
  if (!over) return base;
  const made = SHAPED.get(base)?.get(shape);
  if (made) return made;

  const omit = new Set(over.omit);
  for (const slotId of [...over.omit, ...over.slots.map((slot) => slot.slotId)]) {
    if (!base.slots.some((slot) => slot.slotId === slotId)) {
      throw new Error(`data/packages.json: ${base.id} in ${shape} names ${slotId}, which it does not have`);
    }
  }
  const slots = base.slots
    .filter((slot) => !omit.has(slot.slotId))
    .map((slot) => over.slots.find((written) => written.slotId === slot.slotId) ?? slot);
  const defaultSelection = Object.fromEntries(
    Object.entries({ ...base.defaultSelection, ...over.defaultSelection }).filter(
      ([slotId]) => !omit.has(slotId as SlotId),
    ),
  ) as Package["defaultSelection"];
  for (const slot of slots) {
    if (!defaultSelection[slot.slotId]) {
      throw new Error(`data/packages.json: ${base.id} in ${shape} opens ${slot.slotId} with no model`);
    }
  }
  const shaped: Package = {
    ...base,
    slots,
    defaultSelection,
    columnOrder: base.columnOrder ? base.columnOrder.filter((slotId) => !omit.has(slotId)) : null,
  };
  BASES.set(shaped, base);
  SHAPE_OF.set(shaped, shape);
  SHAPED.set(base, new Map([...(SHAPED.get(base) ?? []), [shape, shaped]]));
  return shaped;
}

/** The package as written, whichever shape this one was made in. */
export const packageAsWritten = (entry: Package): Package => BASES.get(entry) ?? entry;

/** The shape a package was made in: the L for a package as written. */
export const shapeOfPackage = (entry: Package): LayoutShape => SHAPE_OF.get(entry) ?? "L";
const SHAPE_OF = new WeakMap<Package, LayoutShape>();

// Every package in every shape it writes, made once at load: a slot named
// that the package does not have, or a slot left with no model, is a fault in
// the data file and says so here rather than in front of a customer.
for (const entry of PACKAGES) {
  for (const shape of Object.keys(entry.shapes ?? {}) as LayoutShape[]) packageInShape(entry, shape);
}

/**
 * The package the room is built to.
 *
 * A live binding, like the room itself, and for the same reason: it is read by
 * geometry that runs inside the render loop. `setPackage` moves it; the rebuild
 * order in `layoutState.ts` is what makes the move take effect.
 */
export let PACKAGE: Package = DEFAULT_PACKAGE;
/** The shape `PACKAGE` is made in (round 98b): the L until a room in another stands. */
export let PACKAGE_SHAPE: LayoutShape = "L";
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

/**
 * The slots the room is built with, in the order they are listed and numbered.
 *
 * A live binding rather than a constant. Every package has the same six core
 * slots, but a larger one has more — a freezer column, a steam oven, a coffee
 * machine, a second dishwasher — and the left column, the pins and the plan
 * key list what this kitchen has rather than what the first one had. It moves
 * with `setPackage`, which is the one place the package moves.
 */
export let SLOT_ORDER: SlotId[] = [];

export function setPackage(id: string, shape: LayoutShape = PACKAGE_SHAPE) {
  const written = PACKAGE_BY_ID[id];
  if (!written) throw new Error(`No package "${id}"`);
  if (!written.available) throw new Error(`Package "${id}" is registered but has no slots`);
  const next = packageInShape(written, shape);
  PACKAGE_SHAPE = shape;
  PACKAGE = next;
  PACKAGE_SLOTS = slotsOf(next);
  SLOT_ORDER = slotOrderOf(next);
}

setPackage(DEFAULT_PACKAGE.id);
