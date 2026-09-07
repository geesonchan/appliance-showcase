import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { dimensionsFor } from "../data/dimensions";
import { useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";
import { dimensionElements } from "./dimensionRegistry";
import { dimensionRects, projectRects, useApplianceCorners } from "./keepOut";
import { clampPins, layoutPins, type KeepOut, type PinBox } from "./pinLayout";

/** Half the length of the tick at each end of a dimension line, in pixels. */
const TICK = 5;
/** Clear space kept around a figure, in pixels. */
const GAP = 5;

/**
 * Projects each dimension's two ends to the screen and draws the line, its end
 * ticks and the figure between them.
 *
 * The ticks are struck perpendicular to the line, so a vertical dimension gets
 * horizontal ticks and the aisle on the floor gets ticks square to it, which is
 * what makes the pair read as one measurement rather than two stray marks.
 *
 * The figures go through the same placement pass as the pin labels, against the
 * appliances and against each other, and are then published for the pin pass to
 * avoid. A drawing where two numbers sit on top of each other is worse than one
 * with no numbers at all: it looks like it says something.
 */
export function DimensionProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const selection = useSelection();
  const renderMode = useAppStore((s) => s.renderMode);
  const showDimensions = useAppStore((s) => s.showDimensions);

  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const dimensions = useMemo(
    () => dimensionsFor(selection, selectedSlot),
    [selection, selectedSlot],
  );
  const corners = useApplianceCorners(selection);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const appliances = useMemo<KeepOut[]>(() => [], []);
  // Reused each frame; the projector runs in the render loop and must not
  // allocate.
  const layout = useMemo<(PinBox & { x1: number; y1: number; x2: number; y2: number })[]>(
    () => dimensions.map(() => ({ x: 0, y: 0, w: 0, h: 0, hidden: true, x1: 0, y1: 0, x2: 0, y2: 0 })),
    [dimensions],
  );
  const frame = useRef(0);

  useFrame(() => {
    if (!showDimensions || renderMode !== "install") {
      if (dimensionRects.length > 0) dimensionRects.length = 0;
      return;
    }
    frame.current += 1;
    if (frame.current % 2 !== 0) return;

    projectRects(corners, camera, size.width, size.height, scratch, appliances);

    for (const [i, dimension] of dimensions.entries()) {
      const parts = dimensionElements.get(dimension.id);
      const box = layout[i];
      if (!parts) {
        box.hidden = true;
        continue;
      }

      a.set(...dimension.from).project(camera);
      b.set(...dimension.to).project(camera);
      box.x1 = (a.x * 0.5 + 0.5) * size.width;
      box.y1 = (-a.y * 0.5 + 0.5) * size.height;
      box.x2 = (b.x * 0.5 + 0.5) * size.width;
      box.y2 = (-b.y * 0.5 + 0.5) * size.height;

      const t = dimension.labelAt;
      box.x = box.x1 + (box.x2 - box.x1) * t;
      box.y = box.y1 + (box.y2 - box.y1) * t;
      box.hidden = Math.hypot(box.x2 - box.x1, box.y2 - box.y1) < 14;
      if (parts.label) {
        box.w = parts.label.offsetWidth;
        box.h = parts.label.offsetHeight;
      }
    }

    layoutPins(layout, appliances, GAP, size.height);
    clampPins(layout, size.width, size.height);

    dimensionRects.length = 0;
    for (const box of layout) {
      if (!box.hidden) dimensionRects.push({ x: box.x, y: box.y, w: box.w, h: box.h });
    }

    for (const [i, dimension] of dimensions.entries()) {
      const parts = dimensionElements.get(dimension.id);
      if (!parts) continue;
      const box = layout[i];

      if (parts.line) {
        const dx = box.x2 - box.x1;
        const dy = box.y2 - box.y1;
        const length = Math.hypot(dx, dy) || 1;
        // Perpendicular, for the ticks.
        const px = (-dy / length) * TICK;
        const py = (dx / length) * TICK;
        const [main, tickA, tickB] = parts.line.children;
        set(main, box.x1, box.y1, box.x2, box.y2);
        set(tickA, box.x1 - px, box.y1 - py, box.x1 + px, box.y1 + py);
        set(tickB, box.x2 - px, box.y2 - py, box.x2 + px, box.y2 + py);
        parts.line.setAttribute("opacity", box.hidden ? "0" : "0.8");
      }
      if (parts.label) {
        parts.label.style.transform =
          `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0) translate(-50%, -50%)`;
        parts.label.style.opacity = box.hidden ? "0" : "1";
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
