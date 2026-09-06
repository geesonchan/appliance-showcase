import { describe, expect, it } from "vitest";
import { dimensionsFor, formatDimension } from "./dimensions";
import { LAYOUT_LIMITS } from "./layoutRules";
import { CABINET_STANDARDS, ISLAND, ROOM, RUN_BY_ID } from "./room";
import { SLOT_BY_ID } from "./slots";
import { FIXTURES } from "./testFixtures";
import type { Appliance, SlotId } from "../types";

const inches = (feet: number) => feet * 12;
const selection = (over: Partial<Record<SlotId, Appliance>> = {}) => ({
  "slot-range": FIXTURES.gasRange36,
  "slot-hood": FIXTURES.hoodNeedsBlower,
  ...over,
});
const by = (id: string, over: Partial<Record<SlotId, Appliance>> = {}) =>
  dimensionsFor(selection(over)).find((d) => d.id === id)!;

describe("the dimensions come from the standards, not from captions", () => {
  it("measures floor to ceiling", () => {
    expect(by("floor-to-ceiling").valueIn).toBe(inches(ROOM.wallHeight));
    expect(by("floor-to-ceiling").valueIn).toBe(96);
  });

  it("measures floor to counter at the D13 height", () => {
    expect(by("floor-to-counter").valueIn).toBe(CABINET_STANDARDS.base.counterHeightIn);
  });

  it("measures counter to the underside of the wall cabinets", () => {
    expect(by("counter-to-uppers").valueIn).toBe(CABINET_STANDARDS.upper.bottomAboveCounterIn);
    expect(by("counter-to-uppers").valueIn).toBe(inches(ROOM.upperBottom - ROOM.counterHeight));
  });

  it("measures the canopy against its own height", () => {
    expect(by("canopy-height").valueIn).toBe(CABINET_STANDARDS.hood.bodyHeightIn);
  });

  it("measures the island aisle", () => {
    const back = RUN_BY_ID.back;
    expect(by("island-aisle").valueIn).toBeCloseTo(
      inches(ISLAND.z[0] - back.centre - ROOM.counterDepth / 2),
      3,
    );
    expect(by("island-aisle").valueIn).toBeGreaterThanOrEqual(LAYOUT_LIMITS.aisleIn);
  });
});

describe("the figures follow the model that is specified", () => {
  it("takes the cooktop height from the range in the room", () => {
    expect(by("floor-to-cooktop").valueIn).toBe(FIXTURES.gasRange36.heightIn);
    const tall = { ...FIXTURES.gasRange36, heightIn: 36.75 } as Appliance;
    expect(by("floor-to-cooktop", { "slot-range": tall }).valueIn).toBe(36.75);
  });

  // The canopy hangs where the wall was drilled; a taller range eats the gap.
  it("shrinks the clearance when a taller range goes in", () => {
    const standard = by("cooktop-to-canopy");
    const tall = { ...FIXTURES.gasRange36, heightIn: 36.75 } as Appliance;
    const shrunk = by("cooktop-to-canopy", { "slot-range": tall });
    expect(shrunk.valueIn).toBeLessThan(standard.valueIn);
    expect(standard.valueIn - shrunk.valueIn).toBeCloseTo(0.75, 3);
    expect(shrunk.valueIn).toBeCloseTo(inches(SLOT_BY_ID["slot-hood"].position[1]) - 36.75, 3);
  });

  it("prints the clearance the manufacturer allows beside it", () => {
    expect(by("cooktop-to-canopy").noteVars).toEqual({
      min: CABINET_STANDARDS.hood.aboveCooktopMinIn,
      max: CABINET_STANDARDS.hood.aboveCooktopMaxIn,
    });
  });

  it("takes the canopy height from the hood in the room", () => {
    const deep = { ...FIXTURES.hoodNeedsBlower, heightIn: 24 } as Appliance;
    expect(by("canopy-height", { "slot-hood": deep }).valueIn).toBe(24);
  });
});

describe("figures read as a builder writes them", () => {
  it("uses sixteenths rather than decimals", () => {
    expect(formatDimension(36)).toBe('36"');
    expect(formatDimension(36.75)).toBe('36-3/4"');
    expect(formatDimension(8.8125)).toBe('8-13/16"');
    expect(formatDimension(4.1875)).toBe('4-3/16"');
  });
});
