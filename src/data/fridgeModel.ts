import type { Appliance } from "../types";

/**
 * How a refrigerator opens, as geometry.
 *
 * What a customer sees of a refrigerator is its doors. A 36" french door with
 * two drawers under it and a 36" side-by-side are the same box and nothing like
 * the same machine, and drawing both as a slab with a seam down it is the
 * difference between a model and a placeholder.
 *
 * The configuration comes off the appliance's own record, which the importer
 * reads from the sheet's Feature column. A record that does not say gets the
 * commonest front and is marked a guess — the same treatment a model with no
 * rough-in drawing gets, and for the same reason: the room still draws
 * something, and `?debug=1` says which ones nobody has checked.
 */

export type DoorConfig = NonNullable<Appliance["doorConfig"]>;

/** The one a refrigerator gets when nothing says otherwise. */
export const DEFAULT_DOOR_CONFIG: DoorConfig = "french-door-1-drawer";

/** True when the front being drawn is a guess rather than a published fact. */
export const hasGenericDoors = (appliance: Appliance | undefined) =>
  appliance?.category === "refrigerator" && !appliance.doorConfig;

export const doorConfigOf = (appliance: Appliance): DoorConfig =>
  appliance.doorConfig ?? DEFAULT_DOOR_CONFIG;

/** A front, in feet, relative to the body's centre and floor. */
export interface Panel {
  id: string;
  /** Centre of the panel. */
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Its handle: a tube on two brackets, along one axis or the other. The toe
   * grille has none, because it does not open.
   */
  handle: { x: number; y: number; length: number; along: "x" | "y" } | null;
  /**
   * Vent slots across it, for the grille at the bottom.
   *
   * A built-in refrigerator is one piece of steel from the floor to the top of
   * its doors — the grille is the same panel with air getting through it, not a
   * dark plinth the machine is standing on. So it is a front like the others,
   * and what makes it a grille is the slots.
   */
  vents?: { count: number; heightFt: number };
}

/**
 * The proportions of a built-in french door, from the front elevation
 * (docs/reference/t36bt120ns-front.png).
 *
 * Every figure here is read off that drawing rather than chosen: the doors take
 * a shade under three fifths of the front, the two drawers split what is left,
 * and the toe grille is the four inches at the bottom that is not a door at all.
 */
export const FRIDGE_PROPORTIONS = {
  /** The seam down the middle of a pair of doors, and between panels. */
  centreGapIn: 0.125,
  gapIn: 0.125,
  /** Doors stand proud of the carcass — it is a built-in, not a flush panel. */
  proudIn: 0.75,
  /** Tubular handles: a diameter, and how much of their panel they run. */
  handleDiameterIn: 1.25,
  doorHandleFraction: 0.8,
  drawerHandleFraction: 0.9,
};

/**
 * What the front divides into when nobody has read the drawing.
 *
 * The proportions of the class rather than of a model: a built-in french door
 * gives a bit under three fifths of its front to the doors, splits the rest
 * between two drawers, and stands on a grille. A machine whose own elevation
 * has been read uses that instead — see `doorSplit` on the record.
 */
export const GENERIC_SPLIT = {
  toeIn: 7.25,
  drawerLowIn: 19.75,
  drawerHighIn: 10.5,
  doorIn: 49.4375,
};

export type DoorSplit = typeof GENERIC_SPLIT;

/**
 * The four bands of the front, fitted to the machine.
 *
 * The published figures are proportions, not a sum: on the Thermador Freedom
 * elevation they come to 86-15/16" against a cabinet height of 83-7/8",
 * because one of them is measured to somewhere this app cannot see. Scaling
 * them to the opening keeps every ratio between them — which is what the eye
 * reads — and makes the stack come out at the height the machine actually is.
 */
export function doorSplitOf(appliance: Appliance, heightFt: number) {
  const published: DoorSplit = appliance.doorSplit ?? GENERIC_SPLIT;
  const gaps = (FRIDGE_PROPORTIONS.gapIn * 3) / 12;
  const raw =
    (published.toeIn + published.drawerLowIn + published.drawerHighIn + published.doorIn) / 12;
  const scale = (heightFt - gaps) / raw;

  return {
    toe: (published.toeIn / 12) * scale,
    drawerLow: (published.drawerLowIn / 12) * scale,
    drawerHigh: (published.drawerHighIn / 12) * scale,
    door: (published.doorIn / 12) * scale,
    gap: FRIDGE_PROPORTIONS.gapIn / 12,
  };
}

/**
 * The fronts of a refrigerator, in the order they are hung.
 *
 * A pair of doors carries a vertical handle each, both beside the centre seam,
 * which is where the photograph puts them and where you would actually grab
 * them: the pair opens outward from the middle. A drawer carries a horizontal
 * bar across it. The toe grille is not a panel and does not appear here — it is
 * drawn under everything, because nothing opens.
 */
export function fridgeParts(appliance: Appliance, box: { w: number; h: number }): Panel[] {
  const config = doorConfigOf(appliance);
  const P = FRIDGE_PROPORTIONS;
  const { w } = box;
  const split = doorSplitOf(appliance, box.h);
  const centre = P.centreGapIn / 12;
  const grip = P.handleDiameterIn / 12;

  /** A pair of doors, hinged at the outside edges. */
  const pair = (id: string, low: number, high: number): Panel[] =>
    [-1, 1].map((side) => {
      const half = (w - centre) / 2;
      return {
        id: `${id}-${side < 0 ? "left" : "right"}`,
        x: (side * (half + centre)) / 2,
        y: (low + high) / 2,
        w: half,
        h: high - low,
        handle: {
          // Beside the seam, which is the edge that opens.
          x: side * (centre / 2 + grip),
          y: (low + high) / 2,
          length: (high - low) * P.doorHandleFraction,
          along: "y" as const,
        },
      };
    });

  /** A drawer front across the full width, with a bar across it. */
  const drawer = (id: string, low: number, high: number): Panel => ({
    id,
    x: 0,
    y: (low + high) / 2,
    w,
    h: high - low,
    handle: {
      x: 0,
      // Near the top of the front, which is where you lift from.
      y: high - (high - low) * 0.25,
      length: w * P.drawerHandleFraction,
      along: "x",
    },
  });

  /** A single door across the full width, hinged on the left. */
  const door = (id: string, low: number, high: number): Panel => ({
    id,
    x: 0,
    y: (low + high) / 2,
    w,
    h: high - low,
    handle: {
      x: w / 2 - grip * 1.5,
      y: (low + high) / 2,
      length: (high - low) * P.doorHandleFraction,
      along: "y",
    },
  });

  /** The toe grille: the same steel, with air getting through it. */
  const grille = (): Panel => ({
    id: "grille",
    x: 0,
    y: split.toe / 2,
    w,
    h: split.toe,
    handle: null,
    vents: { count: 4, heightFt: Math.min(0.125 / 12, split.toe / 12) },
  });

  // Bottom to top: the grille, the low drawer, the high drawer, the doors,
  // with a gap between each.
  const lowFrom = split.toe;
  const lowTo = lowFrom + split.drawerLow;
  const highFrom = lowTo + split.gap;
  const highTo = highFrom + split.drawerHigh;
  const doorsFrom = highTo + split.gap;

  switch (config) {
    case "french-door-2-drawer":
      // Two doors over a refrigerator drawer over a freezer drawer: four
      // fronts, four handles, which is what a T36BT120NS is.
      return [
        ...pair("door", doorsFrom, box.h),
        drawer("drawer-fresh", highFrom, highTo),
        drawer("drawer-freezer", lowFrom, lowTo),
        grille(),
      ];
    case "french-door-1-drawer":
      return [...pair("door", doorsFrom, box.h), drawer("drawer-freezer", lowFrom, highTo), grille()];
    case "bottom-freezer":
      return [door("door", doorsFrom, box.h), drawer("drawer-freezer", lowFrom, highTo), grille()];
    case "side-by-side":
      return [...pair("door", lowFrom, box.h), grille()];
    case "column":
      return [door("door", lowFrom, box.h), grille()];
  }
}
