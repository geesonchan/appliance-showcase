import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID, SLOT_ORDER } from "./catalogue";
import { setActivePackage } from "./layoutState";
import { PACKAGES, PACKAGE_BY_ID } from "./packages";
import { ISLAND, ROOM, isOmitted } from "./room";
import { resolveRoughIn, roughInFor } from "./roughIn";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { Appliance, SlotId } from "../types";

/**
 * A machine on the island keeps every point its guide gives it (round 72).
 *
 * A point whose box is not the machine's own opening was dropped for an island
 * slot: `hostFor` looks the machine up among the wall runs, an island machine
 * is in none of them, and everything but `in-cutout` returned null — silently,
 * so the line simply was not there. Found in round 49's sweep and left until
 * there was a point to hold a fix to (D22). Package E's island hood has two
 * now: the 8" duct hole and the supply, both roughed into the ceiling before it
 * closes (HMIB42WS, pp. 10, 13, 14, 17).
 *
 * The heights here are the room's own: the ceiling is 108-1/2" (D19), and the
 * hood hangs under it.
 */
afterAll(() => {
  resetRoom();
});

const inches = (feet: number) => feet * 12;

function open(id: string) {
  resetRoom();
  expect(setActivePackage(id).ok).toBe(true);
  return Object.fromEntries(
    Object.entries(PACKAGE_BY_ID[id].defaultSelection).map(([slot, model]) => [slot, APPLIANCE_BY_ID[model as string]]),
  ) as Record<SlotId, Appliance>;
}

const hoodPoints = () => {
  const selection = open("package-e");
  return resolveRoughIn("slot-hood", selection["slot-hood"]);
};

describe("package E's island hood", () => {
  it("draws both of the points its guide gives it", () => {
    expect(hoodPoints().map((p) => p.point.type)).toEqual(["duct", "power"]);
  });

  it("puts them at the ceiling, not at the canopy", () => {
    const points = hoodPoints();
    const low = points.map((p) => inches(p.position[1])).filter((y) => y < inches(ROOM.wallHeight) - 12);
    expect({ points: points.length, low }).toEqual({ points: 2, low: [] });
  });

  it("puts them over the island, where the hood hangs", () => {
    const points = hoodPoints();
    const off = points.filter(
      (p) =>
        p.position[0] < ISLAND.x[0] || p.position[0] > ISLAND.x[1] ||
        p.position[2] < ISLAND.z[0] || p.position[2] > ISLAND.z[1],
    );
    expect({ points: points.length, off: off.map((p) => p.point.type) }).toEqual({ points: 2, off: [] });
  });

  it("keeps the duct hole centred over the hood", () => {
    const duct = hoodPoints().find((p) => p.point.type === "duct")!;
    const hood = SLOT_BY_ID["slot-hood"];
    expect([
      Math.abs(inches(duct.position[0] - hood.position[0])) < 1e-6,
      Math.abs(inches(duct.position[2] - hood.position[2])) < 1e-6,
    ]).toEqual([true, true]);
  });
});

describe("package E's cooktop", () => {
  it("hangs its junction box about 12 inches under the countertop", () => {
    const selection = open("package-e");
    const power = resolveRoughIn("slot-cooktop", selection["slot-cooktop"])[0];
    const below = inches(ROOM.counterHeight) - inches(power.position[1]);
    expect(Math.round(below)).toBe(12);
  });
});

describe("nothing is dropped anywhere", () => {
  // The silent part of the fault: a point with no box just vanished. Every
  // package, every machine that has an entry, every point of it, drawn.
  it.each(PACKAGES.map((pkg) => pkg.id))("%s draws every point its models record", (id) => {
    const selection = open(id);
    const missing: string[] = [];
    for (const slotId of SLOT_ORDER) {
      if (isOmitted(slotId)) continue;
      const entry = roughInFor(selection[slotId]);
      if (!entry) continue;
      const drawn = resolveRoughIn(slotId, selection[slotId]).length;
      if (drawn !== entry.points.length)
        missing.push(`${slotId}: ${drawn} of ${entry.points.length} points`);
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
