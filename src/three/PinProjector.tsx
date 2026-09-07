import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { SLOT_ORDER } from "../data/catalogue";
import { DEBUG } from "../debug";
import { SLOT_BY_ID } from "../data/slots";
import { useSelection } from "../store/useSelection";
import type { SlotId } from "../types";
import { pinAnchors } from "./pinAnchor";
import { pinElements } from "./pinRegistry";
import { dimensionRects, projectRects, useApplianceCorners } from "./keepOut";
import { clampPins, layoutPins, type KeepOut } from "./pinLayout";

/** How far back along the view axis the occlusion ray starts, in feet. */
const RAY_BACKOFF = 60;
/** Ignore hits this close to the anchor; they are the anchor's own surround. */
const RAY_EPSILON = 0.3;
/** Clear space kept between two pin labels, in screen pixels. */
const PIN_GAP = 6;
/** Half the dot, for centring it on its anchor. */
const DOT_HALF = 4;

/** Below this, you can see through a thing, so it is not in the way. */
const OPAQUE_ENOUGH = 0.5;

/**
 * Only solid, visible meshes block a pin.
 *
 * three.js stopped skipping invisible objects during raycasts in r152, so the
 * hidden install wireframe would otherwise count as an occluder in every mode.
 *
 * Transparency counts too, and it has to: the occlusion fade exists precisely
 * to let the camera see past a cabinet, and a pin hidden behind the thing that
 * was just faded for it is the one pin guaranteed to be wanted.
 */
function isOccluding(object: THREE.Object3D): boolean {
  const mesh = object as THREE.Mesh;
  if (!mesh.isMesh) return false;
  const material = mesh.material as THREE.Material | THREE.Material[];
  const single = Array.isArray(material) ? material[0] : material;
  if (single?.transparent && single.opacity < OPAQUE_ENOUGH) return false;
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

  const selection = useSelection();
  const anchors = useMemo(
    () =>
      SLOT_ORDER.map((slotId) => ({
        slotId,
        candidates: pinAnchors(slotId, selection[slotId]),
      })),
    [selection],
  );

  const keepOutCorners = useApplianceCorners(selection);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const occluded = useRef(new Set<SlotId>());
  const frame = useRef(0);
  const projected = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);

  // Reused every frame; the projector runs inside the render loop and must not
  // allocate.
  const layout = useMemo(
    () => SLOT_ORDER.map(() => ({ x: 0, y: 0, dotX: 0, dotY: 0, w: 0, h: 0, hidden: true })),
    [],
  );
  const appliances = useMemo<KeepOut[]>(() => [], []);

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

    // Where each appliance sits on screen, plus wherever the dimension figures
    // ended up: the figures are tied to the geometry they measure, so the pins
    // are what gives way.
    projectRects(keepOutCorners, camera, size.width, size.height, projected, appliances);
    const keepOut = appliances.concat(dimensionRects);

    for (let i = 0; i < anchors.length; i += 1) {
      const { slotId, candidates } = anchors[i];
      // The corner that reads as the appliance's right-hand one from here.
      let anchor = candidates[0];
      if (candidates.length > 1) {
        projected.copy(candidates[0]).project(camera);
        const first = projected.x;
        projected.copy(candidates[1]).project(camera);
        if (projected.x > first) anchor = candidates[1];
      }
      const box = layout[i];
      const parts = pinElements.get(slotId);
      const el = parts?.label;
      if (!parts || !el) {
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

      // The dot goes exactly on the appliance; the label is offset from it by
      // whatever the slot declares, and only the label is allowed to move.
      box.dotX = (projected.x * 0.5 + 0.5) * size.width;
      box.dotY = (-projected.y * 0.5 + 0.5) * size.height;
      const offset = SLOT_BY_ID[slotId].labelOffset;
      box.x = box.dotX + offset.dx;
      box.y = box.dotY + offset.dy;
      box.hidden = offscreen || occluded.current.has(slotId);
      if (measure || box.w === 0) {
        box.w = el.offsetWidth;
        box.h = el.offsetHeight;
      }
    }

    layoutPins(layout, keepOut, PIN_GAP, size.height);
    clampPins(layout, size.width, size.height);
    layoutPins(layout, keepOut, PIN_GAP, size.height);

    if (DEBUG) {
      // What the label placement had to work with, so the check that no label
      // covers an appliance has something to read.
      (window as unknown as { __pinLayout?: unknown }).__pinLayout = {
        appliances: keepOut,
        labels: layout.map((box, i) => ({
          slot: anchors[i].slotId,
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          hidden: box.hidden,
        })),
      };
    }

    for (let i = 0; i < anchors.length; i += 1) {
      const parts = pinElements.get(anchors[i].slotId);
      if (!parts) continue;
      const box = layout[i];
      const shown = box.hidden ? "0" : "1";

      if (parts.label) {
        parts.label.style.transform = `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0) translate(-50%, -50%)`;
        parts.label.style.opacity = shown;
        parts.label.style.pointerEvents = box.hidden ? "none" : "auto";
      }
      if (parts.dot) {
        parts.dot.style.transform = `translate3d(${Math.round(box.dotX) - DOT_HALF}px, ${Math.round(box.dotY) - DOT_HALF}px, 0)`;
        parts.dot.style.opacity = shown;
      }
      if (parts.leader) {
        // To the label's bottom-left corner: the label sits up and to the
        // right of its dot, so that corner is the one facing back at it, and
        // the line stops there instead of running under the text.
        const cornerX = box.x - box.w / 2;
        const cornerY = box.y + box.h / 2;
        parts.leader.setAttribute("x1", String(Math.round(box.dotX)));
        parts.leader.setAttribute("y1", String(Math.round(box.dotY)));
        parts.leader.setAttribute("x2", String(Math.round(cornerX)));
        parts.leader.setAttribute("y2", String(Math.round(cornerY)));
        parts.leader.setAttribute("opacity", box.hidden ? "0" : "0.55");
      }
    }
  });

  return null;
}
