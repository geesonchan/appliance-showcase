import { ROOM, ft } from "../data/slots";
import { useAppStore } from "../store/useAppStore";
import { floorColor, wallColor } from "./materials";

/** Floor and the two walls the L-shaped run sits against. */
/**
 * Wall planes sit an inch behind the nominal room line. Cabinet carcasses are
 * flush with that line, and coplanar faces z-fight.
 */
const WALL_GAP = ft(1);

export function KitchenShell() {
  const renderMode = useAppStore((s) => s.renderMode);
  const lighting = useAppStore((s) => s.lighting);

  const floor = floorColor(renderMode, lighting);
  const wall = wallColor(renderMode, lighting);
  const wallOpacity = renderMode === "install" ? 0.35 : 1;

  return (
    <group name="kitchen-shell">
      <mesh
        name="floor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-WALL_GAP / 2, 0, -WALL_GAP / 2]}
        receiveShadow
      >
        <planeGeometry args={[ROOM.halfX * 2 + WALL_GAP * 2, ROOM.halfZ * 2 + WALL_GAP * 2]} />
        <meshStandardMaterial color={floor} roughness={0.85} metalness={0} />
      </mesh>

      {/* back wall (-Z), faces +Z */}
      <mesh
        name="wall-back"
        position={[0, ROOM.wallHeight / 2, -ROOM.halfZ - WALL_GAP]}
        receiveShadow
      >
        <planeGeometry args={[ROOM.halfX * 2 + WALL_GAP * 2, ROOM.wallHeight]} />
        <meshStandardMaterial
          key={wallOpacity < 1 ? "ghost" : "solid"}
          color={wall}
          roughness={0.95}
          metalness={0}
          transparent={wallOpacity < 1}
          opacity={wallOpacity}
        />
      </mesh>

      {/* left wall (-X), faces +X */}
      <mesh
        name="wall-left"
        position={[-ROOM.halfX - WALL_GAP, ROOM.wallHeight / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[ROOM.halfZ * 2 + WALL_GAP * 2, ROOM.wallHeight]} />
        <meshStandardMaterial
          key={wallOpacity < 1 ? "ghost" : "solid"}
          color={wall}
          roughness={0.95}
          metalness={0}
          transparent={wallOpacity < 1}
          opacity={wallOpacity}
        />
      </mesh>
    </group>
  );
}
