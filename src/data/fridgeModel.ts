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
  /** Where its handle runs, and which way. */
  handle: { x: number; y: number; length: number; along: "x" | "y" };
}

/**
 * Where the fresh food section stops and the frozen one starts, as a fraction
 * of the height. Two thirds is what a french-door cabinet gives to the top.
 */
const SPLIT = { twoDrawer: 0.62, oneDrawer: 0.56, bottomFreezer: 0.6 };
/** The gasket line between one door and the next. */
const GAP = 0.5 / 12;

/**
 * The fronts of a refrigerator, in the order they are hung.
 *
 * Handles sit on the opening edge of each door, which is what tells you which
 * way it swings: a french door pair opens outward from the middle, a drawer
 * pulls from a bar across it.
 */
export function fridgeParts(appliance: Appliance, box: { w: number; h: number }): Panel[] {
  const config = doorConfigOf(appliance);
  const { w, h } = box;
  const half = (w - GAP) / 2;
  const grip = 1.5 / 12;

  /** A pair of doors from `from` to `to`, hinged at the outside edges. */
  const pair = (id: string, from: number, to: number): Panel[] =>
    [-1, 1].map((side) => ({
      id: `${id}-${side < 0 ? "left" : "right"}`,
      x: (side * (half + GAP)) / 2,
      y: (from + to) / 2,
      w: half,
      h: to - from - GAP,
      handle: {
        // On the opening edge, which is the middle of the pair.
        x: side * (GAP / 2 + grip),
        y: (from + to) / 2,
        length: (to - from) * 0.55,
        along: "y" as const,
      },
    }));

  /** A drawer front across the full width, with a bar across it. */
  const drawer = (id: string, from: number, to: number): Panel => ({
    id,
    x: 0,
    y: (from + to) / 2,
    w,
    h: to - from - GAP,
    handle: { x: 0, y: (from + to) / 2 + (to - from) * 0.28, length: w * 0.6, along: "x" },
  });

  /** A single door across the full width, hinged on the left. */
  const door = (id: string, from: number, to: number): Panel => ({
    id,
    x: 0,
    y: (from + to) / 2,
    w,
    h: to - from - GAP,
    handle: { x: w / 2 - grip * 2, y: (from + to) / 2, length: (to - from) * 0.5, along: "y" },
  });

  switch (config) {
    case "french-door-2-drawer": {
      // Two doors over a refrigerator drawer over a freezer drawer: four
      // fronts, four handles, which is what a T36BT120NS is.
      const top = h * SPLIT.twoDrawer;
      const middle = top + (h - top) / 2;
      return [...pair("door", top, h), drawer("drawer-fresh", middle, top), drawer("drawer-freezer", 0, middle)];
    }
    case "french-door-1-drawer": {
      const top = h * SPLIT.oneDrawer;
      return [...pair("door", top, h), drawer("drawer-freezer", 0, top)];
    }
    case "bottom-freezer": {
      const top = h * SPLIT.bottomFreezer;
      return [door("door", top, h), drawer("drawer-freezer", 0, top)];
    }
    case "side-by-side":
      return pair("door", 0, h);
    case "column":
      return [door("door", 0, h)];
  }
}
