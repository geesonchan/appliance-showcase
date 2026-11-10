import { describe, expect, it } from "vitest";
import { PROUD_MAX_IN, ovenFrontIn, type FrontPart } from "./ovenFrontMeasure";

/**
 * How the smoke test's "a hung oven's front stands in the plane of the
 * tower's doors" reads an oven's front (Leo, 2026-11-10: 「旋钮的豁免：证明它只认标成
 * 旋钮的零件，凸出不超过规格书上旋钮的尺寸（写页码）；再加一条测试，让一块没标记的东西凸出
 * 1"，要变红。」).
 *
 * No sheet or guide prints a knob's size (po302w-spec.pdf, pods302b-spec.pdf,
 * 8001185222_A). What they print that stands furthest off the door is the
 * handle: "Door Handle Depth … 2 5/8" … Protrusion of handle from door skin",
 * each sheet's page 2. So a knob is let stand proud up to that and no more.
 */

const DOOR = 100;
const at = (proudIn: number, userData: Record<string, unknown> = {}): FrontPart => ({ userData, frontIn: DOOR + proudIn });
const PLANE = 0.125; // the smoke test's 1/8"
const off = (parts: FrontPart[]) => ovenFrontIn(parts, DOOR).frontIn - DOOR;

describe("an oven's front, read for the plane of the doors", () => {
  const body = [at(0), at(0.125)];

  it("counts an unmarked part standing 1\" proud: the plane check goes red", () => {
    expect(off([...body, at(1)])).toBeGreaterThan(PLANE);
  });

  it("counts a part marked only 'proud', not a knob", () => {
    expect(off([...body, at(1, { proud: true })])).toBeGreaterThan(PLANE);
  });

  it("lets a knob stand 1\" proud, and says how far", () => {
    const read = ovenFrontIn([...body, at(1, { knob: true })], DOOR);
    expect({ off: read.frontIn - DOOR, knobs: read.knobsIn }).toEqual({ off: 0.125, knobs: 1 });
  });

  it(`counts a knob standing prouder than the handle's ${PROUD_MAX_IN}"`, () => {
    expect(off([...body, at(PROUD_MAX_IN + 0.25, { knob: true })])).toBeGreaterThan(PLANE);
  });

  it("lets a handle stand proud, as before", () => {
    expect(off([...body, at(2.625, { handle: true })])).toBeLessThanOrEqual(PLANE);
  });

  it("holds the knob to the handle's published depth, 2-5/8\"", () => {
    expect(PROUD_MAX_IN).toBe(2.625);
  });
});
