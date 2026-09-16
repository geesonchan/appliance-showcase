import { afterAll, describe, expect, it } from "vitest";
import { SLOT_ORDER } from "./catalogue";
import { flyInAzimuth } from "./flyIn";
import { setActivePackage, setLayoutParams, setLayoutParamsGrowing } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE } from "./packages";
import { ISLAND, REQUESTED_PARAMS, runForSlot } from "./room";
import { SLOT_BY_ID, isOmitted } from "./slots";
import type { SlotId } from "../types";

/**
 * D22 step 2, report two, round 51: a fly-in is stored relative to the
 * machine's front, so it arrives at the same view of a machine wherever the
 * machine is.
 *
 * Every view is described here from outside the code that makes it: which way
 * is the front (a back-run machine faces +z, a left-run one +x, an island one
 * the long face of the island it stands nearer), which way is the far end of
 * what it stands on (away from the room's inside corner, where the runs meet:
 * +x along the back run and along an island laid parallel to it, +z along the
 * left run and along an island turned across the room), and from those two
 * the camera's angle off the front and the side it leans to.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

const EPS = 1e-6;

function build(id: string, islandOrientation: "parallel" | "perpendicular" = "parallel") {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  expect(setActivePackage(id).ok).toBe(true);
  expect(setLayoutParamsGrowing({ ...REQUESTED_PARAMS, islandOrientation }).ok).toBe(true);
}

/** A machine's view: degrees off its front, the side it leans to, and whether it is in front at all. */
function view(slotId: SlotId) {
  const slot = SLOT_BY_ID[slotId];
  const azimuth = flyInAzimuth(slot);
  const camera = { x: Math.sin(azimuth), z: Math.cos(azimuth) };
  let front: { axis: "x" | "z"; sign: 1 | -1 };
  let along: "x" | "z";
  if (slot.mount === "island") {
    const alongIsX = ISLAND.x[1] - ISLAND.x[0] > ISLAND.z[1] - ISLAND.z[0];
    along = alongIsX ? "x" : "z";
    const acrossAxis = alongIsX ? "z" : "x";
    const across = acrossAxis === "z" ? ISLAND.z : ISLAND.x;
    const at = acrossAxis === "z" ? slot.position[2] : slot.position[0];
    front = { axis: acrossAxis, sign: at < (across[0] + across[1]) / 2 ? -1 : 1 };
  } else if (runForSlot(slotId) === "back") {
    along = "x";
    front = { axis: "z", sign: 1 };
  } else {
    along = "z";
    front = { axis: "x", sign: 1 };
  }
  const out = camera[front.axis] * front.sign;
  const lean = camera[along];
  return {
    inFront: out > EPS,
    offFrontDeg: (Math.atan2(Math.abs(lean), out) * 180) / Math.PI,
    leansToFarEnd: lean > 0,
  };
}

describe("a fly-in arrives at the same view of a machine wherever it stands", () => {
  it.each(["slot-microwave", "slot-wine"] as const)(
    "flies in on package A's island %s the same way with the island along the back wall or across the room",
    (slotId) => {
      build("package-a", "parallel");
      const along = view(slotId);
      build("package-a", "perpendicular");
      const across = view(slotId);
      expect(across.offFrontDeg).toBeCloseTo(along.offFrontDeg, 6);
      expect(across.leansToFarEnd).toBe(along.leansToFarEnd);
    },
  );

  it("flies in on the dishwasher the same way on the back run (package A) and on the left run (package B)", () => {
    build("package-a");
    expect(runForSlot("slot-dishwasher")).toBe("back");
    const back = view("slot-dishwasher");
    build("package-b");
    expect(runForSlot("slot-dishwasher")).toBe("left");
    const left = view("slot-dishwasher");
    expect(left.offFrontDeg).toBeCloseTo(back.offFrontDeg, 6);
    expect(left.leansToFarEnd).toBe(back.leansToFarEnd);
  });

  it("flies in on the refrigerator the same way on the left run (package A) and on the back run (package B)", () => {
    build("package-a");
    const left = view("slot-fridge");
    build("package-b");
    const back = view("slot-fridge");
    expect(back.offFrontDeg).toBeCloseTo(left.offFrontDeg, 6);
    expect(back.leansToFarEnd).toBe(left.leansToFarEnd);
  });

  it.each([
    ["package-a", "parallel"],
    ["package-a", "perpendicular"],
    ["package-b", "parallel"],
    ["package-c", "parallel"],
    ["package-d", "parallel"],
  ] as const)("puts the camera in front of every machine in %s, island %s", (id, orientation) => {
    build(id, orientation);
    const behind = SLOT_ORDER.filter((slotId) => !isOmitted(slotId) && !view(slotId).inFront);
    expect(behind).toEqual([]);
  });
});
