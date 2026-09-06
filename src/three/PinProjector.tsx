import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { SLOT_ORDER } from "../data/catalogue";
import { SLOT_BY_ID, ft } from "../data/slots";
import type { SlotId } from "../types";
import { pinElements } from "./pinRegistry";

/** How far back along the view axis the occlusion ray starts, in feet. */
const RAY_BACKOFF = 60;
/** Ignore hits this close to the anchor; they are the anchor's own surround. */
const RAY_EPSILON = 0.3;

/** Anchor a pin just in front of the appliance face, at mid height. */
function anchorFor(slotId: SlotId): THREE.Vector3 {
  const slot = SLOT_BY_ID[slotId];
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

/**
 * Only solid, visible meshes block a pin.
 *
 * three.js stopped skipping invisible objects during raycasts in r152, so the
 * hidden install wireframe would otherwise count as an occluder in every mode.
 */
function isOccluding(object: THREE.Object3D): boolean {
  if (!(object as THREE.Mesh).isMesh) return false;
  let node: THREE.Object3D | null = object;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

/** Walk up the parents looking for the slot a cabinet box belongs to. */
function owningSlot(object: THREE.Object3D): SlotId | undefined {
  let node: THREE.Object3D | null = object;
  while (node) {
    const slot = node.userData?.slot as SlotId | undefined;
    if (slot) return slot;
    node = node.parent;
  }
  return undefined;
}

/**
 * Projects each pin anchor to screen space every frame and fades pins that the
 * room shell or cabinetry has moved in front of.
 *
 * Two things make the occlusion test correct rather than merely plausible:
 *
 * - The camera is orthographic, so the sight line is the camera's forward axis,
 *   not the direction from `camera.position` to the anchor. Using the latter
 *   skews the ray for anything off the view centre and produces phantom hits.
 * - A pin is never occluded by its own enclosure. The refrigerator sits between
 *   two full-height finished panels, so without this the fridge pin hides
 *   behind its own surround as soon as the room is orbited.
 *
 * The raycast is far more expensive than the projection, so it runs on every
 * fourth frame.
 */
export function PinProjector() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const anchors = useMemo(
    () => SLOT_ORDER.map((slotId) => ({ slotId, anchor: anchorFor(slotId) })),
    [],
  );
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const occluded = useRef(new Set<SlotId>());
  const frame = useRef(0);
  const projected = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    frame.current += 1;
    const testOcclusion = frame.current % 4 === 0;

    let occluders: THREE.Object3D[] = [];
    if (testOcclusion) {
      const shell = scene.getObjectByName("kitchen-shell");
      const cabinets = scene.getObjectByName("cabinet-layer");
      occluders = [shell, cabinets].filter(
        (o): o is THREE.Object3D => !!o && o.visible,
      );
      // Parallel projection: every sight line runs along the camera's forward
      // axis.
      camera.getWorldDirection(forward);
    }

    for (const { slotId, anchor } of anchors) {
      const el = pinElements.get(slotId);
      if (!el) continue;

      if (testOcclusion && occluders.length > 0) {
        origin.copy(anchor).addScaledVector(forward, -RAY_BACKOFF);
        raycaster.set(origin, forward);
        raycaster.far = RAY_BACKOFF - RAY_EPSILON;
        const hit = raycaster
          .intersectObjects(occluders, true)
          .some(
            ({ object }) => isOccluding(object) && owningSlot(object) !== slotId,
          );
        if (hit) occluded.current.add(slotId);
        else occluded.current.delete(slotId);
      }

      projected.copy(anchor).project(camera);
      const offscreen =
        projected.x < -1.15 || projected.x > 1.15 || projected.y < -1.15 || projected.y > 1.15;
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;

      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`;
      const hidden = offscreen || occluded.current.has(slotId);
      el.style.opacity = hidden ? "0" : "1";
      el.style.pointerEvents = hidden ? "none" : "auto";
    }
  });

  return null;
}
