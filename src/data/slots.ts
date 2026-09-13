import slotsFile from "../../data/slots.json";
import type { PackageSlot, Slot, SlotId, SlotRecord } from "../types";
import { PACKAGE_SLOTS } from "./packages";
import { CABINET_STANDARDS, OMITTED_SLOTS, SLOT_PLACEMENT, ft } from "./room";
import { parseDataFile, slotsFileSchema } from "./schema";

export { ft, CABINET_STANDARDS, ROOM, RUN, RUNS, RUN_BY_ID, PANEL, FRIDGE_OPENING, HOOD_OPENING, ISLAND, OMITTED_SLOTS, isOmitted } from "./room";

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
 * Every slot record in the file, whether or not the room has it.
 *
 * The catalogue reads these to decide what each opening can take, and it has to
 * know that for slots the current package does not use — a model filed under
 * the freezer column is still a freezer when package A is on screen.
 */
export const SLOT_RECORDS: SlotRecord[] = parsed.slots;

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
  const box = {
    w: spec.widthIn,
    ...(spec.heightIn === null ? {} : { h: spec.heightIn }),
    ...(spec.depthIn === null ? {} : { d: spec.depthIn }),
  };
  return {
    ...record,
    // What this package's machine actually needs, where it differs from what
    // the slot was drawn for: a 240V oven where a 120V drawer stood, a 3/4"
    // gas line for 99,000 BTU. Anything the package leaves out is the slot's.
    utilities: {
      ...record.utilities,
      ...(spec.utilities?.gas ? { gas: spec.utilities.gas } : {}),
      ...(spec.utilities?.power ? { power: spec.utilities.power } : {}),
      ...(spec.utilities?.duct ? { duct: spec.utilities.duct } : {}),
    },
    // The hood is hung off the cooking surface the wall was drilled for, and
    // which surface that is belongs to the package. See D13 and D16.
    ...(spec.builtForCooktopIn === null ? {} : { builtForCooktopIn: spec.builtForCooktopIn }),
    cutout: { ...record.cutout, ...box },
    // Where the fly-in comes from, when this package has moved the machine to
    // another wall. See `bestView` on the package slot.
    bestView: spec.bestView ?? record.bestView,
    cabinetConfig: {
      ...record.cabinetConfig,
      type: spec.enclosure ? "enclosure" : spec.tallUnit ? "tall" : record.cabinetConfig.type,
      openingIn: { ...record.cabinetConfig.openingIn, ...box },
      // A freestanding machine still gets a panel each side — they are just 24"
      // deep and do not wrap its doors. See docs/decisions.md D11 rule 11.
      finishedSides: record.cabinetConfig.finishedSides,
      panelReady: spec.panelReady ?? record.cabinetConfig.panelReady,
    },
  };
}

function place(record: SlotRecord): Slot {
  const placement = SLOT_PLACEMENT[record.id];
  // A slot the package names and the layout did not place is a bug in the
  // generator, not a room: say which one rather than drawing it at the origin.
  if (!placement) throw new Error(`layout placed nothing for ${record.id}`);
  if (record.id !== "slot-hood" || record.builtForCooktopIn === null) {
    return { ...record, ...placement };
  }
  const [x, , z] = placement.position;
  const y = ft(record.builtForCooktopIn + CABINET_STANDARDS.hood.aboveCooktopMinIn);
  return { ...record, ...placement, position: [x, y, z] as [number, number, number] };
}

/** The slots standing in the room: the package's, less anything omitted. */
export let SLOTS: Slot[];
/**
 * Every slot the package names, omitted ones included.
 *
 * A slot the room was built without is still a slot somebody can look up — the
 * checklist names it, the catalogue files models under it — so it keeps its
 * entry here. `SLOTS` is the list of what is actually in the room.
 */
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
  // Only the slots this package has. The file describes every opening any
  // package might have; the room is built with the ones this one names.
  const all = parsed.slots
    .filter((record) => PACKAGE_SLOTS[record.id])
    .map((record) => place(size(record, PACKAGE_SLOTS[record.id])));
  SLOT_BY_ID = Object.fromEntries(all.map((slot) => [slot.id, slot])) as Record<SlotId, Slot>;
  SLOTS = all.filter((slot) => !OMITTED_SLOTS.includes(slot.id));
}

rebuildSlots();
