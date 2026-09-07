import { CABINET_STANDARDS, RUNS, ft } from "./room";
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
 * The canopy's section, in inches, as a closed polygon.
 *
 * Measured from the wall (x = 0) outward and from the canopy's underside
 * (y = 0) upward, so it can be extruded along the run without any further
 * arithmetic.
 */
export function hoodProfile(depthIn: number, topDepthIn: number, heightIn: number) {
  const top = Math.min(Math.max(topDepthIn, 1), depthIn);
  const lip = Math.min(HOOD_PROFILE.frontLipIn, heightIn);
  return [
    [0, 0],
    [depthIn, 0],
    [depthIn, lip],
    [top, heightIn],
    [0, heightIn],
  ] as [number, number][];
}

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
