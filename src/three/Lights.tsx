import { useAppStore } from "../store/useAppStore";

/**
 * Day and night differ only in light colour, intensity and the ambient tint.
 * No geometry or material is swapped, so toggling cannot flicker the scene.
 */
export function Lights() {
  const lighting = useAppStore((s) => s.lighting);
  const renderMode = useAppStore((s) => s.renderMode);
  const day = lighting === "day";
  // The white model and install views read best under flat, even light.
  const flat = renderMode !== "realistic";

  return (
    <group name="lights">
      <hemisphereLight
        args={[day ? "#FFFDF6" : "#5B6B7A", day ? "#D9D3C4" : "#2A3230"]}
        intensity={day ? 1.15 : 0.55}
      />
      <ambientLight intensity={flat ? 0.75 : day ? 0.35 : 0.25} />
      <directionalLight
        position={[8, 14, 9]}
        intensity={flat ? 0.7 : day ? 1.5 : 0.5}
        color={day ? "#FFF6E2" : "#9FB6D0"}
        castShadow={!flat}
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
        position={[-2, 4.4, -4]}
        intensity={day ? 0 : 14}
        distance={9}
        decay={2}
        color="#FFC98A"
      />
    </group>
  );
}
