import { describe, expect, it } from "vitest";
import { APPLIANCES_BY_SLOT, offeredFor } from "./catalogue";
import { PACKAGE_BY_ID, slotsOf } from "./packages";
import type { PackageSlot, SlotId } from "../types";

/**
 * What a slot's alternatives list offers. Round 45: HMIB42WS, a hood hung from
 * the ceiling, could be picked for the wall hood slot in packages B and D, where
 * it drew a stem 72" through the ceiling.
 */
const PACKAGES = ["package-a", "package-b", "package-c", "package-d"];

describe("what a slot offers", () => {
  it.each(PACKAGES)("does not offer %s's wall hood slot a hood hung from the ceiling", (id) => {
    const offered = offeredFor("slot-hood", slotsOf(PACKAGE_BY_ID[id])["slot-hood"]).map((a) => a.model);
    expect(offered).not.toContain("HMIB42WS");
    expect(offered.length).toBeGreaterThan(0);
  });

  it("offers an island hood to a slot that hangs one over an island", () => {
    const wall = slotsOf(PACKAGE_BY_ID["package-d"])["slot-hood"];
    const overIsland = { ...wall, installType: "island" } as PackageSlot;
    const offered = offeredFor("slot-hood", overIsland).map((a) => a.model);
    expect(offered).toContain("HMIB42WS");
    expect(offered).not.toContain("VCIN36GWS");
  });

  it("leaves every other slot's list as it was", () => {
    for (const id of PACKAGES) {
      for (const [slotId, slot] of Object.entries(slotsOf(PACKAGE_BY_ID[id]))) {
        if (slotId === "slot-hood") continue;
        expect(offeredFor(slotId as SlotId, slot).length, `${id} ${slotId}`).toBe(
          (APPLIANCES_BY_SLOT[slotId as SlotId] ?? []).length,
        );
      }
    }
  });
});
