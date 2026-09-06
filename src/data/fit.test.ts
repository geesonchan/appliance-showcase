import { describe, expect, it } from "vitest";
import { APPLIANCES_BY_SLOT, APPLIANCE_BY_ID, BLOWERS, blowersFor } from "./catalogue";
import { fitCheck, formatInches } from "./fit";
import { SLOT_BY_ID } from "./slots";
import { deriveUtilities } from "./utilities";
import { effectiveCfm, needsMakeupAir } from "./ventilation";
import type { Appliance } from "../types";

const range = SLOT_BY_ID["slot-range"];
const hoodSlot = SLOT_BY_ID["slot-hood"];
const base = () => structuredClone(APPLIANCE_BY_ID["thermador-prg366wh"]);

describe("fit check", () => {
  it("passes an appliance that matches the opening", () => {
    const result = fitCheck(range, base());
    expect(result.fits).toBe(true);
    expect(result.widthOverIn).toBe(0);
    expect(result.fillerEachSideIn).toBeNull();
  });

  it("fails a wider appliance and reports the overrun", () => {
    const wide = APPLIANCE_BY_ID["thermador-prd486wdhu"]; // 48" in a 36" opening
    const result = fitCheck(range, wide);
    expect(result.fits).toBe(false);
    expect(result.widthOverIn).toBe(12);
  });

  // Narrow is a trim question, not a blocker: the cabinetmaker adds filler.
  it("allows a narrower appliance and splits the filler between the sides", () => {
    const narrow = APPLIANCE_BY_ID["cafe-chs900p2ms1"]; // 30" in a 36" opening
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
    const deep = APPLIANCE_BY_ID["bosch-b36cl80sns"];
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
  const separate = APPLIANCE_BY_ID["thermador-ph36hws"]; // ships without one
  const integrated = APPLIANCE_BY_ID["zephyr-zsa-e36cs"]; // 600 CFM built in
  const internal = APPLIANCE_BY_ID["thermador-vtn2fz"]; // 600 CFM
  const external = APPLIANCE_BY_ID["thermador-vtr1330w"]; // 1300 CFM

  it("keeps blowers out of the hood picker", () => {
    const hoods = APPLIANCES_BY_SLOT["slot-hood"];
    expect(hoods.every((item) => item.category === "hood")).toBe(true);
    expect(BLOWERS.every((item) => item.category === "blower")).toBe(true);
    expect(BLOWERS.length).toBeGreaterThan(0);
  });

  it("offers blowers from the same maker as the hood", () => {
    expect(blowersFor(separate).every((b) => b.brand === separate.brand)).toBe(true);
  });

  // A hood that ships without a blower has no CFM of its own.
  it("takes the CFM from the blower when the hood needs one", () => {
    expect(separate.requires.cfm).toBeNull();
    expect(effectiveCfm(separate, internal)).toBe(600);
    expect(effectiveCfm(separate, external)).toBe(1300);
    expect(effectiveCfm(separate, null)).toBeNull();
  });

  it("ignores the blower when the hood has its own", () => {
    expect(effectiveCfm(integrated, external)).toBe(600);
  });

  it("decides makeup air from whichever part moves the air", () => {
    expect(needsMakeupAir(separate, null)).toBe(false);
    expect(needsMakeupAir(separate, internal)).toBe(true);
    expect(needsMakeupAir(integrated, null)).toBe(true);
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
  const gasRange = APPLIANCE_BY_ID["thermador-prg366wh"]; // 119,500 BTU
  const induction = APPLIANCE_BY_ID["cafe-chs900p2ms1"];

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
    const small = { ...gasRange, requires: { ...gasRange.requires, gasBTU: 61_000 } };
    expect(deriveUtilities(range, gasRange).gas?.pipeSize).toBe('3/4"');
    expect(deriveUtilities(range, small).gas?.pipeSize).toBe('1/2"');
  });

  it("keeps the slot's duct route", () => {
    expect(deriveUtilities(hoodSlot, APPLIANCE_BY_ID["zephyr-zsa-e36cs"]).duct?.route).toBe(
      hoodSlot.utilities.duct?.route,
    );
  });

  it("falls back to the slot's rough-in when nothing is selected", () => {
    expect(deriveUtilities(range, undefined)).toEqual(range.utilities);
  });
});
