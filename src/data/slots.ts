import slotsFile from "../../data/slots.json";
import type { PackageSlot, Slot, SlotId, SlotRecord } from "../types";
import { PACKAGE_SLOTS } from "./packages";
import { CABINET_STANDARDS, SLOT_PLACEMENT, ft } from "./room";
import { parseDataFile, slotsFileSchema } from "./schema";

export { ft, CABINET_STANDARDS, ROOM, RUN, RUNS, RUN_BY_ID, PANEL, FRIDGE_OPENING, HOOD_OPENING, ISLAND } from "./room";

/**
 * The six slots.
 *
 * Each one is assembled from three halves. `data/slots.json` carries the
 * product side — label, utility rough-ins, best view — because that is what
 * Leo maintains and because it does not change when the model does: a 30" range
 * and a 36" range still want gas in the same place. `room.ts` supplies the
 * placement, because where the tower stands is scene construction. And the
 * package supplies the size and the joinery, because that is what separates one
 * package from another. See docs/decisions.md D3.
 */
const parsed = parseDataFile(slotsFileSchema, slotsFile, "data/slots.json");

/**
 * The canopy hangs its clearance above the cooking surface.
 *
 * That is the range's own top, not the 36" counter beside it: a slide-in
 * range's grates stand proud of the counter, and hanging the hood off the
 * counter quietly ate three quarters of an inch out of a clearance the gas
 * minimum has no slack in. The slot records the surface the wall was drilled
 * for; swapping in a range that differs from it is what the clearance rule is
 * for. See docs/decisions.md D13.
 */
/**
 * The slot as this package builds it.
 *
 * The width is the appliance's own hole, which is what the cutout and the
 * cabinet opening both are — they are the same number and the fit check reads
 * them as one. What a finished panel each side adds is the *run's* problem, and
 * `openingIn` in layoutTemplate is where it is added; a freestanding
 * refrigerator has no panels and so no difference between the two.
 *
 * The enclosure flag changes what kind of hole it is: joinery built round the
 * appliance with finished sides, or a full-height unit standing on its own.
 */
function size(record: SlotRecord, spec: PackageSlot): SlotRecord {
  const width = { w: spec.widthIn };
  return {
    ...record,
    cutout: { ...record.cutout, ...width },
    cabinetConfig: {
      ...record.cabinetConfig,
      type: spec.enclosure ? "enclosure" : spec.tallUnit ? "tall" : record.cabinetConfig.type,
      openingIn: { ...record.cabinetConfig.openingIn, ...width },
      finishedSides: spec.enclosure ? record.cabinetConfig.finishedSides : 0,
    },
  };
}

function place(record: SlotRecord) {
  const placement = SLOT_PLACEMENT[record.id];
  if (record.id !== "slot-hood" || record.builtForCooktopIn === null) {
    return { ...record, ...placement };
  }
  const [x, , z] = placement.position;
  const y = ft(record.builtForCooktopIn + CABINET_STANDARDS.hood.aboveCooktopMinIn);
  return { ...record, ...placement, position: [x, y, z] as [number, number, number] };
}

export let SLOTS: Slot[];
export let SLOT_BY_ID: Record<SlotId, Slot>;

/**
 * Re-place the slots against the room as it now stands.
 *
 * The product half of a slot never changes; only where it ended up does. So a
 * rebuild re-runs the placement over the same parsed records rather than
 * re-reading and re-validating the file, which would make every slider step
 * pay for a schema pass.
 */
export function rebuildSlots() {
  SLOTS = parsed.slots.map((record) => place(size(record, PACKAGE_SLOTS[record.id])));
  SLOT_BY_ID = Object.fromEntries(SLOTS.map((slot) => [slot.id, slot])) as Record<SlotId, Slot>;
}

rebuildSlots();
