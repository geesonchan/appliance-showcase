import { afterAll, describe, expect, it } from "vitest";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS, PARAM_LIMITS, type IslandLayout, type LayoutParams } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { ISLAND, LAYOUT_LIMITS, ROOM, RUNS, RUN_BY_ID } from "./room";

/**
 * D20, round 39, Leo: every aisle is measured counter edge to counter edge, and
 * behind an island's seating overhang there is an aisle too — checked only where
 * there is an overhang, so A-D, which have none, pass it as they stand.
 */
const inches = (feet: number) => feet * 12;
const lap = ROOM.counterOverhang;

afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

function activate(id: string): LayoutParams {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage(id);
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
  return { ...DEFAULT_PARAMS, ...PACKAGE_BY_ID[id].defaultLayout, ...(result.adjusted ?? {}) };
}

/** The working aisle as built: the back run's counter edge to the island's. */
const workingAisleIn = (island: IslandLayout = ISLAND) =>
  inches(island.z[0] - lap - (RUN_BY_ID.back.centre + ROOM.counterDepth / 2 + lap));

const codes = (island: IslandLayout) => checkLayout(RUNS, undefined, island).map((v) => v.code);

describe("the island aisle, counter edge to counter edge", () => {
  it.each(["package-a", "package-b", "package-c", "package-d"])(
    "builds %s's own room with the aisle it asks for between the counter edges",
    (id) => {
      const room = activate(id);
      expect(room.hasIsland, id).toBe(true);
      expect(workingAisleIn(), id).toBeCloseTo(room.aisleIn, 6);
      expect(checkLayout(), id).toEqual([]);
    },
  );

  it("holds at every aisle the slider offers", () => {
    const room = activate("package-a");
    for (let aisleIn = PARAM_LIMITS.aisleIn.min; aisleIn <= PARAM_LIMITS.aisleIn.max; aisleIn += PARAM_LIMITS.aisleIn.step) {
      const result = setLayoutParams({ ...room, aisleIn });
      if (!result.ok) continue;
      expect(workingAisleIn(), `${aisleIn}"`).toBeCloseTo(aisleIn, 6);
    }
  });

  it("fails an island an inch too close, which the cabinet-face measure let through", () => {
    activate("package-a");
    const closer: IslandLayout = { ...ISLAND, z: [ISLAND.z[0] - 1 / 12, ISLAND.z[1] - 1 / 12] };
    expect(workingAisleIn(closer)).toBeCloseTo(LAYOUT_LIMITS.aisleIn - 1, 6);
    expect(codes(closer)).toContain("d11-7");
    // By the old measure, carcass to carcass, this island still had 43".
    expect(inches(closer.z[0] - RUN_BY_ID.back.centre - ROOM.counterDepth / 2)).toBeCloseTo(43, 6);
  });
});

describe("the aisle behind an island's seating", () => {
  /** An island whose seating edge is `behindIn` short of the end of the room. */
  const seated = (overhangIn: number, behindIn: number): IslandLayout => {
    const edge = ROOM.halfZ - behindIn / 12;
    const far = edge - overhangIn / 12;
    const depth = ISLAND.z[1] - ISLAND.z[0];
    return { ...ISLAND, overhangIn, z: [far - depth, far], working: far - depth, seating: far };
  };

  it("passes any island with no overhang, however little room is behind it", () => {
    activate("package-a");
    expect(ISLAND.overhangIn).toBe(0);
    const tight = seated(0, 10);
    expect(checkLayout(RUNS, undefined, tight).filter((v) => v.message.includes("seating"))).toEqual([]);
  });

  it("asks for 44 inches behind a seating overhang, and fails 43", () => {
    activate("package-a");
    const seating = (island: IslandLayout) =>
      checkLayout(RUNS, undefined, island).filter((v) => v.message.includes("seating"));
    expect(seating(seated(15, LAYOUT_LIMITS.seatingAisleIn))).toEqual([]);
    expect(seating(seated(15, LAYOUT_LIMITS.seatingAisleIn - 1)).map((v) => v.code)).toEqual(["d11-7"]);
  });
});
