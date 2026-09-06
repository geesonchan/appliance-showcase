import * as THREE from "three";
import { ROOM, SLOT_BY_ID, ft } from "../data/slots";
import type { SlotId } from "../types";

/**
 * Where a pin's dot sits in the world.
 *
 * Wall appliances get a point just in front of their face, at mid height.
 * Island appliances get one floating above the island counter instead: their
 * doors face opposite ways, so a point in front of either one is hidden behind
 * the island from half the angles you can orbit to. Above the counter, nothing
 * can cover it, and the two island pins separate naturally because they sit at
 * different points along the run.
 *
 * Shared with the occlusion fade, which has to clear the same sight line: a pin
 * hidden behind a cabinet the fade did not know about is a pin pointing at
 * nothing.
 */
export function anchorFor(slotId: SlotId): THREE.Vector3 {
  const slot = SLOT_BY_ID[slotId];

  if (slot.mount === "island") {
    return new THREE.Vector3(slot.position[0], ROOM.counterHeight + 0.7, slot.position[2]);
  }

  const out = new THREE.Vector3(
    Math.sin(slot.rotationY),
    0,
    Math.cos(slot.rotationY),
  ).multiplyScalar(ft(slot.cutout.d) / 2 + 0.9);

  return new THREE.Vector3(
    slot.position[0],
    slot.position[1] + ft(slot.cutout.h) / 2,
    slot.position[2],
  ).add(out);
}
