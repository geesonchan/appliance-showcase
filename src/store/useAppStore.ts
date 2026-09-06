import { create } from "zustand";
import { SCHEME } from "../data/catalogue";
import type { Lang, Lighting, RenderMode, SlotId, UtilityType } from "../types";

export interface ToastMessage {
  id: number;
  key: string;
}

interface AppState {
  lang: Lang;
  renderMode: RenderMode;
  lighting: Lighting;
  showCabinets: boolean;
  showLabels: boolean;
  /** Which utility layers are visible while in install mode. */
  visibleUtilities: Record<UtilityType, boolean>;
  selectedSlot: SlotId | null;
  /** Which appliance fills each slot right now, by id. */
  selection: Record<SlotId, string>;
  /** Bumped to ask the camera rig to return to the default isometric view. */
  resetToken: number;
  /** Bumped by the +/- buttons; positive steps in, negative steps out. */
  zoomRequest: { token: number; direction: 1 | -1 };
  helpOpen: boolean;
  /** Mobile drawer state; ignored at desktop widths. */
  mobilePanel: "none" | "list" | "config";
  toast: ToastMessage | null;
  /** Set when a render-mode switch starts, for the ?debug=1 overlay. */
  modeSwitchStartedAt: number | null;
  /** How long the last render-mode switch took to reach the screen, in ms. */
  modeSwitchMs: number | null;

  setLang: (lang: Lang) => void;
  setRenderMode: (mode: RenderMode) => void;
  setLighting: (lighting: Lighting) => void;
  toggleCabinets: () => void;
  toggleLabels: () => void;
  toggleUtility: (type: UtilityType) => void;
  selectSlot: (slot: SlotId | null) => void;
  selectAppliance: (slot: SlotId, applianceId: string) => void;
  resetView: () => void;
  requestZoom: (direction: 1 | -1) => void;
  setHelpOpen: (open: boolean) => void;
  setMobilePanel: (panel: "none" | "list" | "config") => void;
  showToast: (key: string) => void;
  dismissToast: () => void;
  reportModeSwitch: (ms: number) => void;
}

let toastId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  lang: "en",
  renderMode: "realistic",
  lighting: "day",
  showCabinets: true,
  showLabels: true,
  visibleUtilities: { gas: true, power: true, water: true, duct: true },
  selectedSlot: null,
  // Starts from the scheme's default and is the single source of truth from
  // then on; the scene, the summary and the utility layers all read it.
  selection: { ...SCHEME.defaultSelection } as Record<SlotId, string>,
  resetToken: 0,
  zoomRequest: { token: 0, direction: 1 },
  helpOpen: false,
  mobilePanel: "none",
  toast: null,
  modeSwitchStartedAt: null,
  modeSwitchMs: null,

  setLang: (lang) => set({ lang }),
  setRenderMode: (renderMode) => {
    if (get().renderMode === renderMode) return;
    set({ renderMode, modeSwitchStartedAt: performance.now() });
    get().showToast(`mode.toast.${renderMode}`);
  },
  setLighting: (lighting) => set({ lighting }),
  toggleCabinets: () => set((s) => ({ showCabinets: !s.showCabinets })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleUtility: (type) =>
    set((s) => ({
      visibleUtilities: { ...s.visibleUtilities, [type]: !s.visibleUtilities[type] },
    })),
  // The mobile sheet is half height, so selecting an appliance leaves it open;
  // the fly-in happens in the half of the screen the sheet does not cover.
  selectSlot: (selectedSlot) => set({ selectedSlot }),
  selectAppliance: (slot, applianceId) =>
    set((s) => ({ selection: { ...s.selection, [slot]: applianceId } })),
  resetView: () => set((s) => ({ resetToken: s.resetToken + 1, selectedSlot: null })),
  requestZoom: (direction) =>
    set((s) => ({ zoomRequest: { token: s.zoomRequest.token + 1, direction } })),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
  showToast: (key) => set({ toast: { id: ++toastId, key } }),
  dismissToast: () => set({ toast: null }),
  reportModeSwitch: (ms) => set({ modeSwitchMs: Math.round(ms), modeSwitchStartedAt: null }),
}));
