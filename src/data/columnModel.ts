import { ft } from "./roomShell";
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
 * How an 18" wine column divides, in inches.
 *
 * From the T18IW100SP drawing: a 79-7/8" door panel with a fixed panel at each
 * end of it — 6-1/4" at the top and 9-9/16" at the bottom — and glass between
 * them. The two fixed panels are cabinetry, in the door finish; only the field
 * between them is glass, and that is where the bottles are.
 */
export const WINE_COLUMN = {
  doorHeightIn: 79.875,
  doorWidthIn: 17.75,
  topPanelIn: 6.25,
  bottomPanelIn: 9.5625,
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
  kind: "glass" | "panel";
}

export interface WineColumnParts {
  /** The door panel: the whole face, in the cabinet's finish. */
  door: { h: number; w: number; y: number };
  /** The three bands of that face, bottom to top. */
  parts: ColumnDoor[];
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
  const doorW = Math.min(ft(W.doorWidthIn), box.w);
  // Centred in the opening: what is left above and below is the reveal the
  // machine's own drawing leaves.
  const y = (box.h - doorH) / 2;

  const bottom = ft(W.bottomPanelIn);
  const top = ft(W.topPanelIn);
  const glass: readonly [number, number] = [y + bottom, y + doorH - top];

  const shelves: number[] = [];
  const span = glass[1] - glass[0];
  for (let i = 1; i <= W.shelves; i += 1) {
    shelves.push(glass[0] + (span * i) / (W.shelves + 1));
  }

  return {
    door: { h: doorH, w: doorW, y },
    parts: [
      { band: [y, y + bottom] as const, kind: "panel" },
      { band: glass, kind: "glass" },
      { band: [y + doorH - top, y + doorH] as const, kind: "panel" },
    ],
    shelves,
    hinge,
    handle: {
      r: ft(W.handleDiameterIn) / 2,
      proud: ft(W.handleProudIn),
      h: span * 0.6,
    },
  };
}

export interface ComboOvenParts {
  /** The two doors and the control panel, bottom to top. */
  doors: {
    band: readonly [number, number];
    kind: "oven" | "microwave" | "control";
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
