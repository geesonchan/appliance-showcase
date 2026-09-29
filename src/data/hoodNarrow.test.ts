import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { listWidth } from "./fit";
import { setActivePackage, setHoodModel } from "./layoutState";
import { BUILDABLE_PACKAGES } from "./packages";
import { SLOT_BY_ID } from "./slots";
import { defaultSelectionOf, resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import type { Appliance, SlotId } from "../types";

/**
 * A hood narrower than the cooking surface under it, and the width the list
 * prints. Round 79.
 *
 * The rule is Leo's site practice, "一般 Hood 宽度是大于等于炉头的宽度的": a
 * reminder on the checklist and the quote, never a refusal, raised only when
 * the hood is more than 1" narrower (a display figure, no outside source). An
 * insert liner counts as the housing round it. Samples are real models (D7),
 * and the edges are held both sides. One assertion per test.
 */
const PH36HWS = APPLIANCE_BY_ID["thermador-ph36hws"];
const AK7300AS = APPLIANCE_BY_ID["zephyr-ak7300as"];
const PRG366WH = APPLIANCE_BY_ID["thermador-prg366wh"];

function packageSelection(id: string, overrides: Partial<Record<SlotId, Appliance>> = {}) {
  resetRoom();
  const switched = setActivePackage(id);
  if (!switched.ok) throw new Error(`${id} will not build`);
  const selection = { ...defaultSelectionOf(id), ...overrides };
  setHoodModel(selection["slot-hood"]);
  return selection;
}

const narrowLines = (selection: Record<SlotId, Appliance>) =>
  checklistFor(selection, null).findings.filter((f) => f.ruleId === "hood-narrower-than-cooking");

/** A hood in package A this many inches narrower than PRG366WH's 36". */
const hoodNarrowerBy = (inches: number) =>
  ({ ...PH36HWS, id: "test-hood", widthIn: 36 - inches, cutoutWidthIn: 36 - inches }) as Appliance;

beforeEach(() => resetRoom());
afterAll(() => {
  resetRoom();
  setHoodModel(PH36HWS);
});

describe("a hood narrower than the cooking surface", () => {
  it("raises the line for a 30 inch AK7300AS over package A's 36 inch PRG366WH", () => {
    const lines = narrowLines(packageSelection("package-a", { "slot-hood": AK7300AS }));
    expect(lines.map((f) => [f.slot, f.params.hood, f.params.cooking])).toEqual([["slot-hood", "30", "36"]]);
  });

  it("says nothing for package A as it opens, 36 over 36", () => {
    expect(narrowLines(packageSelection("package-a"))).toEqual([]);
  });

  for (const pkg of BUILDABLE_PACKAGES) {
    it(`says nothing for ${pkg.id} as it opens`, () => {
      expect(narrowLines(packageSelection(pkg.id))).toEqual([]);
    });
  }

  it("says nothing at exactly 1 inch narrower", () => {
    expect(narrowLines(packageSelection("package-a", { "slot-hood": hoodNarrowerBy(1) }))).toEqual([]);
  });

  it("raises it at 1-1/16 inches narrower, and writes the width as a fraction", () => {
    const lines = narrowLines(packageSelection("package-a", { "slot-hood": hoodNarrowerBy(1.0625) }));
    expect(lines.map((f) => f.params.hood)).toEqual(["34-15/16"]);
  });

  it("measures an insert liner as its housing: package B's 33-3/4 inch liner in a 42 inch housing", () => {
    const selection = packageSelection("package-b");
    expect({ liner: selection["slot-hood"].widthIn, housing: SLOT_BY_ID["slot-hood"].cutout.w, lines: narrowLines(selection) }).toEqual({
      liner: 33.75,
      housing: 42,
      lines: [],
    });
  });

  it("measures an island hood against the island's cooktop", () => {
    const narrowIslandHood = { ...APPLIANCE_BY_ID["thermador-hmib42ws"], id: "test-island-hood", widthIn: 30 } as Appliance;
    const lines = narrowLines(packageSelection("package-e", { "slot-hood": narrowIslandHood }));
    expect(lines.map((f) => [f.params.hood, f.params.cooking])).toEqual([["30", "37"]]);
  });

  it("uses PRG366WH as package A's cooking surface", () => {
    expect(packageSelection("package-a")["slot-range"].id).toBe(PRG366WH.id);
  });
});

describe("the width the appliance list prints", () => {
  const hoodSlot = () => SLOT_BY_ID["slot-hood"];

  it("prints the machine and the opening for a 30 inch hood in a 36 inch slot", () => {
    packageSelection("package-a");
    expect(listWidth(AK7300AS, hoodSlot())).toEqual({ modelIn: 30, openingIn: 36 });
  });

  it("prints one figure for a machine within half an inch of its opening", () => {
    packageSelection("package-a");
    expect(listWidth({ ...PH36HWS, widthIn: 35.5 } as Appliance, hoodSlot())).toEqual({ modelIn: 35.5, openingIn: null });
  });

  it("prints both just past half an inch", () => {
    packageSelection("package-a");
    expect(listWidth({ ...PH36HWS, widthIn: 35.4375 } as Appliance, hoodSlot())).toEqual({ modelIn: 35.4375, openingIn: 36 });
  });

  it("prints the opening where nothing is chosen", () => {
    packageSelection("package-a");
    expect(listWidth(undefined, hoodSlot())).toEqual({ modelIn: 36, openingIn: null });
  });
});
