import { ROOM, RUN, ft } from "../data/room";
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
  // The realistic rig is deliberately the darkest of the three now that an
  // environment map carries the fill. Ambient light that used to stand in for
  // bounced light is doing it twice, and the room came out flat and pale.
  realistic: {
    day: { hemi: 0.35, ambient: 0.05, directional: 1.9, shadows: 1 },
    night: { hemi: 0.16, ambient: 0.04, directional: 0.35, shadows: 0.85 },
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

/**
 * Light colour by the clock, in the temperatures a fixture is sold at.
 *
 * 4000K is the neutral white a kitchen is lit to in daylight; 3000K is the
 * warm white the same room switches to at night, which is why an evening
 * kitchen looks like one and not like a shop floor. The hex values are those
 * temperatures converted once, here, rather than picked by eye.
 */
const KELVIN = {
  day: { key: "#FFF2E0", fill: "#EAF2FF", ground: "#D9D3C4" },
  night: { key: "#FFD9A8", fill: "#43536B", ground: "#2A3230" },
} as const;

export function Lights() {
  const lighting = useAppStore((s) => s.lighting);
  const renderMode = useAppStore((s) => s.renderMode);
  const day = lighting === "day";
  const rig = RIGS[renderMode][lighting];
  const tone = KELVIN[lighting];
  const underCabinet = renderMode === "realistic" && !day;

  return (
    <group name="lights">
      <hemisphereLight
        args={[day ? "#FFFDF6" : tone.fill, tone.ground]}
        intensity={rig.hemi}
      />
      <ambientLight intensity={rig.ambient} />
      <directionalLight
        position={[10, 13, 8]}
        intensity={rig.directional}
        color={day ? tone.key : tone.fill}
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
      {/* The ceiling fitting: a soft downward wash over the whole room, which
          is what stops the corners going black once the key light is warm. */}
      <pointLight
        position={[0, ROOM.wallHeight - ft(6), 1]}
        intensity={day ? 4 : 5}
        distance={26}
        decay={1.6}
        color={tone.key}
      />

      {/* Under-cabinet lighting: a strip along each run rather than one lamp,
          so the counter reads as lit from above it and the wall cabinets cast
          the line they should. Off in daylight, and off in the modes that are
          deliberately without atmosphere. */}
      {[
        { position: [RUN.leftX + ft(6), ROOM.upperBottom - ft(1), 0] as const },
        { position: [0, ROOM.upperBottom - ft(1), RUN.backZ + ft(6)] as const },
      ].map((strip, i) => (
        <pointLight
          key={i}
          position={strip.position}
          intensity={underCabinet ? 14 : 0}
          distance={10}
          decay={2}
          color="#FFC98A"
        />
      ))}
    </group>
  );
}
