import { useMemo } from "react";
import * as THREE from "three";
import { ROOM, WINDOW, WINDOWS, ft, type ResolvedWindow } from "../data/room";
import { useAppStore } from "../store/useAppStore";
import { finish, surface } from "./materials";
import { Surface } from "./Surface";
import { texture } from "./textures";

/**
 * The windows: a cased opening in the wall, and what is on the other side.
 *
 * A hole rather than a fitting. What is drawn is what a joiner leaves behind —
 * the frame round the opening, the stone sill inside it, and the glass set
 * back in the reveal — and behind that a plain gradient standing in for
 * outside. Not a view: a window in a drawing of a kitchen is there for the
 * light and for the fact that the wall has a hole in it, and a rendered garden
 * invites a customer to look at the garden.
 *
 * The wall itself is cut by `KitchenShell`, which builds its plane as a shape
 * with these openings as holes in it.
 */
export function WindowLayer() {
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const windows = useMemo(() => WINDOWS.slice(), [layoutVersion]);

  return (
    <group name="window-layer">
      {windows.map((window, index) => (
        <WindowOpeningView key={`${window.wall}-${index}`} window={window} />
      ))}
    </group>
  );
}

/**
 * One window, drawn in its own wall's frame.
 *
 * Local x runs along the wall, y up it, and +z into the room, so everything
 * below is written the way it would be measured on site: so far along, so far
 * up, so far out.
 */
function WindowOpeningView({ window }: { window: ResolvedWindow }) {
  const renderMode = useAppStore((s) => s.renderMode);
  const lighting = useAppStore((s) => s.lighting);
  const counterToken = useAppStore((s) => s.finishes.counter);
  const quality = useAppStore((s) => s.quality);

  const back = window.wall === "back";
  const middle = (window.along[0] + window.along[1]) / 2;
  const w = window.along[1] - window.along[0];
  const h = window.band[1] - window.band[0];
  const y = (window.band[0] + window.band[1]) / 2;

  const frame = ft(WINDOW.frameIn);
  const proud = ft(WINDOW.frameProudIn);
  const sillOut = ft(WINDOW.innerSillIn);
  const sillThick = ft(WINDOW.innerSillThickIn);

  // Paint rather than a finish anybody picks: a window frame is white in this
  // room whatever the doors are.
  const white = finish(renderMode, "painted", "#F6F4EE");
  const stone = finish(renderMode, counterToken);
  const install = renderMode === "install";

  // The glass, and the daylight behind it. Both go dark after dark: what makes
  // a window read as night is that the brightest thing in the room is no
  // longer the hole in the wall.
  const night = lighting === "night";
  const glass = {
    ...surface(renderMode, night ? "#20262E" : "#C4DCEA", {
      metalness: 0.1,
      roughness: 0.05,
    }),
    transparent: true,
    opacity: night ? 0.55 : 0.3,
    hardware: true,
  };
  const outside = useMemo(
    () => texture("sky", quality === "high" ? 512 : 256),
    [quality],
  );

  return (
    <group
      name={`window-${window.wall}`}
      position={back ? [0, 0, -ROOM.halfZ] : [-ROOM.halfX, 0, 0]}
      rotation={[0, back ? 0 : Math.PI / 2, 0]}
    >
      <group position={[back ? middle : -middle, y, 0]}>
        {/* What is outside: a flat gradient, unlit, set well back in the
            reveal so the frame reads in front of it. */}
        {renderMode === "realistic" && (
          <mesh position={[0, 0, -ft(5)]}>
            <planeGeometry args={[w + frame, h + frame]} />
            <meshBasicMaterial
              map={outside}
              color={night ? "#2A3340" : "#FFFFFF"}
              toneMapped={false}
            />
          </mesh>
        )}

        {/* The glass, set back inside the reveal. */}
        {!install && (
          <mesh position={[0, 0, -ft(WINDOW.glassBackIn)]}>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial
              key={night ? "night" : "day"}
              color={glass.color}
              metalness={glass.metalness}
              roughness={glass.roughness}
              transparent
              opacity={glass.opacity}
            />
          </mesh>
        )}

        {/* The frame: four lengths round the opening, standing proud of the
            wall. In the install view it is the heavy outline of the hole. */}
        {[
          { id: "head", at: [0, (h + frame) / 2] as const, size: [w + frame * 2, frame] as const },
          { id: "sill", at: [0, -(h + frame) / 2] as const, size: [w + frame * 2, frame] as const },
          { id: "left", at: [-(w + frame) / 2, 0] as const, size: [frame, h] as const },
          { id: "right", at: [(w + frame) / 2, 0] as const, size: [frame, h] as const },
        ].map((part) => (
          <mesh
            key={part.id}
            name={`window-frame-${part.id}`}
            position={[part.at[0], part.at[1], (install ? proud * 2 : proud) / 2]}
            castShadow={!install}
            receiveShadow={!install}
          >
            <boxGeometry
              args={[part.size[0], part.size[1], install ? proud * 2 : proud]}
            />
            <Surface s={white} size={[part.size[0], part.size[1]]} />
          </mesh>
        ))}

        {/* The stone sill inside the opening, in the worktop's own material:
            it is the same slab, cut by the same fabricator. */}
        <mesh
          name="window-sill"
          position={[0, -(h + sillThick) / 2 - frame / 2, sillOut / 2]}
          castShadow={!install}
          receiveShadow
        >
          <boxGeometry args={[w + frame * 2, sillThick, sillOut]} />
          <Surface s={stone} size={[w + frame * 2, sillOut]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A wall with its windows cut out of it.
 *
 * The plane is built as a shape with holes rather than as four pieces round
 * each opening, for the same reason the countertop is one slab: a wall is one
 * surface, and four rectangles meeting at the corners of a hole show their
 * seams the moment the light is low.
 *
 * `holes` are along the wall in the same frame the shape is drawn in, which is
 * the caller's business — the back wall's own x, and the left wall's mirrored
 * z, because that plane is turned a quarter turn to face the room.
 */
export function wallWithWindows(
  halfAlong: number,
  height: number,
  holes: { from: number; to: number; sill: number; head: number }[],
): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-halfAlong, 0);
  shape.lineTo(halfAlong, 0);
  shape.lineTo(halfAlong, height);
  shape.lineTo(-halfAlong, height);
  shape.closePath();

  for (const hole of holes) {
    const path = new THREE.Path();
    path.moveTo(hole.from, hole.sill);
    path.lineTo(hole.to, hole.sill);
    path.lineTo(hole.to, hole.head);
    path.lineTo(hole.from, hole.head);
    path.closePath();
    shape.holes.push(path);
  }
  return new THREE.ShapeGeometry(shape);
}
