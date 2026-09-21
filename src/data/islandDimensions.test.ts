import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { dimensionsFor } from "./dimensions";
import { setActivePackage } from "./layoutState";
import { PACKAGE_BY_ID } from "./packages";
import { testPackageE } from "./testPackageE";
import { resetRoom } from "./testRoom";
import type { Appliance, SlotId } from "../types";

/**
 * The chain of heights over package E's island cooktop. Round 69.
 *
 * Round 52 left two figures wrong over an island and said so (D22): the
 * cooking surface read 4" — the cooktop's own body — so the clearance under
 * the canopy read 68", and the note beside it quoted a wall canopy's gas
 * figures, "gas min 30, max 40", at an induction hob under an island hood. The
 * chain took its cooking surface from `SLOT_BY_ID["slot-range"]`, which exists
 * in every room whether the package has a range or not. One assertion each.
 */
const E_ID = "test-dimensions-island-cooking";

function chainOfE() {
  PACKAGE_BY_ID[E_ID] = testPackageE(E_ID);
  resetRoom();
  const result = setActivePackage(E_ID);
  if (!result.ok) throw new Error(`E will not build: ${JSON.stringify(result.reasons)}`);
  const selection = Object.fromEntries(
    Object.entries(PACKAGE_BY_ID[E_ID].defaultSelection).map(([slot, id]) => [slot, APPLIANCE_BY_ID[id as string]]),
  ) as Record<SlotId, Appliance>;
  return Object.fromEntries(dimensionsFor(selection).map((d) => [d.id, d]));
}

afterAll(() => {
  delete PACKAGE_BY_ID[E_ID];
  resetRoom();
});

describe("the heights over an island cooktop", () => {
  it("reads the cooking surface as the glass, 36-1/4\" off the floor", () => {
    expect(chainOfE()["floor-to-cooktop"].valueIn).toBeCloseTo(36.25, 3);
  });

  it("reads 35-3/4\" from the glass to the canopy hung at 72\"", () => {
    expect(chainOfE()["cooktop-to-canopy"].valueIn).toBeCloseTo(35.75, 3);
  });

  it("notes the island hood's own minimum, the same for gas and induction", () => {
    expect(chainOfE()["cooktop-to-canopy"].noteKey).toBe("dimension.clearanceMinIsland");
  });

  it("gives that minimum as 30\", from the hood's guide", () => {
    expect(chainOfE()["cooktop-to-canopy"].noteVars).toEqual({ min: 30 });
  });
});
