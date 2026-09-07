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

/** A door or a drawer front, in feet, relative to the body's centre and floor. */
export interface Panel {
  id: string;
  /** Centre of the panel. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Its handle: a tube on two brackets, along one axis or the other. */
  handle: { x: number; y: number; length: number; along: "x" | "y" };
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
  /** Where the doors stop, as a fraction of the height above the toe grille. */
  doorFraction: 0.58,
  /** The seam down the middle of a pair of doors. */
  centreGapIn: 0.125,
  /** Between a door and the drawer under it, and between the two drawers. */
  gapIn: 0.25,
  /** The dark grille under the drawers. */
  toeGrilleIn: 4,
  /** Doors stand proud of the carcass — it is a built-in, not a flush panel. */
  proudIn: 0.75,
  /** Tubular handles: a diameter, and how much of their panel they run. */
  handleDiameterIn: 1.25,
  doorHandleFraction: 0.8,
  drawerHandleFraction: 0.9,
};

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
  const toe = P.toeGrilleIn / 12;
  const gap = P.gapIn / 12;
  const centre = P.centreGapIn / 12;
  /** The stack of fronts sits on the grille. */
  const from = toe;
  const height = box.h - toe;
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

  const doorsTo = from + height * P.doorFraction;

  switch (config) {
    case "french-door-2-drawer": {
      // Two doors over a refrigerator drawer over a freezer drawer: four
      // fronts, four handles, which is what a T36BT120NS is.
      const split = (doorsTo + gap + from) / 2;
      return [
        ...pair("door", doorsTo + gap, box.h),
        drawer("drawer-fresh", split + gap / 2, doorsTo),
        drawer("drawer-freezer", from, split - gap / 2),
      ];
    }
    case "french-door-1-drawer":
      return [...pair("door", doorsTo + gap, box.h), drawer("drawer-freezer", from, doorsTo)];
    case "bottom-freezer":
      return [door("door", doorsTo + gap, box.h), drawer("drawer-freezer", from, doorsTo)];
    case "side-by-side":
      return pair("door", from, box.h);
    case "column":
      return [door("door", from, box.h)];
  }
}
