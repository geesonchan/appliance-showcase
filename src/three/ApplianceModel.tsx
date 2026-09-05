import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { ROOM, SLOT_BY_ID, ft } from "../data/slots";
import { useAppStore } from "../store/useAppStore";
import type { Category, Finish, SlotId } from "../types";
import { SCENE_COLORS, finishSurface, surface, type SurfaceProps } from "./materials";

export interface ApplianceModelProps {
  slot: SlotId;
  category: Category;
  finish: Finish;
}

/**
 * A procedural stand-in for one appliance.
 *
 * The contract is deliberately narrow (slot / category / finish) so a later
 * milestone can swap the body of this component for a glTF lookup without
 * touching the layers, pins or interaction code around it.
 */
export function ApplianceModel({ slot, category, finish }: ApplianceModelProps) {
  const def = SLOT_BY_ID[slot];
  const renderMode = useAppStore((s) => s.renderMode);
  const selectSlot = useAppStore((s) => s.selectSlot);
  const selected = useAppStore((s) => s.selectedSlot === slot);

  const body = finishSurface(renderMode, finish);
  const trim = surface(renderMode, "#8E938D", { metalness: 0.9, roughness: 0.25 });
  const glass = surface(renderMode, "#2B322D", { metalness: 0.3, roughness: 0.1 });

  const w = ft(def.cutout.w);
  const h = ft(def.cutout.h);
  const d = ft(def.cutout.d);
  // Slots sit on the centre line of a 24" run. Appliances install flush with
  // the cabinet face, so shallower bodies move forward; a hood is the
  // exception, since it hangs off the wall behind it.
  const flushToWall = category === "hood";
  const dz = flushToWall
    ? -(ROOM.counterDepth - d) / 2
    : (ROOM.counterDepth - d) / 2 + ft(0.5);

  const outline = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    [w, h, d],
  );

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectSlot(slot);
  };

  return (
    <group
      name={"appliance-" + slot}
      position={def.position}
      rotation={[0, def.rotationY, 0]}
      onClick={handleClick}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <group position={[0, 0, dz]}>
        <Body category={category} w={w} h={h} d={d} body={body} trim={trim} glass={glass} />
        {selected && (
          <lineSegments geometry={outline} position={[0, h / 2, 0]}>
            <lineBasicMaterial color={SCENE_COLORS.selection} />
          </lineSegments>
        )}
      </group>
    </group>
  );
}

function Mat({ s }: { s: SurfaceProps }) {
  return (
    <meshStandardMaterial
      color={s.color}
      metalness={s.metalness}
      roughness={s.roughness}
      transparent={s.transparent}
      opacity={s.opacity}
    />
  );
}

interface BodyProps {
  category: Category;
  w: number;
  h: number;
  d: number;
  body: SurfaceProps;
  trim: SurfaceProps;
  glass: SurfaceProps;
}

/** Category-specific massing. Every shape is a primitive; nothing is loaded. */
function Body({ category, w, h, d, body, trim, glass }: BodyProps) {
  const front = d / 2 + 0.005;
  const bar = ft(1.25);

  switch (category) {
    case "refrigerator":
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <Mat s={body} />
          </mesh>
          {/* french-door seam plus the freezer drawer split */}
          <mesh position={[0, h * 0.72, front]}>
            <boxGeometry args={[ft(0.6), h * 0.55, 0.01]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[0, h * 0.44, front]}>
            <boxGeometry args={[w * 0.98, ft(0.6), 0.01]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[-w * 0.16, h * 0.66, front + ft(1)]}>
            <boxGeometry args={[bar, h * 0.34, bar]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[w * 0.16, h * 0.66, front + ft(1)]}>
            <boxGeometry args={[bar, h * 0.34, bar]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[0, h * 0.2, front + ft(1)]}>
            <boxGeometry args={[w * 0.5, bar, bar]} />
            <Mat s={trim} />
          </mesh>
        </group>
      );

    case "range":
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <Mat s={body} />
          </mesh>
          {/* oven door glass and handle */}
          <mesh position={[0, h * 0.38, front]}>
            <boxGeometry args={[w * 0.8, h * 0.45, 0.01]} />
            <Mat s={glass} />
          </mesh>
          <mesh position={[0, h * 0.66, front + ft(1.5)]}>
            <boxGeometry args={[w * 0.92, bar, bar]} />
            <Mat s={trim} />
          </mesh>
          {[-0.3, -0.1, 0.1, 0.3].map((k) => (
            <mesh
              key={k}
              position={[w * k, h * 0.86, front + ft(0.6)]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[ft(0.9), ft(0.9), ft(1.2), 16]} />
              <Mat s={trim} />
            </mesh>
          ))}
          {/* cast iron grates over four burners */}
          {[
            [-0.24, -0.22],
            [0.24, -0.22],
            [-0.24, 0.2],
            [0.24, 0.2],
          ].map(([bx, bz], i) => (
            <mesh key={i} position={[w * bx, h + ft(0.4), d * bz]}>
              <cylinderGeometry args={[ft(3.6), ft(3.6), ft(0.8), 6]} />
              <Mat s={glass} />
            </mesh>
          ))}
        </group>
      );

    case "hood":
      return (
        <group>
          {/* canopy, tapering into a chimney that runs to the ceiling */}
          <mesh position={[0, h * 0.18, 0]} castShadow>
            <boxGeometry args={[w, h * 0.36, d]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, h * 0.42, -d * 0.12]}>
            <boxGeometry args={[w * 0.55, h * 0.14, d * 0.7]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, h * 0.78, -d * 0.18]}>
            <boxGeometry args={[w * 0.36, h * 0.75, d * 0.42]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, h * 0.02, 0]}>
            <boxGeometry args={[w * 0.9, ft(0.8), d * 0.85]} />
            <Mat s={glass} />
          </mesh>
        </group>
      );

    case "dishwasher":
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, h * 0.94, front + ft(1.2)]}>
            <boxGeometry args={[w * 0.9, bar, bar]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[0, h * 0.5, front]}>
            <boxGeometry args={[w * 0.9, h * 0.7, 0.01]} />
            <Mat s={trim} />
          </mesh>
        </group>
      );

    case "wall-oven":
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, h * 0.44, front]}>
            <boxGeometry args={[w * 0.82, h * 0.6, 0.01]} />
            <Mat s={glass} />
          </mesh>
          <mesh position={[0, h * 0.8, front + ft(1.2)]}>
            <boxGeometry args={[w * 0.9, bar, bar]} />
            <Mat s={trim} />
          </mesh>
        </group>
      );

    case "microwave":
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <Mat s={body} />
          </mesh>
          <mesh position={[0, h * 0.55, front + ft(0.8)]}>
            <boxGeometry args={[w * 0.9, bar, bar]} />
            <Mat s={trim} />
          </mesh>
          <mesh position={[0, h * 0.3, front]}>
            <boxGeometry args={[w * 0.7, h * 0.3, 0.01]} />
            <Mat s={glass} />
          </mesh>
        </group>
      );

    default:
      return (
        <mesh position={[0, h / 2, 0]} castShadow>
          <boxGeometry args={[w, h, d]} />
          <Mat s={body} />
        </mesh>
      );
  }
}
