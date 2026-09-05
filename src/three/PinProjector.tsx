import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { SLOT_ORDER } from "../data/appliances";
import { SLOT_BY_ID, ft } from "../data/slots";
import type { SlotId } from "../types";
import { pinElements } from "./pinRegistry";

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
 * Projects each pin anchor to screen space every frame and fades pins that the
 * room shell or cabinetry has moved in front of.
 *
 * Occlusion needs a raycast per pin, which is far more expensive than the
 * projection, so it runs on every fourth frame.
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
    }

    for (const { slotId, anchor } of anchors) {
      const el = pinElements.get(slotId);
      if (!el) continue;

      if (testOcclusion && occluders.length > 0) {
        const direction = anchor.clone().sub(camera.position);
        const distance = direction.length();
        raycaster.set(camera.position, direction.normalize());
        raycaster.far = distance - 0.3;
        const hit = raycaster.intersectObjects(occluders, true).length > 0;
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
