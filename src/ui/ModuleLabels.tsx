import { labelledBoxes } from "../data/cabinets";
import { DEBUG } from "../debug";
import { registerModuleLabel } from "../three/moduleLabelRegistry";

/**
 * Every cabinet's trade code, over the box it belongs to.
 *
 * Only under ?debug=1, and only for boxes that are a module — the counters, toe
 * kicks and the panels either side of an enclosure are parts of a cabinet
 * rather than cabinets you order. It is here so a run can be read back the way
 * it would be quoted: LS36, B24, DB18, B18, T4296.
 */
export function ModuleLabels() {
  if (!DEBUG) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {labelledBoxes().map((box) => (
        <span
          key={box.id}
          ref={(el) => registerModuleLabel(box.id, el)}
          style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform" }}
          className="rounded-sm bg-ink/85 px-1 py-px font-mono text-[8px] leading-none text-[#F7F5EF]"
        >
          {box.module!.code}
        </span>
      ))}
    </div>
  );
}
