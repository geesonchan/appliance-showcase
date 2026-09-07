import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import {
  BUILDABLE_PACKAGES,
  DEFAULT_PACKAGE,
  PACKAGES,
  PACKAGE_BY_ID,
  slotsOf,
} from "./packages";
import { SLOT_BY_ID } from "./slots";

/**
 * The packages as data.
 *
 * What is asserted here is what a package *is*, not what any one of them
 * contains: Leo writes the contents, and a test that repeats them is a second
 * copy of the file. The exceptions are the two facts the code depends on —
 * package C's refrigerator has no enclosure and its hood is a chimney — because
 * those are the branches the generator takes.
 */
describe("the packages on offer", () => {
  it("offers at least one you can build, best tier first", () => {
    expect(BUILDABLE_PACKAGES.length).toBeGreaterThan(0);
    expect(DEFAULT_PACKAGE).toBe(BUILDABLE_PACKAGES[0]);

    const tiers = PACKAGES.map((entry) => entry.tier);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
    expect(new Set(tiers).size, "two packages share a tier").toBe(tiers.length);
  });

  it("registers a package that is not finished without offering it", () => {
    const registered = PACKAGES.filter((entry) => !entry.available);
    for (const entry of registered) {
      expect(entry.name.en.length, `${entry.id} has no name`).toBeGreaterThan(0);
      expect(entry.slots, `${entry.id} is unavailable but has slots`).toEqual([]);
      expect(BUILDABLE_PACKAGES).not.toContain(entry);
    }
  });

  it("fills every slot the app has, with a model the catalogue holds", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      const byId = slotsOf(entry);
      for (const slotId of Object.keys(SLOT_BY_ID) as (keyof typeof SLOT_BY_ID)[]) {
        const slot = byId[slotId];
        expect(slot, `${entry.id} does not fill ${slotId}`).toBeTruthy();

        // The package may narrow the slot, never contradict it: a dishwasher
        // slot takes a dishwasher whichever package is on.
        expect(
          SLOT_BY_ID[slotId].compatibleCategories,
          `${entry.id} puts a ${slot.category} in ${slotId}`,
        ).toContain(slot.category);

        const chosen = APPLIANCE_BY_ID[entry.defaultSelection[slotId]!];
        expect(chosen, `${entry.id}: ${slotId} names a model not in the catalogue`).toBeTruthy();
        expect(chosen.category, `${entry.id}: ${slotId} default is the wrong category`).toBe(
          slot.category,
        );
        expect(chosen.widthIn, `${entry.id}: ${slotId} default is the wrong width`).toBe(
          slot.widthIn,
        );
      }

      if (entry.defaultBlower) {
        expect(APPLIANCE_BY_ID[entry.defaultBlower], `${entry.id} blower`).toBeTruthy();
      }
    }
  });

  // The two things the generator branches on. If either moves, the branch it
  // feeds is untested rather than wrong, which is worse.
  it("keeps package C's refrigerator free-standing and its hood a chimney", () => {
    const c = slotsOf(PACKAGE_BY_ID["package-c"]);
    expect(c["slot-fridge"].enclosure).toBe(false);
    expect(c["slot-fridge"].tallUnit).toBe(true);
    expect(c["slot-hood"].installType).toBe("chimney");
  });

  it("keeps package A enclosed and under a cabinet, which is the other branch", () => {
    const a = slotsOf(PACKAGE_BY_ID["package-a"]);
    expect(a["slot-fridge"].enclosure).toBe(true);
    expect(a["slot-hood"].installType).toBe("under-cabinet");
  });
});
