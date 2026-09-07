import slotsFile from "../../data/slots.json";
import type { Slot, SlotId, SlotRecord } from "../types";
import { CABINET_STANDARDS, SLOT_PLACEMENT, ft } from "./room";
import { parseDataFile, slotsFileSchema } from "./schema";

export { ft, CABINET_STANDARDS, ROOM, RUN, RUNS, RUN_BY_ID, PANEL, FRIDGE_OPENING, HOOD_OPENING, ISLAND } from "./room";

/**
 * The six slots.
 *
 * Each one is assembled from two halves: `data/slots.json` carries the product
 * side (label, cutout, cabinet configuration, utility rough-ins) because that
 * is what Leo maintains, and `room.ts` supplies the placement, because where
 * the oven tower stands is scene construction. See docs/decisions.md D3.
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
function place(record: SlotRecord) {
  const placement = SLOT_PLACEMENT[record.id];
  if (record.id !== "slot-hood" || record.builtForCooktopIn === null) {
    return { ...record, ...placement };
  }
  const [x, , z] = placement.position;
  const y = ft(record.builtForCooktopIn + CABINET_STANDARDS.hood.aboveCooktopMinIn);
  return { ...record, ...placement, position: [x, y, z] as [number, number, number] };
}

export const SLOTS: Slot[] = parsed.slots.map(place);

export const SLOT_BY_ID: Record<SlotId, Slot> = Object.fromEntries(
  SLOTS.map((slot) => [slot.id, slot]),
) as Record<SlotId, Slot>;
