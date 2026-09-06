import { describe, expect, it } from "vitest";
import { APPLIANCES_BY_SLOT, BLOWERS, blowersFor } from "./catalogue";
import { FIXTURES } from "./testFixtures";
import { fitCheck, formatInches } from "./fit";
import { SLOT_BY_ID } from "./slots";
import { deriveUtilities } from "./utilities";
import { effectiveCfm, needsMakeupAir } from "./ventilation";
import type { Appliance } from "../types";

const range = SLOT_BY_ID["slot-range"];
const hoodSlot = SLOT_BY_ID["slot-hood"];
const base = () => structuredClone(FIXTURES.gasRange36);

describe("fit check", () => {
  it("passes an appliance that matches the opening", () => {
    const result = fitCheck(range, base());
    expect(result.fits).toBe(true);
    expect(result.widthOverIn).toBe(0);
    expect(result.fillerEachSideIn).toBeNull();
  });

  it("fails a wider appliance and reports the overrun", () => {
    const wide = FIXTURES.dualFuelRange48; // 48" in a 36" opening
    const result = fitCheck(range, wide);
    expect(result.fits).toBe(false);
    expect(result.widthOverIn).toBe(12);
  });

  // Narrow is a trim question, not a blocker: the cabinetmaker adds filler.
  it("allows a narrower appliance and splits the filler between the sides", () => {
    const narrow = FIXTURES.inductionRange30; // 30" in a 36" opening
    const result = fitCheck(range, narrow);
    expect(result.fits).toBe(true);
    expect(result.widthOverIn).toBe(-6);
    expect(result.fillerEachSideIn).toBe(3);
  });

  it("falls back to the body width when there is no published cutout", () => {
    const noCutout = { ...base(), cutoutWidthIn: null, widthIn: 35.75 } as Appliance;
    expect(fitCheck(range, noCutout).widthOverIn).toBeCloseTo(-0.25);
  });

  it("reports depth without gating on it", () => {
    const fridge = SLOT_BY_ID["slot-fridge"];
    const deep = FIXTURES.fridgeCounterDepth;
    const result = fitCheck(fridge, deep);
    expect(result.fits).toBe(true);
    expect(result.depthOverIn).toBe(4);
  });

  it("leaves an unknown dimension null rather than guessing", () => {
    const unknown = { ...base(), cutoutDepthIn: null, depthIn: null } as Appliance;
    expect(fitCheck(range, unknown).depthOverIn).toBeNull();
  });

  it("formats to one decimal without a trailing zero", () => {
    expect(formatInches(6)).toBe('6"');
    expect(formatInches(5.75)).toBe('5.8"');
    expect(formatInches(0.25)).toBe('0.3"');
  });

  it("offers at least one model that fits every slot", () => {
    for (const [slotId, candidates] of Object.entries(APPLIANCES_BY_SLOT)) {
      const slot = SLOT_BY_ID[slotId as keyof typeof SLOT_BY_ID];
      const fitting = candidates.filter((item) => fitCheck(slot, item).fits);
      expect(fitting.length, `${slotId} has no model that fits`).toBeGreaterThan(0);
    }
  });
});

describe("blowers", () => {
  const separate = FIXTURES.hoodNeedsBlower; // ships without one
  const integrated300 = FIXTURES.hoodIntegrated300;
  const integrated600 = FIXTURES.hoodIntegrated600;
  const internal = FIXTURES.blower600; // 600 CFM
  const external = FIXTURES.blower1300; // 1300 CFM

  it("keeps blowers out of the hood picker", () => {
    const hoods = APPLIANCES_BY_SLOT["slot-hood"];
    expect(hoods.every((item) => item.category === "hood")).toBe(true);
    expect(BLOWERS.every((item) => item.category === "blower")).toBe(true);
  });

  it("offers blowers from the same maker as the hood, when there are any", () => {
    const sameBrand = BLOWERS.filter((b) => b.brand === separate.brand);
    if (sameBrand.length > 0) {
      expect(blowersFor(separate).every((b) => b.brand === separate.brand)).toBe(true);
    } else {
      // Nothing from that maker in stock: offer everything rather than nothing.
      expect(blowersFor(separate)).toEqual(BLOWERS);
    }
  });

  // A hood that ships without a blower has no CFM of its own.
  it("takes the CFM from the blower when the hood needs one", () => {
    expect(separate.requires.cfm).toBeNull();
    expect(effectiveCfm(separate, internal)).toBe(600);
    expect(effectiveCfm(separate, external)).toBe(1300);
    expect(effectiveCfm(separate, null)).toBeNull();
  });

  it("ignores the blower when the hood has its own", () => {
    expect(effectiveCfm(integrated300, external)).toBe(300);
    expect(effectiveCfm(integrated600, external)).toBe(600);
  });

  it("decides makeup air from whichever part moves the air", () => {
    // A hood with no blower yet moves no air at all.
    expect(needsMakeupAir(separate, null)).toBe(false);
    expect(needsMakeupAir(separate, internal)).toBe(true);
    expect(needsMakeupAir(integrated300, null)).toBe(false);
    expect(needsMakeupAir(integrated600, null)).toBe(true);
  });

  it("sizes the duct from the effective CFM, not the hood's own", () => {
    expect(deriveUtilities(hoodSlot, separate, null).duct?.diameterIn).toBe(
      hoodSlot.utilities.duct?.diameterIn,
    );
    expect(deriveUtilities(hoodSlot, separate, 600).duct?.diameterIn).toBe(8);
    expect(deriveUtilities(hoodSlot, separate, 1300).duct?.diameterIn).toBe(10);
    expect(deriveUtilities(hoodSlot, separate, 300).duct?.diameterIn).toBe(6);
  });
});

describe("utilities follow the appliance", () => {
  const gasRange = FIXTURES.gasRange36; // 119,500 BTU
  const induction = FIXTURES.inductionRange30;

  it("draws a gas line for a gas range", () => {
    const utilities = deriveUtilities(range, gasRange);
    expect(utilities.gas).not.toBeNull();
    expect(utilities.power.voltage).toBe(120);
  });

  it("drops the gas line and lifts the circuit for induction", () => {
    const utilities = deriveUtilities(range, induction);
    expect(utilities.gas).toBeNull();
    expect(utilities.power.voltage).toBe(240);
    expect(utilities.power.amps).toBe(40);
  });

  it("sizes the gas pipe by total BTU", () => {
    expect(deriveUtilities(range, gasRange).gas?.pipeSize).toBe('3/4"');
    expect(deriveUtilities(range, FIXTURES.gasRangeSmallBtu).gas?.pipeSize).toBe('1/2"');
  });

  it("keeps the slot's duct route", () => {
    expect(deriveUtilities(hoodSlot, FIXTURES.hoodIntegrated600).duct?.route).toBe(
      hoodSlot.utilities.duct?.route,
    );
  });

  it("falls back to the slot's rough-in when nothing is selected", () => {
    expect(deriveUtilities(range, undefined)).toEqual(range.utilities);
  });
});
