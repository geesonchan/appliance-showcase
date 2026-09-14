import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID, SLOT_ORDER } from "./catalogue";
import { setActivePackage, setLayoutParams, setLayoutParamsGrowing } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { resolveRoughIn } from "./roughIn";
import { REQUESTED_PARAMS } from "./room";
import { ISLAND, SLOT_BY_ID, isOmitted } from "./slots";

/**
 * A machine in the island has its rough-in points in the island. Round 43.
 *
 * Checked against the island's own plan extents and nothing the resolver
 * reports about where it put a point. The resolver used to fall back to the
 * first wall run for a slot on no run, and the host box it reported came from
 * that same fallback — so a test that asked "is the point inside its host"
 * agreed with the mistake and passed while MD24BS's anti-tip block was drawn on
 * the left wall beside the refrigerator.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

const EPSILON = 1e-6;
const within = (value: number, [low, high]: readonly [number, number]) =>
  value >= Math.min(low, high) - EPSILON && value <= Math.max(low, high) + EPSILON;
const f2 = (values: readonly number[]) => values.map((v) => v.toFixed(2)).join("..");

describe.each(["parallel", "perpendicular"] as const)("an island laid %s", (islandOrientation) => {
  it.each(["package-a", "package-d"])("keeps the rough-in points of %s's island machines in the island", (id) => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
    expect(setActivePackage(id).ok).toBe(true);
    expect(setLayoutParamsGrowing({ ...REQUESTED_PARAMS, islandOrientation }).ok).toBe(true);
    expect(ISLAND.present).toBe(true);

    const selection = PACKAGE_BY_ID[id].defaultSelection as Record<string, string>;
    const problems: string[] = [];
    let checked = 0;
    for (const slotId of SLOT_ORDER) {
      if (isOmitted(slotId) || SLOT_BY_ID[slotId].mount !== "island") continue;
      for (const resolved of resolveRoughIn(slotId, APPLIANCE_BY_ID[selection[slotId]])) {
        checked += 1;
        const [x, , z] = resolved.position;
        if (!within(x, ISLAND.x) || !within(z, ISLAND.z)) {
          problems.push(
            `${slotId} ${resolved.point.type} at x ${x.toFixed(2)}, z ${z.toFixed(2)}; ` +
              `island x ${f2(ISLAND.x)}, z ${f2(ISLAND.z)}`,
          );
        }
      }
    }
    expect(checked, "no island rough-in point to check").toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
