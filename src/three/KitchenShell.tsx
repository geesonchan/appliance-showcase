import { HOOD_OPENING, ROOM, RUN, ft } from "../data/room";
import { useAppStore } from "../store/useAppStore";
import { finish, floorColor, wallColor } from "./materials";
import { Surface } from "./Surface";

/** Floor and the two walls the L-shaped run sits against. */
/**
 * Wall planes sit an inch behind the nominal room line. Cabinet carcasses are
 * flush with that line, and coplanar faces z-fight.
 */
const WALL_GAP = ft(1);

export function KitchenShell() {
  const renderMode = useAppStore((s) => s.renderMode);
  const lighting = useAppStore((s) => s.lighting);

  const floorToken = useAppStore((s) => s.finishes.floor);
  const floor = floorColor(renderMode, lighting);
  const wall = wallColor(renderMode, lighting);
  const wallOpacity = renderMode === "install" ? 0.35 : 1;

  // The floor keeps its night tint under a texture: after dark a room is not
  // the same wood at lower brightness, it is a warmer, dimmer version of it.
  const floorSurface = {
    ...finish(renderMode, floorToken),
    ...(lighting === "night" && renderMode === "realistic" ? { color: "#A79274" } : {}),
    ...(renderMode !== "realistic" ? { color: floor } : {}),
  };
  const floorSize: [number, number] = [
    ROOM.halfX * 2 + WALL_GAP * 2,
    ROOM.halfZ * 2 + WALL_GAP * 2,
  ];

  return (
    <group name="kitchen-shell">
      <mesh
        name="floor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-WALL_GAP / 2, 0, -WALL_GAP / 2]}
        receiveShadow
      >
        <planeGeometry args={floorSize} />
        <Surface s={floorSurface} size={floorSize} />
      </mesh>

      <Backsplash />

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

/**
 * Tile behind the range, from the countertop up to the wall cabinets.
 *
 * A splash is not decoration: it is the wall you can wipe, and it is what tells
 * a customer where the cooking happens. It runs the width of the hood opening —
 * the stretch of wall the cabinets leave clear — and stops at the underside of
 * the bank, because that is where the tiler stops.
 */
function Backsplash() {
  const renderMode = useAppStore((s) => s.renderMode);
  const [from, to] = HOOD_OPENING;
  const height = ROOM.upperBottom - ROOM.counterHeight;
  const props = finish(renderMode, "tile-white");

  if (renderMode !== "realistic" || to <= from) return null;

  return (
    <mesh
      name="backsplash"
      position={[(from + to) / 2, ROOM.counterHeight + height / 2, RUN.backZ - ROOM.counterDepth / 2 + ft(0.5)]}
      receiveShadow
    >
      <planeGeometry args={[to - from, height]} />
      <Surface s={props} size={[to - from, height]} />
    </mesh>
  );
}
