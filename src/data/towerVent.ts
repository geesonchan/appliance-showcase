import { RUNS, ft } from "./room";
import { SLOT_BY_ID } from "./slots";
import type { SlotId } from "../types";

/**
 * The vent a hung oven breathes through.
 *
 * Leo, round 32, from site practice: not under the machine, where a grille in
 * the drawer front or the toe kick is the first thing seen from across the room,
 * but in the top of its opening, against the back wall — the shelf the bridge
 * cabinet stands on, cut through along its back edge, where nobody standing in
 * the kitchen can see it.
 *
 * Neither the MEM301WS sheet nor anything for the PODS302B in
 * `docs/reference/` gives a figure for it, so the size is Leo's: most of the
 * opening's width and 2"-3" deep. It is built at the deep end of that, with a
 * 3/4" board left each side so the shelf still bears on the carcass.
 */
export const TOWER_VENT = {
  /** How far the hole reaches forward from the back of the opening. */
  depthIn: 3,
  /** Shelf left each side of the hole. */
  sideLipIn: 0.75,
};

export interface TowerVent {
  /** The oven whose opening it is in. */
  slot: SlotId;
  widthIn: number;
  depthIn: number;
  /** Centre of the hole, in world feet. */
  position: [number, number, number];
  /** The oven's own turn, so the hole runs along its back. */
  rotationY: number;
  /** Its front edge's two ends, in world feet — what the figure is drawn along. */
  front: [[number, number, number], [number, number, number]];
}

/** A point in a slot's own frame — +x across it, +z out of the wall — in the room. */
function toWorld(slotId: SlotId, x: number, y: number, z: number): [number, number, number] {
  const slot = SLOT_BY_ID[slotId];
  const cos = Math.cos(slot.rotationY);
  const sin = Math.sin(slot.rotationY);
  return [slot.position[0] + x * cos + z * sin, y, slot.position[2] - x * sin + z * cos];
}

/**
 * Every tower that hangs its machine off the floor, with the vent in its top.
 *
 * Read off the run rather than off a package, so B's combination oven and D's
 * steam oven get theirs from the same line: a tall unit whose opening starts
 * above the floor with nothing standing under it. A refrigerator column starts
 * on the floor; the coffee cabinet has a dishwasher in its bottom and a machine
 * that does not need one.
 */
export function towerVents(): TowerVent[] {
  const slots: SlotId[] = [];
  for (const run of RUNS) {
    for (const segment of run.segments) {
      for (const module of segment.modules) {
        if (
          module.kind === "tall" &&
          module.slot &&
          (module.sillIn ?? 0) > 0 &&
          !module.lowerSlot &&
          !slots.includes(module.slot)
        ) {
          slots.push(module.slot);
        }
      }
    }
  }

  return slots.map((slotId) => {
    const slot = SLOT_BY_ID[slotId];
    const widthIn = slot.cutout.w - 2 * TOWER_VENT.sideLipIn;
    const depthIn = TOWER_VENT.depthIn;
    // The top of the opening, which is the underside of the cabinet over it.
    const y = slot.position[1] + ft(slot.cutout.h);
    const back = -ft(slot.cutout.d) / 2;
    const frontZ = back + ft(depthIn);
    return {
      slot: slotId,
      widthIn,
      depthIn,
      position: toWorld(slotId, 0, y, (back + frontZ) / 2),
      rotationY: slot.rotationY,
      front: [
        toWorld(slotId, -ft(widthIn) / 2, y, frontZ),
        toWorld(slotId, ft(widthIn) / 2, y, frontZ),
      ],
    };
  });
}

/**
 * Where a vent is, in its oven's own frame and in inches: how far up, and how
 * far its back and front edges are from the back of the opening.
 */
export function ventInSlot(vent: Pick<TowerVent, "slot" | "position" | "depthIn">) {
  const slot = SLOT_BY_ID[vent.slot];
  const dx = vent.position[0] - slot.position[0];
  const dz = vent.position[2] - slot.position[2];
  const cos = Math.cos(slot.rotationY);
  const sin = Math.sin(slot.rotationY);
  // The inverse of `toWorld`'s turn.
  const localZ = dx * sin + dz * cos;
  const centreFromBackIn = (localZ + ft(slot.cutout.d) / 2) * 12;
  return {
    heightIn: vent.position[1] * 12,
    backEdgeIn: centreFromBackIn - vent.depthIn / 2,
    frontEdgeIn: centreFromBackIn + vent.depthIn / 2,
  };
}
