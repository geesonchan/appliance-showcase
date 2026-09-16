import { describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { applianceBox } from "./applianceBox";
import { ductRoute, hoodOutlet, islandHoodParts, ISLAND_HOOD } from "./hood";
import { CABINET_STANDARDS, ROOM, ft } from "./room";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, Slot } from "../types";

/**
 * A hung hood's body is its canopy, not its catalogue height. Round 55.
 *
 * HMIB42WS's `heightIn` is 30", which is the assembly collapsed for shipping —
 * the canopy itself is 2-3/4" and the rest is the duct cover, which is sized to
 * the room (D20, round 46). Three things read "the top of the hood" off that
 * 30" and all three were wrong by the same 27-1/4":
 *
 *   - the duct outlet, which came out at 102" over a canopy whose top is at
 *     74-3/4" — a stub of pipe hanging in mid-air with nothing under it;
 *   - the damper above it, at 110-3/8", which is 1-7/8" *through* a 108-1/2"
 *     ceiling;
 *   - the selection outline in the install view, a 30" box round a 2-3/4"
 *     canopy (the open item from round 47).
 *
 * One cause, so one fix: the box is the canopy. Every figure below is written
 * out from D20 and the room, never read back from the code.
 */

const CATALOGUE = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
const byModel = (model: string) => CATALOGUE.find((entry) => entry.model === model)!;

/** The hood slot as package E hangs it: over the island, underside at 72". */
const hungHood = (): Slot => ({
  ...SLOT_BY_ID["slot-hood"],
  position: [1.5, ft(ISLAND_HOOD.undersideIn), 2.75],
  rotationY: 0,
  mount: "island",
});

describe("a hood hung over an island is as tall as its canopy", () => {
  const island = byModel("HMIB42WS");

  it("is not the catalogue's collapsed height", () => {
    expect(island.heightIn).toBe(30);
    const box = applianceBox(hungHood(), island);
    expect(box.h).toBeCloseTo(ft(ISLAND_HOOD.canopyThicknessIn), 9);
    expect(box.h).not.toBeCloseTo(ft(30), 6);
  });

  it("agrees with the canopy the scene actually draws", () => {
    const parts = islandHoodParts(ISLAND_HOOD.undersideIn);
    expect(applianceBox(hungHood(), island).h).toBeCloseTo(ft(parts.canopyIn), 9);
  });

  it("puts the duct outlet on the canopy's own top, not 27 inches above it", () => {
    const slot = hungHood();
    const outlet = hoodOutlet(slot, island);
    const canopyTopIn = ISLAND_HOOD.undersideIn + ISLAND_HOOD.canopyThicknessIn;
    expect(canopyTopIn).toBeCloseTo(74.75, 9);
    expect(outlet.position[1] * 12).toBeCloseTo(canopyTopIn, 9);
  });

  it("keeps the damper under the ceiling, where a damper goes", () => {
    const slot = hungHood();
    const outlet = hoodOutlet(slot, island);
    const collarY = outlet.position[1] + ft(CABINET_STANDARDS.hood.outletAboveBodyIn);
    expect(collarY).toBeLessThan(ROOM.wallHeight);
    const route = ductRoute(slot, outlet, collarY, "up-through-cabinet");
    expect(route.runsUp).toBe(true);
    // And the duct is the whole height of the cover, not a six-inch stub.
    const lengthIn = (route.end[1] - outlet.position[1]) * 12;
    expect(lengthIn).toBeCloseTo(islandHoodParts(ISLAND_HOOD.undersideIn).coverIn, 9);
  });
});

describe("a hood against a wall is unchanged", () => {
  it("is still as tall as the machine the catalogue sells", () => {
    const wall = SLOT_BY_ID["slot-hood"];
    const canopy = byModel("PH36HWS");
    const box = applianceBox(wall, canopy);
    expect(box.h).toBeCloseTo(ft(canopy.heightIn ?? wall.cutout.h), 9);
  });

  it("still takes its duct off the top of that body", () => {
    const wall = SLOT_BY_ID["slot-hood"];
    const canopy = byModel("PH36HWS");
    const outlet = hoodOutlet(wall, canopy);
    expect(outlet.position[1]).toBeCloseTo(
      wall.position[1] + ft(canopy.heightIn ?? wall.cutout.h),
      9,
    );
  });
});
