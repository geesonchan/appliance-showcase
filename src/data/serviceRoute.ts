import { islandRiser } from "./islandRiser";
import { wallAnchor } from "./wallAnchor";
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
