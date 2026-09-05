import { useAppStore } from "../store/useAppStore";
import type { Lighting, RenderMode } from "../types";

interface Rig {
  hemi: number;
  ambient: number;
  directional: number;
  /**
   * Shadow strength, 0 to 1, rather than a `castShadow` flag.
   *
   * Turning `castShadow` off changes the light count three.js compiles into
   * every material, so every shader in the scene would be rebuilt on a render
   * mode switch. Fading the shadow instead keeps the program cache keys stable
   * and makes the switch a property write.
   */
  shadows: number;
}

/**
 * Day and night differ only in light colour and intensity, and each render
 * mode gets the contrast it needs: the white model relies entirely on shading
 * to read its volumes, while install mode wants flat, even light so the pipe
 * colours stay true. No geometry or material is swapped, so toggling cannot
 * flicker the scene.
 */
const RIGS: Record<RenderMode, Record<Lighting, Rig>> = {
  realistic: {
    day: { hemi: 1.1, ambient: 0.3, directional: 1.5, shadows: 1 },
    night: { hemi: 0.5, ambient: 0.22, directional: 0.5, shadows: 0.85 },
  },
  white: {
    day: { hemi: 0.55, ambient: 0.25, directional: 1.5, shadows: 0 },
    night: { hemi: 0.35, ambient: 0.2, directional: 0.9, shadows: 0 },
  },
  install: {
    day: { hemi: 0.8, ambient: 0.7, directional: 0.5, shadows: 0 },
    night: { hemi: 0.5, ambient: 0.55, directional: 0.35, shadows: 0 },
  },
};

export function Lights() {
  const lighting = useAppStore((s) => s.lighting);
  const renderMode = useAppStore((s) => s.renderMode);
  const day = lighting === "day";
  const rig = RIGS[renderMode][lighting];

  return (
    <group name="lights">
      <hemisphereLight
        args={[day ? "#FFFDF6" : "#5B6B7A", day ? "#D9D3C4" : "#2A3230"]}
        intensity={rig.hemi}
      />
      <ambientLight intensity={rig.ambient} />
      <directionalLight
        position={[10, 13, 8]}
        intensity={rig.directional}
        color={day ? "#FFF6E2" : "#9FB6D0"}
        castShadow
        shadow-intensity={rig.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={15}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
        shadow-bias={-0.0002}
        shadow-normalBias={0.035}
      />
      {/* warm fill standing in for under-cabinet lighting after dark */}
      <pointLight
        position={[-2.25, 4.4, -4]}
        intensity={day ? 0 : 16}
        distance={9}
        decay={2}
        color="#FFC98A"
      />
    </group>
  );
}
