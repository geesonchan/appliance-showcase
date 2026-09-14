import type { CabinetBox } from "./cabinets";
import { axisIndex, otherAxis, type Facing } from "./frame";

/**
 * Which face of a box its door goes on, how wide and tall that face is, and how
 * deep the box is behind it — all in feet.
 *
 * The face is the box's own `facing`, recorded where the box is made (D22).
 * Round 50: this used to guess from the box's proportions, taking the longer
 * side on the plan for the front and always its +x or +z face. That put every
 * working-side door on an island inside the island, and on the wall runs it put
 * the door of anything narrower than it is deep — a 21" drawer base, a 3"
 * filler, the side of a tall unit — on its side.
 */
export function doorFace(box: CabinetBox): Facing & { width: number; height: number; depth: number } {
  const { axis, sign } = box.facing;
  return {
    axis,
    sign,
    width: box.size[axisIndex(otherAxis(axis))],
    height: box.size[1],
    depth: box.size[axisIndex(axis)],
  };
}
