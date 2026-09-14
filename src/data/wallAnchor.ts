import { ROOM } from "./room";
import { facingOf, sameFacing, stripFacing } from "./frame";
import type { ServicePoint } from "../types";

/**
 * Where a slot meets its wall, at a given standoff from the wall plane.
 *
 * Null for a slot in the island: it is on no wall, and its services come up
 * through the floor behind it (`islandRiser`). A wall slot is on the left wall
 * when it faces the way the left run's machines face, +x, and on the back wall
 * otherwise.
 *
 * Round 50 (D22 step 2). This used to read a quarter turn as the left wall and
 * any other turn as the back wall, whatever the slot was mounted on. An island
 * wine cabinet on an island laid across the room is turned a quarter, so it was
 * anchored to the left wall; the island's microwave drawer was anchored to the
 * back wall. No island slot has gas or water yet, so nothing was drawn from it —
 * it would have been the first day one did.
 */
export function wallAnchor(
  slot: ServicePoint,
  standoff: number,
): { onLeftWall: boolean; x: number; z: number } | null {
  if (slot.mount === "island") return null;
  const onLeftWall = sameFacing(facingOf(slot.rotationY), stripFacing("z", 1));
  return {
    onLeftWall,
    x: onLeftWall ? -ROOM.halfX + standoff : slot.position[0],
    z: onLeftWall ? slot.position[2] : -ROOM.halfZ + standoff,
  };
}
