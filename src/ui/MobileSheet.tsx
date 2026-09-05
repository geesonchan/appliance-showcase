import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";

/** Sheet heights, in vh. */
const SNAP = { half: 50, low: 26 };
/** Dragged below this, the sheet dismisses instead of snapping. */
const DISMISS_BELOW = 18;

type Panel = "list" | "config";

/**
 * The phone version of the two side columns.
 *
 * It is a half-height sheet rather than a modal: the scene keeps the top half
 * of the screen, so a fly-in or a layer toggle is visible while the sheet is
 * still open. Nothing inside the sheet dismisses it — only the tabs, the close
 * button, or dragging the grabber down past the low snap.
 */
export function MobileSheet() {
  const t = useT();
  const panel = useAppStore((s) => s.mobilePanel);
  const setMobilePanel = useAppStore((s) => s.setMobilePanel);
  const [heightVh, setHeightVh] = useState(SNAP.half);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  const open = panel !== "none";

  // A freshly opened sheet always comes back at half height.
  useEffect(() => {
    if (open) setHeightVh(SNAP.half);
  }, [open]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: 0 };
    // Resolve the current height at grab time so a mid-animation grab is exact.
    const sheet = (event.currentTarget as HTMLElement).closest("[data-sheet]");
    drag.current.startHeight = sheet
      ? (sheet.getBoundingClientRect().height / window.innerHeight) * 100
      : SNAP.half;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!drag.current) return;
    const deltaVh = ((drag.current.startY - event.clientY) / window.innerHeight) * 100;
    setHeightVh(Math.min(SNAP.half, Math.max(6, drag.current.startHeight + deltaVh)));
  }, []);

  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setHeightVh((current) => {
      if (current < DISMISS_BELOW) {
        setMobilePanel("none");
        return SNAP.half;
      }
      const toHalf = Math.abs(current - SNAP.half);
      const toLow = Math.abs(current - SNAP.low);
      return toHalf <= toLow ? SNAP.half : SNAP.low;
    });
  }, [setMobilePanel]);

  const tab = (value: Panel, label: string) => (
    <button
      type="button"
      onClick={() => setMobilePanel(value)}
      className={[
        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
        panel === value ? "bg-accent text-[#F7F5EF]" : "text-ink-muted",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="md:hidden">
      {/* Closed state: the two entry buttons float above the toolbar. */}
      {!open && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[72px] z-30 flex justify-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setMobilePanel("list")}
            className="pointer-events-auto rounded-full border border-line bg-surface px-4 py-2 text-[12px] font-medium text-ink"
          >
            {t("mobile.appliances")}
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("config")}
            className="pointer-events-auto rounded-full border border-line bg-surface px-4 py-2 text-[12px] font-medium text-ink"
          >
            {t("mobile.config")}
          </button>
        </div>
      )}

      {open && (
        <div
          data-sheet
          style={{ height: `${heightVh}vh` }}
          className={[
            "absolute inset-x-0 bottom-0 z-40 flex flex-col",
            "rounded-t-xl border-t border-line bg-surface shadow-[0_-8px_24px_rgba(31,42,34,0.12)]",
            drag.current ? "" : "transition-[height] duration-200 ease-out",
          ].join(" ")}
        >
          {/*
            Only this strip starts a drag. Pointer capture on the whole header
            would swallow the clicks meant for the tabs and the close button.
          */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="shrink-0 cursor-grab touch-none px-3 pb-1 pt-2 active:cursor-grabbing"
            role="separator"
            aria-label={t("mobile.resize")}
          >
            <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
          </div>

          <div className="flex shrink-0 items-center justify-between px-3 pb-2">
            <div className="flex gap-1">
              {tab("list", t("mobile.appliances"))}
              {tab("config", t("mobile.config"))}
            </div>
            <button
              type="button"
              onClick={() => setMobilePanel("none")}
              aria-label={t("mobile.close")}
              className="grid h-7 w-7 place-items-center rounded-full border border-line text-[13px] text-ink-muted"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line">
            {panel === "list" ? <LeftPanel /> : <RightPanel />}
          </div>
        </div>
      )}
    </div>
  );
}
