import { useMemo } from "react";
import * as THREE from "three";
import { applianceBox, flushOffset } from "../data/applianceBox";
import { SLOT_ORDER } from "../data/catalogue";
import { SLOT_BY_ID } from "../data/slots";
import type { Appliance, SlotId } from "../types";
import type { KeepOut } from "./pinLayout";

/**
 * The corners of every appliance, in world space.
 *
 * Both annotation layers need to know where the appliances land on screen —
 * the pins so a label never covers the thing it names, the dimensions so a
 * figure never sits on one. Computing the corners once and projecting them per
 * frame is the cheap half; the projection is the part that has to be redone as
 * the camera moves.
 */
export function useApplianceCorners(selection: Record<SlotId, Appliance>) {
  return useMemo(
    () =>
      SLOT_ORDER.map((slotId) => {
        const slot = SLOT_BY_ID[slotId];
        const appliance = selection[slotId];
        if (!appliance) return [];
        const box = applianceBox(slot, appliance);
        const dz = flushOffset(slot, box.d);
        const points: THREE.Vector3[] = [];
        for (const sx of [-0.5, 0.5]) {
          for (const sy of [0, 1]) {
            for (const sz of [-0.5, 0.5]) {
              const local = new THREE.Vector3(sx * box.w, box.y + sy * box.h, dz + sz * box.d);
              local.applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotationY);
              points.push(local.add(new THREE.Vector3(...slot.position)));
            }
          }
        }
        return points;
      }),
    [selection],
  );
}

/** Project each group of corners to its screen-space bounding rectangle. */
export function projectRects(
  groups: THREE.Vector3[][],
  camera: THREE.Camera,
  width: number,
  height: number,
  scratch: THREE.Vector3,
  out: KeepOut[],
): void {
  out.length = 0;
  for (const points of groups) {
    if (points.length === 0) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      scratch.copy(point).project(camera);
      const px = (scratch.x * 0.5 + 0.5) * width;
      const py = (-scratch.y * 0.5 + 0.5) * height;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    out.push({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      w: maxX - minX,
      h: maxY - minY,
    });
  }
}

/**
 * Where the dimension figures ended up this frame.
 *
 * Published by the dimension projector and read by the pin projector, which
 * runs after it. The dimensions are tied to the geometry they measure and the
 * pins are the flexible ones, so the pins are what gives way — and both are
 * mounted in that order in the scene so the hand-off is not a race.
 */
export const dimensionRects: KeepOut[] = [];
