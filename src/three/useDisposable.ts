import { useEffect } from "react";
import * as THREE from "three";

/**
 * Frees what a component made for itself, once it is replaced or the component
 * is taken down (Leo, 甲: `docs/plans/geometry-leak-plan.md`).
 *
 * @react-three/fiber frees a geometry or material it made from JSX
 * (`<boxGeometry args={…} />`), and nothing a component made itself and handed
 * it — `<mesh geometry={made}>`, `<primitive object={made} />`. Those were
 * never freed: every room rebuilt left the last one's in the renderer, 238
 * geometries with the page open and 2,019 after fifty model swaps (round 100).
 * A geometry or material is disposed; a three object (a line, a group of bar
 * stools) has every geometry and material under it disposed.
 *
 * Disposing a geometry the scene still draws only has three upload it again,
 * so a second run of an effect (React's StrictMode in development) costs a
 * frame, never the picture.
 */
export function useDisposable(made: { dispose(): void } | THREE.Object3D | null | undefined) {
  useEffect(() => () => dispose(made), [made]);
}

function dispose(made: { dispose(): void } | THREE.Object3D | null | undefined) {
  if (!made) return;
  if (made instanceof THREE.Object3D) {
    made.traverse((object) => {
      const drawn = object as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
      drawn.geometry?.dispose();
      for (const material of [drawn.material ?? []].flat()) material.dispose();
    });
    return;
  }
  made.dispose();
}
