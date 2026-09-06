import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { SLOT_ORDER } from "../data/catalogue";
import { ROOM, SLOT_BY_ID, ft } from "../data/slots";
import type { SlotId } from "../types";
import { pinElements } from "./pinRegistry";
import { spreadPins } from "./pinLayout";

/** How far back along the view axis the occlusion ray starts, in feet. */
const RAY_BACKOFF = 60;
/** Ignore hits this close to the anchor; they are the anchor's own surround. */
const RAY_EPSILON = 0.3;
/** Clear space kept between two pin labels, in screen pixels. */
const PIN_GAP = 6;

/**
 * Where a pin sits in the world.
 *
 * Wall appliances get a pin just in front of their face, at mid height. Island
 * appliances get one floating above the island counter instead: their doors
 * face opposite ways, so a pin in front of either one is hidden behind the
 * island from half the angles you can orbit to. Above the counter, nothing can
 * cover it, and the two island pins separate naturally because they sit at
 * different points along the run.
 */
function anchorFor(slotId: SlotId): THREE.Vector3 {
  const slot = SLOT_BY_ID[slotId];

  if (slot.mount === "island") {
    return new THREE.Vector3(
      slot.position[0],
      ROOM.counterHeight + 0.7,
      slot.position[2],
    );
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
 *
 * Labels that land on top of each other are then pushed apart vertically, in
 * pin order: 01 keeps its anchor and higher numbers move. The island is what
 * forces this — the microwave and the wine cabinet are two feet apart and their
 * pins both float above the same counter, so at some angles they sit on the
 * same spot on screen.
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

  // Reused every frame; the projector runs inside the render loop and must not
  // allocate.
  const layout = useMemo(
    () => SLOT_ORDER.map(() => ({ x: 0, y: 0, w: 0, h: 0, hidden: true })),
    [],
  );

  useFrame(() => {
    frame.current += 1;
    const testOcclusion = frame.current % 4 === 0;
    // Label sizes only change on selection, language or breakpoint, and reading
    // them does not force layout here because we only ever write transform and
    // opacity. Still, once every eight frames is plenty.
    const measure = frame.current % 8 === 0;

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

    for (let i = 0; i < anchors.length; i += 1) {
      const { slotId, anchor } = anchors[i];
      const box = layout[i];
      const el = pinElements.get(slotId);
      if (!el) {
        box.hidden = true;
        continue;
      }

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

      box.x = (projected.x * 0.5 + 0.5) * size.width;
      box.y = (-projected.y * 0.5 + 0.5) * size.height;
      box.hidden = offscreen || occluded.current.has(slotId);
      if (measure || box.w === 0) {
        box.w = el.offsetWidth;
        box.h = el.offsetHeight;
      }
    }

    spreadPins(layout, PIN_GAP);

    for (let i = 0; i < anchors.length; i += 1) {
      const el = pinElements.get(anchors[i].slotId);
      if (!el) continue;
      const box = layout[i];
      el.style.transform = `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0) translate(-50%, -50%)`;
      el.style.opacity = box.hidden ? "0" : "1";
      el.style.pointerEvents = box.hidden ? "none" : "auto";
    }
  });

  return null;
}
