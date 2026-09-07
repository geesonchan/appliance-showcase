import { useMemo } from "react";
import * as THREE from "three";
import { useAppStore } from "../store/useAppStore";
import type { SurfaceProps } from "./materials";
import { texture } from "./textures";

/** Texture resolution per quality tier, in pixels. */
const TEXTURE_SIZE = { high: 512, low: 256 } as const;

/**
 * The one place a set of surface properties becomes a material.
 *
 * Keyed on the transparency flag and the maps, because three.js needs a fresh
 * material when `transparent` flips or a map appears — not just a property
 * write. Everything else is a write, which is what keeps a render-mode switch
 * from rebuilding every shader in the room.
 *
 * `size` is the extent of the face the material lands on, in feet, so a finish
 * can say "one tile of oak every two feet" and mean it: the same wood grain
 * comes out the same size on a 12-foot floor and a 2-foot door.
 */
export function Surface({ s, size }: { s: SurfaceProps; size?: [number, number] }) {
  const quality = useAppStore((state) => state.quality);
  const px = TEXTURE_SIZE[quality];

  // Destructured, because `size` arrives as a fresh array literal on every
  // render: memoising on the array itself recloned every texture every frame
  // the component drew.
  const [alongFt, acrossFt] = size ?? [0, 0];
  const maps = useMemo(() => {
    const repeat = s.repeatFt ?? 1;
    const along = size ? Math.max(0.25, alongFt / repeat) : 1;
    const across = size ? Math.max(0.25, acrossFt / repeat) : 1;

    // Each mesh gets its own clone: repeat is per-surface, and a shared texture
    // would let the last cabinet drawn set the grain size for all of them.
    const make = (kind: NonNullable<SurfaceProps["map"]>) => {
      const clone = texture(kind, px).clone();
      clone.needsUpdate = true;
      clone.repeat.set(along, across);
      return clone;
    };
    return {
      map: s.map ? make(s.map) : null,
      normalMap: s.normalMap ? make(s.normalMap) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.map, s.normalMap, s.repeatFt, px, alongFt, acrossFt]);

  return (
    <meshStandardMaterial
      // Keyed on transparency alone. Three.js needs a fresh material when that
      // flag flips, but a map appearing or going is a property write on the
      // material it already has — and keying on the maps too meant a render
      // mode switch built a new material for every cabinet in the room.
      key={s.transparent ? "ghost" : "solid"}
      color={s.color}
      metalness={s.metalness}
      roughness={s.roughness}
      transparent={s.transparent}
      opacity={s.opacity}
      map={maps.map}
      normalMap={maps.normalMap}
      normalScale={
        maps.normalMap
          ? new THREE.Vector2(s.normalScale ?? 0.4, s.normalScale ?? 0.4)
          : undefined
      }
    />
  );
}
