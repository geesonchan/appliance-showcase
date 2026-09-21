import * as THREE from "three";
import { applianceBox, flushOffset } from "../data/applianceBox";
import { ROOM, SLOT_BY_ID } from "../data/slots";
import { toPlan } from "../data/frame";
import type { Appliance, SlotId } from "../types";

/**
 * The two candidates for a pin's dot: the top corners of the appliance's own
 * front face.
 *
 * A dot in the middle of a door is ambiguous — it could be marking the door, the
 * cabinet, or the run. On a corner it is unmistakably *that* appliance, and it
 * leaves the face clear. Which of the two corners gets used is decided per
 * frame by whichever is further right on screen, so it stays on the outside
 * edge however the room is orbited.
 *
 * Island appliances are the exception and stay above their counter. Their doors
 * face opposite ways, so a corner of either front face is behind the island
 * from half the angles you can orbit to — including the default one, where the
 * overview has to show all six pins at once.
 */
export function pinAnchors(slotId: SlotId, appliance: Appliance | undefined): THREE.Vector3[] {
  const slot = SLOT_BY_ID[slotId];

  // A hood hung over the island is not in it. Round 68: it took the island's
  // anchor — the counter, 0.7' up — and its label hung five feet under the
  // canopy. It takes the corners of its own canopy like any other machine, and
  // `applianceBox` already knows a hung canopy is 2-3/4" deep, not the 30"
  // the catalogue lists (round 55).
  if (slot.mount === "island" && slotId !== "slot-hood") {
    return [new THREE.Vector3(slot.position[0], ROOM.counterHeight + 0.7, slot.position[2])];
  }

  const box = appliance ? applianceBox(slot, appliance) : null;
  const w = box?.w ?? slot.cutout.w / 12;
  const h = box?.h ?? slot.cutout.h / 12;
  const d = box?.d ?? slot.cutout.d / 12;
  const y = (box?.y ?? 0) + h;
  const dz = box ? flushOffset(slot, d) : 0;

  // Local space: +Z out of the appliance's face, +X across it. A hair proud of
  // the corner so the dot sits on the appliance rather than inside it.
  const out = d / 2 + dz + 0.04;
  const across = w / 2;

  return [-1, 1].map((side) => {
    const [x, z] = toPlan(slot, side * across, out);
    return new THREE.Vector3(x, slot.position[1] + y, z);
  });
}

/**
 * The single point the occlusion fade has to clear.
 *
 * The fade runs off the selection rather than the camera, so it takes the
 * appliance's centre-top rather than trying to guess which corner the projector
 * will pick this frame.
 */
export function anchorFor(slotId: SlotId, appliance?: Appliance): THREE.Vector3 {
  const candidates = pinAnchors(slotId, appliance);
  if (candidates.length === 1) return candidates[0];
  return candidates[0].clone().add(candidates[1]).multiplyScalar(0.5);
}
