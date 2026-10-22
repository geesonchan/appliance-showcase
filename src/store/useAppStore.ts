import { create } from "zustand";
import {
  APPLIANCE_BY_ID,
  migrateBlower,
  migrateSelection,
} from "../data/catalogue";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID, PACKAGE_SHAPE, packageInShape, setPackage, slotsKeptPerShape } from "../data/packages";
import { setActivePackage, setFridgeModel, setHoodModel, setLayoutParams, setLayoutParamsGrowing, setRangeModel } from "../data/layoutState";
import { recordRangeModel } from "../data/cookingSurface";
import { recordFridgeModel } from "../data/fridgeMount";
import { recordHoodModel } from "../data/hoodMount";
import { oneWallWantedIn, paramLimitsFor } from "../data/layoutTemplate";
import type { LayoutShape } from "../data/layoutShape";
import { inchesSpoken } from "../data/inches";
import type { LayoutParams, Refusal } from "../data/layoutTemplate";
import { LAYOUT_ISSUES, REQUESTED_PARAMS } from "../data/room";
import type { Lang, Lighting, RenderMode, SlotId, UtilityType } from "../types";
import { readRails, readTab, writeRails, writeTab, type RightTab } from "./railState";
import {
  ACCENT_COLORS,
  ACCENT_RUNS,
  CABINET_COLORS,
  COUNTER_NAMES,
  FLOOR_NAMES,
  TILE_SIZES,
  WALL_FINISHES,
  paintFromName,
  type AccentRun,
  type CounterFinish,
  type FloorFinish,
  type TileSize,
  type Finishes,
} from "./finishes";
import { isShareLink } from "../data/linkVersion";
import type { WallFinish } from "../three/materials";

export interface ToastMessage {
  id: number;
  key: string;
  /**
   * Values for the message's placeholders, when it has any. A value whose name
   * ends in `Key` is itself a message key, translated before it is put in.
   */
  vars?: Record<string, string | number>;
  /** More than one sentence: shown in order, each a key and its values. */
  lines?: { key: string; vars?: Record<string, string | number> }[];
  /** What Undo puts back, when the toast offers it. */
  undo?: RoomSnapshot;
  /**
   * What the Undo button says: where it goes back to (round 98b-2) — the
   * package before, the room before, the shape before. Its words are Leo's
   * to give; until then each says "Undo".
   */
  undoLabel?: { key: string; vars?: Record<string, string | number> };
  /**
   * What a page opened from a share link could not show as the link had it,
   * one line each, or that the link could not be read at all. Stays until it
   * is closed, and offers no Undo: there was no room before it (D23).
   */
  notice?: NoticeLine[] | "unreadable";
}

/**
 * One thing a share link had that the page does not show as it was: a model
 * not in the catalogue, a model or blower that does not go in its place, or a
 * setting it could not use. `field` is the link field's name (shareLink.ts);
 * `from` is what the link had, `to` what is shown, each in that field's terms.
 */
export interface NoticeLine {
  kind: "catalogue" | "fit" | "setting";
  field: string;
  from?: string;
  to: unknown;
}

/** The room as it was before something changed it, for Undo. */
export interface RoomSnapshot {
  packageId: string;
  layoutParams: LayoutParams;
  selection: Record<SlotId, string>;
  blowerId: string | null;
}

interface AppState {
  lang: Lang;
  /**
   * The layout parameters as asked for, which is not always what is standing:
   * a combination the template refuses leaves the room alone and fills
   * `layoutIssues` instead. See docs/decisions.md D14.
   */
  layoutParams: LayoutParams;
  layoutIssues: Refusal[];
  /**
   * Bumped whenever the room actually changed. Everything derived from the
   * layout is a module value rather than state, so the pieces of the interface
   * that read it are keyed on this and rebuild when it moves.
   */
  layoutVersion: number;
  renderMode: RenderMode;
  lighting: Lighting;
  /** The finishes the room is shown in (finishes.ts; D12, D15). */
  finishes: Finishes;
  /**
   * Render quality. Dropped automatically when the frame rate will not hold,
   * which is the only thing allowed to change it besides ?quality= in the URL.
   */
  quality: Quality;
  /** Frames per second over the last second, for the ?debug=1 overlay. */
  fps: number;
  showCabinets: boolean;
  showLabels: boolean;
  /** Which utility layers are visible while in install mode. */
  visibleUtilities: Record<UtilityType, boolean>;
  /** The dimension lines, which are an install-mode layer of their own. */
  showDimensions: boolean;
  selectedSlot: SlotId | null;
  /** Which appliance fills each slot right now, by id. */
  /**
   * Which package the room is built to.
   *
   * It decides how wide every opening is, so it is upstream of the layout
   * rather than beside it: changing it regenerates the room. See D16.
   */
  packageId: string;
  selection: Record<SlotId, string>;
  /**
   * The blower specified with the hood, or null. A blower is an accessory
   * hanging off slot-hood rather than a slot of its own, so it lives beside the
   * selection instead of in it. See docs/decisions.md D6.
   */
  blowerId: string | null;
  /**
   * The L room as it stood when the shape was switched away from it, to put
   * back exactly when the shape comes back to the L (round 98b, Leo: "一字型切
   * 回 L 型：恢复客户原来在 L 型里的选择 … 房间和切换前一模一样"). Null in an L,
   * and after a package switch: the L kept is that package's.
   */
  lRoom: RoomSnapshot | null;
  /**
   * The model each shape last had in the openings that differ between shapes,
   * by package (round 98b-2, Leo: "开口不同的位置各记各的"). The openings that
   * are the same in both share the one selection and are not kept here.
   */
  shapePicks: Record<string, Partial<Record<LayoutShape, Partial<Record<SlotId, string>>>>>;
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
  /**
   * Which tab the right panel shows, and the phone sheet when it shows the
   * settings. Round 91 (railState.ts): Look by default, kept for the browser tab.
   */
  rightTab: RightTab;
  /**
   * The tab to go back to on leaving Install mode, when entering it jumped the
   * panel to Install; null when it did not, or when somebody chose a tab while
   * in Install, which then stays (Leo, round 91).
   */
  tabBeforeInstall: RightTab | null;
  toast: ToastMessage | null;
  /** Set when a render-mode switch starts, for the ?debug=1 overlay. */
  modeSwitchStartedAt: number | null;
  /** How long the last render-mode switch took to reach the screen, in ms. */
  modeSwitchMs: number | null;

  setLang: (lang: Lang) => void;
  setLayout: (patch: Partial<LayoutParams>) => void;
  setRenderMode: (mode: RenderMode) => void;
  setLighting: (lighting: Lighting) => void;
  setFinish: (patch: Partial<AppState["finishes"]>) => void;
  setQuality: (quality: Quality) => void;
  reportFps: (fps: number) => void;
  toggleCabinets: () => void;
  toggleLabels: () => void;
  toggleUtility: (type: UtilityType) => void;
  toggleDimensions: () => void;
  selectSlot: (slot: SlotId | null) => void;
  selectAppliance: (slot: SlotId, applianceId: string) => void;
  selectBlower: (blowerId: string | null) => void;
  setPackageId: (packageId: string) => void;
  /**
   * Change the layout's shape (round 98b). No control calls it yet — 98b-2
   * adds the switch — but a share link does. Returns the back wall when it
   * grew, for the switch to say so and offer Undo (D18).
   */
  setLayoutShape: (shape: LayoutShape) => { ok: boolean; grown: { fromIn: number; toIn: number } | null };
  resetView: () => void;
  requestZoom: (direction: 1 | -1) => void;
  setHelpOpen: (open: boolean) => void;
  setQuoteOpen: (open: boolean) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  openSpec: (slot: SlotId) => void;
  closeSpec: () => void;
  setMobilePanel: (panel: "none" | "list" | "config") => void;
  /** A tab chosen by somebody: it is kept, and it stays when Install mode ends. */
  setRightTab: (tab: RightTab) => void;
  showToast: (key: string, vars?: Record<string, string | number>) => void;
  dismissToast: () => void;
  /** Put back the room the current toast offers to undo. */
  undo: () => void;
  reportModeSwitch: (ms: number) => void;
}

let toastId = 0;

export type Quality = "high" | "low";
export {
  ACCENT_COLORS,
  CABINET_COLORS,
  TILE_SIZES,
  WALL_FINISHES,
  type AccentRun,
  type CounterFinish,
  type FloorFinish,
  type TileSize,
} from "./finishes";

/**
 * The finish a stretch of cabinetry is in, primary or accent.
 *
 * The one place that decides it. Anything drawn as cabinetry has to go through
 * here — the doors, the panels filling an appliance's opening, the front of a
 * panel-ready machine — because the alternative is what happened: a drawer
 * front under the microwave stayed the scheme's green while the room went navy,
 * for no reason except that it was written down somewhere else.
 */
export function cabinetPaint(
  finishes: { cabinet: string; accent: string; accentRun: AccentRun },
  run: "left" | "back" | "island",
) {
  const value = run === finishes.accentRun ? finishes.accent : finishes.cabinet;
  const token = cabinetToken(value);
  return { value, token, colour: token === "painted" ? value : undefined };
}

/** The finish token behind a swatch on either palette: paint, or the wood. */
export function cabinetToken(value: string) {
  return (
    [...CABINET_COLORS, ...ACCENT_COLORS].find((paint) => paint.value === value)?.token ??
    "painted"
  );
}

/**
 * The finishes the page opens in.
 *
 * From the query string, so a room in a particular set of finishes is a link:
 * `?cabinet=navy&counter=marble`. The screenshot runs need that, and so does
 * anybody sending a colleague the version they were looking at.
 */
function initialFinishes() {
  const defaults = {
    cabinet: CABINET_COLORS[0].value,
    accent: ACCENT_COLORS[0].value,
    accentRun: "none" as AccentRun,
    counter: "quartz-white" as CounterFinish,
    floor: "floor-oak" as FloorFinish,
    tileSize: "24x48" as TileSize,
    wall: "warm-grey" as WallFinish,
  };
  if (typeof window === "undefined") return defaults;

  const query = new URLSearchParams(window.location.search);
  // A share link is read whole by its own table, after the page has loaded
  // (round 94, openLink.ts); these older names are for screenshots.
  if (isShareLink(query)) return defaults;
  // A swatch by name, or a RAL number from the table: `?cabinet=ral6005`.
  return {
    cabinet: paintFromName(CABINET_COLORS, query.get("cabinet")) ?? defaults.cabinet,
    accent: paintFromName(ACCENT_COLORS, query.get("accent")) ?? defaults.accent,
    accentRun: ACCENT_RUNS.find((run) => run === query.get("accentRun")) ?? defaults.accentRun,
    counter: COUNTER_NAMES[query.get("counter") ?? ""] ?? defaults.counter,
    floor: FLOOR_NAMES[query.get("floor") ?? ""] ?? defaults.floor,
    tileSize: TILE_SIZES.find((size) => size === query.get("tile")) ?? defaults.tileSize,
    wall: WALL_FINISHES.find((paint) => paint === query.get("wall")) ?? defaults.wall,
  };
}

/** The room as it stands, for a toast to offer to put back. */
const snapshot = (state: {
  packageId: string;
  layoutParams: LayoutParams;
  selection: Record<SlotId, string>;
  blowerId: string | null;
}): RoomSnapshot => ({
  packageId: state.packageId,
  layoutParams: state.layoutParams,
  selection: state.selection,
  blowerId: state.blowerId,
});

/**
 * The hood, the cooking surface and the refrigerator a room is built round,
 * recorded for a package in a shape before the room is generated (round 98b):
 * the run stands under what is chosen (rounds 83, 87, 89).
 */
function recordModels(selection: Record<SlotId, string>, packageId: string, shape: LayoutShape) {
  recordHoodModel(APPLIANCE_BY_ID[selection["slot-hood"]], packageId, shape);
  recordRangeModel(packageId, APPLIANCE_BY_ID[selection["slot-range"]], shape);
  recordFridgeModel(APPLIANCE_BY_ID[selection["slot-fridge"]], packageId, shape);
}

/** The switches a room can grow for, each with the words for why. */
const GROW_REASONS = [
  "fridgeEndAbuts",
  "towerSide",
  "sinkLeg",
  "fridgeEnd",
  "coffeeLeg",
  "cornerType",
  "housingStyle",
  "hasIsland",
  "islandOrientation",
  "windows",
  "sinkUnderWindow",
] as const;

/** Why a wall grew, as a message key: the first switch in the change that has words. */
const growReasonKey = (patch: Partial<LayoutParams>) => {
  const key = GROW_REASONS.find((name) => name in patch);
  return key ? `toast.growReason.${key}` : "toast.growReason.other";
};

/**
 * Where quality starts.
 *
 * A phone starts low and is measured up rather than starting high and being
 * caught out: the first second of a hitching scene is the second somebody
 * decides the app is slow. `?quality=` overrides both, for screenshots.
 */
function initialQuality(): Quality {
  if (typeof window === "undefined") return "high";
  const asked = new URLSearchParams(window.location.search).get("quality");
  if (asked === "high" || asked === "low") return asked;
  return window.matchMedia("(max-width: 767px)").matches ? "low" : "high";
}

// The cabinet over a canopy stands on the chosen hood's own top (round 78), so
// the data layer is told which hood the page opens with before anything draws.
setHoodModel(APPLIANCE_BY_ID[migrateSelection(DEFAULT_PACKAGE)["slot-hood"]]);

export const useAppStore = create<AppState>((set, get) => ({
  lang: "en",
  layoutParams: REQUESTED_PARAMS,
  layoutIssues: LAYOUT_ISSUES,
  layoutVersion: 0,
  renderMode: "realistic",
  lighting: "day",
  finishes: initialFinishes(),
  quality: initialQuality(),
  fps: 0,
  showCabinets: true,
  showLabels: true,
  visibleUtilities: { gas: true, power: true, water: true, duct: true },
  showDimensions: true,
  selectedSlot: null,
  packageId: DEFAULT_PACKAGE.id,
  // Starts from the package's default and is the single source of truth from
  // then on; the scene, the summary and the utility layers all read it.
  selection: migrateSelection(DEFAULT_PACKAGE),
  blowerId: DEFAULT_PACKAGE.defaultBlower,
  lRoom: null,
  shapePicks: {},
  resetToken: 0,
  zoomRequest: { token: 0, direction: 1 },
  helpOpen: false,
  quoteOpen: false,
  specSlot: null,
  // The list closed and Configuration open, unless this tab has already been
  // told otherwise. See railState.ts and docs/decisions.md D12.
  ...readRails(),
  mobilePanel: "none",
  rightTab: readTab(),
  tabBeforeInstall: null,
  toast: null,
  modeSwitchStartedAt: null,
  modeSwitchMs: null,

  setLang: (lang) => set({ lang }),
  // The selection is keyed by slot id and the slot ids do not change with the
  // parameters, so which appliance is in which opening survives a rebuild
  // without being carried across.
  setLayout: (patch) => {
    const before = snapshot(get());
    const built = get().layoutIssues.length === 0;
    const asked = { ...before.layoutParams, ...patch };
    // One leg will not carry the sink and the refrigerator both, so moving one
    // onto the other's leg pushes that one across. Whichever was just asked
    // for wins; the other yields. Asking for the pair directly still refuses,
    // with the reason, which is what a link in the query string gets.
    if (asked.fridgeEnd === asked.sinkLeg) {
      const other = asked.sinkLeg === "back" ? "left" : "back";
      if (patch.fridgeEnd) asked.sinkLeg = other;
      else if (patch.sinkLeg) asked.fridgeEnd = other;
    }
    // A wall slider is somebody asking for that length, and a length that will
    // not build is refused on its own terms. Anything else that needs more wall
    // than the room has gets it, and says so. Round 34.
    const setsAWall = "backWallIn" in patch || "leftWallIn" in patch;
    const result = setsAWall
      ? { ...setLayoutParams(asked), params: asked, grown: [] }
      : setLayoutParamsGrowing(asked);
    set((s) => ({
      layoutParams: result.params,
      layoutIssues: result.reasons,
      layoutVersion: result.ok ? s.layoutVersion + 1 : s.layoutVersion,
      toast:
        result.grown.length > 0
          ? {
              id: ++toastId,
              key: "toast.wallGrew",
              lines: result.grown.map((growth) => ({
                key: "toast.wallGrew",
                vars: {
                  wallKey: growth.key === "backWallIn" ? "toast.wall.back" : "toast.wall.left",
                  fromIn: inchesSpoken(growth.fromIn),
                  toIn: inchesSpoken(growth.toIn),
                  reasonKey: growReasonKey(patch),
                },
              })),
              // Only a room that was standing can be gone back to.
              undo: built ? before : undefined,
              undoLabel: { key: "toast.undo.layout" },
            }
          : s.toast,
    }));
  },
  setRenderMode: (renderMode) => {
    const was = get().renderMode;
    if (was === renderMode) return;
    // Install mode brings the Install tab forward, and leaving it puts back
    // the tab that was showing — unless somebody chose a tab meanwhile, which
    // then stays (Leo, round 80's plan, decision 4, and round 91).
    const tabs =
      renderMode === "install"
        ? get().rightTab === "install"
          ? {}
          : { rightTab: "install" as const, tabBeforeInstall: get().rightTab }
        : was === "install" && get().tabBeforeInstall
          ? { rightTab: get().tabBeforeInstall!, tabBeforeInstall: null }
          : {};
    set({ renderMode, modeSwitchStartedAt: performance.now(), ...tabs });
    get().showToast(`mode.toast.${renderMode}`);
  },
  setLighting: (lighting) => set({ lighting }),
  setFinish: (patch) => set((s) => ({ finishes: { ...s.finishes, ...patch } })),
  setQuality: (quality) => set({ quality }),
  reportFps: (fps) => set({ fps }),
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
  selectAppliance: (slot, applianceId) => {
    if (slot === "slot-range") {
      // A rangetop stands on a base cabinet and a range on the floor (round
      // 83): changing one for the other changes what the run orders under it,
      // so the room is generated again where it stands. A range for a range
      // changes nothing in the run.
      const result = setRangeModel(APPLIANCE_BY_ID[applianceId], get().packageId);
      if (!result.ok) {
        set({ layoutIssues: result.reasons });
        return;
      }
      set((s) => ({
        selection: { ...s.selection, [slot]: applianceId },
        layoutVersion: result.rebuilt ? s.layoutVersion + 1 : s.layoutVersion,
      }));
      return;
    }
    if (slot === "slot-fridge") {
      // A built-in stands in an enclosure and a counter-depth machine among
      // rule 11's parts, each to its own height (round 89): changing one for
      // the other generates the room again where it stands.
      const result = setFridgeModel(APPLIANCE_BY_ID[applianceId], get().packageId);
      if (!result.ok) {
        set({ layoutIssues: result.reasons });
        return;
      }
      set((s) => ({
        selection: { ...s.selection, [slot]: applianceId },
        layoutVersion: result.rebuilt ? s.layoutVersion + 1 : s.layoutVersion,
      }));
      return;
    }
    if (slot !== "slot-hood") {
      set((s) => ({ selection: { ...s.selection, [slot]: applianceId } }));
      return;
    }
    // A different hood is a different cabinet over it (round 78): the carcass
    // is re-cut and the room redrawn. A hood that hangs differently — an
    // insert in a housing, a chimney with nothing over it — has the room
    // generated again where it stands (round 87). The camera and every other
    // choice stay as they are.
    const result = setHoodModel(APPLIANCE_BY_ID[applianceId], get().packageId);
    if (!result.ok) {
      set({ layoutIssues: result.reasons });
      return;
    }
    set((s) => ({
      selection: { ...s.selection, [slot]: applianceId },
      layoutVersion: s.layoutVersion + 1,
    }));
  },
  selectBlower: (blowerId) => set({ blowerId }),

  /**
   * Change the package the room is built to.
   *
   * The room is regenerated first, because a package that will not fit the
   * walls as they stand is refused and the switch does not happen — the same
   * bargain a refused slider makes. What was chosen carries across by slot id:
   * a dishwasher stays a dishwasher, and only a model that no longer fits the
   * opening falls back to the new package's own default.
   */
  setPackageId: (packageId) => {
    const entry = PACKAGE_BY_ID[packageId];
    if (!entry?.available) return;

    const before = snapshot(get());
    const built = get().layoutIssues.length === 0;
    const result = setActivePackage(packageId);
    if (!result.ok) {
      set({ layoutIssues: result.reasons });
      return;
    }
    set((s) => {
      // In the shape the room is in (round 98b): on one wall, each package as
      // that shape builds it.
      const shape = s.layoutParams.shape;
      const shaped = packageInShape(entry, shape);
      const selection = migrateSelection(shaped, s.selection, packageInShape(PACKAGE_BY_ID[s.packageId], shape));
      const hood = APPLIANCE_BY_ID[selection["slot-hood"]];
      setHoodModel(hood);
      // The range carried across installs the way the new slot does, so the
      // run already stands right under it; recorded so the package's next
      // rebuild reads the range on screen (round 83).
      if (selection["slot-range"]) setRangeModel(APPLIANCE_BY_ID[selection["slot-range"]], packageId);
      // And the refrigerator, which a switch carries across only when it is
      // built in the way the new slot is (round 89).
      if (selection["slot-fridge"]) setFridgeModel(APPLIANCE_BY_ID[selection["slot-fridge"]], packageId);
      return {
        packageId,
        selection,
        blowerId: migrateBlower(shaped, hood, s.blowerId),
        // The L kept is the package left's; a new package's L is its own.
        lRoom: null,
        // The room the package landed in, which is not always the one it was
        // offered. Leaving the panel's own copy on the old figures meant the
        // next thing the customer touched was judged against a room that no
        // longer existed, and refused.
        layoutParams: result.adjusted
          ? { ...s.layoutParams, ...result.adjusted }
          : s.layoutParams,
        layoutIssues: [],
        layoutVersion: s.layoutVersion + 1,
        selectedSlot: null,
        // A package that needed a longer wall got one. The room is the
        // customer's, so the change is announced rather than slipped in.
        // Only a wall that grew: the package's own arrangement moving the sink
        // to the other leg is not the room getting bigger (round 60).
        toast: result.grown
          ? {
              id: ++toastId,
              key: "toast.roomGrew",
              vars: {
                package: entry.name[s.lang] ?? entry.name.en,
                // To the tenth, the way every other figure on screen is
                // printed: the wall is 147-5/8" and nobody wants three
                // decimal places of it in a message.
                backIn: Number(REQUESTED_PARAMS.backWallIn.toFixed(1)),
                leftIn: Number(REQUESTED_PARAMS.leftWallIn.toFixed(1)),
              },
              undo: built ? before : undefined,
              undoLabel: {
                key: "toast.undo.package",
                vars: { package: PACKAGE_BY_ID[s.packageId]?.name[s.lang] ?? s.packageId },
              },
            }
          : // A toast that offers Undo is about the room before this switch —
            // "Package D needs a longer run", and Undo back to where D came
            // from — and is not true of the package now on screen. Anything
            // else, a mode hint, is left to finish.
            s.toast?.undo
            ? null
            : s.toast,
      };
    });
  },
  setLayoutShape: (shape) => {
    const s = get();
    const was = s.layoutParams.shape;
    if (shape === was) return { ok: true, grown: null };
    const before = snapshot(s);
    const written = PACKAGE_BY_ID[s.packageId];
    const from = packageInShape(written, was);
    const to = packageInShape(written, shape);

    // The models, by Leo's rule (round 98b-2): an opening that differs between
    // the shapes takes the model last chosen for it in the shape arrived in, or
    // that shape's own; an opening the same in both keeps the one choice,
    // wherever it was made. Package D on one wall: its three narrow columns and
    // MEM301WS; package E: HMCB36WS — and the L's back, coming back.
    const kept = slotsKeptPerShape(written, shape === "L" ? was : shape);
    const picksHere = Object.fromEntries(
      from.slots.filter((slot) => kept.includes(slot.slotId)).map((slot) => [slot.slotId, s.selection[slot.slotId]]),
    ) as Partial<Record<SlotId, string>>;
    const picks = { ...s.shapePicks, [s.packageId]: { ...s.shapePicks[s.packageId], [was]: picksHere } };
    const remembered = picks[s.packageId]?.[shape] ?? {};
    const selection = Object.fromEntries(
      to.slots.map((slot) => [
        slot.slotId,
        kept.includes(slot.slotId)
          ? (remembered[slot.slotId] ?? to.defaultSelection[slot.slotId]!)
          : (s.selection[slot.slotId] ?? to.defaultSelection[slot.slotId]!),
      ]),
    ) as Record<SlotId, string>;
    const hood = APPLIANCE_BY_ID[selection["slot-hood"]];
    recordModels(selection, s.packageId, shape);

    // Back to the L it left: exactly that room (Leo, round 98b: "房间和切换前一
    // 模一样"), with the models above.
    if (shape === "L" && s.lRoom?.packageId === s.packageId) {
      const back = s.lRoom;
      const result = setLayoutParams(back.layoutParams);
      if (!result.ok) {
        recordModels(s.selection, s.packageId, was);
        set({ layoutIssues: result.reasons });
        return { ok: false, grown: null };
      }
      set((now) => ({
        selection,
        blowerId: migrateBlower(to, hood, now.blowerId),
        layoutParams: back.layoutParams,
        layoutIssues: [],
        layoutVersion: now.layoutVersion + 1,
        selectedSlot: null,
        lRoom: null,
        shapePicks: picks,
      }));
      return { ok: true, grown: null };
    }
    // The wall the package needs in this shape, never shorter than it stands
    // (D18); the L's own ceiling where it comes back to an L it did not leave.
    const limits = paramLimitsFor(shape);
    const backWallIn =
      shape === "one-wall"
        ? Math.max(s.layoutParams.backWallIn, oneWallWantedIn(s.layoutParams, written))
        : Math.min(s.layoutParams.backWallIn, limits.backWallIn.max);
    const result = setLayoutParamsGrowing({ ...s.layoutParams, shape, backWallIn });
    if (!result.ok) {
      recordModels(s.selection, s.packageId, was);
      set({ layoutIssues: result.reasons });
      return { ok: false, grown: null };
    }
    const grew = result.params.backWallIn > s.layoutParams.backWallIn;
    const built = s.layoutIssues.length === 0;
    set((now) => ({
      selection,
      blowerId: migrateBlower(to, hood, now.blowerId),
      layoutParams: result.params,
      layoutIssues: [],
      layoutVersion: now.layoutVersion + 1,
      selectedSlot: null,
      lRoom: was === "L" ? before : now.lRoom,
      shapePicks: picks,
      // The wall grown for the shape is said, and can be undone, as a package
      // switch's is (Leo, round 98b: "形状切换用同一种提示"), in its own words:
      // one wall grows only its back wall (Leo, round 98b-2). Only one wall
      // grows a wall on the way in; the L comes back to the room it left.
      toast: grew
        ? {
            id: ++toastId,
            key: "toast.shapeGrew",
            vars: { backIn: Number(result.params.backWallIn.toFixed(1)) },
            undo: built ? before : undefined,
            undoLabel: { key: "toast.undo.shape" },
          }
        : now.toast?.undo
          ? null
          : now.toast,
    }));
    return { ok: true, grown: grew ? { fromIn: s.layoutParams.backWallIn, toIn: result.params.backWallIn } : null };
  },
  resetView: () => set((s) => ({ resetToken: s.resetToken + 1, selectedSlot: null })),
  requestZoom: (direction) =>
    set((s) => ({ zoomRequest: { token: s.zoomRequest.token + 1, direction } })),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setQuoteOpen: (quoteOpen) => set({ quoteOpen }),
  toggleLeft: () =>
    set((s) => {
      const rails = { leftOpen: !s.leftOpen, rightOpen: s.rightOpen };
      writeRails(rails);
      return rails;
    }),
  toggleRight: () =>
    set((s) => {
      const rails = { leftOpen: s.leftOpen, rightOpen: !s.rightOpen };
      writeRails(rails);
      return rails;
    }),
  openSpec: (specSlot) => set({ specSlot }),
  closeSpec: () => set({ specSlot: null }),
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
  setRightTab: (rightTab) => {
    writeTab(rightTab);
    set({ rightTab, tabBeforeInstall: null });
  },
  showToast: (key, vars) => set({ toast: { id: ++toastId, key, vars } }),
  dismissToast: () => set({ toast: null }),
  undo: () => {
    const back = get().toast?.undo;
    if (!back) return;
    // The package first, because it decides every opening the room is built
    // round; then the exact room and choices that were standing, which built
    // then and builds now.
    if (back.packageId !== get().packageId) setActivePackage(back.packageId);
    // In the shape the room put back was in (round 98b), so the choices below
    // are recorded for the package as that shape builds it.
    if (back.layoutParams.shape !== PACKAGE_SHAPE) setPackage(back.packageId, back.layoutParams.shape);
    setHoodModel(APPLIANCE_BY_ID[back.selection["slot-hood"]]);
    recordRangeModel(back.packageId, APPLIANCE_BY_ID[back.selection["slot-range"]]);
    recordFridgeModel(APPLIANCE_BY_ID[back.selection["slot-fridge"]], back.packageId);
    const result = setLayoutParams(back.layoutParams);
    set((s) => ({
      packageId: back.packageId,
      selection: back.selection,
      blowerId: back.blowerId,
      layoutParams: back.layoutParams,
      layoutIssues: result.reasons,
      layoutVersion: s.layoutVersion + 1,
      selectedSlot: null,
      toast: null,
      // Back in an L there is no other shape's room to keep (round 98b-2).
      lRoom: back.layoutParams.shape === "L" ? null : s.lRoom,
    }));
  },
  reportModeSwitch: (ms) => set({ modeSwitchMs: Math.round(ms), modeSwitchStartedAt: null }),
}));
