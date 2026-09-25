import * as THREE from "three";
import { BAR_STOOL, type BarStool } from "../data/barStools";
import { ft } from "../data/roomShell";
import type { RenderMode } from "../types";
import { surface } from "./materials";

/** Where a stool's pieces take their colour from outside the white model. Neutral, no product. */
const SEAT = { color: "#8C877F", metalness: 0.05, roughness: 0.7 };
const FRAME = { color: "#3B3D3A", metalness: 0.6, roughness: 0.45 };

/** A mesh that takes no clicks, and no ray of anybody's. */
const NO_HIT: THREE.Mesh["raycast"] = () => {};

/** The name the stools' group goes by, which the sight-line fade looks for. */
export const FURNISHING_LAYER = "furnishing-layer";

/**
 * The stools, built once for the room. Round 77.
 *
 * Plain procedural pieces: a round seat, four straight legs and a footrest
 * ring of four bars. **Every mesh has its raycast switched off** — a hidden
 * mesh or a line still takes a ray in three.js (D2), and furnishing must never
 * take a click meant for the island behind it. The sight-line fade asks the
 * geometry directly instead (`furnishingHits`).
 *
 * Each stool has materials of its own, so the fade, which works material by
 * material, fades the stool that is in the way and not all three.
 */
export function buildBarStools(stools: BarStool[]): THREE.Group {
  const group = new THREE.Group();
  group.name = FURNISHING_LAYER;
  const seatH = ft(BAR_STOOL.seatThicknessIn);
  const seatTop = ft(BAR_STOOL.seatHeightIn);
  const seatR = ft(BAR_STOOL.seatDiameterIn / 2);
  const legR = ft(0.5);
  const legAt = seatR * 0.75;
  const legH = seatTop - seatH;
  const ringY = ft(9);
  const ringHalf = legAt / Math.SQRT2 + legR;

  for (const stool of stools) {
    const seatMaterial = new THREE.MeshStandardMaterial();
    const frameMaterial = new THREE.MeshStandardMaterial();
    seatMaterial.userData = { part: "seat" };
    frameMaterial.userData = { part: "frame" };
    const one = new THREE.Group();
    one.position.set(...stool.position);
    one.rotation.y = stool.rotationY;
    one.userData = { furnishing: "bar-stool" };

    const seat = new THREE.Mesh(new THREE.CylinderGeometry(seatR, seatR, seatH, 28), seatMaterial);
    seat.position.y = seatTop - seatH / 2;
    one.add(seat);

    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 8), frameMaterial);
      leg.position.set(Math.cos(angle) * legAt, legH / 2, Math.sin(angle) * legAt);
      one.add(leg);
    }
    // The footrest: a square of four bars joining the legs, which stand at
    // (±corner, ±corner).
    const corner = legAt / Math.SQRT2;
    for (const [x, z, turned] of [
      [0, corner, false],
      [0, -corner, false],
      [corner, 0, true],
      [-corner, 0, true],
    ] as const) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(ringHalf * 2, ft(0.75), ft(0.75)), frameMaterial);
      bar.position.set(x, ringY, z);
      if (turned) bar.rotation.y = Math.PI / 2;
      one.add(bar);
    }

    one.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.raycast = NO_HIT;
      mesh.castShadow = true;
    });
    group.add(one);
  }
  return group;
}

/**
 * Colour the stools for a render mode. Only material values change (D2); the
 * install view hides the group rather than restyling it.
 */
export function paintBarStools(group: THREE.Group, mode: RenderMode) {
  const seat = surface(mode, SEAT.color, SEAT);
  const frame = surface(mode, FRAME.color, FRAME);
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    const props = material.userData.part === "seat" ? seat : frame;
    material.color.set(props.color);
    material.metalness = props.metalness;
    material.roughness = props.roughness;
  });
}

/**
 * What a sight line meets among the stools. Their own raycast is off, so the
 * fade asks each mesh's geometry through three.js's own `Mesh.raycast`, which
 * nothing that handles a click ever does.
 */
export function furnishingHits(group: THREE.Object3D | undefined, raycaster: THREE.Raycaster) {
  const hits: THREE.Intersection[] = [];
  if (!group || !group.visible) return hits;
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.visible) THREE.Mesh.prototype.raycast.call(mesh, raycaster, hits);
  });
  return hits.sort((a, b) => a.distance - b.distance);
}
