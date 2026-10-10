import { dropsIntoCounter } from "./applianceBox";
import { hoodMount } from "./hoodMount";
import { CABINET_STANDARDS } from "./roomShell";
import { PROTRUSION_DATUM } from "./rules";
import type { Appliance, Category, OpeningAbove, Slot } from "../types";

export interface FitResult {
  /**
   * Whether the appliance can go in this opening at all: its width, and since
   * round 86 its height where something is fixed above the opening, and its
   * kind where the opening is in a tall unit built for another.
   */
  fits: boolean;
  /** Whether the width alone lets it in. */
  widthFits: boolean;
  /** Inches the appliance exceeds the opening by; negative means clearance. */
  widthOverIn: number;
  /**
   * Filler needed on each side when the appliance is narrower than the opening,
   * or null when it is not. Narrow is a trim question, not a blocker: the
   * cabinetmaker adds a filler strip. See docs/decisions.md D5.
   */
  fillerEachSideIn: number | null;
  /**
   * Reported but not gating; null when the appliance has no figure for it.
   * Where something is fixed above the opening, height gates instead: see
   * `tooTallIn`.
   */
  heightOverIn: number | null;
  /**
   * Inches taller than an opening with something fixed above it, which is a
   * refusal; null when it is not taller, or nothing is above. Round 86.
   */
  tooTallIn: number | null;
  /** What is above the opening, for the refusal to name. */
  above: OpeningAbove | null;
  /**
   * Another kind of machine than the tall unit is built for, which its maker
   * has not confirmed for a tall cabinet: a refusal. Round 86, Leo — a
   * microwave drawer and an over-the-range microwave in a combination-oven
   * tower, until a manual says they can be built in (Open items).
   */
  notForTallUnit: boolean;
  /**
   * How far the machine stands proud, measured from the cabinet face.
   *
   * One datum, everywhere a customer can see it: the front of the run is the
   * line their eye follows along a kitchen, and it is what a machine visibly
   * stands out from. The carcass front and the slot's published cutout are
   * draughtsman's datums a foot apart, and printing whichever the calling code
   * had to hand is how one refrigerator got two figures for the same fact.
   * See `protrusionDatum` in data/rules.json.
   */
  depthOverIn: number | null;
}

/** What the opening actually has to accommodate: the cutout if the manufacturer
 * publishes one, otherwise the body itself. */
const required = (cutout: number | null, body: number | null) => cutout ?? body;

/**
 * A machine that exactly fills its space fits. Figures are fractions of an inch
 * added in floating point, so equality is given a millionth of an inch rather
 * than trusted to the last bit. A hung hood's space is its own outline, so it
 * is always exactly equal (D4, round 40).
 */
const FIT_TOLERANCE_IN = 1e-6;

/**
 * Check an appliance against a slot's rough opening.
 *
 * Width is the only dimension that gates. Height and depth are computed and
 * returned so the panel can mention them, but a deep counter-depth
 * refrigerator in a shallow enclosure is a conversation, not a hard no — the
 * enclosure can usually be furred out, where a wall cannot be widened.
 */
export function fitCheck(slot: Slot, appliance: Appliance): FitResult {
  // Only a blower has no width, and a blower is never a candidate for a slot,
  // so this cannot report on one. Treated as no overrun rather than thrown,
  // because a fit check has nothing to say about a part that goes in no opening.
  const width = required(appliance.cutoutWidthIn, appliance.widthIn);
  const widthOverIn = width === null ? 0 : width - slot.cutout.w;
  const height = required(appliance.cutoutHeightIn, appliance.heightIn);
  const depth = depthFromWallIn(appliance);
  const widthFits = widthOverIn <= FIT_TOLERANCE_IN;
  const above = slot.above ?? null;
  const tallerIn = tooTallIn(appliance, slot.cutout.h, above);
  const otherKind = notForTallUnit(appliance, slot.tallUnitFor ?? null);

  return {
    fits: widthFits && tallerIn === null && !otherKind,
    widthFits,
    widthOverIn,
    // What is left over each side of a machine is filler — unless the machine
    // is not standing in the opening at all. A liner hangs on the ledge of a
    // hole cut in the underside of a housing that is wider than it on purpose;
    // a rangetop drops through the stone, and what closes round it is the
    // stone. Calling either one two strips of panel would be quoting parts
    // nobody orders.
    fillerEachSideIn: widthOverIn < 0 && !dropsIntoSomething(appliance) ? -widthOverIn / 2 : null,
    heightOverIn: height === null ? null : height - slot.cutout.h,
    tooTallIn: tallerIn,
    above,
    notForTallUnit: otherKind,
    // How far it stands proud of the cabinet face, which is a warning about a
    // machine built into cabinetry and a fact about one that is not. A rangetop
    // is *meant* to stand 1-1/2" out: that is where its controls are, and it is
    // on the install list as a clearance rather than here as an overrun.
    //
    // Nor is there anything to stand proud of under a hood hung over an
    // island: no wall, no cabinet face, no enclosure to fur out. Round 69 —
    // package E's checklist said "3\" deeper than the opening" under one.
    depthOverIn:
      depth === null || dropsIntoCounter(appliance) || hungOverAnIsland(slot)
        ? null
        : depth - protrusionDatumIn(slot),
  };
}

/**
 * How much taller than an opening with something fixed above it a machine is,
 * or null where it is not taller or nothing is above. Round 86.
 *
 * The one judgement of it: `fitCheck` asks it for the list, the model card and
 * everything else that reads a fit, and `suitsPackageSlot` asks it for a
 * package switch, so the two copies of "can this model go in this slot"
 * (D17's table, first row) do not grow a third answer for height. Measured as
 * width is — the published cutout, else the body — with the same millionth of
 * an inch for figures added in floating point. A machine with no height
 * figure is let through: there is nothing to refuse it on.
 */
export function tooTallIn(
  appliance: Appliance,
  openingHeightIn: number,
  above: OpeningAbove | null,
): number | null {
  if (above === null) return null;
  const height = required(appliance.cutoutHeightIn, appliance.heightIn);
  if (height === null) return null;
  const over = height - openingHeightIn;
  return over > FIT_TOLERANCE_IN ? over : null;
}

/**
 * Whether a machine is another kind than the tall unit it is offered for was
 * built for. Round 86, Leo: not allowed until its maker confirms it can go in
 * a tall cabinet — a built-in kit, a manual that says so. No model in the
 * catalogue records that yet (Open items).
 */
export const notForTallUnit = (appliance: Appliance, tallUnitFor: Category | null): boolean =>
  tallUnitFor !== null && appliance.category !== tallUnitFor;

/** A hood hung from the ceiling over an island: nothing round it to measure against. */
const hungOverAnIsland = (slot: Slot) => slot.id === "slot-hood" && slot.mount === "island";

/**
 * How far a machine's face stands from the wall behind it, in inches.
 *
 * What sticks out is the machine, not the hole it needs. A cutout depth is a
 * rough opening — an inch of it is service space behind the machine — so
 * measuring a protrusion against it reports a built-in as standing an inch
 * proud of cabinets it finishes flush with. The doors where the model
 * publishes them, then the body, and the cutout only when there is nothing
 * else to go on.
 *
 * Plus whatever holds the machine off the plaster. A freestanding
 * refrigerator carries spacers on its back, and they are as real as the doors:
 * the sheet's 28-3/4" is the machine, the inch behind it is where the machine
 * has to stand, and 29-3/4" from the wall is what the customer sees — 5-3/4"
 * proud of a 24" panel.
 */
export function depthFromWallIn(appliance: Appliance): number | null {
  const depth = appliance.depthWithDoorsIn ?? appliance.depthIn ?? appliance.cutoutDepthIn;
  return depth === null ? null : depth + (appliance.rearSpacerIn ?? 0);
}

/**
 * The line a protrusion is measured from, in inches.
 *
 * The cabinet face for everything that stands in a run, which is the datum the
 * whole app prints; a hood is the exception, because it hangs off the wall and
 * has no run to be proud of.
 */
export function protrusionDatumIn(slot: Slot): number {
  if (PROTRUSION_DATUM === "cutout" || slot.id === "slot-hood") return slot.cutout.d;
  return CABINET_STANDARDS.base.depthIn;
}

/** Whether the opening closes round the machine rather than being filled. */
const dropsIntoSomething = (appliance: Appliance) =>
  dropsIntoCounter(appliance) || (appliance.category === "hood" && hoodMount(appliance) === "insert");

/** Inches to one decimal, without a trailing ".0" on whole numbers. */
export const formatInches = (value: number) =>
  `${Number(value.toFixed(1))}"`;

/**
 * The opening a model actually needs: the published cutout where there is one,
 * otherwise the body itself.
 *
 * This is not the same thing as the slot's opening, and the difference is the
 * whole point of showing both. A 36" slot at 72" high accepts a 36"-wide
 * refrigerator that still needs 84" of height, and only a card that prints the
 * two side by side makes that visible before the cabinetmaker does.
 */
export function requiredOpening(appliance: Appliance): {
  w: number | null;
  h: number | null;
  d: number | null;
} {
  return {
    w: required(appliance.cutoutWidthIn, appliance.widthIn),
    h: required(appliance.cutoutHeightIn, appliance.heightIn),
    d: required(appliance.cutoutDepthIn, appliance.depthIn),
  };
}

/**
 * Two widths closer than this read as one in the appliance list, in inches.
 * A display figure with no outside source (Leo, round 79): 35-15/16" in a 36"
 * opening is the same size to anybody reading a list, and a threshold of a
 * sixteenth would sit exactly on that case.
 */
export const SAME_WIDTH_WITHIN_IN = 0.5;

/**
 * The width the appliance list prints for a slot: the machine's own, and the
 * opening beside it only where the two differ. Round 79, Leo — the list used
 * to print the opening alone, so a 30" hood in a 36" slot read as 36".
 */
export function listWidth(
  appliance: Appliance | undefined,
  slot: Slot,
): { modelIn: number; openingIn: number | null } {
  const modelIn = appliance ? (appliance.widthIn ?? appliance.cutoutWidthIn ?? slot.cutout.w) : slot.cutout.w;
  const differs = Math.abs(modelIn - slot.cutout.w) > SAME_WIDTH_WITHIN_IN;
  return { modelIn, openingIn: differs ? slot.cutout.w : null };
}
