import { ROOM, ft, type HousingStyle } from "./roomShell";
import type { Appliance } from "../types";

/**
 * The hood a joiner builds, with a manufacturer's liner in the underside of it.
 *
 * An insert hood is not a hood you can look at: it is a stainless liner —
 * filters, lights and a control strip — that goes up inside a housing somebody
 * else builds. What the customer sees is the housing, in the same door finish
 * as the cabinets beside it, and a band of steel and baffle filters underneath.
 *
 * There are two shapes it is built in and they are a customer's choice rather
 * than a figure off a drawing, so they are a parameter: `box`, a straight
 * breast whose front is one plane from the band to the top line, and `sweep`,
 * the same band under a face that curves up and in to a narrow flue. Both are
 * hung off the same liner, both stop at the wall cabinets' top line, and both
 * carry the same band along the bottom.
 *
 * The liner's own figures are docs/reference/vcin36gws-manual.pdf: a
 * 32-15/16" x 21-1/4" opening in the underside with a 5/8" ledge round it, and
 * a 33-3/4" x 22" liner that hangs on that ledge.
 */
export const HOOD_CABINET = {
  /**
   * The straight box at the bottom of a breast, which the liner hangs in.
   *
   * The manual's own framing, not a proportion: a 12-11/16" crossbar with the
   * liner hanging on the 5/8" ledge under it.
   *
   * A swept housing has no such box — its straight part is the band, and what
   * keeps the tray inside is that a cove leaves the band vertical and turns in
   * slowly. That is a thing to check rather than to assume, and
   * `packageLayouts.test.ts` checks it at the height the tray ends.
   */
  baseIn: 13.3125,
  /**
   * The band along the bottom edge of the housing, in its own finish.
   *
   * Six inches of it, and it is the one part of a housing that is usually not
   * the door colour — a strap of oak under a painted breast is what half of
   * these are built as. It stands a little proud of the face above it, which
   * is what makes it a band rather than a painted stripe.
   */
  bandIn: 6,
  bandProudIn: 0.75,
  /** The straight box at the top, above the curve. */
  crownIn: 8,
  /** The ledge the liner's flange rests on, from the manual. */
  ledgeIn: 0.625,
  /**
   * How much of the liner shows below the housing.
   *
   * The tray hangs on its ledge with its front face standing below the band,
   * which is the band of steel a customer sees under the joinery. A housing
   * whose underside is level with the liner's swallows it whole and reads as a
   * box with nothing in it.
   */
  linerProudIn: 2.5,
  /** The moulding at the ceiling. */
  mouldingIn: 1.5,
  /** How far the moulding stands proud of the face it runs along. */
  mouldingProudIn: 0.75,
  /** How many straight lengths the curve is drawn as. */
  coveSegments: 10,
};

/**
 * What each shape gathers in to at the top, and what its face is made of.
 *
 * A box does not gather in at all: 42" wide and as deep as the base run below
 * it, which is what a chimney breast is, with the front boarded in shiplap.
 * A sweep draws in to a flue — 30" on the drawing, and 14" deep, except that
 * the top of that wall has to read as one line and a section standing proud of
 * the cabinets breaks it, so its depth is theirs where theirs is less.
 */
export const HOUSING_STYLES = {
  box: { topWidthIn: 42, topDepthIn: 24, coved: false, boardIn: 6 },
  sweep: { topWidthIn: 30, topDepthIn: 14, coved: true, boardIn: 0 },
} as const satisfies Record<HousingStyle, unknown>;

/** The liner's own opening in the underside of the housing, in inches. */
export const LINER_OPENING = { widthIn: 32.9375, depthIn: 21.25 } as const;

/**
 * A straight section of the housing: its size and where its middle is.
 *
 * `z` is how far the middle sits from the housing's own, and it is not always
 * nothing: a breast is built against a wall, so a section shallower than the
 * housing keeps its back on that wall and gathers in at the front. A section
 * centred instead would leave a gap behind it and lean the face in twice as
 * fast as it should.
 */
export interface HoodSection {
  h: number;
  w: number;
  d: number;
  y: number;
  z: number;
}

export interface HoodCabinetParts {
  style: HousingStyle;
  /** Straight box at the bottom, which the liner hangs in: full width and depth. */
  base: HoodSection;
  /** The band along its lower edge, in its own finish. Part of the base. */
  band: HoodSection & { proud: number };
  /**
   * The curve, as the rings it is drawn from, bottom to top.
   *
   * Empty where the shape has none. Each ring is in the curve's own frame:
   * how far up it, and the section there.
   */
  cove: { h: number; y: number; rings: { y: number; w: number; d: number; z: number }[] };
  /** Straight box to the top line. */
  crown: HoodSection;
  /** The section at the very top, which the moulding wraps. */
  top: { w: number; d: number; z: number };
  /** The hole in the underside the liner hangs in, and the ledge round it. */
  opening: { w: number; d: number; ledge: number };
}

/**
 * The housing's sections, given its own envelope and the shape asked for.
 *
 * `h` is the housing's own height — from where it is hung over the cooking
 * surface up to the ceiling — and the curve is what is left of it once the two
 * straight sections have taken theirs. A housing too short for all three is
 * not an error: the curve closes up and the two boxes meet, which is what a
 * low ceiling actually gets built as.
 */
export function hoodCabinetParts(
  size: { w: number; h: number; d: number },
  style: HousingStyle = "box",
): HoodCabinetParts {
  const shape = HOUSING_STYLES[style];
  // A breast is boxed to the manual's framing; a sweep is straight for the
  // depth of its band and curved from there.
  const base = Math.min(
    ft(shape.coved ? HOOD_CABINET.bandIn : HOOD_CABINET.baseIn),
    size.h,
  );
  const crown = Math.min(shape.coved ? ft(HOOD_CABINET.crownIn) : size.h - base, size.h - base);
  const cove = Math.max(0, size.h - base - crown);

  // The top can only draw in, never out: a housing narrower than its own flue
  // would be a curve the wrong way round. And no deeper than the cabinets it
  // meets, where it is meant to meet them.
  const topW = Math.min(ft(shape.topWidthIn), size.w);
  const topD = Math.min(ft(shape.topDepthIn), size.d, shape.coved ? ROOM.upperDepth : size.d);
  const band = Math.min(ft(HOOD_CABINET.bandIn), base);
  /** Back against the wall: where the middle of a shallower section lands. */
  const wall = (d: number) => (d - size.d) / 2;

  return {
    style,
    base: { h: base, w: size.w, d: size.d, y: base / 2, z: 0 },
    // Proud of the face and not of the flanks: what is beside a housing is a
    // cabinet or a tower, and a band that stood proud of those would be a band
    // driven through them.
    band: {
      h: band,
      w: size.w,
      d: size.d + ft(HOOD_CABINET.bandProudIn),
      y: band / 2,
      z: wall(size.d + ft(HOOD_CABINET.bandProudIn)),
      proud: ft(HOOD_CABINET.bandProudIn),
    },
    cove: {
      h: cove,
      y: base,
      rings:
        cove > 0
          ? coveRings(cove, { w: size.w, d: size.d }, { w: topW, d: topD }, wall)
          : [],
    },
    crown: { h: crown, w: topW, d: topD, y: base + cove + crown / 2, z: wall(topD) },
    top: { w: topW, d: topD, z: wall(topD) },
    opening: {
      w: ft(LINER_OPENING.widthIn),
      d: ft(LINER_OPENING.depthIn),
      ledge: ft(HOOD_CABINET.ledgeIn),
    },
  };
}

/**
 * The rings a cove is drawn from, bottom to top.
 *
 * A cove is not a taper: it leaves the band standing straight up, turns in
 * slowly at first and hardest just under the flue. That is a quarter cosine,
 * and it is the whole difference between a hood that looks turned and one that
 * looks folded. It is also what keeps the liner inside a housing whose
 * straight part is only six inches tall — the tray ends a third of the way up
 * the curve, where the curve has barely left the vertical.
 *
 * Ten straight lengths is enough that the joint between two of them stops
 * reading as a facet at the size these are drawn.
 */
function coveRings(
  h: number,
  bottom: { w: number; d: number },
  top: { w: number; d: number },
  wall: (d: number) => number,
): { y: number; w: number; d: number; z: number }[] {
  const steps = HOOD_CABINET.coveSegments;
  const rings: { y: number; w: number; d: number; z: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const f = 1 - Math.cos((t * Math.PI) / 2);
    const d = bottom.d + (top.d - bottom.d) * f;
    rings.push({
      y: h * t,
      w: bottom.w + (top.w - bottom.w) * f,
      d,
      z: wall(d),
    });
  }
  return rings;
}

/** True when this hood goes up inside a housing somebody else builds. */
export const isInsert = (appliance: Appliance | undefined) =>
  !!appliance?.installType.includes("insert");

/**
 * Where the housing hangs, in feet above the floor.
 *
 * Not at the liner's underside but a couple of inches above it: the tray hangs
 * on its ledge with its face showing below the band, which is the band of
 * steel you see under one of these. The figure below it is the clearance over
 * the cooking surface — the same one a canopy is hung at, and the same rule.
 */
export const hoodCabinetBand = (mountY: number) =>
  [mountY + ft(HOOD_CABINET.linerProudIn), ROOM.wallHeight] as const;
