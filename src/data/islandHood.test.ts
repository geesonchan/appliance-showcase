import { describe, expect, it } from "vitest";
import { ISLAND_HOOD, islandHoodParts } from "./hood";
import { ROOM } from "./slots";

/**
 * A hood hung from the ceiling has heights that start from where it hangs.
 * D20, round 46: at a 72" underside under the 108-1/2" ceiling it is 36-1/2"
 * overall, a 2-3/4" canopy and a 33-3/4" duct cover.
 */
describe("the island hood's heights", () => {
  it("fills the ceiling from a 72-inch underside, canopy thin and cover the rest", () => {
    expect(ROOM.wallHeight * 12).toBeCloseTo(108.5, 6);
    const parts = islandHoodParts(72);
    expect(parts.overallIn).toBeCloseTo(36.5, 6);
    expect(parts.canopyIn).toBe(2.75);
    expect(parts.coverIn).toBeCloseTo(33.75, 6);
    expect(parts.canopyIn + parts.coverIn + 72).toBeCloseTo(108.5, 6);
    expect(parts.withinSpan).toBe(true);
  });

  it("is never the 30-inch catalogue height drawn as a canopy", () => {
    expect(islandHoodParts(72).canopyIn).toBeLessThan(30);
    expect(ISLAND_HOOD.canopyThicknessIn).toBe(2.75);
  });

  it("says so when the underside is outside what the duct cover spans", () => {
    expect(islandHoodParts(60).withinSpan).toBe(false); // 48-1/2" overall
    expect(islandHoodParts(80).withinSpan).toBe(false); // 28-1/2" overall
    expect(islandHoodParts(66).withinSpan).toBe(true); // 42-1/2" overall
  });
});
