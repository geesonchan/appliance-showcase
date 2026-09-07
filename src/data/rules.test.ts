import { describe, expect, it } from "vitest";
import { FIXTURES } from "./testFixtures";
import { SLOT_BY_ID } from "./slots";
import {
  RULES,
  canopyClearance,
  ductDiameterFor,
  evaluateSlot,
  packageContext,
} from "./rules";
import { outletSize } from "./hood";
import { slotAvailability } from "./availability";
import type { Appliance, SlotId } from "../types";

const slot = (id: SlotId) => SLOT_BY_ID[id];


/** Fire the slot-scope rules for one appliance, with no blower in play. */
const fire = (slotId: SlotId, appliance: Appliance, blower: Appliance | null = null) =>
  evaluateSlot(slot(slotId), appliance, packageContext(undefined, blower)).map(
    (finding) => finding.ruleId,
  );

/** Fire the package-scope rules for a hood and blower pairing. */
const firePackage = (hood: Appliance, blower: Appliance | null) =>
  evaluateSlot(slot("slot-hood"), hood, packageContext(hood, blower), "package").map(
    (finding) => finding.ruleId,
  );

describe("the rules file", () => {
  it("gives every rule a unique id", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it("has a message for every rule", () => {
    for (const rule of RULES) expect(rule.messageKey, rule.id).toMatch(/^rule\./);
  });
});

/**
 * One appliance that fires each rule and one that does not, so moving a
 * threshold in data/rules.json fails a test that names the case that crossed it.
 *
 * These come from `testFixtures`, not from the live catalogue: stock is
 * re-imported whenever it changes, and a rule test keyed to a SKU would fail
 * the day that SKU sold out.
 */
describe("§3.5.4 rules", () => {
  it("power-upgrade: induction in a 120V slot, but not a gas range", () => {
    expect(fire("slot-range", FIXTURES.inductionRange30)).toContain("power-upgrade");
    expect(fire("slot-range", FIXTURES.gasRange36)).not.toContain("power-upgrade");
  });

  it("dual-fuel: a dual-fuel range, but not a gas one", () => {
    expect(fire("slot-range", FIXTURES.dualFuelRange48)).toContain("dual-fuel");
    expect(fire("slot-range", FIXTURES.gasRange36)).not.toContain("dual-fuel");
  });

  it("gas-pipe-size: 119,500 BTU wants 3/4\", 61,000 does not", () => {
    expect(fire("slot-range", FIXTURES.gasRange36)).toContain("gas-pipe-size");
    expect(fire("slot-range", FIXTURES.gasRangeSmallBtu)).not.toContain("gas-pipe-size");
  });

  it("gas-line-missing: a gas appliance in a slot with no gas", () => {
    const gasRange = FIXTURES.gasRange36;
    // The wine slot has no gas rough-in at all.
    expect(fire("slot-wine", gasRange)).toContain("gas-line-missing");
    expect(fire("slot-range", gasRange)).not.toContain("gas-line-missing");
  });

  it("blower-missing: a hood that ships without one, until one is chosen", () => {
    const needsBlower = FIXTURES.hoodNeedsBlower;
    expect(fire("slot-hood", needsBlower, null)).toContain("blower-missing");
    expect(fire("slot-hood", needsBlower, FIXTURES.blower600)).not.toContain(
      "blower-missing",
    );
    // A hood with its own blower never asks.
    expect(fire("slot-hood", FIXTURES.hoodIntegrated300, null)).not.toContain("blower-missing");
  });

  it("makeup-air: 600 CFM triggers it, 300 does not", () => {
    expect(firePackage(FIXTURES.hoodNeedsBlower, FIXTURES.blower600)).toContain("makeup-air");
    expect(firePackage(FIXTURES.hoodIntegrated300, null)).not.toContain("makeup-air");
  });

  it("integrated-lead-time: an integrated fridge, but not a built-in one", () => {
    expect(fire("slot-fridge", FIXTURES.fridgeIntegrated)).toContain("integrated-lead-time");
    expect(fire("slot-fridge", FIXTURES.fridgeBuiltIn)).not.toContain(
      "integrated-lead-time",
    );
  });

  it("filler-needed: a 30\" range in a 36\" opening, but not a 36\" one", () => {
    expect(fire("slot-range", FIXTURES.inductionRange30)).toContain("filler-needed");
    expect(fire("slot-range", FIXTURES.gasRange36)).not.toContain("filler-needed");
  });

  it("deeper-than-opening: a counter-depth fridge, but not a built-in", () => {
    expect(fire("slot-fridge", FIXTURES.fridgeCounterDepth)).toContain("deeper-than-opening");
    expect(fire("slot-fridge", FIXTURES.fridgeBuiltIn)).not.toContain(
      "deeper-than-opening",
    );
  });

  it("reports the numbers the message needs", () => {
    const findings = evaluateSlot(
      slot("slot-range"),
      FIXTURES.inductionRange30,
      packageContext(undefined, null),
    );
    const power = findings.find((f) => f.ruleId === "power-upgrade");
    expect(power?.params).toEqual({ voltage: 240, amps: 40 });
    const filler = findings.find((f) => f.ruleId === "filler-needed");
    expect(filler?.params.filler).toBe(3);
  });
});

describe("duct sizing comes from the thresholds table", () => {
  it.each([
    [300, 6],
    [400, 6],
    [401, 8],
    [600, 8],
    [601, 10],
    [1300, 10],
  ])("%s CFM wants %s inches", (cfm, expected) => {
    expect(ductDiameterFor(cfm)).toBe(expected);
  });

  it("has no opinion with no airflow", () => {
    expect(ductDiameterFor(null)).toBeNull();
  });
});

/**
 * A fully specified package produces no blockers. Built from fixtures rather
 * than from the shipped scheme: whether today's stock happens to contain a
 * blower is a question about the inventory, and the checklist already answers
 * it in the app.
 */
describe("a complete package", () => {
  const complete = {
    "slot-fridge": FIXTURES.fridgeBuiltIn,
    "slot-range": FIXTURES.gasRange36,
    "slot-hood": FIXTURES.hoodIntegrated600,
    "slot-dishwasher": FIXTURES.dishwasher,
    "slot-microwave": FIXTURES.microwaveDrawer,
    "slot-wine": FIXTURES.wine,
  } as Record<SlotId, Appliance>;

  const findingsFor = (selection: Record<SlotId, Appliance>, blower: Appliance | null) => {
    const context = packageContext(selection["slot-hood"], blower);
    return [
      ...Object.entries(selection).flatMap(([slotId, item]) =>
        evaluateSlot(slot(slotId as SlotId), item, context),
      ),
      ...evaluateSlot(slot("slot-hood"), selection["slot-hood"], context, "package"),
    ];
  };

  it("has no blockers", () => {
    expect(findingsFor(complete, null).filter((f) => f.severity === "blocker")).toEqual([]);
  });

  it("blocks as soon as a hood needs a blower and has none", () => {
    const withSeparateHood = { ...complete, "slot-hood": FIXTURES.hoodNeedsBlower };
    expect(
      findingsFor(withSeparateHood, null).map((f) => f.ruleId),
    ).toContain("blower-missing");
    expect(
      findingsFor(withSeparateHood, FIXTURES.blower600).map((f) => f.ruleId),
    ).not.toContain("blower-missing");
  });
});

describe("slot availability", () => {
  const otr = FIXTURES.microwaveOtr;

  it("closes the hood slot when an over-the-range microwave takes the wall", () => {
    const availability = slotAvailability({ "slot-microwave": otr });
    expect(availability["slot-hood"]?.available).toBe(false);
    expect(availability["slot-hood"]?.takenBy).toContain(otr.model);
  });

  it("leaves it open for a drawer microwave", () => {
    const availability = slotAvailability({
      "slot-microwave": FIXTURES.microwaveDrawer,
    });
    expect(availability["slot-hood"]).toBeUndefined();
  });

  // Scheme 01 cannot reach this state: the island opening is 24" and every OTR
  // is 30", so the fit check blocks it first. The rule is here for Scheme 02,
  // where the microwave goes back over the range.
  it("is unreachable in Scheme 01, because no OTR fits the island", () => {
    const microwaveSlot = slot("slot-microwave");
    expect(microwaveSlot.cutout.w).toBe(24);
  });
});

describe("message numbers", () => {
  const paramsOf = (slotId: SlotId, appliance: Appliance, ruleId: string, blower: Appliance | null = null) =>
    evaluateSlot(slot(slotId), appliance, packageContext(appliance, blower)).find(
      (finding) => finding.ruleId === ruleId,
    )?.params;

  // "119500 BTU total" on a quote is a number nobody reads at a glance.
  it("separates thousands in a gas load", () => {
    expect(paramsOf("slot-range", FIXTURES.gasRange36, "gas-pipe-size")?.btu).toBe("119,500");
  });

  it("separates thousands in an airflow", () => {
    const findings = evaluateSlot(
      slot("slot-hood"),
      FIXTURES.hoodNeedsBlower,
      packageContext(FIXTURES.hoodNeedsBlower, FIXTURES.blower1300),
      "package",
    );
    expect(findings.find((f) => f.ruleId === "duct-size")?.params.cfm).toBe("1,300");
  });

  it("keeps inches to one decimal, unseparated", () => {
    const deep = { ...FIXTURES.fridgeCounterDepth } as Appliance;
    expect(paramsOf("slot-fridge", deep, "deeper-than-opening")?.depth).toBe(4);
  });
});

describe("the canopy has to clear the cooking surface", () => {
  const hood = FIXTURES.hoodNeedsBlower;

  it("passes for the range the room was built for", () => {
    const built = {
      ...FIXTURES.gasRange36,
      heightIn: slot("slot-hood").builtForCooktopIn!,
    } as Appliance;
    expect(canopyClearance(built)).toBe(30);
    expect(firePackage2(hood, built)).not.toContain("canopy-clearance");
  });

  // The canopy hangs where the wall was drilled; a taller range eats the gap.
  it("fires when a taller range closes the gap below 30 inches", () => {
    const tall = {
      ...FIXTURES.gasRange36,
      heightIn: slot("slot-hood").builtForCooktopIn! + 1,
    } as Appliance;
    expect(canopyClearance(tall)).toBeLessThan(30);
    expect(firePackage2(hood, tall)).toContain("canopy-clearance");
  });

  it("says nothing when there is no range to measure from", () => {
    expect(canopyClearance(undefined)).toBeNull();
    expect(firePackage2(hood, undefined)).not.toContain("canopy-clearance");
  });

  it("quotes the cabinet cutout at the size of the hood's own outlet", () => {
    const findings = evaluateSlot(slot("slot-hood"), hood, packageContext(hood, null));
    const cutout = findings.find((f) => f.ruleId === "hood-cabinet-cutout");
    expect(cutout).toBeDefined();
    expect(cutout!.params.size).toBe(outletSize());
    expect(String(cutout!.params.size)).toContain("8.8125");
  });
});

/** Package-scope rules for a hood and the range under it. */
function firePackage2(hood: Appliance, range: Appliance | undefined) {
  return evaluateSlot(
    slot("slot-hood"),
    hood,
    packageContext(hood, null, range),
    "package",
  ).map((finding) => finding.ruleId);
}
