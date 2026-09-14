import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { SLOT_BY_ID, ft } from "../data/slots";
import { anchorFor } from "./pinAnchor";
import { DEBUG } from "../debug";
import { useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";

/** What a faded object drops to. */
const FADED_OPACITY = 0.2;
/** How far back along the view axis the sight lines start, in feet. */
const BACKOFF = 60;
/** Stop short of the appliance itself so its own enclosure is not caught. */
const EPSILON = 0.35;
/** Frames between recalculations. The camera moves; cabinets do not. */
const CADENCE = 4;
/** Sample offsets across the appliance's own face, as a fraction of it. */
const GRID = [-0.6, 0, 0.6];
/**
 * Groups whose meshes may be faded off a sight line. The appliances never are
 * on a sight line; in install mode they step back as a whole instead.
 */
const LAYERS = ["kitchen-shell", "cabinet-layer", "fixture-layer"];
/** What an appliance's install-mode material drops to. */
const INSTALL_APPLIANCE_OPACITY = 0.12;
/** A mesh that takes no clicks. */
const NO_HIT: THREE.Mesh["raycast"] = () => {};

interface Saved {
  material: THREE.Material;
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
}

/**
 * Fade whatever stands between the camera and the appliance being looked at.
 *
 * Flying to the microwave puts the island's own counter, and often a run of
 * wall cabinets, directly in the line of sight — the camera arrives at the
 * right angle and shows you the back of a cupboard. Rather than move the
 * camera somewhere it can see past them, which trades one obstruction for a
 * worse angle, the obstruction gets out of the way: only the objects actually
 * on the sight line, only while a slot is selected, restored exactly as they
 * were on the way out.
 *
 * This is the third behaviour allowed to change what the camera shows, and it
 * replaces the earlier licence to drop the pitch for island slots. See
 * docs/decisions.md D1.
 *
 * The sight line is a small grid of rays over the appliance's own footprint
 * rather than one down the middle: a single ray slips between two cabinets and
 * leaves the pair of them solid.
 */
export function OcclusionFade() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const renderMode = useAppStore((s) => s.renderMode);
  const selection = useSelection();

  /**
   * Install mode: the appliances step back so the services inside and behind
   * them can be seen and clicked (round 42). The same saved-and-restored writes
   * as the sight-line fade, on the whole appliance layer: no click lands on an
   * appliance, and a material that is already transparent drops further. Only
   * opacity is written — never `transparent` — so no shader is rebuilt.
   */
  const installFaded = useRef(
    new Map<THREE.Mesh, { raycast: THREE.Mesh["raycast"]; material: THREE.Material | null; opacity: number }>(),
  );
  const applyInstallFade = (on: boolean) => {
    if (!on) {
      for (const [mesh, saved] of installFaded.current) {
        mesh.raycast = saved.raycast;
        if (saved.material) saved.material.opacity = saved.opacity;
      }
      installFaded.current.clear();
      return;
    }
    const layer = scene.getObjectByName("appliance-layer");
    if (!layer) return;
    layer.traverse((object) => {
      const mesh = object as THREE.Mesh;
      // Lines too: an appliance's install-view outline is line segments, and a
      // hidden or faint line still takes a raycast. Round 43's probe found the
      // refrigerator's outline taking the clicks meant for its services.
      const line = (object as THREE.Line).isLine === true;
      if (!mesh.isMesh && !line) return;
      const material = Array.isArray(mesh.material) ? null : mesh.material;
      const saved = installFaded.current.get(mesh);
      // A material React has swapped in since is faded again.
      if (saved && saved.material === material) return;
      installFaded.current.set(mesh, {
        raycast: saved?.raycast ?? mesh.raycast,
        material,
        opacity: material?.opacity ?? 1,
      });
      mesh.raycast = NO_HIT;
      if (mesh.isMesh && material?.transparent) {
        material.opacity = Math.min(material.opacity, INSTALL_APPLIANCE_OPACITY);
      }
    });
  };
  useEffect(() => () => applyInstallFade(false), []);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const anchor = useMemo(() => new THREE.Vector3(), []);
  const pinAt = useMemo(() => new THREE.Vector3(), []);
  const faded = useRef(new Map<string, Saved>());
  const frame = useRef(0);
  /** Under ?debug=1, what is currently being faded and why. */
  const report = (names: string[]) => {
    if (DEBUG) (window as unknown as { __faded?: string[] }).__faded = names;
  };

  const restoreAll = () => {
    for (const saved of faded.current.values()) {
      saved.material.transparent = saved.transparent;
      saved.material.opacity = saved.opacity;
      saved.material.depthWrite = saved.depthWrite;
      saved.material.needsUpdate = true;
    }
    faded.current.clear();
    report([]);
  };

  // Nothing stays faded once the room is back on screen, including when this
  // unmounts mid-fly.
  useEffect(() => restoreAll, []);
  useEffect(() => {
    if (!selectedSlot) restoreAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot]);

  useFrame(() => {
    frame.current += 1;
    if (frame.current % CADENCE !== 0) return;

    applyInstallFade(renderMode === "install");

    if (!selectedSlot) {
      if (faded.current.size > 0) restoreAll();
      return;
    }

    const layers = LAYERS.map((name) => scene.getObjectByName(name)).filter(
      (group): group is THREE.Object3D => !!group && group.visible,
    );
    if (layers.length === 0) return;

    const slot = SLOT_BY_ID[selectedSlot];
    // Orthographic: every sight line runs along the camera's forward axis.
    camera.getWorldDirection(forward);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    const halfW = ft(slot.cutout.w) / 2;
    const halfH = ft(slot.cutout.h) / 2;
    anchor.set(slot.position[0], slot.position[1] + halfH, slot.position[2]);

    pinAt.copy(anchorFor(selectedSlot, selection[selectedSlot]));

    const hits = new Set<THREE.Material>();
    const names = new Set<string>();

    const cast = (from: THREE.Vector3, u: number, v: number) => {
      origin
        .copy(from)
        .addScaledVector(right, u * halfW)
        .addScaledVector(up, v * halfH)
        .addScaledVector(forward, -BACKOFF);
      raycaster.set(origin, forward);
      raycaster.far = BACKOFF - EPSILON;
      for (const { object } of raycaster.intersectObjects(layers, true)) {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) continue;
        // An appliance's own enclosure is not in its way.
        if (owningSlot(mesh) === selectedSlot) continue;
        const material = mesh.material;
        if (Array.isArray(material)) continue;
        hits.add(material);
        names.add(boxName(mesh));
      }
    };

    for (const u of GRID) for (const v of GRID) cast(anchor, u, v);
    // ...and the point the pin is anchored at. A dot hidden behind a cabinet
    // points at nothing, and it is the pin for the very appliance the camera
    // was just sent to.
    cast(pinAt, 0, 0);

    for (const [uuid, saved] of faded.current) {
      if (hits.has(saved.material)) continue;
      saved.material.transparent = saved.transparent;
      saved.material.opacity = saved.opacity;
      saved.material.depthWrite = saved.depthWrite;
      saved.material.needsUpdate = true;
      faded.current.delete(uuid);
    }

    for (const material of hits) {
      if (faded.current.has(material.uuid)) continue;
      faded.current.set(material.uuid, {
        material,
        transparent: material.transparent,
        opacity: material.opacity,
        depthWrite: material.depthWrite,
      });
      material.transparent = true;
      // Install mode already fades the carcass further than this; never make
      // something more solid than the mode chose.
      material.opacity = Math.min(material.opacity, FADED_OPACITY);
      material.depthWrite = false;
      material.needsUpdate = true;
    }

    report([...names].sort());
  });

  return null;
}

/** The cabinet box an occluding mesh came from, for the debug overlay. */
function boxName(object: THREE.Object3D): string {
  let node: THREE.Object3D | null = object;
  while (node) {
    const id = node.userData?.boxId as string | undefined;
    if (id) return id;
    if (node.name) return node.name;
    node = node.parent;
  }
  return "?";
}

/** Walk up the parents looking for the slot a box belongs to. */
function owningSlot(object: THREE.Object3D): string | undefined {
  let node: THREE.Object3D | null = object;
  while (node) {
    const slot = node.userData?.slot as string | undefined;
    if (slot) return slot;
    node = node.parent;
  }
  return undefined;
}
