import { RUNS, ft } from "./room";
import { SLOT_BY_ID } from "./slots";
import { toLocal, toWorld as turnToWorld } from "./frame";
import type { Appliance, SlotId } from "../types";

/**
 * The vent a hung oven breathes through.
 *
 * Leo, round 32, from site practice: not under the machine, where a grille in
 * the drawer front or the toe kick is the first thing seen from across the room,
 * but in the top of its opening, against the back wall — the shelf the bridge
 * cabinet stands on, cut through along its back edge, where nobody standing in
 * the kitchen can see it.
 *
 * Neither the MEM301WS sheet nor the PODS302B sheet in `docs/reference/`
 * gives a figure for it, so the size is Leo's: most of the
 * opening's width and 2"-3" deep. It is built at the deep end of that, with a
 * 3/4" board left each side so the shelf still bears on the carcass.
 */
export const TOWER_VENT = {
  /** How far the hole reaches forward from the back of the opening. */
  depthIn: 3,
  /** Shelf left each side of the hole. */
  sideLipIn: 0.75,
  /**
   * How far the cabinets over a steam oven stand off the wall, backs open.
   *
   * Leo, round 37: the box directly over the oven, and the box stacked on it,
   * have open backs and do not touch the wall, so what comes up through the
   * vent has somewhere to go; round 38 gave it a grille to leave by. Round 39:
   * only over a steam oven; round 73: over any machine whose `rearVent` asks
   * for it. 3" is Leo's figure from site — a site value, not read off a
   * drawing and not an inference — and it clears the 1-3/8" TCM24PS's manual
   * asks behind it (p. 11).
   */
  bridgeStandOffIn: 3,
};

/**
 * Where the air leaves: a grille in the top of the box stacked over a machine
 * that breathes at its back, just under the crown. Leo, round 38.
 *
 * Keyed on the machine rather than the tower (`ventsAtRear`). The size is
 * worked back from an area rather than read off a drawing: the PODS302B sheet
 * in `docs/reference/` states no ventilation requirement for the cabinet at
 * all. TCM24PS's manual gives one figure, a slot of at least 31 sq in where the
 * machine sits under a décor panel (p. 11), and 6" x 28" is well past it.
 */
export const OVEN_GRILLE = {
  heightIn: 6,
  widthIn: 28,
  slats: 5,
  slatIn: 0.375,
  /** How far each slat is turned down toward the room, in radians. */
  tilt: Math.PI / 5,
};

export interface TowerVent {
  /** The oven whose opening it is in. */
  slot: SlotId;
  /** How far the open-backed cabinet over the opening stands off the wall. */
  bridgeStandOffIn: number;
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
  return turnToWorld(SLOT_BY_ID[slotId], x, y, z);
}

/**
 * Whether a machine hung in a tower needs air at its back: open backs, the
 * cabinets over it standing off the wall, and a grille under the crown.
 *
 * Per model, from `rearVent` — TCM24PS because its manual asks for it (p. 11),
 * PODS302B because Leo builds it that way (D11 rule 12, round 73). Until round
 * 73 this was "is it a steam oven", which left the coffee machine out although
 * its own manual asks for exactly this.
 */
export const ventsAtRear = (appliance: Appliance | undefined) => Boolean(appliance?.rearVent);

/**
 * Every tower opening with a vent in its top, at the back.
 *
 * Read off the run, and asked of the machine in it. Two ways in:
 * - an oven hung off the floor with nothing standing under it — B's
 *   combination oven and D's steam oven by one line (round 32, Leo);
 * - a machine whose `rearVent` asks for air at its back, whatever stands under
 *   it — the coffee machine over D's dishwasher and E's wine cooler (round 73).
 *
 * A refrigerator column starts on the floor. A coffee machine is not an oven:
 * until round 73 E's coffee cabinet, with nothing under it, was taken for a
 * hung oven and given a vent under a solid-backed cabinet — a hole to nowhere.
 */
export function towerVents(selection: Partial<Record<SlotId, Appliance | undefined>>): TowerVent[] {
  const slots: SlotId[] = [];
  for (const run of RUNS) {
    for (const segment of run.segments) {
      for (const module of segment.modules) {
        if (module.kind !== "tall" || !module.slot || (module.sillIn ?? 0) <= 0) continue;
        if (slots.includes(module.slot)) continue;
        const machine = selection[module.slot];
        const hungOven = machine?.category === "wall-oven" && !module.lowerSlot;
        if (hungOven || ventsAtRear(machine)) slots.push(module.slot);
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
      bridgeStandOffIn: TOWER_VENT.bridgeStandOffIn,
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
  // The inverse of `toWorld`'s turn.
  const localZ = toLocal(slot, vent.position[0], vent.position[2]).out;
  const centreFromBackIn = (localZ + ft(slot.cutout.d) / 2) * 12;
  return {
    heightIn: vent.position[1] * 12,
    backEdgeIn: centreFromBackIn - vent.depthIn / 2,
    frontEdgeIn: centreFromBackIn + vent.depthIn / 2,
  };
}
