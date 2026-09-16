import { facingOf, stripFacing } from "./frame";
import { againstWall, wallBehind } from "./roomWalls";
import { RUN_BY_ID } from "./room";
import type { ServicePoint } from "../types";

/**
 * Where a slot meets its wall, at a given standoff from the wall plane.
 *
 * Null for a slot in the island: it is on no wall, and its services come up
 * through the floor behind it (`islandRiser`). `serviceRoute` is the question
 * asked both ways round, and is what the utility layer calls.
 *
 * Round 50 (D22 step 2). This used to read a quarter turn as the left wall and
 * any other turn as the back wall, whatever the slot was mounted on. An island
 * wine cabinet on an island laid across the room is turned a quarter, so it was
 * anchored to the left wall; the island's microwave drawer was anchored to the
 * back wall.
 *
 * Round 52 (D22 step 3). The facing was right after that, but the wall itself
 * was still written out here — `-ROOM.halfX` for one and `-ROOM.halfZ` for the
 * other, which is the two walls this room happens to have. `wallBehind` answers
 * it from the facing, so a machine facing the other way anchors to the wall it
 * actually backs onto rather than to the far side of the kitchen.
 */
export function wallAnchor(
  slot: ServicePoint,
  standoff: number,
): { onLeftWall: boolean; x: number; z: number } | null {
  if (slot.mount === "island") return null;
  const { wall, x, z } = againstWall(
    facingOf(slot.rotationY),
    slot.position[0],
    slot.position[2],
    standoff,
  );
  // The trunks care which of the two walls it is, because a run to the left
  // wall turns the inside corner on the way. Which one that is comes from the
  // left run — the wall it backs onto — rather than from naming an axis here.
  const leftWall = wallBehind(stripFacing(RUN_BY_ID.left.axis, 1));
  return { onLeftWall: wall.axis === leftWall.axis, x, z };
}
