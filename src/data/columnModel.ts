import { ROOM, ft } from "./roomShell";
import type { Appliance } from "../types";

/**
 * The two machines that stand in a tall bank: a combination oven and a wine
 * column.
 *
 * Both are fronts rather than bodies. What a customer sees of either is the
 * face — two glass doors on the oven, one tall glass door in a cabinet-finish
 * frame on the column — and where the lines across that face fall is the whole
 * of what tells them apart from the cabinet beside them. So the divisions are
 * worked out here, where they can be checked against a drawing, and
 * `ApplianceModel` draws what it is handed. Same split as `rangeModel.ts`.
 */

/**
 * How a 30" combination oven divides, in inches up its own front.
 *
 * From the MEM301WS elevation in docs/reference/mem301ws-manual.png: an oven
 * door at the bottom, a microwave door over it, and the control panel across
 * the top. Each door carries a bar handle, and where those two bars land is
 * the whole of what makes this machine reachable or not — so they are figures
 * off the drawing rather than fractions of the envelope, and the tower's sill
 * is set from them rather than the other way round.
 *
 * They are measured from the machine's own bottom. Add the sill it hangs at to
 * get the height a person reaches to.
 */
export const COMBO_OVEN = {
  /** The microwave door's handle: the one a person uses most. */
  microwaveHandleIn: 39,
  /** The lower oven's. */
  ovenHandleIn: 22,
  /** Where the microwave door starts, and the oven door stops. */
  microwaveSillIn: 26,
  /** The control panel across the top, above both doors. */
  controlIn: 8,
  /**
   * How far off the floor the opening may start, from the drawing.
   *
   * The tower is built to put the microwave's handle where a person's hand is,
   * and this is the room the drawing leaves to do it in: 4-3/4" to 18".
   */
  sillIn: { min: 4.75, max: 18 },
  /** A reveal between the two doors, and around each of them. */
  revealIn: 0.25,
  /** The handle: a bar across the top of each door, standing 2-3/8" proud. */
  handleDiameterIn: 1.25,
  handleProudIn: 2.375,
  handleFraction: 0.9,
  /** The glass field inside the stainless frame of each door. */
  glassInsetIn: 2,
  /**
   * How far the lower oven's door reaches into the room, fully open.
   *
   * From the elevation in docs/reference/mem301ws-manual.png. The aisle rule
   * covers it and the install list says it anyway: a plan cannot show a door
   * that is shut, and this one opens where the cook stands.
   */
  doorReachIn: 26.625,
};

/**
 * The stainless door panels Thermador sells for an 18" column.
 *
 * A column is sold panel-ready: what goes on the front is somebody's decision,
 * and it is either a door the joiner makes or one of these two. Which of them
 * is on this kitchen is the row's own finish — a panel-ready row wears the
 * cabinet's door, a stainless one wears the manufacturer's — so nothing here
 * decides it; this is only what to order when it is the second.
 */
export const COLUMN_DOOR_PANELS = {
  handleless: "TFL18IW105",
  handleReady: "TFL18IW10R",
} as const;

/**
 * How an 18" wine column's door divides, in inches.
 *
 * From the T18IW905SP panel drawing, which is the family's: a 17-3/4" x
 * 79-7/8" door standing 4" off the floor, with a window in the middle of it —
 * 10-1/8" of solid at the top and the bottom, and 3-3/4" of solid down each
 * side. What is left is about 10-1/4" x 59-5/8" of glass, and that is where
 * the bottles show.
 *
 * The side inset is the one figure with any give in it: the drawing calls it
 * variable between 2-1/2" and 3-3/4", which is the range a panel is cut to.
 * The solid parts are the same material as the door itself — steel where the
 * machine is sold with a steel panel, the kitchen's own door where it is
 * panel-ready.
 */
export const WINE_COLUMN = {
  doorHeightIn: 79.875,
  doorWidthIn: 17.75,
  /** Solid at the top and at the bottom of the door. */
  panelIn: 10.125,
  /** Solid down each side of the window; 2-1/2" to 3-3/4" on the drawing. */
  glassInsetIn: 3.75,
  glassInsetRangeIn: { min: 2.5, max: 3.75 },
  /**
   * The door's own bottom, off the floor.
   *
   * What is under it is not the cabinetmaker's plinth: a column stands on its
   * own grille, the same steel as the door with air getting through it, and it
   * is the same detail as the refrigerator's four inches beside it. Drawing a
   * dark recess there put a painted kick under one machine and a steel one
   * under the other, on two doors hung in the same run.
   */
  toeIn: 4,
  /** Slots across that grille, as the refrigerator's has. */
  vents: 4,
  /** The handle, which is the refrigerator's: a vertical tube on two brackets. */
  handleDiameterIn: 1.25,
  handleProudIn: 2.375,
  /** How much of the glass the shelves show through. */
  shelves: 6,
  /** The reveal round the door inside its opening. */
  revealIn: 0.125,
};

export interface ColumnDoor {
  /** Bottom and top of the part, in feet above the machine's own floor. */
  band: readonly [number, number];
  kind: "glass" | "panel" | "grille";
  /** Slots across it, where it is the grille the machine stands on. */
  vents?: { count: number; heightFt: number };
}

export interface WineColumnParts {
  /** The door panel: the whole face, in the machine's own finish. */
  door: { h: number; w: number; y: number };
  /** The three bands of that face, bottom to top. */
  parts: ColumnDoor[];
  /** The window in it, centred: half-width and the band it spans. */
  glass: { w: number; band: readonly [number, number] };
  /** Where the shelves show through the glass, in feet. */
  shelves: number[];
  /** Which side the hinge is on: -1 for the left, 1 for the right. */
  hinge: -1 | 1;
  handle: { r: number; proud: number; h: number };
}

/**
 * A wine column's face, given the envelope it is drawn in.
 *
 * The hinge side is the caller's: in a bank it is the side away from the
 * refrigerator, so the two doors open back to back rather than into each
 * other. Everything else is the drawing's.
 */
export function wineColumnParts(
  box: { w: number; h: number; d: number },
  hinge: -1 | 1 = 1,
): WineColumnParts {
  const W = WINE_COLUMN;
  const doorH = Math.min(ft(W.doorHeightIn), box.h);
  // The drawing's 17-3/4" on an 18" column, and on a wider one its own width
  // less a reveal each side — 23-3/4" on a 24" column. Taking the 18" door as
  // every column's door put a 24" column's case in view either side of it.
  const doorW = Math.min(box.w, Math.max(ft(W.doorWidthIn), box.w - ft(W.revealIn * 2)));
  // Four inches off the floor, which is the grille under it — not centred in
  // the opening. The refrigerator beside it starts its own fronts at the same
  // four, whatever the grille behind them is, so the two doors are on one
  // line. What is above the door is the machine's own top rail.
  const toe = ft(W.toeIn);
  const y = Math.min(toe, Math.max(0, box.h - doorH));

  const band = ft(W.panelIn);
  const glassBand: readonly [number, number] = [y + band, y + doorH - band];
  const glassW = Math.max(0, doorW - ft(W.glassInsetIn) * 2);

  const shelves: number[] = [];
  const span = glassBand[1] - glassBand[0];
  for (let i = 1; i <= W.shelves; i += 1) {
    shelves.push(glassBand[0] + (span * i) / (W.shelves + 1));
  }

  return {
    door: { h: doorH, w: doorW, y },
    parts: [
      // The grille the machine stands on, where the door starts off the floor.
      // Same steel as the door, and the front of the machine is therefore one
      // piece from the floor to the top of it.
      ...(y > 0
        ? [
            {
              band: [0, y] as const,
              kind: "grille" as const,
              vents: { count: W.vents, heightFt: Math.min(ft(0.125), y / 8) },
            },
          ]
        : []),
      { band: [y, y + band] as const, kind: "panel" },
      { band: glassBand, kind: "glass" },
      { band: [y + doorH - band, y + doorH] as const, kind: "panel" },
    ],
    glass: { w: glassW, band: glassBand },
    shelves,
    hinge,
    handle: {
      r: ft(W.handleDiameterIn) / 2,
      proud: ft(W.handleProudIn),
      h: span * 0.6,
    },
  };
}

/**
 * Package D's steam oven: a double oven, steam over convection.
 *
 * It has no microwave, so the reach rule the combination oven is hung from does
 * not apply, and nothing is worked backwards from a handle. Under it is what
 * is under any base cabinet — the 4" toe kick — and one shallow drawer, and the
 * opening starts on top of that drawer. Leo, round 31: the machine is tall
 * enough that a second drawer, or a door, down there is cabinet nobody uses.
 *
 * The drawer is 8" so that the sill lands on the 3" step D13 builds to:
 * 4 + 8 = 12". Leo asked for an 8"-10" drawer and a 12"-14" sill, and 12" is
 * the only step in that band. Figures up the machine are measured from its own
 * bottom, like the combination oven's.
 */
export const STEAM_OVEN = {
  /** Where the lower door's bar sits, up the machine's own front. */
  lowerHandleIn: 22,
  /** The one drawer front between the toe kick and the opening. */
  drawerFrontIn: 8,
  /** Where the lower door stops and the steam oven's door starts. */
  splitIn: 23.75,
  /** The control strip across the top. */
  controlIn: 4.5,
  /** The upper door's bar, down from its own top. */
  upperHandleDropIn: 1.75,
};

/** The toe kick and one drawer: 4 + 8 = 12". */
export const steamOvenSillIn = () =>
  Math.round((ROOM.toeKick * 12 + STEAM_OVEN.drawerFrontIn) * 8) / 8;

/** True when this machine is a double oven. */
export const isDouble = (appliance: Appliance) => appliance.installType.includes("double");

/**
 * A double oven's front, given the envelope it is drawn in: the convection
 * oven's door at the bottom with its bar where the handle figure puts it, the
 * steam oven's over it, and the control strip across the top. Same parts as a
 * combination oven, so the same component draws both.
 */
export function doubleOvenParts(box: { w: number; h: number }): ComboOvenParts {
  const S = STEAM_OVEN;
  const reveal = ft(COMBO_OVEN.revealIn);
  const split = Math.min(ft(S.splitIn), box.h / 2);
  const controlFloor = box.h - ft(S.controlIn);
  return {
    doors: [
      { band: [0, split - reveal] as const, kind: "oven", handleAt: ft(S.lowerHandleIn) },
      {
        band: [split, controlFloor - reveal] as const,
        kind: "steam",
        handleAt: controlFloor - reveal - ft(S.upperHandleDropIn),
      },
      { band: [controlFloor, box.h] as const, kind: "control", handleAt: null },
    ],
    handle: {
      r: ft(COMBO_OVEN.handleDiameterIn) / 2,
      proud: ft(COMBO_OVEN.handleProudIn),
      width: box.w * COMBO_OVEN.handleFraction,
    },
    glassInset: ft(COMBO_OVEN.glassInsetIn),
  };
}

/**
 * A built-in coffee machine's front, in inches up and across it.
 *
 * From the TCM24PS product elevation: a steel face with a display strip across
 * the top, and the dispensing niche in the lower middle — the recess a cup
 * stands in, with the spout at the top of it and the drip grate at the bottom.
 * The niche is what makes it read as a coffee machine rather than a small oven,
 * so it is the part drawn with any care.
 */
export const COFFEE_MACHINE = {
  displayIn: 2.75,
  displayWidthIn: 12,
  nicheWidthIn: 9.5,
  nicheHeightIn: 9.25,
  nicheFromBottomIn: 1.25,
  nicheDepthIn: 3,
  spoutWidthIn: 3.5,
  spoutHeightIn: 1.5,
  grateHeightIn: 0.5,
};

export interface CoffeeParts {
  display: { w: number; h: number; y: number };
  niche: { w: number; h: number; y: number; depth: number };
  spout: { w: number; h: number; y: number };
  grate: { w: number; h: number; y: number };
}

/** The coffee machine's face, fitted to the envelope it is drawn in. */
export function coffeeParts(box: { w: number; h: number }): CoffeeParts {
  const C = COFFEE_MACHINE;
  const nicheH = Math.min(ft(C.nicheHeightIn), box.h * 0.6);
  const nicheY = ft(C.nicheFromBottomIn) + nicheH / 2;
  const displayH = Math.min(ft(C.displayIn), box.h * 0.2);
  return {
    display: {
      w: Math.min(ft(C.displayWidthIn), box.w * 0.6),
      h: displayH,
      y: box.h - displayH / 2 - ft(1),
    },
    niche: { w: Math.min(ft(C.nicheWidthIn), box.w * 0.5), h: nicheH, y: nicheY, depth: ft(C.nicheDepthIn) },
    spout: {
      w: ft(C.spoutWidthIn),
      h: ft(C.spoutHeightIn),
      y: nicheY + nicheH / 2 - ft(C.spoutHeightIn) / 2,
    },
    grate: { w: Math.min(ft(C.nicheWidthIn), box.w * 0.5), h: ft(C.grateHeightIn), y: nicheY - nicheH / 2 + ft(C.grateHeightIn) / 2 },
  };
}

export interface ComboOvenParts {
  /** The two doors and the control panel, bottom to top. */
  doors: {
    band: readonly [number, number];
    kind: "oven" | "microwave" | "steam" | "control";
    /** Where the bar sits on it, or null for the control panel. */
    handleAt: number | null;
  }[];
  handle: { r: number; proud: number; width: number };
  glassInset: number;
}

/**
 * A combination oven's front, given the envelope it is drawn in.
 *
 * The bands are the drawing's, scaled if the envelope is not the 49" the
 * figures were read at — a taller machine in the same family divides the same
 * way. The handles are where the drawing puts them, because the whole point of
 * the tower's sill is to land the top one at a person's chest.
 */
export function comboOvenParts(box: { w: number; h: number }): ComboOvenParts {
  const C = COMBO_OVEN;
  const reveal = ft(C.revealIn);
  // The elevation the figures came off. Anything else in the family is the
  // same front at a different size.
  const drawn = ft(49);
  const at = (inches: number) => (ft(inches) / drawn) * box.h;

  const microwaveSill = at(C.microwaveSillIn);
  const controlFloor = box.h - at(C.controlIn);

  return {
    doors: [
      { band: [0, microwaveSill - reveal] as const, kind: "oven", handleAt: at(C.ovenHandleIn) },
      {
        band: [microwaveSill, controlFloor - reveal] as const,
        kind: "microwave",
        handleAt: at(C.microwaveHandleIn),
      },
      { band: [controlFloor, box.h] as const, kind: "control", handleAt: null },
    ],
    handle: {
      r: ft(C.handleDiameterIn) / 2,
      proud: ft(C.handleProudIn),
      width: box.w * C.handleFraction,
    },
    glassInset: ft(C.glassInsetIn),
  };
}

/**
 * Where the opening starts, to put the microwave's handle at a given height.
 *
 * The parameter is the height a person reaches to; this is the hole the joiner
 * cuts to make that true, clamped to what the drawing allows. Clamped is a
 * real answer rather than an error — the handle lands where it lands and the
 * install list says by how much it missed.
 */
export function comboSillFor(handleIn: number): { sillIn: number; clamped: boolean } {
  const wanted = handleIn - COMBO_OVEN.microwaveHandleIn;
  const { min, max } = COMBO_OVEN.sillIn;
  const sillIn = Math.min(max, Math.max(min, wanted));
  return { sillIn, clamped: Math.abs(sillIn - wanted) > 1e-6 };
}

/** And back: where the handle actually lands, given the sill it is hung at. */
export const comboHandleAt = (sillIn: number) => sillIn + COMBO_OVEN.microwaveHandleIn;

/** True when this machine is a combination oven rather than a plain one. */
export const isCombo = (appliance: Appliance) => appliance.installType.includes("combo");

/** True when this machine is a full-height column rather than an under-counter box. */
export const isColumn = (appliance: Appliance) => appliance.installType.includes("column");
