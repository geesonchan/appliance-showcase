import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useAppStore } from "../store/useAppStore";
import { ApplianceLayer } from "./ApplianceLayer";
import { CabinetLayer } from "./CabinetLayer";
import { CameraRig } from "./CameraRig";
import { KitchenShell } from "./KitchenShell";
import { Lights } from "./Lights";
import { PinProjector } from "./PinProjector";
import { UtilityLayer } from "./UtilityLayer";

/**
 * The whole scene graph is mounted once. Render mode, day/night and the layer
 * toggles only change materials and `visible` flags, so nothing is rebuilt on
 * a mode switch.
 */
export function Scene() {
  const selectSlot = useAppStore((s) => s.selectSlot);
  const lighting = useAppStore((s) => s.lighting);
  const renderMode = useAppStore((s) => s.renderMode);

  return (
    <Canvas
      orthographic
      shadows={renderMode === "realistic"}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [12, 15, 12], zoom: 46, near: -100, far: 200 }}
      onPointerMissed={() => selectSlot(null)}
    >
      <color attach="background" args={[lighting === "day" ? "#EFEDE6" : "#D9D8D1"]} />
      <fog attach="fog" args={[lighting === "day" ? "#EFEDE6" : "#D9D8D1", 40, 80]} />
      <Suspense fallback={null}>
        <Lights />
        <KitchenShell />
        <CabinetLayer />
        <ApplianceLayer />
        <UtilityLayer type="gas" />
        <UtilityLayer type="power" />
        <UtilityLayer type="water" />
        <UtilityLayer type="duct" />
        <PinProjector />
      </Suspense>
      <CameraRig />
    </Canvas>
  );
}
