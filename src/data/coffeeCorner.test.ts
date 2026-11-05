import { afterAll, describe, expect, it } from "vitest";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import { COFFEE_AT_WALL, type LayoutParams } from "./layoutTemplate";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { resetRoom } from "./testRoom";

/**
 * The L's coffee machine after the corner (round 101, step one; Leo,
 * 2026-11-04, A-1 and A-2).
 *
 * D with its coffee cabinet on the back leg and its refrigerator on the left
 * leg stood the coffee tower 12" after the corner: TCM24PS's hinge side, its
 * own left, came 12 + 3/4 + 5/16 = 13-1/16" from the front of the left run's
 * cabinets across the corner, which Leo counts as the wall (round 98b), where
 * its door at the 110° it is delivered at wants 13-3/4" (installation
 * instructions p. 11, p. 3 step 2). Leo's 乙: a whole 15" cabinet, B15, after
 * the corner — 15 + 3/4 + 5/16 = 16-1/16" — in D only; where the wall is too
 * short it grows (D18), says so and can be undone. E, whose combination oven
 * stands first after the corner and its coffee tower behind it, is not
 * touched.
 */

afterAll(() => resetRoom());

/** A package's room with its coffee cabinet on the back leg and its refrigerator on the left, grown as the panel grows it. */
function coffeeOnTheBack(pkg: string, arrangement: Partial<LayoutParams>) {
  resetRoom();
  expect(setActivePackage(pkg).ok).toBe(true);
  const result = setLayoutParamsGrowing({
    ...REQUESTED_PARAMS,
    sinkLeg: "back",
    fridgeEnd: "left",
    coffeeLeg: "back",
    ...arrangement,
  });
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
  return result;
}

/** The back run from its start (the face across the corner) to the coffee machine's hinge side, in inches. */
function hingeFromTheCorner(): number {
  const back = RUNS.find((run) => run.id === "back")!;
  const coffee = back.segments.find((segment) => segment.slot === "slot-coffee")!;
  // TCM24PS is 23-3/8" across its front, centred in its tower; its hinge on
  // its own left, the corner's side on the back leg.
  const centreIn = Math.abs((coffee.from + coffee.to) / 2 - back.segments[0].from) * 12;
  return Math.round((centreIn - 23.375 / 2) * 16) / 16;
}

describe("the L's coffee machine after the corner (round 101, Leo A-1)", () => {
  // Not symmetric on purpose: each corner with the tower on a different side,
  // the refrigerator's end against cabinetry in one and a wall in the other,
  // so no two rooms are the same length.
  const rooms: [string, Partial<LayoutParams>][] = [
    ["a blind corner, the oven tower left of the range", { cornerType: "blind", towerSide: "left", fridgeEndAbuts: "cabinet" }],
    ["a blind corner, the oven tower right of the range", { cornerType: "blind", towerSide: "right", fridgeEndAbuts: "wall" }],
    ["a lazy susan, the oven tower left of the range", { cornerType: "lazy-susan", towerSide: "left", fridgeEndAbuts: "wall", hasIsland: false }],
    ["a lazy susan, the oven tower right of the range", { cornerType: "lazy-susan", towerSide: "right", fridgeEndAbuts: "cabinet" }],
  ];

  for (const [name, arrangement] of rooms) {
    it(`stands D's hinge side 16-1/16 inches from the cabinets across the corner, past the 13-3/4 its door wants: ${name}`, () => {
      coffeeOnTheBack("package-d", arrangement);
      const hingeIn = hingeFromTheCorner();
      const first = RUNS.find((run) => run.id === "back")!.segments[0];
      expect({
        hingeIn,
        atLeast: hingeIn >= COFFEE_AT_WALL.doorToWallIn,
        first: first.modules.map((module) => module.code).join(" + "),
      }).toEqual({ hingeIn: 16.0625, atLeast: true, first: "B15" });
    });
  }

  it("grows D's back wall where it is too short, as the panel always has (D18, Leo A-2)", () => {
    const grown = coffeeOnTheBack("package-d", { cornerType: "lazy-susan", towerSide: "right", fridgeEndAbuts: "cabinet" });
    // From D's own 224-1/4" (packages.json), 235-1/2" before round 101.
    expect(grown.grown).toEqual([{ key: "backWallIn", fromIn: 224.25, toIn: 238.5 }]);
  });

  it("keeps the 9-inch cabinet between the oven tower and the rangetop with a blind corner and the tower left, and grows the wall for it", () => {
    // Leo, 2026-11-04, correcting step one: "保留 9" 柜 B9，不变成 6" 填充板 …
    // 差的 3" 照 D18 加长墙", as with the tower right of the range (226-1/2").
    const grown = coffeeOnTheBack("package-d", { cornerType: "blind", towerSide: "left", fridgeEndAbuts: "wall", hasIsland: false });
    const back = RUNS.find((run) => run.id === "back")!;
    const between = back.segments.filter((segment) => segment.id.startsWith("back-tower-clearance"));
    expect({
      between: between.map((segment) => segment.modules.map((module) => module.code).join(" + ")),
      grown: grown.grown,
      hingeIn: hingeFromTheCorner(),
    }).toEqual({
      between: ["B9"],
      grown: [{ key: "backWallIn", fromIn: 224.25, toIn: 226.5 }],
      hingeIn: 16.0625,
    });
  });

  it("leaves E as it was: its combination oven the first tall unit after the corner, 18 inches of drawers before it", () => {
    coffeeOnTheBack("package-e", {});
    const back = RUNS.find((run) => run.id === "back")!;
    const first = back.segments[0];
    const firstTall = back.segments.find((segment) => segment.kind === "tall")!;
    expect({
      first: first.modules.map((module) => module.code).join(" + "),
      widthIn: Math.round((first.to - first.from) * 12 * 16) / 16,
      firstTall: firstTall.slot,
    }).toEqual({ first: "DB18", widthIn: 18, firstTall: "slot-microwave" });
  });
});
