import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { dimensionsFor } from "../data/dimensions";
import { useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";
import { dimensionElements } from "./dimensionRegistry";

/** Half the length of the tick at each end of a dimension line, in pixels. */
const TICK = 5;

/**
 * Projects each dimension's two ends to the screen and draws the line, its end
 * ticks and the figure between them.
 *
 * The ticks are struck perpendicular to the line, so a vertical dimension gets
 * horizontal ticks and the aisle on the floor gets ticks square to it, which is
 * what makes the pair read as one measurement rather than two stray marks.
 */
export function DimensionProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const selection = useSelection();
  const renderMode = useAppStore((s) => s.renderMode);
  const showDimensions = useAppStore((s) => s.showDimensions);

  const dimensions = useMemo(() => dimensionsFor(selection), [selection]);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const frame = useRef(0);

  useFrame(() => {
    if (!showDimensions || renderMode !== "install") return;
    frame.current += 1;
    if (frame.current % 2 !== 0) return;

    for (const dimension of dimensions) {
      const parts = dimensionElements.get(dimension.id);
      if (!parts) continue;

      a.set(...dimension.from).project(camera);
      b.set(...dimension.to).project(camera);
      const x1 = (a.x * 0.5 + 0.5) * size.width;
      const y1 = (-a.y * 0.5 + 0.5) * size.height;
      const x2 = (b.x * 0.5 + 0.5) * size.width;
      const y2 = (-b.y * 0.5 + 0.5) * size.height;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy) || 1;
      // Perpendicular, for the ticks.
      const px = (-dy / length) * TICK;
      const py = (dx / length) * TICK;

      if (parts.line) {
        const [main, tickA, tickB] = parts.line.children;
        set(main, x1, y1, x2, y2);
        set(tickA, x1 - px, y1 - py, x1 + px, y1 + py);
        set(tickB, x2 - px, y2 - py, x2 + px, y2 + py);
        parts.line.setAttribute("opacity", length < 14 ? "0" : "0.8");
      }
      if (parts.label) {
        const t = dimension.labelAt;
        parts.label.style.transform =
          `translate3d(${Math.round(x1 + dx * t)}px, ${Math.round(y1 + dy * t)}px, 0)` +
          " translate(-50%, -50%)";
        parts.label.style.opacity = length < 14 ? "0" : "1";
      }
    }
  });

  return null;
}

function set(node: Element, x1: number, y1: number, x2: number, y2: number) {
  node.setAttribute("x1", String(Math.round(x1)));
  node.setAttribute("y1", String(Math.round(y1)));
  node.setAttribute("x2", String(Math.round(x2)));
  node.setAttribute("y2", String(Math.round(y2)));
}
