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

  // Every tower vent in the scene, and whether it can actually be seen: drawn,
  // and inside nothing hidden. Asked at the moment, like the panel colours,
  // because it changes with the render mode.
  useEffect(() => {
    if (!DEBUG) return;
    type Vent = { slot: string; shown: boolean; yIn: number; shelfIn: number | null };
    (window as unknown as { __towerVents?: () => Vent[] }).__towerVents = () => {
      const vents: Vent[] = [];
      scene.traverse((object) => {
        if (object.name !== "tower-vent") return;
        let shown = true;
        for (let node: THREE.Object3D | null = object; node; node = node.parent) {
          if (!node.visible) shown = false;
        }
        const slot = String(object.userData.slot);
        const bridge = bridgeOf(scene, slot);
        vents.push({
          slot,
          shown,
          yIn: object.getWorldPosition(new THREE.Vector3()).y * 12,
          // The underside of the cabinet over the opening: the shelf it is cut in.
          shelfIn: bridge ? new THREE.Box3().setFromObject(bridge).min.y * 12 : null,
        });
      });
      return vents;
    };

    // Everything in the scene named as a vent, and which opening it belongs
    // to — so a grille in a tower's drawer or toe kick has nowhere to hide.
    (window as unknown as { __ventNames?: () => { name: string; slot: string | null }[] }).__ventNames =
      () => {
        const found: { name: string; slot: string | null }[] = [];
        scene.traverse((object) => {
          if (!/vent/i.test(object.name)) return;
          let slot: string | null = null;
          for (let node: THREE.Object3D | null = object; node && slot === null; node = node.parent) {
            if (node.userData?.slot) slot = String(node.userData.slot);
            else if (node.name.startsWith("appliance-") && !node.name.startsWith("appliance-body-")) {
              slot = node.name.replace(/^appliance-(filler-|trim-)?/, "");
            }
          }
          found.push({ name: object.name, slot });
        });
        return found;
      };
  }, [scene]);

  // Each hung oven's front against the door of the cabinet over it, in inches
  // along the way both of them face. Handles are left out: they are meant to
  // stand proud. Round 36: a standard install puts the machine's trim in the
  // plane of the doors, not back in its cutout.
  useEffect(() => {
    if (!DEBUG) return;
    type Front = { slot: string; ovenIn: number; doorIn: number };
    (window as unknown as { __ovenFronts?: () => Front[] }).__ovenFronts = () => {
      const fronts: Front[] = [];
      scene.traverse((object) => {
        if (object.name !== "combo-oven") return;
        let body: THREE.Object3D | null = object;
        while (body && !body.name.startsWith("appliance-body-")) body = body.parent;
        if (!body) return;
        const slot = body.name.slice("appliance-body-".length);
        const bridge = bridgeOf(scene, slot);
        const door = bridge && scene.getObjectByName("door-" + bridge.userData.boxId);
        if (!bridge || !door) return;
        // The run's boxes open toward +x on the left wall and +z on the back.
        const size = new THREE.Box3().setFromObject(bridge).getSize(new THREE.Vector3());
        const axis = size.x < size.z ? "x" : "z";
        const face = new THREE.Box3();
        object.traverse((part) => {
          if ((part as THREE.Mesh).isMesh && !part.userData.handle) face.expandByObject(part);
        });
        fronts.push({
          slot,
          ovenIn: face.max[axis] * 12,
          doorIn: new THREE.Box3().setFromObject(door).max[axis] * 12,
        });
      });
      return fronts;
    };
  }, [scene]);

  return null;
}

/** The carcass of the cabinet over a tower's opening, if the slot has one. */
function bridgeOf(scene: THREE.Object3D, slot: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  scene.traverse((object) => {
    if (
      (object as THREE.Mesh).isMesh &&
      object.userData?.slot === slot &&
      String(object.userData?.boxId ?? "").endsWith("-bridge")
    ) {
      found = object;
    }
  });
  return found;
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
