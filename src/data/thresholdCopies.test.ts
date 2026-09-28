import { describe, expect, it } from "vitest";
import { FIXTURES } from "./testFixtures";
import { RULES, packageContext } from "./rules";
import { SLOT_BY_ID } from "./slots";
import { deriveUtilities } from "./utilities";
import type { Appliance } from "../types";

/**
 * Two figures, one copy each. Round 78, D17's table.
 *
 * The duct size by airflow was written twice — `thresholds.duct` in
 * data/rules.json, which the checklist reads, and a literal in utilities.ts,
 * which the quote, the spec card and the install view read — and at exactly
 * 400 CFM the one said 6" and the other 8". The gas threshold was written
 * three times, and the copy printed on the quote was the literal. Both are now
 * asked of data/rules.json. One assertion per test.
 */
const hood = SLOT_BY_ID["slot-hood"];
const range = SLOT_BY_ID["slot-range"];
const hoodAt = (cfm: number) =>
  ({ ...FIXTURES.hoodIntegrated600, requires: { ...FIXTURES.hoodIntegrated600.requires, cfm } }) as Appliance;
const rangeAt = (gasBTU: number) =>
  ({ ...FIXTURES.gasRange36, requires: { ...FIXTURES.gasRange36.requires, gasBTU } }) as Appliance;
const quotedDuct = (cfm: number) => deriveUtilities(hood, hoodAt(cfm), cfm).duct?.diameterIn;
const quotedPipe = (btu: number) => deriveUtilities(range, rangeAt(btu)).gas?.pipeSize;

describe("the duct size has one copy", () => {
  it("quotes a 6 inch duct at exactly 400 CFM, as data/rules.json does", () => {
    expect(quotedDuct(400)).toBe(6);
  });

  it("quotes the same duct as the checklist at every band edge", () => {
    const edges = [399, 400, 401, 600, 601, 1000];
    const disagree = edges.filter((cfm) => quotedDuct(cfm) !== packageContext(hoodAt(cfm), null).ductDiameterIn);
    expect({ checked: edges.length, disagree }).toEqual({ checked: 6, disagree: [] });
  });
});

describe("the gas threshold has one copy", () => {
  it("keeps a 1/2 inch line at 65,000 BTU", () => {
    expect(quotedPipe(65_000)).toBe('1/2"');
  });

  it("upsizes to 3/4 inch at 65,001 BTU", () => {
    expect(quotedPipe(65_001)).toBe('3/4"');
  });

  // The proof there is one copy: move the rule's own figure and see the quote
  // follow it. A second copy anywhere would leave the quote where it was.
  it("follows the gas-pipe-size rule when its threshold moves", () => {
    const condition = RULES.find((rule) => rule.id === "gas-pipe-size")!.when.find(
      (c) => c.fact === "appliance.requires.gasBTU",
    )!;
    const was = condition.value;
    condition.value = 90_000;
    try {
      expect(quotedPipe(80_000)).toBe('1/2"');
    } finally {
      condition.value = was;
    }
  });
});
