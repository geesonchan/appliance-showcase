import { afterAll, describe, expect, it } from "vitest";
import { setActivePackage } from "./layoutState";
import { checkLayout } from "./layoutRules";
import { PACKAGE_BY_ID } from "./packages";
import { ISLAND, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { testPackageE } from "./testPackageE";
import { resetRoom } from "./testRoom";
import type { IslandLayout } from "./layoutTemplate";
import type { Slot, SlotId } from "../types";

/**
 * D11 rule 4 where the cooking surface is a cooktop in the island. Round 69.
 *
 * The check was written round a range: it looked for `slot-range` on a run and
 * failed "no range on any run" when there was none, and it held a hood over an
 * island to `slot-range` standing there — the shape of an early prototype, not
 * of package E, whose cooking surface is `slot-cooktop`. So E failed rule 4
 * outright and its hood was never checked. One assertion per test.
 */
const E_ID = "test-rule4-island-cooking";

function openE() {
  PACKAGE_BY_ID[E_ID] = testPackageE(E_ID);
  resetRoom();
  const result = setActivePackage(E_ID);
  if (!result.ok) throw new Error(`E will not build: ${JSON.stringify(result.reasons)}`);
}

/** The room's slots with the hood moved by `inches` along or across the island. */
function hoodMoved(inches: number, direction: "along" | "across"): Record<SlotId, Slot> {
  const hood = SLOT_BY_ID["slot-hood"];
  const alongX = ISLAND.axis === "x";
  const moveX = direction === "along" ? alongX : !alongX;
  const [x, y, z] = hood.position;
  const position: [number, number, number] = moveX ? [x + inches / 12, y, z] : [x, y, z + inches / 12];
  return { ...SLOT_BY_ID, "slot-hood": { ...hood, position } };
}

const rule4 = (slots: Record<SlotId, Slot> = SLOT_BY_ID) =>
  checkLayout(RUNS, undefined, ISLAND, slots).filter((v) => v.code === "d11-4" || v.code === "d13-hood-width");

afterAll(() => {
  delete PACKAGE_BY_ID[E_ID];
  resetRoom();
});

describe("rule 4 with the cooking on the island", () => {
  it("passes package E as it is built", () => {
    openE();
    expect(rule4()).toEqual([]);
  });

  // Asked by what it says, not by its code: the old check failed every one of
  // these rooms as d11-4, "no range on any run", and a test asking only for
  // d11-4 passed on that — the thing under test never having been reached.
  it("fails a hood 6\" off centre along the island", () => {
    openE();
    expect(rule4(hoodMoved(6, "along")).map((v) => v.message)).toEqual(['hood is 6.00" off centre along the island']);
  });

  it("fails a hood 6\" off centre across the island", () => {
    openE();
    expect(rule4(hoodMoved(6, "across")).map((v) => v.message)).toEqual(['hood is 6.00" off centre across the island']);
  });

  it("fails a hood narrower than the cooktop under it", () => {
    openE();
    const hood = SLOT_BY_ID["slot-hood"];
    const narrow = { ...SLOT_BY_ID, "slot-hood": { ...hood, cutout: { ...hood.cutout, w: 30 } } };
    expect(rule4(narrow).map((v) => v.code)).toEqual(["d13-hood-width"]);
  });
});

/**
 * Round 48's cases, moved here in round 69: an island laid both ways, 72" by
 * 36" (lopsided, so a check comparing the wrong axis cannot pass), the cooktop
 * in its middle and the hood `dx`, `dz` feet off it. They used to stand the
 * cooktop in `slot-range` in package A's room; they now use the island's own
 * cooktop in a room with no range.
 */
describe("rule 4 · a hood over an island cooktop is centred on it, either way the island is turned", () => {
  const island = (axis: "x" | "z"): IslandLayout =>
    axis === "z"
      ? { ...ISLAND, present: true, axis, x: [-1.5, 1.5], z: [-3, 3] }
      : { ...ISLAND, present: true, axis, x: [-3, 3], z: [-1.5, 1.5] };
  const centre = (i: IslandLayout) => [(i.x[0] + i.x[1]) / 2, (i.z[0] + i.z[1]) / 2] as const;
  const hung = (i: IslandLayout, dx: number, dz: number): Record<SlotId, Slot> => {
    const [x, z] = centre(i);
    return {
      ...SLOT_BY_ID,
      "slot-cooktop": { ...SLOT_BY_ID["slot-cooktop"], mount: "island", position: [x, 0, z] },
      "slot-hood": { ...SLOT_BY_ID["slot-hood"], mount: "island", position: [x + dx, 6, z + dz] },
    };
  };
  const offCentre = (i: IslandLayout, slots: Record<SlotId, Slot>) =>
    checkLayout(RUNS, undefined, i, slots)
      .filter((v) => v.code === "d11-4" && v.message.includes("off centre"))
      .map((v) => v.message.replace(/^hood is [\d.]+" /, ""));

  it("catches a hood slid 6 inches along an island turned across the room", () => {
    openE();
    expect(offCentre(island("z"), hung(island("z"), 0, 0.5))).toEqual(["off centre along the island"]);
  });

  it("catches a hood slid 6 inches along an island parallel to the back wall", () => {
    openE();
    expect(offCentre(island("x"), hung(island("x"), 0.5, 0))).toEqual(["off centre along the island"]);
  });

  it("catches a hood slid 6 inches across an island turned across the room", () => {
    openE();
    expect(offCentre(island("z"), hung(island("z"), 0.5, 0))).toEqual(["off centre across the island"]);
  });

  it("catches a hood slid 6 inches across an island parallel to the back wall", () => {
    openE();
    expect(offCentre(island("x"), hung(island("x"), 0, 0.5))).toEqual(["off centre across the island"]);
  });

  it("passes a hood hung straight over the cooktop, the island along the back wall", () => {
    openE();
    expect(offCentre(island("x"), hung(island("x"), 0, 0))).toEqual([]);
  });

  it("passes a hood hung straight over the cooktop, the island across the room", () => {
    openE();
    expect(offCentre(island("z"), hung(island("z"), 0, 0))).toEqual([]);
  });
});
