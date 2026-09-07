import type { FixtureId, SlotId } from "../types";

/**
 * The room's fixed dimensions and the vocabulary a layout is written in.
 *
 * Everything here is true of every layout: the shell, the trade's standards,
 * and the shapes a run is made of. What varies with the parameters — which
 * cabinets, where the appliances land — is generated in `layoutTemplate.ts` and
 * instantiated in `room.ts`.
 */

/**
 * Scene units are feet. Appliance and cabinet dimensions in the brief are
 * inches, so everything crossing that boundary goes through `ft()`.
 */
export const ft = (inches: number) => inches / 12;

/**
 * Room shell, in feet. A 14' x 12' kitchen with an L-shaped run against the
 * -X and -Z walls; the room opens toward the camera at +X / +Z.
 *
 * The depth is set by the island rather than by taste: a 24" run plus a 36"
 * island plus the 42" aisles either side of it is what a working kitchen needs,
 * and anything shallower puts the island within arm's reach of the range.
 */
export const ROOM = {
  halfX: 7,
  halfZ: 6,
  wallHeight: 8,
  /** Finished counter height: a 34.5" base box under a 1.5" top. */
  counterHeight: ft(36),
  counterThickness: ft(1.5),
  counterDepth: ft(24),
  counterOverhang: ft(1),
  /** Wall cabinets: 12" deep, 42" tall, hung 18" above the counter. */
  upperDepth: ft(12),
  upperBottom: ft(54),
  upperTop: ft(96),
  /** Tall cabinets are 24" deep and run to the same 96" as the uppers. */
  tallTop: ft(96),
  toeKick: ft(4),
};

/**
 * The dimensions a North American kitchen is actually built to.
 *
 * Written as inches because that is how the trade states them, and kept apart
 * from ROOM because these are the constraints — the numbers a layout is checked
 * against — while ROOM is this particular room. See docs/decisions.md D13.
 */
export const CABINET_STANDARDS = {
  base: { depthIn: 24, boxHeightIn: 34.5, counterHeightIn: 36 },
  /** Cabinet widths come in 3" increments between 12" and 36". */
  widthIn: { min: 12, max: 36, step: 3 },
  upper: { depthIn: 12, heightsIn: [30, 36, 42], bottomAboveCounterIn: 18 },
  tall: { depthIn: 24, heightsIn: [84, 90, 96] },
  /** A lazy susan is a 36" square; a blind corner is 42" along one run. */
  corner: { lazySusanIn: 36, blindIn: 42 },
  /**
   * A run may finish short of the ceiling. Six inches is where a gap stops
   * reading as a scribe and starts reading as a mistake.
   */
  closingGapIn: { min: 0, max: 6 },
  /** An L needs a short leg of at least 8ft and a long leg of 10-12ft. */
  legIn: { shortMin: 96, longMin: 120, longMax: 144 },
  /**
   * Ventilation, from the Thermador clearance sheet
   * (docs/reference/thermador-hood-clearance.png).
   */
  hood: {
    bodyHeightIn: 18,
    /** Canopy bottom above the cooking surface. Gas sets the 30" minimum. */
    aboveCooktopMinIn: 30,
    aboveCooktopMaxIn: 40,
    /** The duct collar sits this far above the canopy top. */
    outletAboveBodyIn: 8.375,
    /**
     * The rectangular opening in the top of the canopy, and how far its centre
     * sits from the wall. This is what the cabinet above has to be cut for.
     */
    outlet: { widthIn: 8.8125, depthIn: 6.8125, fromWallIn: 6 },
  },
};

/** Thickness of a finished panel or a tower side, in feet. */
export const PANEL = ft(3);

/**
 * What a stretch of a cabinet run is for.
 *
 * `corner` is the L itself — a lazy susan or a blind corner, never an appliance.
 * `tall` is a full-height enclosure. `appliance` and `fixture` are openings the
 * carcass leaves for something to sit in. `counter` is plain base cabinetry.
 */
export type SegmentKind = "corner" | "counter" | "appliance" | "tall" | "fixture";

/**
 * One cabinet, as it would be ordered.
 *
 * A run is built out of these and nothing else, the way a kitchen actually is:
 * boxes off a size list, fillers absorbing the remainder, and the widths adding
 * up to the wall exactly. `docs/reference/cabinet-modules.md` has the size lists
 * and where they come from.
 */
export type ModuleKind =
  | "base"
  | "drawer-base"
  | "sink-base"
  | "wall"
  | "bridge"
  | "tall"
  | "corner"
  | "filler"
  | "opening";

export interface CabinetModule {
  /** The trade code: B24, SB30, DB18, LS36, W3042, T4296, BF3, RO36. */
  code: string;
  kind: ModuleKind;
  widthIn: number;
  /** Present where the height is part of the code — wall and tall boxes. */
  heightIn?: number;
  /** The appliance or fixture this module houses. */
  slot?: SlotId;
  fixture?: FixtureId;
}

export interface RunSegment {
  id: string;
  kind: SegmentKind;
  /** Extent along the run's axis, in feet. */
  from: number;
  to: number;
  slot?: SlotId;
  fixture?: FixtureId;
  /**
   * The cabinets this segment is built from, in order. Their widths have to
   * add up to the segment exactly; `checkLayout` says by how much they miss.
   */
  modules: CabinetModule[];
}

/** A stretch of wall cabinets, which have their own widths and heights. */
export interface UpperBank {
  id: string;
  from: number;
  to: number;
  /**
   * Bottom and top above the floor, in feet. Absent on the bank over a hood,
   * whose floor is the canopy's top and therefore moves with the range: see
   * `hoodBridgeBand` in cabinets.ts.
   */
  band?: readonly [number, number];
  modules: CabinetModule[];
}

export interface CabinetRun {
  id: "back" | "left";
  /** The axis this run travels along. */
  axis: "x" | "z";
  /** The run's centre line on the other horizontal axis, in feet. */
  centre: number;
  /**
   * Segments in order, starting at the corner. "End of the run" therefore
   * means the last entry, which is what rule 1 is about.
   */
  segments: RunSegment[];
  uppers: UpperBank[];
}


