import { ROOM } from "./room";
import type { Appliance, Slot } from "../types";

/**
 * How a hung oven sits in its tower: a standard install.
 *
 * Leo, round 36. The machine does not sit back in its hole. Its trim is wider
 * and taller than the cutout, laps over the cabinet round it, and its front is
 * in the plane of the tower's doors — which is what the customer sees from
 * across the room, and what a recessed machine gets visibly wrong.
 *
 * The overlaps and handle figures are each machine's own spec sheet, not a
 * rule of thumb, so a model with no entry here keeps the old placement rather
 * than borrowing a neighbour's numbers.
 */
export const OVEN_TRIM: Record<
  string,
  {
    /** What the trim laps over the top of the cutout; a range where the cutout height has one. */
    topIn: { min: number; max: number };
    sidesIn: number;
    bottomIn: number;
    /** How far the handle stands off the door skin. */
    handleProudIn: number;
    source: string;
  }
> = {
  // "Trim Overlaps (Top – Sides – Bottom) 1/2" – 9/16" – 0"", Masterpiece handle 2-3/8".
  MEM301WS: {
    topIn: { min: 0.5, max: 0.5 },
    sidesIn: 0.5625,
    bottomIn: 0,
    handleProudIn: 2.375,
    source: "docs/reference/mem301ws-spec.pdf",
  },
  // "3/4" to 1 1/2" – 9/16" – 0"": the top depends on which end of the
  // 47-3/8"-48-1/8" cutout was built. Professional handle 2-5/8".
  PODS302B: {
    topIn: { min: 0.75, max: 1.5 },
    sidesIn: 0.5625,
    bottomIn: 0,
    handleProudIn: 2.625,
    source: "docs/reference/pods302b-spec.pdf",
  },
};

/** A cabinet door's thickness, which is what puts its face in front of the carcass. */
export const CABINET_DOOR_IN = 0.75;

/**
 * How far the trim stands in front of the door plane.
 *
 * On site a 1" trim on a 24" carcass finishes a quarter inch proud of a 3/4"
 * door; Leo asked for the plane of the doors, "or slightly in front". A
 * sixteenth keeps it in front without the two faces sharing a plane, which on
 * screen is a flicker rather than a finish.
 */
export const TRIM_PROUD_IN = 0.0625;

export interface StandardInstall {
  /** The front of the machine's door skin, in inches in front of the run's centre line. */
  faceIn: number;
  /** The front of the tower's doors, on the same line. */
  doorFrontIn: number;
  /** The whole machine, handle excluded. */
  bodyIn: { w: number; h: number; d: number };
  /** The part that goes into the cutout, behind the trim. */
  chassisIn: { w: number; h: number; d: number };
  /** What the trim laps over the cabinet round the cutout. */
  overlapIn: { top: number; sides: number; bottom: number };
  handleProudIn: number;
  /** The standard cutout's width, and the cabinet side each side of it in the opening. */
  cutoutWidthIn: number;
  sideIn: number;
}

/**
 * The standard install of an oven in a tower, or null where there is nothing
 * published to build it from: a machine without a trim entry, or one that is
 * not standing in a tower's opening.
 */
export function standardInstall(slot: Slot, appliance: Appliance): StandardInstall | null {
  const trim = OVEN_TRIM[appliance.model];
  if (!trim || appliance.category !== "wall-oven") return null;
  if (slot.cabinetConfig.type !== "enclosure") return null;
  const { widthIn: w, heightIn: h, depthIn: d, cutoutWidthIn, cutoutDepthIn } = appliance;
  if (w === null || h === null || d === null || cutoutWidthIn === null || cutoutDepthIn === null) {
    return null;
  }

  // The machine stands on the bottom of its opening and its trim runs on up
  // past the top; what is past the top is the overlap.
  const top = h - trim.bottomIn - slot.cutout.h;
  const doorFrontIn = (ROOM.counterDepth * 12) / 2 + CABINET_DOOR_IN;
  const sides = trim.sidesIn;
  return {
    faceIn: doorFrontIn + TRIM_PROUD_IN,
    doorFrontIn,
    bodyIn: { w, h, d },
    chassisIn: { w: w - 2 * sides, h: h - top - trim.bottomIn, d: cutoutDepthIn },
    overlapIn: { top, sides, bottom: trim.bottomIn },
    handleProudIn: trim.handleProudIn,
    cutoutWidthIn,
    sideIn: Math.max(0, (slot.cutout.w - cutoutWidthIn) / 2),
  };
}
