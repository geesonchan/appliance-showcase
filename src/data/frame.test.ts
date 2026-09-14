import { describe, expect, it } from "vitest";
import {
  alongIsToTheRight,
  faceRotation,
  facingOf,
  onAxis,
  outward,
  rotationOf,
  sizeOnPlan,
  toLocal,
  toPlan,
} from "./frame";

/**
 * The frame module, held to the room's own conventions rather than to itself:
 * a turn of 0 faces out from the back wall (+z), a quarter turn faces out from
 * the left wall (+x) — the two turns every wall machine in the room already
 * has — and three.js turns a point about y the same way.
 */
const near = (a: readonly number[], b: readonly number[]) =>
  a.forEach((value, i) => expect(value).toBeCloseTo(b[i], 9));

describe("a machine's own frame", () => {
  it("faces +z at no turn and +x at a quarter turn, as the back and left walls' machines do", () => {
    near(outward(0), [0, 1]);
    near(outward(Math.PI / 2), [1, 0]);
    expect(facingOf(0)).toEqual({ axis: "z", sign: 1 });
    expect(facingOf(Math.PI / 2)).toEqual({ axis: "x", sign: 1 });
    expect(facingOf(Math.PI)).toEqual({ axis: "z", sign: -1 });
    expect(facingOf(Math.PI * 1.5)).toEqual({ axis: "x", sign: -1 });
  });

  it("turns a point the way three.js turns an object about y", () => {
    // Object3D.rotation.y = t maps local (x, z) to (x cos t + z sin t, -x sin t + z cos t).
    for (const t of [0, 0.3, Math.PI / 2, Math.PI, 4.1]) {
      const [x, z] = toPlan({ position: [2, 0, -1], rotationY: t }, 0.7, 1.9);
      near([x, z], [2 + 0.7 * Math.cos(t) + 1.9 * Math.sin(t), -1 - 0.7 * Math.sin(t) + 1.9 * Math.cos(t)]);
    }
  });

  it("brings a point back to where it came from", () => {
    const frame = { position: [3, 0, 5], rotationY: 2.2 };
    const [x, z] = toPlan(frame, -1.25, 0.5);
    const local = toLocal(frame, x, z);
    near([local.across, local.out], [-1.25, 0.5]);
  });

  it("lays width across the face and depth out of it", () => {
    near(sizeOnPlan(0, 3, 2), [3, 2]);
    near(sizeOnPlan(Math.PI / 2, 3, 2), [2, 3]);
    near(sizeOnPlan(Math.PI, 3, 2), [3, 2]);
  });

  it("faces what it is turned to face", () => {
    for (const facing of [
      { axis: "z", sign: 1 },
      { axis: "z", sign: -1 },
      { axis: "x", sign: 1 },
      { axis: "x", sign: -1 },
    ] as const) {
      expect(facingOf(rotationOf(facing))).toEqual(facing);
    }
  });
});

describe("a strip laid along an axis", () => {
  it("puts along on the strip's axis and across on the other", () => {
    near(onAxis("x", 4, -2, 1), [4, 1, -2]);
    near(onAxis("z", 4, -2, 1), [-2, 1, 4]);
  });

  it("turns the machines on its sides to face out of them", () => {
    // The back run's machines face +z; the left run's face +x.
    expect(faceRotation("x", 1)).toBeCloseTo(0, 9);
    expect(faceRotation("z", 1)).toBeCloseTo(Math.PI / 2, 9);
    // The island's working side is its lower across coordinate.
    expect(facingOf(faceRotation("x", -1))).toEqual({ axis: "z", sign: -1 });
    expect(facingOf(faceRotation("z", -1))).toEqual({ axis: "x", sign: -1 });
  });

  it("has further along to a machine's right on the back wall and to its left on the left wall", () => {
    // Facing the back wall, the run goes away from the corner to your right;
    // facing the left wall it goes away from the corner to your left.
    expect(alongIsToTheRight("x")).toBe(true);
    expect(alongIsToTheRight("z")).toBe(false);
  });
});
