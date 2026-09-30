import { afterAll, describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates";
import { offeredFor } from "./catalogue";
import { fitCheck } from "./fit";
import { setActivePackage } from "./layoutState";
import { BUILDABLE_PACKAGES, slotsOf } from "./packages";
import { resetRoom } from "./testRoom";
import { SLOT_BY_ID } from "./slots";
import type { SlotId } from "../types";

/**
 * Round 82: the list and the model card read their models from
 * `candidatesFor`, which is the list's own logic moved. Held here to what the
 * list computed before the move — `offeredFor`, then `fitCheck` per row — for
 * every slot every package declares, with the number of pairs compared in the
 * expectation (D22: a comparison over a set says how big the set was).
 */
afterAll(() => resetRoom());

describe("the models a slot offers", () => {
  it("are what offeredFor and fitCheck gave the list before round 82, in every package", () => {
    const mismatches: string[] = [];
    let compared = 0;
    for (const entry of BUILDABLE_PACKAGES) {
      // The room built to the package, as the page does: a slot's opening,
      // which the fit is measured against, is the room's.
      resetRoom();
      if (!setActivePackage(entry.id).ok) mismatches.push(`${entry.id}: room refused`);
      for (const slotId of Object.keys(slotsOf(entry)) as SlotId[]) {
        const before = offeredFor(slotId, slotsOf(entry)[slotId]).map((appliance) => ({
          id: appliance.id,
          fits: fitCheck(SLOT_BY_ID[slotId], appliance).fits,
        }));
        const now = candidatesFor(slotId, entry).map(({ appliance, fit }) => ({
          id: appliance.id,
          fits: fit.fits,
        }));
        compared += before.length;
        if (JSON.stringify(before) !== JSON.stringify(now)) mismatches.push(`${entry.id} ${slotId}`);
      }
    }
    expect({ packages: BUILDABLE_PACKAGES.length, enoughCompared: compared > 100, mismatches }).toEqual({
      packages: 5,
      enoughCompared: true,
      mismatches: [],
    });
  });
});
