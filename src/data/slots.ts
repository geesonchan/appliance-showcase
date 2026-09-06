import slotsFile from "../../data/slots.json";
import type { Slot, SlotId } from "../types";
import { SLOT_PLACEMENT } from "./room";
import { parseDataFile, slotsFileSchema } from "./schema";

export { ft, ROOM, RUN, BACK_RUN, LEFT_RUN, PANEL, FRIDGE_OPENING, ISLAND } from "./room";

/**
 * The six slots.
 *
 * Each one is assembled from two halves: `data/slots.json` carries the product
 * side (label, cutout, cabinet configuration, utility rough-ins) because that
 * is what Leo maintains, and `room.ts` supplies the placement, because where
 * the oven tower stands is scene construction. See docs/decisions.md D3.
 */
const parsed = parseDataFile(slotsFileSchema, slotsFile, "data/slots.json");

export const SLOTS: Slot[] = parsed.slots.map((record) => ({
  ...record,
  ...SLOT_PLACEMENT[record.id],
}));

export const SLOT_BY_ID: Record<SlotId, Slot> = Object.fromEntries(
  SLOTS.map((slot) => [slot.id, slot]),
) as Record<SlotId, Slot>;
