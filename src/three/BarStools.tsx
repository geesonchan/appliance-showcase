import { useMemo } from "react";
import { barStools } from "../data/barStools";
import { ISLAND } from "../data/room";
import { useAppStore } from "../store/useAppStore";
import { buildBarStools, paintBarStools } from "./barStoolMesh";

/**
 * Bar stools at the island's seating overhang, where it has one. Round 77.
 *
 * Mounted inside the room's key, so it is rebuilt with the island and built
 * once per room; a render mode only repaints it (D2). Hidden in the install
 * view, which explains services, and with the cabinets, which it stands at.
 * Faded off a sight line like the joinery (`OcclusionFade`), and never clicked.
 */
export function BarStools() {
  const renderMode = useAppStore((s) => s.renderMode);
  const showCabinets = useAppStore((s) => s.showCabinets);
  const group = useMemo(() => buildBarStools(barStools(ISLAND)), []);
  // Painted during render, so the first frame is already in the right colours.
  paintBarStools(group, renderMode);
  return <primitive object={group} visible={showCabinets && renderMode !== "install"} />;
}
