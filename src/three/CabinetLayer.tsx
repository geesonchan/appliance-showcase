import { useMemo } from "react";
import * as THREE from "three";
import { CABINETS, type CabinetBox } from "../data/cabinets";
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

function CabinetBoxMesh({ box }: { box: CabinetBox }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const props = surface(renderMode, KIND_COLOR[box.kind], {
    metalness: 0,
    roughness: box.kind === "counter" ? 0.4 : 0.85,
  });

  const geometry = useMemo(
    () => new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2]),
    [box.size],
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  // Install mode drops the solid box to a faint ghost and draws the carcass
  // edges instead, so openings and clearances read at a glance.
  return (
    <group position={box.position}>
      <mesh geometry={geometry} castShadow={renderMode !== "install"} receiveShadow>
        {/* Keyed on the mode: three.js needs a fresh material when the
            `transparent` flag flips, not just a property write. */}
        <meshStandardMaterial
          key={renderMode}
          color={props.color}
          metalness={props.metalness}
          roughness={props.roughness}
          transparent={renderMode === "install"}
          opacity={renderMode === "install" ? 0.06 : 1}
        />
      </mesh>
      {renderMode === "install" && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={SCENE_COLORS.wireframe} />
        </lineSegments>
      )}
    </group>
  );
}

/**
 * The cabinetry layer. It is always mounted; `showCabinets` only toggles
 * visibility and render mode only changes materials, so neither rebuilds the
 * scene graph.
 */
export function CabinetLayer() {
  const showCabinets = useAppStore((s) => s.showCabinets);
  return (
    <group name="cabinet-layer" visible={showCabinets}>
      {CABINETS.map((box) => (
        <CabinetBoxMesh key={box.id} box={box} />
      ))}
    </group>
  );
}
