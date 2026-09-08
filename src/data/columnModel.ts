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
 * How a 30" combination oven divides, as fractions of its own height.
 *
 * From the MEM301WS elevation in docs/reference/: a microwave over an oven,
 * with the microwave the shallower cavity of the two — 1.6 cubic feet against
 * 4.5 — and a full-width handle on each door. The figures are proportions of
 * the class rather than of the one model, the way the range's are: what is the
 * model's own is the 49" x 29-3/4" envelope they are applied to.
 */
export const COMBO_OVEN = {
  /** The microwave door, from the top down. */
  upperFraction: 0.37,
  /** A reveal between the two doors, and around each of them. */
  revealIn: 0.25,
  /** The handle: a bar across the top of each door, standing 2-3/8" proud. */
  handleDiameterIn: 1.25,
  handleProudIn: 2.375,
  handleFraction: 0.9,
  /** The glass field inside the stainless frame of each door. */
  glassInsetIn: 2,
};

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
  /** The two doors, bottom to top: the oven, then the microwave. */
  doors: { band: readonly [number, number]; kind: "oven" | "microwave" }[];
  handle: { r: number; proud: number; width: number };
  glassInset: number;
}

/** A combination oven's two doors, given the envelope it is drawn in. */
export function comboOvenParts(box: { w: number; h: number }): ComboOvenParts {
  const C = COMBO_OVEN;
  const reveal = ft(C.revealIn);
  const upper = box.h * C.upperFraction;
  const lower = box.h - upper;

  return {
    doors: [
      { band: [0, lower - reveal] as const, kind: "oven" },
      { band: [lower, box.h] as const, kind: "microwave" },
    ],
    handle: {
      r: ft(C.handleDiameterIn) / 2,
      proud: ft(C.handleProudIn),
      width: box.w * C.handleFraction,
    },
    glassInset: ft(C.glassInsetIn),
  };
}

/** True when this machine is a combination oven rather than a plain one. */
export const isCombo = (appliance: Appliance) => appliance.installType.includes("combo");

/** True when this machine is a full-height column rather than an under-counter box. */
export const isColumn = (appliance: Appliance) => appliance.installType.includes("column");
