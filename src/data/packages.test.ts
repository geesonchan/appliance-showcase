import { describe, expect, it } from "vitest";
import {
  APPLIANCE_BY_ID,
  migrateBlower,
  migrateSelection,
  suitsPackageSlot,
} from "./catalogue";
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
        // And it installs the way the package installs it, so a package's own
        // default is one the migration would keep rather than replace.
        expect(
          suitsPackageSlot(chosen, slot),
          `${entry.id}: ${slotId} default is a ${chosen.installType.join("/")} ` +
            `in a ${slot.installType} slot`,
        ).toBe(true);
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

/**
 * What a customer keeps when they change their mind about the package.
 *
 * By slot id, because the six slots do not change. What cannot come across is a
 * model the new package has nowhere to put — and that is not only a question of
 * width: a built-in refrigerator is exactly as wide as package C's opening and
 * is still the wrong machine, because C stands it at the end of a run with no
 * panels either side.
 */
describe("changing package", () => {
  const a = PACKAGE_BY_ID["package-a"];
  const c = PACKAGE_BY_ID["package-c"];

  it("keeps what still fits and replaces what does not", () => {
    const inA = migrateSelection(a);
    // Everything deliberately chosen, so nothing is carried as a default.
    const intoC = migrateSelection(c, inA);

    // The microwave drawer is a 24" drawer in both, so it comes across.
    expect(intoC["slot-microwave"]).toBe(inA["slot-microwave"]);
    expect(intoC["slot-wine"]).toBe(inA["slot-wine"]);

    // The refrigerator cannot: A's is built in, C's stands on its own.
    expect(intoC["slot-fridge"]).not.toBe(inA["slot-fridge"]);
    expect(intoC["slot-fridge"]).toBe(c.defaultSelection["slot-fridge"]);

    // Neither can a 36" range in a 30" opening, or an under-cabinet hood
    // where the flue runs up the wall.
    expect(intoC["slot-range"]).toBe(c.defaultSelection["slot-range"]);
    expect(intoC["slot-hood"]).toBe(c.defaultSelection["slot-hood"]);

    // And back the other way, from a room somebody has been working in.
    const backToA = migrateSelection(a, intoC);
    expect(backToA["slot-fridge"]).toBe(a.defaultSelection["slot-fridge"]);
    expect(backToA["slot-microwave"]).toBe(intoC["slot-microwave"]);
  });

  it("carries a deliberate swap across, when the new package can take it", () => {
    // A dishwasher chosen by hand rather than by default: the panel-ready
    // Bosch is 24" and freestanding, which is what C asks for too.
    const swapped = { ...migrateSelection(c), "slot-dishwasher": "bosch-shv78cm3n" } as Record<
      string,
      string
    >;
    expect(migrateSelection(c, swapped)["slot-dishwasher"]).toBe("bosch-shv78cm3n");
  });

  it("gives way on a slot nobody touched, so C's kitchen is C's", () => {
    // Straight off A's shelf, nothing chosen. Every slot should come out as
    // package C specifies it, including the ones A's model would have fitted.
    const intoC = migrateSelection(c, migrateSelection(a), a);
    for (const slot of c.slots) {
      expect(intoC[slot.slotId], `${slot.slotId} carried A's default into C`).toBe(
        c.defaultSelection[slot.slotId],
      );
    }
  });

  it("still carries a swap the customer made themselves", () => {
    // A's default dishwasher is the panel-ready Bosch; ask for the stainless
    // one on purpose and it comes across, because C takes a 24" freestanding
    // dishwasher either way.
    const chosen = { ...migrateSelection(a), "slot-dishwasher": "bosch-shx78cm5n" };
    expect(migrateSelection(c, chosen, a)["slot-dishwasher"]).toBe("bosch-shx78cm5n");
  });

  it("drops a blower the new hood has no room for", () => {
    const intoC = migrateSelection(c, migrateSelection(a));
    const hood = APPLIANCE_BY_ID[intoC["slot-hood"]];
    // C's hood has its blower in it, so a separate one is a part that fits
    // nothing — it goes rather than sitting on the quote.
    expect(hood.blower).toBe("integrated");
    expect(migrateBlower(c, hood, a.defaultBlower)).toBe(null);
  });

  it("keeps a blower the new hood accepts", () => {
    const hood = APPLIANCE_BY_ID[a.defaultSelection["slot-hood"]!];
    expect(migrateBlower(a, hood, a.defaultBlower)).toBe(a.defaultBlower);
  });
});
