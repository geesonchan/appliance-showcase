import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SLOT_ORDER } from "../data/catalogue";
import { hasGenericDoors } from "../data/fridgeModel";
import { hasGenericRoughIn } from "../data/roughIn";
import { DEBUG } from "../debug";
import { useSelection } from "../store/useSelection";

/**
 * Measured dimensions of what actually reached the scene graph, in inches.
 *
 * Published under ?debug=1 so the bounding-box check has something to read.
 * A screenshot cannot tell you a microwave is eleven inches too tall, and a
 * unit test over `applianceBox` only proves the arithmetic — this proves the
 * geometry that arithmetic produced.
 */
export function SceneDebug() {
  const scene = useThree((s) => s.scene);
  // Re-measure whenever the package changes: swapping a 36" range for a 30" one
  // is exactly the case worth checking.
  const selection = useSelection();

  useEffect(() => {
    if (!DEBUG) return;
    // One frame after mount, so every layer has been added.
    const id = requestAnimationFrame(() => {
      const boxes: Record<string, { w: number; h: number; d: number }> = {};
      const size = new THREE.Vector3();
      for (const slot of SLOT_ORDER) {
        const group = scene.getObjectByName("appliance-body-" + slot);
        if (!group) continue;
        boxes[slot] = measure(group, size);
      }
      (window as unknown as { __applianceBoxes?: typeof boxes }).__applianceBoxes = boxes;

      // Which appliances are being drawn from a guess rather than from what
      // somebody read off a drawing.
      (window as unknown as { __generic?: string[] }).__generic = Object.values(selection)
        .filter((appliance) => hasGenericDoors(appliance) || hasGenericRoughIn(appliance))
        .map((appliance) => appliance.model);
    });
    return () => cancelAnimationFrame(id);
  }, [scene, selection]);

  // Every colour the room has painted a cabinet panel. A kitchen has exactly
  // two: the one that was picked, and the accent if a run is wearing one. A
  // third means something is drawing joinery from a colour written down
  // somewhere else — which is what a drawer front under the microwave was
  // doing after the doors changed.
  //
  // Published as a question rather than an answer. The others here are
  // measurements of geometry, which settles once and stays put; a colour
  // changes every time somebody touches a swatch, and a snapshot taken a frame
  // after the click reported the picker's previous choice. Asking the scene at
  // the moment you want to know cannot be stale.
  useEffect(() => {
    if (!DEBUG) return;
    (window as unknown as { __cabinetPanels?: () => string[] }).__cabinetPanels = () => {
      const painted = new Set<string>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) collectPanelColour(mesh, painted);
      });
      return [...painted].sort();
    };
  }, [scene]);

  return null;
}

/**
 * Add a mesh's colour to the set, if it is cabinetry.
 *
 * Cabinetry is a mesh tagged as such, or anything inside a group that is — a
 * panel-ready machine's whole front is the cabinetmaker's, not the
 * manufacturer's.
 */
function collectPanelColour(mesh: THREE.Mesh, into: Set<string>) {
  let node: THREE.Object3D | null = mesh;
  while (node) {
    if (node.userData?.cabinetRole === true) {
      for (const material of ([] as THREE.Material[]).concat(mesh.material)) {
        if (material.userData?.hardware) continue;
        const standard = material as THREE.MeshStandardMaterial;
        if (standard.color) into.add(`#${standard.color.getHexString().toUpperCase()}`);
      }
      return;
    }
    if (node.userData?.cabinetRole === false) return;
    node = node.parent;
  }
}

/**
 * The group's extents in its own frame, in inches.
 *
 * World-space bounds would be useless here: the refrigerator is turned to face
 * the left wall, so its width and depth would come back swapped and a check
 * against the published dimensions would compare the wrong pair.
 */
function measure(group: THREE.Object3D, size: THREE.Vector3) {
  group.updateWorldMatrix(true, true);
  const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const bounds = new THREE.Box3();
  const transform = new THREE.Matrix4();

  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    transform.multiplyMatrices(toLocal, mesh.matrixWorld);
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(transform);
    geometry.computeBoundingBox();
    if (geometry.boundingBox) bounds.union(geometry.boundingBox);
    geometry.dispose();
  });

  bounds.getSize(size);
  return {
    w: Number((size.x * 12).toFixed(2)),
    h: Number((size.y * 12).toFixed(2)),
    d: Number((size.z * 12).toFixed(2)),
  };
}
