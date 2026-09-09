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
import { LAYOUT_POLICY } from "./layoutPolicy";

export const ft = (inches: number) => inches / 12;

/**
 * Room shell, in feet. A 14' x 12' kitchen by default, with an L-shaped run
 * against the -X and -Z walls; the room opens toward the camera at +X / +Z.
 *
 * `halfX` and `halfZ` are the two wall lengths, halved, and they are the one
 * pair of values here that a parameter changes — `setRoomSize` is called by
 * `applyLayout` so the shell, the camera framing and the plan all follow the
 * walls the layout was generated for. Everything else is true of every kitchen.
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

/** Set the room to the walls a layout was generated for, in inches. */
export function setRoomSize(backWallIn: number, leftWallIn: number) {
  ROOM.halfX = ft(backWallIn) / 2;
  ROOM.halfZ = ft(leftWallIn) / 2;
}

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
  // Nine, not twelve: a 9" base is a spice pull-out or a tray divider and
  // every line offers one. It is what a stretch too narrow for a door and too
  // wide for a filler actually gets built as — which is most of the counter
  // between a cooking surface and the oven tower beside it.
  widthIn: { min: 9, max: 36, step: 3 },
  upper: { depthIn: 12, heightsIn: [30, 36, 42], bottomAboveCounterIn: 18 },
  tall: { depthIn: 24, heightsIn: [84, 90, 96] },
  /** A lazy susan is a 36" square; a blind corner is 42" along one run. */
  corner: {
    lazySusanIn: 36,
    blindIn: 42,
  },
  /**
   * A run may finish short of the ceiling. Six inches is where a gap stops
   * reading as a scribe and starts reading as a mistake.
   */
  closingGapIn: { min: 0, max: 6 },
  /**
   * An L needs a short leg of at least 8ft and a long leg of 10-14ft.
   *
   * Fourteen, not twelve: Leo raised the cap for round 19. A single run of
   * 168" is a long wall but it is one somebody builds, and the twelve-foot
   * figure was what stopped a no-island kitchen from ever carrying the
   * microwave drawer and the wine cabinet on the refrigerator's leg.
   */
  legIn: { shortMin: 96, longMin: 120, longMax: 168 },
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

/**
 * The clearances D11 asks for, in inches.
 *
 * Here rather than in `layoutRules.ts` because the generator has to lay a run
 * out to them and the checker has to hold it to them, and two copies of "12"
 * would drift. They are Leo's numbers to change, and changing one here changes
 * both the room that is generated and the test that catches it.
 */
export const LAYOUT_LIMITS = {
  /** D11 rule 1: a tower is never hard against the corner cabinet. */
  cornerLandingIn: 12,
  /**
   * D11 rule 4: counter each side of the range, and the two are not equal.
   * From `layout.rangeLandingIn` in data/rules.json.
   */
  rangeLanding: LAYOUT_POLICY.rangeLandingIn,
  /** D11 rule 5: how far the dishwasher may sit from the sink. */
  dishwasherToSinkIn: LAYOUT_POLICY.dishwasherToSinkIn,
  /** D11 rule 6: counter on the refrigerator's door side. */
  fridgeLandingIn: 15,
  /**
   * D11 rule 12: what goes between a cooking surface and the oven tower.
   *
   * Open counter, and the tower's own side panel at the end of it. PCG366W
   * asks for 5" from the burners to a combustible surface, so that is the
   * least counter that may be there — and whatever the wall has spare goes
   * into it, because a working counter beside the burners is where you want
   * the slack rather than a wider cabinet somewhere else. What closes the
   * tower is a finished end panel, 3/4" of board from the floor to its top.
   */
  towerSpacer: { counterIn: 5, panelIn: 0.75 },
  /** D11 rule 7: the aisle a working kitchen needs, for the island. */
  aisleIn: 42,
  /**
   * What finishes a run, which is never the appliance itself. Against a wall a
   * filler, so a door has somewhere to swing; in the open a cabinet.
   */
  terminalIn: LAYOUT_POLICY.terminalIn,
  /**
   * D11 rule 10: the sink has counter on both sides — one of them a working
   * side, the other somewhere to stack — and stands clear of the corner
   * cabinet so its door still opens. The dishwasher counts as the wide side:
   * it is 24" of surface at counter height, which is what the rule is for.
   */
  sink: { ...LAYOUT_POLICY.sinkLandingIn, fromCornerIn: 15 },

  /**
   * D11 rule 11: what a refrigerator needs beside it.
   *
   * A door opens through more than the machine's own width. Against a standard
   * 24" cabinet the door sweeps past its front and the manufacturer's eighth of
   * an inch is the whole of it. Against a return wall the door fouls the wall
   * before it is open ninety degrees, and the drawers will not come out — so
   * three and a half inches of filler go in, and the install list says so.
   */
  fridge: {
    /** The manufacturer's minimum, either side. */
    sideGapIn: 0.125,
    /** Between the machine and a return wall, so the door opens 90 degrees. */
    fromWallIn: 3.5,
    /** A return this deep or more is a wall to a door, not a reveal. */
    wallReturnIn: 30,
    /** The optional stop that holds the door at ninety degrees. */
    doorStop: "10012733",
    /** The gap between the top of the machine and the cabinet over it. */
    aboveIn: 1,
  },
};

/** Thickness of a finished panel or a tower side. */
export const PANEL_IN = 3;
export const PANEL = ft(PANEL_IN);

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
  /**
   * A full-height appliance standing in the run with nothing built round it.
   *
   * A freestanding refrigerator at the end of a counter is not joinery: there
   * is no panel either side and no cabinet bridging over it. It still takes up
   * its width and still stops the wall cabinets, which is why it is a module
   * at all rather than a gap.
   */
  | "tall-open"
  /**
   * A finished end panel: the piece of cabinetry that closes the side of a
   * tall opening. Not a filler — a filler absorbs a remainder, and this is a
   * part with a width somebody chose.
   */
  | "panel"
  /**
   * The manufacturer's kit between two refrigeration columns standing side by
   * side: a 5/8" divider that carries the trim and keeps the two doors off
   * each other. Ordered by part number rather than cut to a width, which is
   * why it is not a panel — a 5/8" panel is not a part anybody stocks.
   */
  | "spacer"
  /**
   * The housing built round an insert liner: a chimney breast in the door
   * finish, from where the liner hangs to the ceiling. Not a wall cabinet —
   * nothing is stored in it, and its shape is three sections rather than a box.
   * See `insertHood.ts`.
   */
  | "hood-cabinet"
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
  /**
   * How far the box stands off the wall, where that is not the run's own depth.
   * A lazy susan is a 36" square and reaches into both legs; a blind corner is
   * a 42" box that is still only 24" deep, and drawing it square put a foot of
   * cabinet out into the floor.
   */
  depthIn?: number;
  /**
   * Finished panel each side of a tall unit's opening, in inches.
   *
   * A tower standing on its own is an opening with a panel each side of it and
   * a cabinet over the top — three inches, which is what a finished panel is.
   * A column in a bank has none: the bank has its own panels at its two ends
   * and the columns butt each other, so drawing three inches of cabinet inside
   * each one puts a green frame over the machine's own front.
   */
  insetIn?: number;
  /**
   * How far off the floor a tall unit's opening starts.
   *
   * Zero for a refrigerator, which stands on the floor of its opening; 18" for
   * an oven tower, which hangs in a hole with a drawer base under it. What is
   * below the sill and above the opening is cabinetry either way.
   */
  sillIn?: number;
  /**
   * Which shape a hood housing is built in, where the module is one.
   *
   * A parameter rather than a constant because it is a decision somebody makes
   * about their kitchen and not a figure off a drawing: the same liner goes up
   * inside either. See `insertHood.ts`.
   */
  housing?: HousingStyle;
  /** The appliance or fixture this module houses. */
  slot?: SlotId;
  fixture?: FixtureId;
}

/**
 * The two shapes a hood housing is built in.
 *
 * `box` is a straight breast from the liner to the top line, its front in one
 * plane, with a band along the bottom. `sweep` is the same band under a face
 * that curves up and in to a narrow flue. Both are joinery in the door finish
 * with a manufacturer's liner underneath; what differs is the face.
 */
export type HousingStyle = "box" | "sweep";

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


