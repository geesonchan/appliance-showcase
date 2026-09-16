import { describe, expect, it } from "vitest";
import { facingOf, rotationOf } from "./frame";
import { againstWall, wallBehind } from "./roomWalls";
import { ductRoute, hoodOutlet } from "./hood";
import { CABINET_STANDARDS, ROOM, ft } from "./room";
import { serviceRoute } from "./serviceRoute";
import { SLOT_BY_ID } from "./slots";
import { wallAnchor } from "./wallAnchor";
import { FIXTURES } from "./testFixtures";
import type { ServicePoint, Slot } from "../types";

/**
 * Nothing is behind the back wall by assumption. Round 52, D22 step 3.
 *
 * The round-49 sweep found two kinds of mistake. The first — a turn written by
 * hand — `orientationGuard.test.ts` can see, and step 2 cleared it. The second
 * it cannot see: `-ROOM.halfZ` written where "the wall behind this machine" was
 * meant. The two are spelled identically, and they agree for every machine on
 * the back run, which is every machine the app can build today. So these cases
 * are the ones the app cannot reach yet — a hood on the left run, a machine
 * facing the other way — because those are the ones where the assumption shows.
 *
 * Every figure below is written out from the room and the machine, never read
 * back from the code being tested.
 */

/** A quarter turn faces +x: a machine on the left run, backing onto the left wall. */
const FACING_LEFT_RUN = rotationOf({ axis: "x", sign: 1 });
/** A half turn faces -z: a machine backing onto the wall at +halfZ. */
const FACING_BACKWARD = rotationOf({ axis: "z", sign: -1 });

describe("the wall behind a thing is the one it faces away from", () => {
  it("names the back wall for a machine facing the room off the back run", () => {
    expect(wallBehind({ axis: "z", sign: 1 })).toEqual({ axis: "z", at: -ROOM.halfZ });
  });

  it("names the left wall for a machine facing the room off the left run", () => {
    expect(wallBehind({ axis: "x", sign: 1 })).toEqual({ axis: "x", at: -ROOM.halfX });
  });

  it("names the far wall for a machine facing the other way, which is not today's room", () => {
    expect(wallBehind({ axis: "z", sign: -1 })).toEqual({ axis: "z", at: ROOM.halfZ });
    expect(wallBehind({ axis: "x", sign: -1 })).toEqual({ axis: "x", at: ROOM.halfX });
  });

  it("keeps a point level along its wall and stands it off into the room", () => {
    // Deliberately lopsided: a point with a different x and z, so an answer that
    // swapped them or kept the wrong one could not pass.
    const on = againstWall({ axis: "x", sign: 1 }, -4.25, 1.75, ft(2));
    expect(on.x).toBeCloseTo(-ROOM.halfX + ft(2), 9);
    expect(on.z).toBeCloseTo(1.75, 9);
    const back = againstWall({ axis: "z", sign: 1 }, -4.25, 1.75, ft(2));
    expect(back.x).toBeCloseTo(-4.25, 9);
    expect(back.z).toBeCloseTo(-ROOM.halfZ + ft(2), 9);
  });
});

/**
 * A hood's duct leaves through the back of the canopy, six inches in from it.
 * Six inches from *the wall* is the same figure only while the canopy's back is
 * against the back wall.
 */
describe("the duct leaves the back of the canopy, whichever way the canopy faces", () => {
  const hood = SLOT_BY_ID["slot-hood"];
  const { fromWallIn } = CABINET_STANDARDS.hood.outlet;
  const depthFt = ft(hood.cutout.d);

  it("is unchanged for the hood on the back run, which is where every package's is", () => {
    const outlet = hoodOutlet(hood, FIXTURES.hoodNeedsBlower);
    expect(outlet.position[0]).toBeCloseTo(hood.position[0], 9);
    expect(outlet.position[2]).toBeCloseTo(
      hood.position[2] - depthFt / 2 + ft(fromWallIn),
      9,
    );
  });

  it("moves along x, not z, for a hood on the left run", () => {
    // x and z are different numbers on purpose: a hood whose two coordinates
    // matched would be placed right by code that used the wrong axis.
    const onLeft: Slot = {
      ...hood,
      position: [-5.5, hood.position[1], 1.25],
      rotationY: FACING_LEFT_RUN,
    };
    const outlet = hoodOutlet(onLeft, FIXTURES.hoodNeedsBlower);
    // Six inches out of its own back face, which faces -x.
    expect(outlet.position[0]).toBeCloseTo(-5.5 - depthFt / 2 + ft(fromWallIn), 9);
    expect(outlet.position[2]).toBeCloseTo(1.25, 9);
  });

  it("sits in the middle of a hood hung over an island, which has no back", () => {
    const hung: Slot = {
      ...hood,
      position: [1.5, ft(72), 2.75],
      rotationY: FACING_LEFT_RUN,
      mount: "island",
    };
    const outlet = hoodOutlet(hung, FIXTURES.hoodNeedsBlower);
    expect(outlet.position[0]).toBeCloseTo(1.5, 9);
    expect(outlet.position[2]).toBeCloseTo(2.75, 9);
  });
});

describe("a duct through the wall goes through the wall the hood is on", () => {
  const hood = SLOT_BY_ID["slot-hood"];
  const collarY = ft(80);

  it("runs up to the ceiling when the route is not through a wall", () => {
    const outlet = hoodOutlet(hood, FIXTURES.hoodNeedsBlower);
    const route = ductRoute(hood, outlet, collarY, "roof");
    expect(route.runsUp).toBe(true);
    expect(route.end).toEqual([outlet.position[0], ROOM.wallHeight, outlet.position[2]]);
  });

  it("ends on the back wall for a hood on the back run", () => {
    const outlet = hoodOutlet(hood, FIXTURES.hoodNeedsBlower);
    const route = ductRoute(hood, outlet, collarY, "back-wall");
    expect(route.runsUp).toBe(false);
    expect(route.end[0]).toBeCloseTo(outlet.position[0], 9);
    expect(route.end[1]).toBeCloseTo(collarY, 9);
    expect(route.end[2]).toBeCloseTo(-ROOM.halfZ, 9);
  });

  it("ends on the left wall for a hood on the left run", () => {
    const onLeft: Slot = {
      ...hood,
      position: [-5.5, hood.position[1], 1.25],
      rotationY: FACING_LEFT_RUN,
    };
    const outlet = hoodOutlet(onLeft, FIXTURES.hoodNeedsBlower);
    const route = ductRoute(onLeft, outlet, collarY, "back-wall");
    expect(route.runsUp).toBe(false);
    expect(route.end[0]).toBeCloseTo(-ROOM.halfX, 9);
    expect(route.end[2]).toBeCloseTo(1.25, 9);
    // And the blower in the run is between the hood and that wall, not out in
    // the middle of the floor on the other axis.
    expect(route.inlineAt[0]).toBeGreaterThan(-ROOM.halfX);
    expect(route.inlineAt[0]).toBeLessThan(-5.5);
    expect(route.inlineAt[2]).toBeCloseTo(1.25, 9);
  });

  it("runs up from a hood over the island, which has no wall to go through", () => {
    const hung: Slot = {
      ...hood,
      position: [1.5, ft(72), 2.75],
      rotationY: 0,
      mount: "island",
    };
    const outlet = hoodOutlet(hung, FIXTURES.hoodNeedsBlower);
    const route = ductRoute(hung, outlet, collarY, "back-wall");
    expect(route.runsUp).toBe(true);
    expect(route.end[1]).toBeCloseTo(ROOM.wallHeight, 9);
  });
});

describe("a trunk runs along the wall its machine is actually on", () => {
  const dishwasher = SLOT_BY_ID["slot-dishwasher"];
  const standoff = ft(2);

  it("leaves today's two runs where they are", () => {
    for (const slot of [SLOT_BY_ID["slot-range"], SLOT_BY_ID["slot-fridge"]]) {
      const anchor = wallAnchor(slot, standoff)!;
      const facing = facingOf(slot.rotationY);
      const wall = wallBehind(facing);
      expect(anchor.onLeftWall).toBe(wall.axis === "x");
      const at = wall.axis === "x" ? anchor.x : anchor.z;
      expect(at).toBeCloseTo(wall.at + facing.sign * standoff, 9);
    }
  });

  it("anchors a machine facing the other way to the wall behind it, not the back wall", () => {
    const turned: ServicePoint = {
      ...dishwasher,
      position: [2.25, 0, 4.5],
      rotationY: FACING_BACKWARD,
    };
    const anchor = wallAnchor(turned, standoff)!;
    expect(anchor.x).toBeCloseTo(2.25, 9);
    expect(anchor.z).toBeCloseTo(ROOM.halfZ - standoff, 9);
    expect(anchor.onLeftWall).toBe(false);
  });
});

describe("an island machine's services come up through the floor", () => {
  const microwave = SLOT_BY_ID["slot-microwave"];
  const standoff = ft(2);

  it("routes a machine on a run along its wall", () => {
    const route = serviceRoute(SLOT_BY_ID["slot-range"], standoff);
    expect(route?.kind).toBe("wall");
  });

  it("routes an island machine to the floor rather than to nothing", () => {
    const island: ServicePoint = {
      ...microwave,
      position: [1.5, 0, 2.75],
      rotationY: FACING_LEFT_RUN,
      mount: "island",
    };
    const route = serviceRoute(island, standoff);
    expect(route).not.toBeNull();
    expect(route?.kind).toBe("floor");
    if (route?.kind !== "floor") return;
    // Behind the machine, which faces +x, so the riser is at a lower x and the
    // same z. Six inches, from `ISLAND_RISER_BEHIND_IN`.
    expect(route.x).toBeCloseTo(1.5 - ft(6), 9);
    expect(route.z).toBeCloseTo(2.75, 9);
  });
});
