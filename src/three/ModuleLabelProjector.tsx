import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { labelledBoxes } from "../data/cabinets";
import { DEBUG } from "../debug";
import { moduleLabels } from "./moduleLabelRegistry";

/**
 * Puts each cabinet's code over the front face of its box.
 *
 * Debug-only, so it skips the occlusion and collision work the pins do: a code
 * behind a cabinet is a nuisance rather than a bug, and reading the run in
 * order matters more than never overlapping.
 */
export function ModuleLabelProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const frame = useRef(0);

  // The point each label sits at: the middle of the box's front face.
  const anchors = useMemo(() => {
    if (!DEBUG) return [];
    return labelledBoxes().map((box) => {
      const [x, y, z] = box.position;
      const [w, h, d] = box.size;
      // Front is +Z for a box that is wider than it is deep, +X otherwise:
      // the run's own axis is the long one.
      const front = w >= d ? new THREE.Vector3(0, 0, d / 2) : new THREE.Vector3(w / 2, 0, 0);
      return { id: box.id, at: new THREE.Vector3(x, y + h * 0.32, z).add(front) };
    });
  }, []);

  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!DEBUG || anchors.length === 0) return;
    frame.current += 1;
    if (frame.current % 3 !== 0) return;

    for (const { id, at } of anchors) {
      const el = moduleLabels.get(id);
      if (!el) continue;
      projected.copy(at).project(camera);
      const offscreen = Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1;
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`;
      el.style.opacity = offscreen ? "0" : "0.9";
    }
  });

  return null;
}
