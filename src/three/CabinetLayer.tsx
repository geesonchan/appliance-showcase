import { useMemo } from "react";
import * as THREE from "three";
import { CABINETS, CABINET_OUTLINES, type CabinetBox } from "../data/cabinets";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAppStore } from "../store/useAppStore";
import { SCENE_COLORS, surface } from "./materials";

const KIND_COLOR: Record<CabinetBox["kind"], string> = {
  base: SCENE_COLORS.cabinet,
  tall: SCENE_COLORS.cabinet,
  surround: SCENE_COLORS.cabinet,
  upper: SCENE_COLORS.cabinetUpper,
  counter: SCENE_COLORS.counter,
  toe: SCENE_COLORS.toe,
};

/** Opacity of the ghosted carcass behind the install wireframe. */
const GHOST_OPACITY = 0.06;
/** Wireframe opacity on a phone, where the lines otherwise crowd each other. */
const MOBILE_WIRE_OPACITY = 0.25;

function useBoxGeometry(size: [number, number, number]) {
  return useMemo(() => new THREE.BoxGeometry(size[0], size[1], size[2]), [size]);
}

/** The solid carcass, ghosted rather than hidden in install mode. */
function CabinetSolid({ box }: { box: CabinetBox }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const isMobile = useIsMobile();
  const geometry = useBoxGeometry(box.size);
  const props = surface(renderMode, KIND_COLOR[box.kind], {
    metalness: 0,
    roughness: box.kind === "counter" ? 0.4 : 0.85,
  });

  const install = renderMode === "install";
  // On a phone the install view is outline-only; the ghost fill just muddies it.
  const hidden = install && isMobile;

  return (
    <mesh
      geometry={geometry}
      visible={!hidden}
      castShadow
      receiveShadow
      userData={{ slot: box.slot }}
    >
      {/* Keyed on the mode: three.js needs a fresh material when the
          `transparent` flag flips, not just a property write. */}
      <meshStandardMaterial
        key={renderMode}
        color={props.color}
        metalness={props.metalness}
        roughness={props.roughness}
        transparent={install}
        opacity={install ? GHOST_OPACITY : 1}
      />
    </mesh>
  );
}

/**
 * Carcass edges. Kept mounted and toggled by `visible`, so entering install
 * mode costs no geometry or object construction.
 */
function CabinetWireframe({ box, faint }: { box: CabinetBox; faint: boolean }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const geometry = useBoxGeometry(box.size);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <lineSegments
      geometry={edges}
      position={box.position}
      visible={renderMode === "install"}
      userData={{ slot: box.slot }}
      // Opt out of raycasting entirely. Line raycasts use a threshold measured
      // in world units (a whole foot at this scale), so leaving these in the
      // occlusion test hides pins that nothing actually covers.
      raycast={() => null}
    >
      <lineBasicMaterial
        key={faint ? "faint" : "solid"}
        color={SCENE_COLORS.wireframe}
        transparent={faint}
        opacity={faint ? MOBILE_WIRE_OPACITY : 1}
      />
    </lineSegments>
  );
}

/**
 * The cabinetry layer. It is always mounted; `showCabinets` only toggles
 * visibility and render mode only changes materials, so neither rebuilds the
 * scene graph.
 *
 * The wireframe has two forms. On a desktop it traces every carcass, which is
 * what you want when reading clearances. On a phone that resolves to a thicket
 * of lines, so it falls back to `CABINET_OUTLINES`: trim omitted and each
 * multi-piece volume collapsed to its outer box.
 */
export function CabinetLayer() {
  const showCabinets = useAppStore((s) => s.showCabinets);
  const isMobile = useIsMobile();
  const wireBoxes = isMobile ? CABINET_OUTLINES : CABINETS;

  return (
    <group name="cabinet-layer" visible={showCabinets}>
      {CABINETS.map((box) => (
        <group key={box.id} position={box.position} userData={{ slot: box.slot }}>
          <CabinetSolid box={box} />
        </group>
      ))}
      {wireBoxes.map((box) => (
        <CabinetWireframe key={"wire-" + box.id} box={box} faint={isMobile} />
      ))}
    </group>
  );
}
