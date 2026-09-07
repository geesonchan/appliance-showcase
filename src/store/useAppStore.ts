import { create } from "zustand";
import { SCHEME } from "../data/catalogue";
import { setLayoutParams } from "../data/layoutState";
import type { LayoutParams } from "../data/layoutTemplate";
import { LAYOUT_ISSUES, REQUESTED_PARAMS } from "../data/room";
import type { Lang, Lighting, RenderMode, SlotId, UtilityType } from "../types";

export interface ToastMessage {
  id: number;
  key: string;
  /** Values for the message's placeholders, when it has any. */
  vars?: Record<string, string | number>;
}

interface AppState {
  lang: Lang;
  /**
   * The layout parameters as asked for, which is not always what is standing:
   * a combination the template refuses leaves the room alone and fills
   * `layoutIssues` instead. See docs/decisions.md D14.
   */
  layoutParams: LayoutParams;
  layoutIssues: string[];
  /**
   * Bumped whenever the room actually changed. Everything derived from the
   * layout is a module value rather than state, so the pieces of the interface
   * that read it are keyed on this and rebuild when it moves.
   */
  layoutVersion: number;
  renderMode: RenderMode;
  lighting: Lighting;
  showCabinets: boolean;
  showLabels: boolean;
  /** Which utility layers are visible while in install mode. */
  visibleUtilities: Record<UtilityType, boolean>;
  /** The dimension lines, which are an install-mode layer of their own. */
  showDimensions: boolean;
  selectedSlot: SlotId | null;
  /** Which appliance fills each slot right now, by id. */
  selection: Record<SlotId, string>;
  /**
   * The blower specified with the hood, or null. A blower is an accessory
   * hanging off slot-hood rather than a slot of its own, so it lives beside the
   * selection instead of in it. See docs/decisions.md D6.
   */
  blowerId: string | null;
  /** Bumped to ask the camera rig to return to the default isometric view. */
  resetToken: number;
  /** Bumped by the +/- buttons; positive steps in, negative steps out. */
  zoomRequest: { token: number; direction: 1 | -1 };
  helpOpen: boolean;
  quoteOpen: boolean;
  /**
   * The slot whose spec card is open. Separate from `selectedSlot`: selecting
   * flies the camera, opening the card does not move it.
   */
  specSlot: SlotId | null;
  /**
   * Which side columns are open at desktop widths. The scene is the product,
   * so it keeps the screen: the configuration rail starts closed and the
   * appliance list can be folded away too. See docs/decisions.md D12.
   */
  leftOpen: boolean;
  rightOpen: boolean;
  /** Mobile drawer state; ignored at desktop widths. */
  mobilePanel: "none" | "list" | "config";
  toast: ToastMessage | null;
  /** Set when a render-mode switch starts, for the ?debug=1 overlay. */
  modeSwitchStartedAt: number | null;
  /** How long the last render-mode switch took to reach the screen, in ms. */
  modeSwitchMs: number | null;

  setLang: (lang: Lang) => void;
  setLayout: (patch: Partial<LayoutParams>) => void;
  setRenderMode: (mode: RenderMode) => void;
  setLighting: (lighting: Lighting) => void;
  toggleCabinets: () => void;
  toggleLabels: () => void;
  toggleUtility: (type: UtilityType) => void;
  toggleDimensions: () => void;
  selectSlot: (slot: SlotId | null) => void;
  selectAppliance: (slot: SlotId, applianceId: string) => void;
  selectBlower: (blowerId: string | null) => void;
  resetView: () => void;
  requestZoom: (direction: 1 | -1) => void;
  setHelpOpen: (open: boolean) => void;
  setQuoteOpen: (open: boolean) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  openSpec: (slot: SlotId) => void;
  closeSpec: () => void;
  setMobilePanel: (panel: "none" | "list" | "config") => void;
  showToast: (key: string, vars?: Record<string, string | number>) => void;
  dismissToast: () => void;
  reportModeSwitch: (ms: number) => void;
}

let toastId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  lang: "en",
  layoutParams: REQUESTED_PARAMS,
  layoutIssues: LAYOUT_ISSUES,
  layoutVersion: 0,
  renderMode: "realistic",
  lighting: "day",
  showCabinets: true,
  showLabels: true,
  visibleUtilities: { gas: true, power: true, water: true, duct: true },
  showDimensions: true,
  selectedSlot: null,
  // Starts from the scheme's default and is the single source of truth from
  // then on; the scene, the summary and the utility layers all read it.
  selection: { ...SCHEME.defaultSelection } as Record<SlotId, string>,
  blowerId: SCHEME.defaultBlower,
  resetToken: 0,
  zoomRequest: { token: 0, direction: 1 },
  helpOpen: false,
  quoteOpen: false,
  specSlot: null,
  leftOpen: true,
  rightOpen: false,
  mobilePanel: "none",
  toast: null,
  modeSwitchStartedAt: null,
  modeSwitchMs: null,

  setLang: (lang) => set({ lang }),
  // The selection is keyed by slot id and the slot ids do not change with the
  // parameters, so which appliance is in which opening survives a rebuild
  // without being carried across.
  setLayout: (patch) => {
    const layoutParams = { ...get().layoutParams, ...patch };
    const result = setLayoutParams(layoutParams);
    set((s) => ({
      layoutParams,
      layoutIssues: result.reasons,
      layoutVersion: result.ok ? s.layoutVersion + 1 : s.layoutVersion,
    }));
  },
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
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
  // The mobile sheet is half height, so selecting an appliance leaves it open;
  // the fly-in happens in the half of the screen the sheet does not cover.
  selectSlot: (selectedSlot) => set({ selectedSlot }),
  selectAppliance: (slot, applianceId) =>
    set((s) => ({ selection: { ...s.selection, [slot]: applianceId } })),
  selectBlower: (blowerId) => set({ blowerId }),
  resetView: () => set((s) => ({ resetToken: s.resetToken + 1, selectedSlot: null })),
  requestZoom: (direction) =>
    set((s) => ({ zoomRequest: { token: s.zoomRequest.token + 1, direction } })),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setQuoteOpen: (quoteOpen) => set({ quoteOpen }),
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  openSpec: (specSlot) => set({ specSlot }),
  closeSpec: () => set({ specSlot: null }),
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
  showToast: (key, vars) => set({ toast: { id: ++toastId, key, vars } }),
  dismissToast: () => set({ toast: null }),
  reportModeSwitch: (ms) => set({ modeSwitchMs: Math.round(ms), modeSwitchStartedAt: null }),
}));
