import { SLOT_ORDER } from "../data/catalogue";
import { SLOT_BY_ID } from "../data/slots";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { registerPinPart } from "../three/pinRegistry";

/**
 * The pins, as a surveyor would draw them: a dot on the thing, a hairline out
 * to clear space, and the label there.
 *
 * The label used to sit on the appliance, which put a white pill over the one
 * object it was naming. Splitting the two means the mark can be exactly on the
 * appliance — where it is accurate — while the text sits where it can be read
 * without hiding anything.
 *
 * All three parts live in a DOM layer over the canvas, so they always face the
 * screen and stay the same size however far the scene is zoomed. PinProjector
 * moves them; React only re-renders them on selection.
 */
export function PinOverlay() {
  const t = useT();
  const showLabels = useAppStore((s) => s.showLabels);
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const selectSlot = useAppStore((s) => s.selectSlot);

  if (!showLabels) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* The leaders sit under the labels, in one SVG so they share a
          coordinate space with the overlay rather than each being a rotated
          div with its own rounding error. */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {SLOT_ORDER.map((slotId) => (
          <line
            key={slotId}
            ref={(el) => registerPinPart(slotId, "leader", el)}
            stroke={selectedSlot === slotId ? "#2E5C45" : "#6B7268"}
            strokeWidth="1"
            opacity="0"
            shapeRendering="crispEdges"
          />
        ))}
      </svg>

      {SLOT_ORDER.map((slotId, index) => {
        const slot = SLOT_BY_ID[slotId];
        const selected = selectedSlot === slotId;
        return (
          <div key={slotId}>
            <span
              ref={(el) => registerPinPart(slotId, "dot", el)}
              style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform" }}
              className={[
                "block h-2 w-2 rounded-full ring-2 transition-colors",
                selected ? "bg-accent ring-[#F7F5EF]" : "bg-ink ring-[rgba(247,245,239,0.9)]",
              ].join(" ")}
              aria-hidden="true"
            />
            <button
              type="button"
              ref={(el) => registerPinPart(slotId, "label", el)}
              onClick={() => selectSlot(slotId)}
              style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform" }}
              className={[
                "flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5",
                "text-[10px] font-medium leading-none transition-colors",
                selected
                  ? "border-accent bg-accent text-[#F7F5EF]"
                  : "border-line bg-[rgba(247,245,239,0.92)] text-ink hover:border-accent",
              ].join(" ")}
            >
              <span
                className={
                  "tabular-nums " + (selected ? "text-[#C3D6C9]" : "text-ink-muted")
                }
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {t(slot.labelKey)}
            </button>
          </div>
        );
      })}
    </div>
  );
}
