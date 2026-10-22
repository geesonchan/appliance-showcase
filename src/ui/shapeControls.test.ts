import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, ONE_WALL_SETS, generateLayout, type LayoutParams } from "../data/layoutTemplate";
import { BUILDABLE_PACKAGES } from "../data/packages";
import { SHOWN_ON_ONE_WALL, showsControl } from "./shapeControls";

/**
 * What the Layout tab shows on one wall reads a setting one wall leaves as
 * asked, so a control never shows the L's value beside a room built otherwise
 * (Leo, round 98b-2: "藏之前面板显示实际建出来的值，不显示 L 型存的值").
 */
describe("the Layout tab on one wall (round 98b-2)", () => {
  it("shows no control for a setting one wall decides itself", () => {
    expect(SHOWN_ON_ONE_WALL.filter((control) => (ONE_WALL_SETS as readonly string[]).includes(control))).toEqual([]);
  });

  it("shows the room as built for every control it shows, in every package", () => {
    // Asked as far from the room one wall builds as the controls go.
    const asked: Partial<LayoutParams> = { housingStyle: "sweep", microwaveHandleIn: 50, coffeeSillIn: 44, backWallIn: 276 };
    const differs = BUILDABLE_PACKAGES.flatMap((entry) => {
      const params = { ...DEFAULT_PARAMS, ...asked, shape: "one-wall" as const };
      const result = generateLayout(params, entry);
      if (!result.ok) return [`${entry.code} does not build`];
      return SHOWN_ON_ONE_WALL.filter((control) => result.layout.params[control] !== params[control]).map((control) => `${entry.code} ${control}`);
    });
    expect(differs).toEqual([]);
  });

  it("shows every control in an L", () => {
    expect((["fridgeEnd", "sinkLeg", "cornerType", "hasIsland", "leftWallIn", "towerSide"] as const).every((control) => showsControl("L", control))).toBe(true);
  });

  it("hides the refrigerator's and the sink's leg, the corner, the tower's side, the coffee leg, the island and the depth on one wall", () => {
    const hidden = (["fridgeEnd", "fridgeEndAbuts", "sinkLeg", "cornerType", "towerSide", "coffeeLeg", "hasIsland", "islandOrientation", "islandLengthIn", "islandDepthIn", "aisleIn", "leftWallIn"] as const).filter(
      (control) => showsControl("one-wall", control),
    );
    expect(hidden).toEqual([]);
  });
});
