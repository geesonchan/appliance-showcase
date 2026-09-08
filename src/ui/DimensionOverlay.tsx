import { useMemo } from "react";
import { dimensionsFor, formatDimension } from "../data/dimensions";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";
import { registerDimensionPart } from "../three/dimensionRegistry";

/**
 * The dimension lines, drawn the way they are on a working drawing: a thin
 * line, a tick at each end, and the figure sitting on it.
 *
 * Drawn in SVG over the canvas rather than as geometry in the scene. A
 * dimension is an annotation — it should stay one pixel wide and stay legible
 * however far the room is zoomed, which is exactly what geometry does not do.
 * The projector moves the endpoints; nothing here re-renders per frame.
 */
export function DimensionOverlay() {
  const t = useT();
  const selection = useSelection();
  const renderMode = useAppStore((s) => s.renderMode);
  const showDimensions = useAppStore((s) => s.showDimensions);
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const layerOn = showDimensions && renderMode === "install";
  const dimensions = useMemo(
    () => dimensionsFor(selection, selectedSlot).filter((d) => layerOn || d.always),
    [selection, selectedSlot, layerOn],
  );

  if (dimensions.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {dimensions.map((dimension) => (
          <g key={dimension.id} ref={(el) => registerDimensionPart(dimension.id, "line", el)}>
            <line stroke="#4A5B4F" strokeWidth="1" shapeRendering="crispEdges" />
            <line stroke="#4A5B4F" strokeWidth="1" shapeRendering="crispEdges" />
            <line stroke="#4A5B4F" strokeWidth="1" shapeRendering="crispEdges" />
          </g>
        ))}
      </svg>

      {dimensions.map((dimension) => (
        <span
          key={dimension.id}
          ref={(el) => registerDimensionPart(dimension.id, "label", el)}
          style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform" }}
          className="whitespace-nowrap rounded-sm bg-[rgba(247,245,239,0.94)] px-1 py-px text-center text-[9px] leading-tight text-ink"
        >
          <span className="block font-medium tabular-nums">
            {formatDimension(dimension.valueIn)}
          </span>
          {dimension.noteKey && (
            <span className="block text-[8px] text-ink-muted">
              {t(dimension.noteKey, dimension.noteVars)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
