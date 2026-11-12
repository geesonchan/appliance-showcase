import { islandRiser } from "./islandRiser";
import { wallAnchor } from "./wallAnchor";
import { facingOf, onAxis, otherAxis, type Facing } from "./frame";
import { againstWall, wallBehind } from "./roomWalls";
import { RUN_BY_ID, serviceEntry } from "./room";
import { ROOM, ft } from "./roomShell";
import { LEFT_WALL_FACING } from "./layoutShape";
import type { ServicePoint } from "../types";

/**
 * How a machine's services reach it: along a wall, or up through the floor.
 *
 * One answer for gas, water and power, because it is one fact about the
 * machine and not three. A machine on a run backs onto a wall and its trunk
 * runs along it. A machine in the island backs onto nothing: its services come
 * up through the slab inside the cabinet, which is what `islandRiser` draws.
 *
 * Round 52 (D22 step 3). Before this, power asked `islandRiser` and gas and
 * water asked `wallAnchor`, got nothing, and drew nothing — an island slot with
 * a gas cooktop or a prep sink in it would have been a machine with no services
 * at all in the view that exists to explain the services.
 */
export type ServiceRoute =
  | { kind: "wall"; onLeftWall: boolean; x: number; z: number }
  | { kind: "floor"; x: number; z: number; box: [number, number, number] };

export function serviceRoute(slot: ServicePoint, standoff: number): ServiceRoute {
  const anchor = wallAnchor(slot, standoff);
  if (anchor) return { kind: "wall", ...anchor };
  const riser = islandRiser(slot);
  return { kind: "floor", x: riser.x, z: riser.z, box: riser.box };
}

export { islandRiser };

/**
 * Where the services come into the room, a standoff off the wall (U-2).
 *
 * The U's: on the cooking surface's wall, 48" back from its run's open end
 * (`serviceEntry`; Leo, 2026-11-11: 「管线进口：U 型用 4'（48"）」). The L's and one
 * wall's as the utility layer has drawn them since round 52: the back run's wall,
 * `ft(4)` — 4 inches — from the room's far end, the comment there saying four
 * feet. Registered, not changed (Open items, "The services' entry: 4" or 4'"; Leo:
 * 「保持登记，等 U 型做完单独修一轮」).
 */
export function serviceEntryPoint(standoff: number): { x: number; z: number } {
  if (RUN_BY_ID.right) {
    const { run: id, along } = serviceEntry();
    const run = RUN_BY_ID[id];
    const wall = wallBehind(run.facing);
    const [x, , z] = onAxis(otherAxis(wall.axis), along, wall.at + run.facing.sign * standoff);
    return { x, z };
  }
  const run = RUN_BY_ID.back;
  const wall = wallBehind(run.facing);
  const [x, , z] = onAxis(otherAxis(wall.axis), ROOM.halfX - ft(4), wall.at + run.facing.sign * standoff);
  return { x, z };
}

/** Where two walls meet, a standoff off each: the inside corner a trunk turns. */
function cornerOf(a: Facing, b: Facing, standoff: number): { x: number; z: number } {
  const first = wallBehind(a);
  const second = wallBehind(b);
  const at = { x: 0, z: 0 };
  at[first.axis] = first.at + a.sign * standoff;
  at[second.axis] = second.at + b.sign * standoff;
  return at;
}

/**
 * A trunk's way from the entry to a machine on a wall, on the plan: along the
 * walls, turning their inside corners, never across the floor. The L's: the
 * back wall, then round the corner to the left wall (round 52). The U's (U-2):
 * from the right wall, round the right-back corner to the back wall, and round
 * the back-left corner to the left wall.
 */
export function trunkPath(slot: ServicePoint, standoff: number): { x: number; z: number }[] {
  const anchor = wallAnchor(slot, standoff);
  // A trunk runs along the walls, and an island slot is on none of them: its
  // services come up through the floor (`islandRiser`). D22.
  if (!anchor) throw new Error(`serviceRoute: no wall trunk to ${slot.id}, which is in the island`);
  const points = [serviceEntryPoint(standoff)];
  const back = RUN_BY_ID.back.facing;
  const left = RUN_BY_ID.left?.facing ?? LEFT_WALL_FACING;
  const right = RUN_BY_ID.right?.facing;
  if (right) {
    const { wall } = againstWall(facingOf(slot.rotationY), slot.position[0], slot.position[2], standoff);
    const on = (facing: Facing) => {
      const behind = wallBehind(facing);
      return behind.axis === wall.axis && behind.at === wall.at;
    };
    if (!on(right)) points.push(cornerOf(right, back, standoff));
    if (on(left)) points.push(cornerOf(back, left, standoff));
  } else if (anchor.onLeftWall) {
    points.push(cornerOf(back, left, standoff));
  }
  points.push({ x: anchor.x, z: anchor.z });
  return points;
}
