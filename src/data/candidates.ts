import { offeredFor } from "./catalogue";
import { fitCheck, type FitResult } from "./fit";
import { slotsOf } from "./packages";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, Package, SlotId } from "../types";

export interface Candidate {
  appliance: Appliance;
  /** Width gates (`fit.fits`); height and depth are for the row to mention. */
  fit: FitResult;
}

/**
 * The models a slot offers in a package, each with how it fits the opening.
 *
 * What the alternatives list has always shown — `offeredFor` for how a model
 * hangs, then `fitCheck` per row for width — moved here unchanged in round 82
 * so that the list and the model card read one answer rather than two. It is
 * not a new judgement of "can this model go in this slot", and not a third
 * copy of that question (D17's table, first row, which is still the two:
 * this, and `suitsPackageSlot` for a package switch).
 */
export function candidatesFor(slotId: SlotId, entry: Package): Candidate[] {
  return offeredFor(slotId, slotsOf(entry)[slotId]).map((appliance) => ({
    appliance,
    fit: fitCheck(SLOT_BY_ID[slotId], appliance),
  }));
}
