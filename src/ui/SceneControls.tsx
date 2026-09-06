import { useEffect, useRef, useState } from "react";
import { SLOT_BY_ID } from "../data/slots";
import { APPLIANCE_BY_SLOT } from "../data/catalogue";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import type { RenderMode } from "../types";
import { IconButton, Segmented } from "./primitives";

/** The three render modes, floating over the top of the scene. */
export function ModeSwitch() {
  const t = useT();
  const renderMode = useAppStore((s) => s.renderMode);
  const setRenderMode = useAppStore((s) => s.setRenderMode);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-10 -translate-x-1/2">
      <Segmented<RenderMode>
        value={renderMode}
        onChange={setRenderMode}
        options={[
          { value: "realistic", label: t("mode.realistic") },
          { value: "white", label: t("mode.white") },
          { value: "install", label: t("mode.install") },
        ]}
      />
    </div>
  );
}

/** Compass rose. The scene never rotates about anything but Y, so north is fixed. */
function Compass() {
  const t = useT();
  return (
    <div className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-[9px] font-medium text-ink-muted">
      <span className="leading-none">{t("bottom.compass")}</span>
    </div>
  );
}

export function BottomBar() {
  const t = useT();
  const resetView = useAppStore((s) => s.resetView);
  const requestZoom = useAppStore((s) => s.requestZoom);
  const showToast = useAppStore((s) => s.showToast);
  // The mobile sheet covers the bottom of the screen; hide the toolbar under it
  // rather than leaving controls the user cannot reach.
  const sheetOpen = useAppStore((s) => s.mobilePanel !== "none");

  return (
    <div
      className={[
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex-col items-center gap-3 p-4",
        sheetOpen ? "hidden md:flex" : "flex",
      ].join(" ")}
    >
      <p className="hidden text-[11px] text-ink-muted sm:block">{t("scene.hint")}</p>
      <div className="pointer-events-auto flex w-full max-w-[720px] items-center justify-between gap-3 rounded-full border border-line bg-surface/95 px-3 py-2 backdrop-blur-sm">
        <div className="hidden md:block">
          <Segmented
            size="sm"
            value="3d"
            onChange={() => showToast("bottom.viewPlan.soon")}
            options={[
              { value: "3d", label: t("bottom.view3d") },
              {
                value: "plan",
                label: t("bottom.viewPlan"),
                disabled: true,
                title: t("bottom.viewPlan.soon"),
              },
            ]}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton label={t("bottom.zoomOut")} onClick={() => requestZoom(-1)}>
            <span className="text-[15px] leading-none">−</span>
          </IconButton>
          <IconButton label={t("bottom.zoomIn")} onClick={() => requestZoom(1)}>
            <span className="text-[15px] leading-none">+</span>
          </IconButton>
          <IconButton label={t("bottom.reset")} onClick={resetView}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M2 7a5 5 0 1 1 1.5 3.5M2 7V4m0 3h3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <div className="hidden sm:block">
            <Compass />
          </div>
        </div>

        <button
          type="button"
          onClick={() => showToast("bottom.quote.soon")}
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-[12px] font-medium text-[#F7F5EF] transition-opacity hover:opacity-90"
        >
          {t("bottom.quote")}
        </button>
      </div>
    </div>
  );
}

/**
 * The "View specs" affordance that appears at the lower right once the camera
 * has flown to an appliance, mirroring the reference product's "enter room".
 */
export function SelectionCallout() {
  const t = useT();
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const showToast = useAppStore((s) => s.showToast);
  if (!selectedSlot) return null;

  const slot = SLOT_BY_ID[selectedSlot];
  const appliance = APPLIANCE_BY_SLOT[selectedSlot];

  return (
    <div className="pointer-events-auto absolute bottom-32 right-4 z-20 w-56 rounded-md border border-line bg-surface p-4 md:bottom-24">
      <p className="tracking-label text-[9px] text-ink-muted">{t(slot.labelKey)}</p>
      {appliance && (
        <p className="mt-1 text-[13px] leading-snug text-ink">
          {appliance.brand} {appliance.model}
        </p>
      )}
      <button
        type="button"
        onClick={() => showToast("bottom.quote.soon")}
        className="mt-3 flex w-full items-center justify-between text-[12px] font-medium text-accent transition-opacity hover:opacity-80"
      >
        {t("scene.enter")}
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

/** Transient message shown on a render-mode switch, as in the reference. */
export function Toast() {
  const t = useT();
  const toast = useAppStore((s) => s.toast);
  const dismissToast = useAppStore((s) => s.dismissToast);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!toast) {
      setVisible(false);
      return;
    }
    setVisible(true);
    timers.current.push(window.setTimeout(() => setVisible(false), 3500));
    timers.current.push(window.setTimeout(() => dismissToast(), 3800));
    return () => timers.current.forEach(clearTimeout);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className={[
        "pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2",
        "rounded-full border border-line bg-ink px-4 py-2 text-[11px] text-[#F7F5EF]",
        "transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      {t(toast.key)}
    </div>
  );
}
