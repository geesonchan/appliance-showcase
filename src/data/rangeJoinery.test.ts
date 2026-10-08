import { afterAll, describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates";
import { dropsIntoCounter } from "./cookingSurface";
import { counterOutline } from "./counter";
import { setActivePackage, setRangeModel } from "./layoutState";
import { BUILDABLE_PACKAGES, slotsOf } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { resetRoom } from "./testRoom";
import type { Appliance } from "../types";

/**
 * Round 83: the run, the counter and the machine agree on what stands under a
 * cooking surface, and it is the chosen machine's to say.
 *
 * Leo's rule, from site: a rangetop always has a base cabinet under it, in any
 * package, whichever way the swap goes; a range stands on the floor with
 * nothing under it; a slide-in stands on the floor too, and the stone stops at
 * its two sides with nothing behind it.
 *
 * Every buildable package, every range its slot offers that fits on width —
 * the swaps a customer can make on the model card — and back to the package's
 * own range after each, so a choice cannot stick to the room. Held to the
 * machine's kind as it is written in the data (a rangetop, or not), and to
 * what is built: the run's modules, and whether the stone at the middle of the
 * cooking opening is a hole in one slab or the gap between two.
 */

afterAll(() => resetRoom());

type Point = readonly [number, number];

/** Even-odd point in polygon, in plan. */
function inside(point: Point, polygon: readonly Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > point[1] !== zj > point[1] && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** What is built at the cooking opening, read from the room. */
function built(range: Appliance) {
  const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
  const segment = run.segments.find((s) => s.slot === "slot-range")!;
  const mid = (segment.from + segment.to) / 2;
  const centre: Point = run.axis === "x" ? [mid, run.centre] : [run.centre, mid];
  const { pieces } = counterOutline(RUNS, range);
  const slab = pieces.find((piece) => inside(centre, piece.outline as unknown as Point[]));
  return {
    drawerBase: segment.modules.some((m) => m.kind === "drawer-base"),
    stone: !slab ? "cut" : slab.holes.some((hole) => inside(centre, hole as unknown as Point[])) ? "hole" : "solid",
  };
}

describe("what stands under a cooking surface", () => {
  it("follows the machine chosen, for every range every package offers, and goes back with it", () => {
    const wrong: string[] = [];
    let swaps = 0;
    let rangetops = 0;
    for (const entry of BUILDABLE_PACKAGES) {
      if (!slotsOf(entry)["slot-range"]) continue;
      resetRoom();
      if (!setActivePackage(entry.id).ok) {
        wrong.push(`${entry.id}: room refused`);
        continue;
      }
      const own = candidatesFor("slot-range", entry).find((c) => c.appliance.id === entry.defaultSelection["slot-range"])!
        .appliance;
      const walls = `${REQUESTED_PARAMS.backWallIn}x${REQUESTED_PARAMS.leftWallIn}`;
      for (const { appliance, fit } of candidatesFor("slot-range", entry)) {
        if (!fit.fits) continue;
        if (dropsIntoCounter(appliance)) rangetops += 1;
        for (const range of [appliance, own]) {
          const result = setRangeModel(range, entry.id);
          swaps += 1;
          const want = dropsIntoCounter(range)
            ? { drawerBase: true, stone: "hole" }
            : { drawerBase: false, stone: "cut" };
          const got = built(range);
          const wallsNow = `${REQUESTED_PARAMS.backWallIn}x${REQUESTED_PARAMS.leftWallIn}`;
          if (!result.ok || JSON.stringify(got) !== JSON.stringify(want) || wallsNow !== walls) {
            wrong.push(
              `${entry.id} ${range.model}: ${result.ok ? "" : "refused, "}got ${JSON.stringify(got)}, want ${JSON.stringify(want)}${wallsNow !== walls ? `, walls ${walls} -> ${wallsNow}` : ""}`,
            );
          }
        }
      }
    }
    // Four packages cook on a range (E cooks in its island). The 36" rangetop
    // fits A's, B's and D's 36" openings and not C's 30", so three swaps are
    // to a rangetop.
    expect({ enoughSwaps: swaps >= 30, rangetops, wrong }).toEqual({ enoughSwaps: true, rangetops: 3, wrong: [] });
  });
});
