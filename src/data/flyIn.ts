import { alongOf, facingOf, otherAxis, toPlan } from "./frame.ts";
import type { Slot } from "../types";

/**
 * How far off a machine's front a fly-in arrives, in degrees, when its slot
 * does not say otherwise. D22, round 51.
 *
 * 45: the default overview is 45 degrees round from the back wall, so a fly-in
 * at 45 off a back-wall machine is the overview turned to face that machine,
 * and seven of the eleven angles hand-set before this were 40 to 55 off their
 * machine's front. Toward the far end of what the machine stands on, because
 * that is where the room is open; toward the inside corner the camera looks
 * across the tall units that finish the other run.
 */
export const FLY_IN_OFFSET_DEG = 45;

/**
 * The azimuth a fly-in arrives at for a slot, in radians.
 *
 * `bestView.azimuth` is how far off the machine's front the camera comes in,
 * in degrees: positive leans toward the far end of the run or island the
 * machine stands on — away from the room's inside corner, +x along the back
 * run, +z along the left one — and negative leans toward that corner. The
 * machine's own turn is added, so the same figure gives the same view of the
 * machine on either wall and with its island either way round.
 *
 * Round 51 (D22 step 2). It used to be an absolute azimuth, which meant the
 * same view only while everything faced the back wall: turning package A's
 * island across the room brought the camera in 60 degrees off the microwave
 * drawer's front instead of 30, and the dishwasher was 55 off on the back run
 * and 35 off on the left one.
 */
export function flyInAzimuth(slot: Pick<Slot, "rotationY" | "bestView">): number {
  // What it stands on runs across its face, and its own right says which way
  // along that is.
  const along = otherAxis(facingOf(slot.rotationY).axis);
  const [rightX, rightZ] = toPlan({ position: [0, 0, 0], rotationY: slot.rotationY }, 1, 0);
  const towardFarEnd = alongOf(along, rightX, rightZ) >= 0 ? 1 : -1;
  return slot.rotationY + (towardFarEnd * slot.bestView.azimuth * Math.PI) / 180;
}
