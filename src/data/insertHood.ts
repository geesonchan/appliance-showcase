import { ROOM, ft } from "./roomShell";
import type { Appliance } from "../types";

/**
 * The hood a joiner builds, with a manufacturer's liner in the underside of it.
 *
 * An insert hood is not a hood you can look at: it is a stainless liner —
 * filters, lights and a control strip — that goes up inside a housing somebody
 * else builds. What the customer sees is the housing, in the same door finish
 * as the cabinets beside it, and a band of steel and baffle filters underneath.
 *
 * The shape is Leo's round-20 note, which is the shape these are built in:
 * three sections, not one taper. A straight box at the bottom with the liner
 * set into it, a four-sided frustum above that gathering in to the flue, and a
 * straight box from there to the ceiling with a crown at the top. The bottom
 * and the top are fixed heights; the taper takes whatever the room leaves,
 * so a taller ceiling makes a longer slope rather than a stretched box.
 *
 * The liner's own figures are the VCIN36WS manual: a 32-15/16" x 21-1/4"
 * opening in the underside with a 5/8" ledge round it, and a 33-3/4" x 22"
 * liner that hangs on that ledge.
 */
export const HOOD_CABINET = {
  /**
   * The straight box at the bottom, which the liner hangs in.
   *
   * The manual's own framing, not a proportion: a 12-11/16" crossbar with the
   * liner hanging on the 5/8" ledge under it. The liner is 12-13/16" tall and
   * has to be inside a section with vertical sides, or it comes out through the
   * slope. Round-20's note said "about 6", which is what the band under the
   * moulding reads as from the room — the box behind it is this.
   */
  baseIn: 13.3125,
  /** The straight box at the top, which meets the ceiling. */
  crownIn: 8,
  /** What the taper gathers in to: the flue, and the box round it. */
  topWidthIn: 24,
  topDepthIn: 14,
  /** The ledge the liner's flange rests on, from the manual. */
  ledgeIn: 0.625,
  /** The moulding along the bottom edge and again at the ceiling. */
  mouldingIn: 1.5,
  /** How far the moulding stands proud of the face it runs along. */
  mouldingProudIn: 0.75,
  /** The recessed panel on each sloping face, as a shaker door's is. */
  panelInsetIn: 4,
  panelDepthIn: 0.25,
};

/** The liner's own opening in the underside of the housing, in inches. */
export const LINER_OPENING = { widthIn: 32.9375, depthIn: 21.25 } as const;

export interface HoodCabinetParts {
  /** Straight box at the bottom: full width and depth. */
  base: { h: number; w: number; d: number; y: number };
  /** The taper, from the base's section to the crown's. */
  taper: { h: number; y: number; bottom: { w: number; d: number }; top: { w: number; d: number } };
  /** Straight box to the ceiling. */
  crown: { h: number; w: number; d: number; y: number };
  /** The hole in the underside the liner hangs in, and the ledge round it. */
  opening: { w: number; d: number; ledge: number };
}

/**
 * The three sections, given the housing's own envelope.
 *
 * `h` is floor to ceiling of the housing — from where it is hung over the
 * cooking surface up to the ceiling — and the taper is what is left of it once
 * the two straight sections have taken theirs. A housing too short for all
 * three is not an error: the taper closes up and the two boxes meet, which is
 * what a low ceiling actually gets built as.
 */
export function hoodCabinetParts(size: {
  w: number;
  h: number;
  d: number;
}): HoodCabinetParts {
  const base = Math.min(ft(HOOD_CABINET.baseIn), size.h);
  const crown = Math.min(ft(HOOD_CABINET.crownIn), size.h - base);
  const taper = Math.max(0, size.h - base - crown);

  // The top can only draw in, never out: a housing narrower than its own flue
  // would be a taper the wrong way round.
  const topW = Math.min(ft(HOOD_CABINET.topWidthIn), size.w);
  const topD = Math.min(ft(HOOD_CABINET.topDepthIn), size.d);

  return {
    base: { h: base, w: size.w, d: size.d, y: base / 2 },
    taper: {
      h: taper,
      y: base + taper / 2,
      bottom: { w: size.w, d: size.d },
      top: { w: topW, d: topD },
    },
    crown: { h: crown, w: topW, d: topD, y: base + taper + crown / 2 },
    opening: {
      w: ft(LINER_OPENING.widthIn),
      d: ft(LINER_OPENING.depthIn),
      ledge: ft(HOOD_CABINET.ledgeIn),
    },
  };
}

/** True when this hood goes up inside a housing somebody else builds. */
export const isInsert = (appliance: Appliance | undefined) =>
  !!appliance?.installType.includes("insert");

/**
 * Where the housing hangs, in feet above the floor.
 *
 * The liner's underside, which is the clearance over the cooking surface — the
 * same figure a canopy is hung at, and the same rule.
 */
export const hoodCabinetBand = (mountY: number) => [mountY, ROOM.wallHeight] as const;
