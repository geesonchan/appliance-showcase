import { describe, expect, it } from "vitest";
import { APPLIANCES_BY_SLOT, APPLIANCE_BY_ID } from "./catalogue";
import { fitCheck, formatInches } from "./fit";
import { SLOT_BY_ID } from "./slots";
import { deriveUtilities } from "./utilities";
import type { Appliance } from "../types";

const range = SLOT_BY_ID["slot-range"];
const base = () => structuredClone(APPLIANCE_BY_ID["range-bluestar-rnb304bv2"]);

describe("fit check", () => {
  it("passes an appliance that matches the opening", () => {
    const result = fitCheck(range, base());
    expect(result.fits).toBe(true);
    expect(result.widthOverIn).toBe(0);
  });

  it("fails a wider appliance and reports the overrun", () => {
    const wide = { ...base(), cutoutWidthIn: 36 } as Appliance;
    const result = fitCheck(range, wide);
    expect(result.fits).toBe(false);
    expect(result.widthOverIn).toBe(6);
  });

  it("falls back to the body width when there is no published cutout", () => {
    const noCutout = { ...base(), cutoutWidthIn: null, widthIn: 35.75 } as Appliance;
    expect(fitCheck(range, noCutout).widthOverIn).toBeCloseTo(5.75);
  });

  it("reports depth without gating on it", () => {
    const fridge = SLOT_BY_ID["slot-fridge"];
    const deep = APPLIANCE_BY_ID["fridge-bosch-b36cl80sns"];
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

describe("utilities follow the appliance", () => {
  const gasRange = APPLIANCE_BY_ID["range-bluestar-rnb304bv2"];
  const induction = APPLIANCE_BY_ID["range-cafe-chs900p2ms1"];

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
    const big = { ...gasRange, requires: { ...gasRange.requires, gasBTU: 72_000 } };
    expect(deriveUtilities(range, gasRange).gas?.pipeSize).toBe('1/2"');
    expect(deriveUtilities(range, big).gas?.pipeSize).toBe('3/4"');
  });

  it("sizes the duct by CFM and keeps the slot's route", () => {
    const hood = SLOT_BY_ID["slot-hood"];
    const big = APPLIANCE_BY_ID["hood-zephyr-zsa-e36cs"]; // 600 CFM
    const small = APPLIANCE_BY_ID["hood-ventahood-prh9-136ss"]; // 300 CFM
    expect(deriveUtilities(hood, big).duct?.diameterIn).toBe(8);
    expect(deriveUtilities(hood, small).duct?.diameterIn).toBe(6);
    expect(deriveUtilities(hood, big).duct?.route).toBe(hood.utilities.duct?.route);
  });

  it("falls back to the slot's rough-in when nothing is selected", () => {
    expect(deriveUtilities(range, undefined)).toEqual(range.utilities);
  });
});
