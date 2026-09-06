import type { Appliance, Slot } from "../types";

export interface FitResult {
  /** Whether the appliance can go in this opening at all. */
  fits: boolean;
  /** Inches the appliance exceeds the opening by; negative means clearance. */
  widthOverIn: number;
  /**
   * Filler needed on each side when the appliance is narrower than the opening,
   * or null when it is not. Narrow is a trim question, not a blocker: the
   * cabinetmaker adds a filler strip. See docs/decisions.md D5.
   */
  fillerEachSideIn: number | null;
  /** Reported but not gating; null when the appliance has no figure for it. */
  heightOverIn: number | null;
  depthOverIn: number | null;
}

/** What the opening actually has to accommodate: the cutout if the manufacturer
 * publishes one, otherwise the body itself. */
const required = (cutout: number | null, body: number | null) => cutout ?? body;

/**
 * Check an appliance against a slot's rough opening.
 *
 * Width is the only dimension that gates. Height and depth are computed and
 * returned so the panel can mention them, but a deep counter-depth
 * refrigerator in a shallow enclosure is a conversation, not a hard no — the
 * enclosure can usually be furred out, where a wall cannot be widened.
 */
export function fitCheck(slot: Slot, appliance: Appliance): FitResult {
  const widthOverIn = required(appliance.cutoutWidthIn, appliance.widthIn)! - slot.cutout.w;
  const height = required(appliance.cutoutHeightIn, appliance.heightIn);
  const depth = required(appliance.cutoutDepthIn, appliance.depthIn);

  return {
    fits: widthOverIn <= 0,
    widthOverIn,
    fillerEachSideIn: widthOverIn < 0 ? -widthOverIn / 2 : null,
    heightOverIn: height === null ? null : height - slot.cutout.h,
    depthOverIn: depth === null ? null : depth - slot.cutout.d,
  };
}

/** Inches to one decimal, without a trailing ".0" on whole numbers. */
export const formatInches = (value: number) =>
  `${Number(value.toFixed(1))}"`;
