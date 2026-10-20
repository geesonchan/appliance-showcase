import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { alongIsToTheRight, outward, type Facing } from "./frame";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import { DEFAULT_PARAMS, generateLayout, type LayoutParams } from "./layoutTemplate";
import { PACKAGES } from "./packages";
import { LAYOUT_PARAMS, REQUESTED_PARAMS, RUNS, SLOT_PLACEMENT, runForSlot } from "./room";
import type { SlotId } from "../types";
import { resetRoom } from "./testRoom";

/**
 * The layout's shape, and every run saying which way it faces. Round 98a
 * (docs/plans/round-98-layout-shape-plan.md, sections 2.3 and 3).
 *
 * Until round 98a a run did not record which way it faced: every place that
 * needed it wrote "out of the run's +1 side", which is the back wall's +z and
 * the left wall's +x and nothing else. A run on the right wall faces -x and one
 * on a front wall -z; a U and a galley have them. So the facing is a fact on
 * the run, and the cases below state it from the room, never read back from
 * the code.
 */

afterAll(() => resetRoom());

const PACKAGE_IDS = PACKAGES.filter((entry) => entry.available).map((entry) => entry.id);

/** Arrangements that put each leg's machines on the other leg, the island both ways and none. */
const ARRANGEMENTS: Partial<LayoutParams>[] = [
  {},
  { sinkLeg: "left", fridgeEnd: "back", coffeeLeg: "back", cornerType: "lazy-susan" },
  { islandOrientation: "perpendicular", towerSide: "left" },
  { hasIsland: false },
];

function build(id: string, arrangement: Partial<LayoutParams>) {
  resetRoom();
  if (!setActivePackage(id).ok) return false;
  if (Object.keys(arrangement).length === 0) return true;
  return setLayoutParamsGrowing({ ...REQUESTED_PARAMS, ...arrangement }).ok;
}

const CASES = PACKAGE_IDS.flatMap((id) =>
  ARRANGEMENTS.filter((arrangement) => build(id, arrangement)).map((arrangement) => [id, JSON.stringify(arrangement), arrangement] as const),
);
resetRoom();

/** The room's own words for the L's two walls: the back wall faces +z, the left wall +x. */
const ROOM_SAYS: Record<string, Facing> = {
  back: { axis: "z", sign: 1 },
  left: { axis: "x", sign: 1 },
};
const asPlan = (facing: Facing): [number, number] => (facing.axis === "x" ? [facing.sign, 0] : [0, facing.sign]);
const round = (n: number) => Math.round(n * 1e9) / 1e9 + 0;

describe.each(CASES)("%s, %s", (id, _name, arrangement) => {
  it("records each run's facing: the back run +z, the left run +x", () => {
    build(id, arrangement);
    expect(RUNS.map((run) => ({ id: run.id, facing: run.facing }))).toEqual(
      RUNS.map((run) => ({ id: run.id, facing: ROOM_SAYS[run.id] })),
    );
  });

  it("faces every box on a run the way its run faces", () => {
    build(id, arrangement);
    const onRuns = CABINETS.filter((box) => box.run !== "island");
    const wrong = onRuns.filter((box) => {
      const run = RUNS.find((r) => r.id === box.run)!;
      return box.facing.axis !== run.facing?.axis || box.facing.sign !== run.facing?.sign;
    });
    expect({ boxes: onRuns.length > 0, wrong: wrong.map((box) => box.id) }).toEqual({ boxes: true, wrong: [] });
  });

  it("turns every machine on a run out of it the way the run faces", () => {
    build(id, arrangement);
    const onRuns = Object.entries(SLOT_PLACEMENT).filter(([, placement]) => placement && placement.mount !== "island");
    const wrong = onRuns.filter(([slot, placement]) => {
      const run = RUNS.find((r) => r.id === runForSlot(slot as SlotId));
      if (!run?.facing) return true;
      const [x, z] = outward(placement!.rotationY);
      const [fx, fz] = asPlan(run.facing);
      return round(x) !== fx || round(z) !== fz;
    });
    expect({ machines: onRuns.length > 0, wrong: wrong.map(([slot]) => slot) }).toEqual({ machines: true, wrong: [] });
  });
});

describe("whether further along a run is to a machine's own right", () => {
  // A machine's own right is its local +x. Facing +z (no turn) that is +x; a
  // quarter turn to face +x puts it at -z; facing -x (three quarters) at +z;
  // facing -z (a half) at -x. Further along a run is +x on a run along x and
  // +z on a run along z. Lopsided on purpose: the two walls of each pair face
  // opposite ways and must give opposite answers.
  it.each([
    ["the back wall, a run along x facing +z", { axis: "z", sign: 1 } as Facing, true],
    ["a front wall, a run along x facing -z", { axis: "z", sign: -1 } as Facing, false],
    ["the left wall, a run along z facing +x", { axis: "x", sign: 1 } as Facing, false],
    ["a right wall, a run along z facing -x", { axis: "x", sign: -1 } as Facing, true],
  ])("on %s", (_wall, facing, right) => {
    expect(alongIsToTheRight(facing)).toBe(right);
  });
});

describe("the layout's shape", () => {
  it("is an L unless a page says otherwise", () => {
    expect((DEFAULT_PARAMS as { shape?: unknown }).shape).toBe("L");
  });

  it.each(PACKAGE_IDS)("is an L in package %s as it opens", (id) => {
    build(id, {});
    expect((LAYOUT_PARAMS as { shape?: unknown }).shape).toBe("L");
  });

  it("is refused loudly where no template builds it, rather than drawn as an L", () => {
    expect(() => generateLayout({ ...DEFAULT_PARAMS, shape: "U" } as unknown as LayoutParams)).toThrow(/shape "U"/);
  });
});
