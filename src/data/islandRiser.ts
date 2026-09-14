import { ft } from "./room";

/** How far behind an island machine its services come up through the floor. */
export const ISLAND_RISER_BEHIND_IN = 6;

/**
 * Where an island machine's services rise out of the floor, and the shape of
 * the box they end in.
 *
 * Behind the machine, whichever way it faces. A slot turned by `rotationY`
 * faces (sin, cos) on the floor plan, so behind it is the other way on both
 * axes. Round 49: this used to move z by cos alone, and on an island turned
 * across the room cos is 0, so the riser stood under the middle of the machine.
 * The box is thin in the direction the machine faces, so it lies flat against
 * whatever it is fixed to either way.
 */
export function islandRiser(slot: {
  position: readonly [number, number, number];
  rotationY: number;
}): { x: number; z: number; box: [number, number, number] } {
  const [x, , z] = slot.position;
  const sin = Math.sin(slot.rotationY);
  const cos = Math.cos(slot.rotationY);
  const behind = ft(ISLAND_RISER_BEHIND_IN);
  const facesX = Math.abs(sin) > Math.abs(cos);
  return {
    x: x - sin * behind,
    z: z - cos * behind,
    box: facesX ? [ft(2), ft(4.5), ft(3)] : [ft(3), ft(4.5), ft(2)],
  };
}
