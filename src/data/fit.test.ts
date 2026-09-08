import { describe, expect, it } from "vitest";
import {
  APPLIANCES_BY_SLOT,
  BLOWERS,
  blowerListUnverified,
  blowersFor,
} from "./catalogue";
import { COMPATIBLE_BLOWERS } from "../../scripts/normalise";
import { FIXTURES } from "./testFixtures";
import { fitCheck, formatInches, protrusionDatumIn } from "./fit";
import { PROTRUSION_DATUM } from "./rules";
import { CABINET_STANDARDS } from "./roomShell";
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

  it("reports depth without gating on it, from the cabinet face", () => {
    const fridge = SLOT_BY_ID["slot-fridge"];
    const deep = FIXTURES.fridgeCounterDepth;
    const result = fitCheck(fridge, deep);
    expect(result.fits).toBe(true);
    // 28-1/2" of machine past a 24" run. One datum everywhere a customer can
    // see it: not the carcass line, and not the rough opening.
    expect(result.depthOverIn).toBe(4.5);
  });

  it("says a built-in stands proud of nothing, because it finishes flush", () => {
    // Its cutout is 25" — an inch of service space behind it — and measuring
    // the protrusion against that reported it as sticking out of the cabinets
    // it is defined by finishing flush with.
    const result = fitCheck(SLOT_BY_ID["slot-fridge"], FIXTURES.fridgeBuiltIn);
    expect(result.depthOverIn).toBe(0);
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

describe("blower compatibility comes from the chart, not the badge", () => {
  const hood = (model: string, compatible: string[]): Appliance => ({
    ...FIXTURES.hoodNeedsBlower,
    model,
    compatibleBlowers: compatible,
  });

  it("offers only the models the hood is listed for", () => {
    const inStock = BLOWERS.map((b) => b.model);
    expect(inStock.length).toBeGreaterThan(1);
    const only = blowersFor(hood("PH36HWS", [inStock[0]]));
    expect(only.map((b) => b.model)).toEqual([inStock[0]]);
  });

  // VTN1DZ is the 30" hood's blower; brand pairing would have offered it.
  it("does not offer a blower from the same maker that is not on the list", () => {
    const thirtyInch = COMPATIBLE_BLOWERS.PH30HWS;
    const thirtySixInch = COMPATIBLE_BLOWERS.PH36HWS;
    expect(thirtyInch).toContain("VTN1DZ");
    expect(thirtySixInch).not.toContain("VTN1DZ");
    // Both charts are Thermador's own, so brand alone cannot tell them apart.
    expect(thirtyInch.some((model) => thirtySixInch.includes(model))).toBe(true);
  });

  it("offers everything in stock when nobody has checked, rather than nothing", () => {
    expect(blowersFor(hood("UNKNOWN", []))).toEqual(BLOWERS);
    expect(blowerListUnverified(hood("UNKNOWN", []))).toBe(true);
    expect(blowerListUnverified(hood("PH36HWS", ["VTN2FZ"]))).toBe(false);
  });

  it("keeps the catalogue's own hood pointed at blowers that exist", () => {
    for (const item of APPLIANCES_BY_SLOT["slot-hood"]) {
      if (item.compatibleBlowers.length === 0) continue;
      // Not every listed model is stocked, but at least one must be.
      expect(blowersFor(item).length, `${item.model} has no stocked blower`).toBeGreaterThan(0);
    }
  });
});

/**
 * One datum, everywhere a customer can see a protrusion.
 *
 * The cabinet face is the line their eye follows along a kitchen and the thing
 * a machine visibly stands out from. The carcass front and the published cutout
 * are draughtsman's datums an inch apart, and printing whichever the calling
 * code had to hand is how one refrigerator got two figures for the same fact.
 * See `protrusionDatum` in data/rules.json.
 */
describe("what a machine sticks out of", () => {
  it("measures from the cabinet face, not the slot's rough opening", () => {
    const fridge = SLOT_BY_ID["slot-fridge"];
    expect(PROTRUSION_DATUM).toBe("cabinetFace");
    expect(protrusionDatumIn(fridge)).toBe(CABINET_STANDARDS.base.depthIn);
    expect(protrusionDatumIn(fridge)).not.toBe(fridge.cutout.d);
  });

  it("gives the freestanding refrigerator its 4-3/4 inches", () => {
    // 28-3/4" to the door face against a 24" run. The 3-3/4" figure is the same
    // machine measured from the carcass line, which is a drawing's datum and
    // stays in docs/reference rather than on a customer's screen.
    const t36ft820ns = {
      ...FIXTURES.fridgeCounterDepth,
      depthIn: 24,
      cutoutDepthIn: 25,
      rearSpacerIn: 1,
      depthWithDoorsIn: 28.75,
      depthWithHandleIn: 31.4375,
    } as Appliance;
    expect(fitCheck(SLOT_BY_ID["slot-fridge"], t36ft820ns).depthOverIn).toBe(4.75);
  });

  it("leaves a hood alone: it hangs off a wall and has no run to be proud of", () => {
    const hood = SLOT_BY_ID["slot-hood"];
    expect(protrusionDatumIn(hood)).toBe(hood.cutout.d);
  });
});
