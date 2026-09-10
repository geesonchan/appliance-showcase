import { useMemo } from "react";
import { HOOD_OPENING, ROOM, RUN, WINDOWS, ft, fridgeReturnWall } from "../data/room";
import { useAppStore } from "../store/useAppStore";
import { finish, floorColor, wallColor } from "./materials";
import { Surface } from "./Surface";
import { WindowLayer, wallWithWindows } from "./WindowLayer";

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
  // The walls are shapes rather than planes, because they have holes in them:
  // a window is a hole in a wall before it is anything else. A wall drawn as
  // four rectangles round each opening shows its seams the moment the light is
  // low, the same reason the countertop is one slab.
  //
  // The left wall's plane is turned a quarter turn to face the room, so what
  // is further along it in the room is nearer the start of the shape: its
  // holes are mirrored, and its own geometry is the only place that is true.
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const backWall = useMemo(
    () =>
      wallWithWindows(
        ROOM.halfX + WALL_GAP,
        ROOM.wallHeight,
        WINDOWS.filter((window) => window.wall === "back").map((window) => ({
          from: window.along[0],
          to: window.along[1],
          sill: window.band[0],
          head: window.band[1],
        })),
      ),
    [layoutVersion],
  );
  const leftWall = useMemo(
    () =>
      wallWithWindows(
        ROOM.halfZ + WALL_GAP,
        ROOM.wallHeight,
        WINDOWS.filter((window) => window.wall === "left").map((window) => ({
          from: -window.along[1],
          to: -window.along[0],
          sill: window.band[0],
          head: window.band[1],
        })),
      ),
    [layoutVersion],
  );

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
        geometry={backWall}
        position={[0, 0, -ROOM.halfZ - WALL_GAP]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          key={wallOpacity < 1 ? "ghost" : "solid"}
          color={wall}
          roughness={0.95}
          metalness={0}
          transparent={wallOpacity < 1}
          opacity={wallOpacity}
        />
      </mesh>

      <ReturnWall colour={wall} opacity={wallOpacity} />

      {/* left wall (-X), faces +X */}
      <mesh
        name="wall-left"
        geometry={leftWall}
        position={[-ROOM.halfX - WALL_GAP, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          key={wallOpacity < 1 ? "ghost" : "solid"}
          color={wall}
          roughness={0.95}
          metalness={0}
          transparent={wallOpacity < 1}
          opacity={wallOpacity}
        />
      </mesh>

      <WindowLayer />
    </group>
  );
}

/**
 * The wall past the refrigerator, when the layout says one is there.
 *
 * In the wall's own colour and at the wall's own height, because the three and
 * a half inches beside the machine only make sense if you can see what they are
 * against — an empty gap at the end of a run reads as a cabinet somebody forgot
 * rather than as a door that has to open. See docs/decisions.md D11 rule 11.
 */
function ReturnWall({ colour, opacity }: { colour: string; opacity: number }) {
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const wall = useMemo(() => fridgeReturnWall(), [layoutVersion]);
  if (!wall) return null;

  return (
    <mesh name="wall-return" position={wall.position} receiveShadow castShadow>
      <boxGeometry args={wall.size} />
      <meshStandardMaterial
        key={opacity < 1 ? "ghost" : "solid"}
        color={colour}
        roughness={0.95}
        metalness={0}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
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
