import { CABINET_STANDARDS, ROOM, RUNS, ft } from "./room";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, Slot } from "../types";

/**
 * The shape of a canopy, from the Thermador clearance drawing
 * (docs/reference/thermador-hood-clearance.png).
 *
 * A wall canopy is a wedge, not a box: 24" deep at the cooktop, a short
 * vertical lip at the front, then a slope back to a flat top only 12" deep
 * where it meets the wall. Drawing it as a box makes it look like a cupboard
 * and hides the fact that the duct comes off the *top*, well behind the front
 * edge — which is the whole reason the cabinet above it needs a hole in its
 * floor.
 */
export const HOOD_PROFILE = {
  /** The vertical face at the front, before the slope starts. */
  frontLipIn: 4.1875,
  /** Flat top against the wall when the model does not publish one. */
  defaultTopDepthIn: 12,
};

/**
 * The canopy as a solid, in inches.
 *
 * It is not a wedge. A wall canopy collects on all three open sides and
 * gathers into the flue, so it draws in on the front *and* both flanks: a
 * vertical face at the front, then four faces sloping up and inward to a top
 * the size of the chimney's own section, with the back staying flat against the
 * wall. Seen from the front it is an isosceles trapezoid; seen from the side it
 * is a wedge, which is the half of it the old geometry drew.
 *
 * Everything is in inches, from the canopy's underside (y = 0) upward, with x
 * across the run and z from the wall (0) into the room. See
 * docs/reference/hmcb30ws-spec.png.
 */
export function canopySolid(canopy: {
  widthIn: number;
  depthIn: number;
  heightIn: number;
  frontLipIn: number;
  topWidthIn: number;
  topDepthIn: number;
}) {
  const { widthIn, depthIn, heightIn } = canopy;
  const lip = Math.min(canopy.frontLipIn, heightIn);
  // The top can only draw in, never out: a canopy narrower than its own flue
  // would be a funnel the wrong way round.
  const topW = Math.min(canopy.topWidthIn, widthIn);
  const topD = Math.min(canopy.topDepthIn, depthIn);

  return {
    /** The rim, at the cooking surface end. */
    bottom: { w: widthIn, d: depthIn },
    /** Where the chimney lands. The same section, or the canopy does not meet it. */
    top: { w: topW, d: topD },
    /** How high the vertical front face runs before the slope starts. */
    lip,
    height: heightIn,
    /** Both back faces sit here: the canopy is flat against the wall. */
    backZ: 0,
    /** How far each flank draws in, which is the same on both sides. */
    insetX: (widthIn - topW) / 2,
    /** And how far the front draws back. */
    insetZ: depthIn - topD,
  };
}

/**
 * The canopy's section through the middle, in inches, as a closed polygon.
 *
 * Measured from the wall (x = 0) outward and from the canopy's underside
 * (y = 0) upward. Kept for the side elevation and the clearance drawing; the
 * solid itself is `canopySolid`.
 */
export function hoodProfile(
  depthIn: number,
  topDepthIn: number,
  heightIn: number,
  /** The model's own front face, where it publishes one. */
  frontLipIn = HOOD_PROFILE.frontLipIn,
) {
  const top = Math.min(Math.max(topDepthIn, 1), depthIn);
  const lip = Math.min(frontLipIn, heightIn);
  return [
    [0, 0],
    [depthIn, 0],
    [depthIn, lip],
    [top, heightIn],
    [0, heightIn],
  ] as [number, number][];
}

/**
 * The telescopic duct cover above a chimney hood.
 *
 * Not decoration and not a cabinet: it is the part that carries the duct from
 * the canopy to the ceiling, and it is sized to the room rather than to the
 * hood. Two sections, the lower sliding over the upper with a half-inch step
 * where they meet, and it always finishes at the ceiling — that is what makes a
 * chimney hood a chimney hood, and it is why nothing is built above one.
 *
 * The assembly has its own travel. Past the top of it the manufacturer sells an
 * extension, and a room that needs one has to say so on the install list rather
 * than draw a chimney that does not exist. Figures from Leo's round-17 note
 * against HMCB30WS.
 */
export const CHIMNEY = {
  widthIn: 13.1875,
  depthIn: 10.75,
  /**
   * How much bigger the outer section is than the inner, all round.
   *
   * Nearly nothing: the two read as one flue with a joint in it, not as a
   * stepped stack. The drawing gives one cross-section for both.
   */
  stepIn: 0.25,
  /**
   * One section's height, and therefore the whole assembly collapsed.
   *
   * Read off docs/reference/hmcb30ws-spec.png: its 30-42" is measured from the
   * canopy's *underside* to the top of the chimney, and the canopy is 8-9/16"
   * of that. So collapsed the chimney shows 30 - 8-9/16 = 21-7/16", which is
   * the outer section with the inner entirely inside it.
   *
   * What the assembly can cover is therefore one section at the bottom and two
   * nearly fully drawn apart at the top — not the sheet's 30-42, which is the
   * rated installation range for an 8' to 9' ceiling rather than the travel of
   * the part.
   */
  sectionIn: 30 - 8.5625,
  /** The extension a taller room needs. */
  extension: "CHXTHMCB",
  /** The grille across the top of each side, from the drawing's 5-1/2". */
  vent: { heightIn: 5.5, fromTopIn: 1 },
};

export interface ChimneyParts {
  /** Canopy top to ceiling, in feet. What the assembly has to cover. */
  rise: number;
  /**
   * The two sections. Both are one section tall — they telescope, so they
   * overlap rather than tile: the outer one hangs from the canopy's top and the
   * inner one from the ceiling, and how far apart they are drawn is the rise.
   */
  lower: { from: number; h: number; w: number; d: number };
  upper: { from: number; h: number; w: number; d: number };
  /** How much of the outer section the inner is still inside, in feet. */
  overlap: number;
  /** True when the room is taller than the two sections reach. */
  needsExtension: boolean;
  /** How much taller, in inches. Zero when it fits. */
  shortIn: number;
  /** True when the ceiling is too low for even one section. */
  tooLow: boolean;
}

/**
 * The chimney for a canopy whose top is at `canopyTop` feet above the floor.
 *
 * Measured, not assumed. The canopy hangs its clearance above the cooking
 * surface the wall was drilled for, so where its top lands moves with the range
 * — and the chimney is whatever is left between there and the ceiling.
 */
export function chimneyParts(canopyTop: number, ceiling = ROOM.wallHeight): ChimneyParts {
  const rise = Math.max(0, ceiling - canopyTop);
  const section = ft(CHIMNEY.sectionIn);
  const step = ft(CHIMNEY.stepIn);
  const w = ft(CHIMNEY.widthIn);
  const d = ft(CHIMNEY.depthIn);

  // Both sections are the same length and they slide on each other. The outer
  // hangs off the canopy, the inner off the ceiling, and what changes with the
  // room is how much of the inner is still inside the outer. Collapsed they
  // are one section tall; drawn nearly apart they are two.
  const overlap = 2 * section - rise;
  const overIn = -overlap * 12;
  return {
    rise,
    lower: { from: 0, h: section, w, d },
    upper: { from: rise - section, h: section, w: w - step, d: d - step },
    overlap: Math.max(0, overlap),
    needsExtension: overIn > 1e-6,
    shortIn: overIn > 1e-6 ? overIn : 0,
    tooLow: rise < section - 1e-6,
  };
}

/** True when this model hangs its own duct cover rather than living under a box. */
export const isChimney = (appliance: Appliance | undefined) =>
  !!appliance?.installType.some((type) => type === "chimney" || type === "wall-mount");

/** How deep the flat top is, in inches. */
export const hoodTopDepthIn = (appliance: Appliance | undefined, depthIn: number) =>
  Math.min(appliance?.topDepthIn ?? HOOD_PROFILE.defaultTopDepthIn, depthIn);

export interface HoodOutlet {
  /** Centre of the opening, in world feet. */
  position: [number, number, number];
  /** The rectangle itself, in feet. */
  widthFt: number;
  depthFt: number;
  /** The same rectangle in inches, for the copy that quotes it. */
  widthIn: number;
  depthIn: number;
}

/**
 * Where the duct leaves the canopy.
 *
 * One definition, used by three things that must agree: the collar drawn on the
 * hood, the duct that rises from it, and the hole cut in the floor of the
 * cabinet above. Two of those are on opposite sides of a cabinet panel, so a
 * disagreement between them is a duct that misses its hole.
 */
export function hoodOutlet(slot: Slot, appliance: Appliance | undefined): HoodOutlet {
  const { outlet } = CABINET_STANDARDS.hood;
  const depthFt = ft(slot.cutout.d);
  const backZ = slot.position[2] - depthFt / 2;

  return {
    position: [
      slot.position[0],
      slot.position[1] + ft(appliance?.heightIn ?? slot.cutout.h),
      backZ + ft(outlet.fromWallIn),
    ],
    widthFt: ft(outlet.widthIn),
    depthFt: ft(outlet.depthIn),
    widthIn: outlet.widthIn,
    depthIn: outlet.depthIn,
  };
}

/**
 * The underside of the cabinet the duct has to pass through, in feet.
 *
 * That is the bridge over the canopy, whose floor sits at 84" — not the 54" the
 * rest of the wall cabinets start at. Cutting the hole at the wrong height puts
 * it in mid-air.
 */
export function hoodCabinetFloor(): number | null {
  const hood = SLOT_BY_ID["slot-hood"];
  const carries = RUNS.some((run) =>
    run.uppers.some((bank) => bank.modules.some((module) => module.slot === "slot-hood")),
  );
  return carries ? hood.position[1] + ft(hood.cutout.h) : null;
}

/** Formatted for the install checklist and the duct's own callout. */
export const outletSize = () =>
  `${CABINET_STANDARDS.hood.outlet.widthIn}" × ${CABINET_STANDARDS.hood.outlet.depthIn}"`;
