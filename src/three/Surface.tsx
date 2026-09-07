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
export function Surface({
  s,
  size,
  rotate = 0,
}: {
  s: SurfaceProps;
  size?: [number, number];
  /**
   * Turn the map, in radians. Wood has a direction: a door stile runs with the
   * height of the door and the rail across it, and one texture turned ninety
   * degrees is how you get both without drawing a second one.
   */
  rotate?: number;
}) {
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
      // Cloned but deliberately not marked dirty. A clone shares its source
      // with the original, which is already on the GPU; setting `needsUpdate`
      // marks that shared source for re-upload, and with a clone per door that
      // was eighty uploads of a 512px canvas on the frame a mode switch
      // landed. Repeat and rotation are uniforms — they cost nothing.
      const clone = texture(kind, px).clone();
      // Turning about the middle rather than the corner, so a rotated map
      // still covers the face it is on.
      clone.center.set(0.5, 0.5);
      clone.rotation = rotate;
      clone.repeat.set(rotate === 0 ? along : across, rotate === 0 ? across : along);
      return clone;
    };
    return {
      map: s.map ? make(s.map) : null,
      normalMap: s.normalMap ? make(s.normalMap) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.map, s.normalMap, s.repeatFt, px, alongFt, acrossFt, rotate]);

  return (
    <meshStandardMaterial
      // Keyed on what a shader has to be recompiled for: the transparency
      // flag, and whether there is a map at all. Not on *which* map — a finish
      // token keeps its slots filled in every render mode, so a mode switch
      // does not rekey, while changing the doors from paint to oak does.
      //
      // Keying on transparency alone was wrong and it showed: an oak door
      // rendered white, because the material picked up the texture without
      // recompiling the program that samples it.
      key={[
        s.transparent ? "ghost" : "solid",
        s.map ? "map" : "flat",
        s.normalMap ? "bump" : "smooth",
      ].join("-")}
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
