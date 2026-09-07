import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

/**
 * Compiles the shader variants install mode needs, at load rather than on the
 * first switch into it.
 *
 * Most of the scene is already covered: the utility layers and the cabinet
 * wireframe are mounted from the start (merely invisible), and
 * `WebGLRenderer.compile` walks the whole graph rather than only visible
 * objects. What is missing are the ghosted materials, which do not exist until
 * install mode mounts them — a material whose `transparent` flag differs needs
 * its own program. The two hidden meshes below stand in for those, and because
 * three.js keys its program cache on material parameters rather than identity,
 * the real materials pick the compiled programs straight back up.
 *
 * Colour and opacity are uniforms, not part of the cache key, so the exact
 * values here do not matter; the flags do.
 */
export function ShaderWarmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.01, 0.01, 0.01)),
    [],
  );
  // A one-pixel stand-in for every textured variant. Three.js keys its program
  // cache on which maps a material has, not on which texture, so any map will
  // do — and a real one would be a texture generated for a mesh nobody sees.
  const pixel = useMemo(() => {
    const made = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    made.needsUpdate = true;
    return made;
  }, []);

  useEffect(() => {
    // One frame of delay so the graph is mounted and the lights are set up.
    // compileAsync keeps this off the main thread where the driver supports it.
    const raf = requestAnimationFrame(() => {
      if (typeof gl.compileAsync === "function") void gl.compileAsync(scene, camera);
      else gl.compile(scene, camera);
    });
    return () => cancelAnimationFrame(raf);
  }, [gl, scene, camera]);

  return (
    <group name="shader-warmup" visible={false} position={[0, -200, 0]}>
      {/* ghosted cabinet and wall: transparent, receives shadow */}
      <mesh receiveShadow>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial transparent opacity={0.06} />
      </mesh>
      {/* ghosted appliance: transparent, casts shadow */}
      <mesh castShadow>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial transparent opacity={0.22} />
      </mesh>
      {/* the phone variant of the wireframe, which fades its lines */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial transparent opacity={0.25} />
      </lineSegments>

      {/* The textured variants, which is what M3-5 added and what a switch back
          into the realistic view was paying to compile. A material with a map
          and one with a map and a normal map are two more programs; so is the
          double-sided counter slab, in both its solid and its ghosted form. */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial map={pixel} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial map={pixel} normalMap={pixel} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial map={pixel} side={THREE.DoubleSide} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
