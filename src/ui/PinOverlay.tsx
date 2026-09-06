import { APPLIANCE_BY_SLOT, SLOT_ORDER } from "../data/catalogue";
import { SLOT_BY_ID } from "../data/slots";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { registerPin } from "../three/pinRegistry";

/**
 * The pin labels themselves. They sit in a DOM layer over the canvas, so they
 * always face the screen and stay the same size however far the scene is
 * zoomed. PinProjector moves them; React only re-renders them on selection.
 */
export function PinOverlay() {
  const t = useT();
  const showLabels = useAppStore((s) => s.showLabels);
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const selectSlot = useAppStore((s) => s.selectSlot);

  if (!showLabels) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {SLOT_ORDER.map((slotId, index) => {
        const slot = SLOT_BY_ID[slotId];
        const appliance = APPLIANCE_BY_SLOT[slotId];
        const selected = selectedSlot === slotId;
        return (
          <button
            key={slotId}
            type="button"
            ref={(el) => registerPin(slotId, el)}
            onClick={() => selectSlot(slotId)}
            style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform" }}
            className={[
              "flex items-center gap-2 whitespace-nowrap rounded-full border p-1 sm:py-1 sm:pl-1 sm:pr-3",
              "text-[11px] font-medium shadow-sm transition-[opacity,border-color] duration-300 ease-out",
              selected
                ? "border-accent bg-accent text-[#F7F5EF]"
                : "border-line bg-[rgba(247,245,239,0.94)] text-ink hover:border-accent",
            ].join(" ")}
          >
            <span
              className={[
                "grid h-5 w-5 place-items-center rounded-full text-[10px] tabular-nums",
                selected ? "bg-[#F7F5EF] text-accent" : "bg-accent text-[#F7F5EF]",
              ].join(" ")}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="hidden sm:inline">{t(slot.labelKey)}</span>
            {appliance && (
              <span
                className={
                  "hidden sm:inline " + (selected ? "text-[#C3D6C9]" : "text-ink-muted")
                }
              >
                {appliance.brand}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
