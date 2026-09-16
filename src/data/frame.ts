/**
 * Which way things face, written once.
 *
 * Round 50 (D22). A sweep in round 49 found sixteen places that got an island,
 * or an island turned across the room, wrong. Five of them did the same turn
 * written out again; the other eleven did no turn at all — they guessed which
 * way a thing faced from its proportions, or assumed it was on the back wall.
 * So there are two things here: one way to turn a point, and a way to say
 * which way something faces so nothing has to guess.
 *
 * Three kinds of frame share it. A run and the island are strips laid along an
 * axis: a point on one is how far along and a coordinate across. A machine is
 * turned by `rotationY`: a point in it is how far across its face and how far
 * out of it. `orientationGuard.test.ts` holds the rest of `src` to asking this
 * module rather than writing its own.
 *
 * Feet throughout, on the floor plan: x along the back wall, z along the left
 * wall, y up. A turn of 0 faces +z, out from the back wall; a quarter turn faces
 * +x, out from the left wall. That is three.js's own turn about y.
 */

/** A world axis on the floor plan. */
export type Axis = "x" | "z";

/** Which way a face points: along a world axis, toward its higher or lower end. */
export interface Facing {
  axis: Axis;
  sign: -1 | 1;
}

/** The other axis on the floor plan. */
export const otherAxis = (axis: Axis): Axis => (axis === "x" ? "z" : "x");

/** The index of an axis in an `[x, y, z]` triple. */
export const axisIndex = (axis: Axis): 0 | 2 => (axis === "x" ? 0 : 2);

// --- a strip laid along an axis: a run, or the island ------------------------

/** A point on a strip laid along `axis`: how far along it, and where across it. */
export function onAxis(axis: Axis, along: number, across: number, y = 0): [number, number, number] {
  return axis === "x" ? [along, y, across] : [across, y, along];
}

/** How far along a strip laid along `axis` a plan point is. */
export const alongOf = (axis: Axis, x: number, z: number): number => (axis === "x" ? x : z);

/** Where across a strip laid along `axis` a plan point is. */
export const acrossOf = (axis: Axis, x: number, z: number): number => (axis === "x" ? z : x);

/**
 * A pair on the plan, `[x, z]`, from what it is along and across a strip: a
 * box's size, or the island's two extents.
 */
export const sizeOnAxis = <T>(axis: Axis, along: T, across: T): [T, T] =>
  axis === "x" ? [along, across] : [across, along];

/** Pick the along and the across extent out of a pair of `[x, z]` extents. */
export const extentsOnAxis = <T>(axis: Axis, x: T, z: T): { along: T; across: T } =>
  axis === "x" ? { along: x, across: z } : { along: z, across: x };

/** The face of a strip toward its higher (+1) or lower (-1) across coordinate. */
export const stripFacing = (axis: Axis, sign: -1 | 1): Facing => ({ axis: otherAxis(axis), sign });

/** The turn of something that faces out of a strip's side: +1 its higher across, -1 its lower. */
export function faceRotation(axis: Axis, sign: -1 | 1): number {
  return rotationOf(stripFacing(axis, sign));
}

/**
 * Whether further along a run is to the right of a machine standing in it.
 *
 * "Right" is the machine's own: its local +x, which is what the hinge and the
 * trim kit are written in. A machine faces out of the run's +1 side.
 */
export function alongIsToTheRight(axis: Axis): boolean {
  const [rx, rz] = turnPlan(faceRotation(axis, 1), 1, 0);
  return alongOf(axis, rx, rz) > 0;
}

// --- a machine turned by rotationY ----------------------------------------------

/** Anything with a place on the plan and a turn: a slot, a fixture, a service point. */
export interface Turned {
  position: readonly [number, number, number] | readonly number[];
  rotationY: number;
}

/** A vector across-and-out in a turned frame, as an `[x, z]` vector on the plan. */
function turnPlan(rotationY: number, across: number, out: number): [number, number] {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return [across * cos + out * sin, -across * sin + out * cos];
}

/** A point in a machine's own frame — across its face, out of it — on the plan, `[x, z]`. */
export function toPlan(frame: Turned, across: number, out: number): [number, number] {
  const [dx, dz] = turnPlan(frame.rotationY, across, out);
  return [frame.position[0] + dx, frame.position[2] + dz];
}

/** The same, with a height: `[x, y, z]`. */
export function toWorld(frame: Turned, across: number, y: number, out: number): [number, number, number] {
  const [x, z] = toPlan(frame, across, out);
  return [x, y, z];
}

/** A plan point in a machine's own frame: how far across its face, how far out of it. */
export function toLocal(frame: Turned, x: number, z: number): { across: number; out: number } {
  const dx = x - frame.position[0];
  const dz = z - frame.position[2];
  const cos = Math.cos(frame.rotationY);
  const sin = Math.sin(frame.rotationY);
  return { across: dx * cos - dz * sin, out: dx * sin + dz * cos };
}

/** The way a machine faces, as a unit `[x, z]` vector. */
export const outward = (rotationY: number): [number, number] => turnPlan(rotationY, 0, 1);

/** The nearest world axis and direction to the way a turn faces. */
export function facingOf(rotationY: number): Facing {
  const [x, z] = outward(rotationY);
  return Math.abs(z) >= Math.abs(x)
    ? { axis: "z", sign: z >= 0 ? 1 : -1 }
    : { axis: "x", sign: x >= 0 ? 1 : -1 };
}

/** Whether two facings are the same way. */
export const sameFacing = (a: Facing, b: Facing): boolean => a.axis === b.axis && a.sign === b.sign;

/** The turn that faces a given way. */
export function rotationOf(facing: Facing): number {
  if (facing.axis === "z") return facing.sign > 0 ? 0 : Math.PI;
  return facing.sign > 0 ? Math.PI / 2 : Math.PI * 1.5;
}

/** A machine's width and depth as extents on the plan, `[x, z]`, turned with it. */
export function sizeOnPlan(rotationY: number, width: number, depth: number): [number, number] {
  return facingOf(rotationY).axis === "z" ? [width, depth] : [depth, width];
}

