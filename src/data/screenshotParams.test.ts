import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, type LayoutParams } from "./layoutTemplate";
import { paramsFromQuery } from "./room";
import { LAYOUT_FIELDS } from "../store/shareLink";

/**
 * A page's address without a link version — the screenshot parameters,
 * `?back=180&island=none` — is read by the share link's own table. Round 98a,
 * Leo: "截图参数和链接字段表在 98a 里合成一份（D17 表第 18 行的 'Join them
 * then'），形状只在字段表里写一处".
 *
 * Until round 98a `readParams` in room.ts read eight names of its own and the
 * table fifteen, the same names for the same things written twice (D17's table,
 * the eighteenth row). A new layout setting given a name in one was missing from
 * the other; the shape would have been the first.
 */

/** One value away from the default for every setting a link carries, by its name in the link. */
const AWAY: Record<string, [string, Partial<LayoutParams>]> = {
  back: ["180", { backWallIn: 180 }],
  left: ["150", { leftWallIn: 150 }],
  corner: ["lazy-susan", { cornerType: "lazy-susan" }],
  fridgeLeg: ["back", { fridgeEnd: "back" }],
  fridgeAbuts: ["wall", { fridgeEndAbuts: "wall" }],
  sinkLeg: ["left", { sinkLeg: "left" }],
  towerSide: ["left", { towerSide: "left" }],
  housing: ["sweep", { housingStyle: "sweep" }],
  coffeeLeg: ["back", { coffeeLeg: "back" }],
  coffeeSill: ["40", { coffeeSillIn: 40 }],
  handle: ["50", { microwaveHandleIn: 50 }],
  island: ["96", { hasIsland: true, islandLengthIn: 96 }],
  islandTurn: ["perpendicular", { islandOrientation: "perpendicular" }],
  islandDepth: ["42", { islandDepthIn: 42 }],
  aisle: ["45", { aisleIn: 45 }],
  // The only shape there is in round 98a, so not away from the default; it is
  // here to be read by the name the link writes.
  shape: ["L", { shape: "L" } as Partial<LayoutParams>],
};

describe("a screenshot address is read by the link's table", () => {
  it("knows every setting the table carries, by the table's own names", () => {
    expect(Object.keys(AWAY).sort()).toEqual(LAYOUT_FIELDS.map((field) => field.name).sort());
  });

  it.each(Object.entries(AWAY))("reads %s", (name, [raw, expected]) => {
    const { params, issues } = paramsFromQuery(new URLSearchParams(`?${name}=${raw}`));
    expect({ issues, params }).toEqual({ issues: [], params: { ...DEFAULT_PARAMS, ...expected } });
  });

  it("still reads the two older names screenshots have used, fridge and sink", () => {
    const { params } = paramsFromQuery(new URLSearchParams("?fridge=back&sink=left"));
    expect({ fridgeEnd: params.fridgeEnd, sinkLeg: params.sinkLeg }).toEqual({ fridgeEnd: "back", sinkLeg: "left" });
  });

  it("opens the default room and says why, for a value it cannot use", () => {
    const { params, issues } = paramsFromQuery(new URLSearchParams("?shape=U&back=180"));
    expect({ params, issues: issues.length }).toEqual({ params: DEFAULT_PARAMS, issues: 1 });
  });

  it("reads no island, and the rest beside it", () => {
    const { params, issues } = paramsFromQuery(new URLSearchParams("?island=none&back=180"));
    expect({ issues, hasIsland: params.hasIsland, back: params.backWallIn }).toEqual({ issues: [], hasIsland: false, back: 180 });
  });

  it("leaves a share link to its own reading", () => {
    const { params, issues } = paramsFromQuery(new URLSearchParams("?v=2&pkg=D&back=230"));
    expect({ params, issues }).toEqual({ params: DEFAULT_PARAMS, issues: [] });
  });
});
