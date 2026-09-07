import { rebuildCabinets } from "./cabinets";
import { rebuildFixtures } from "./fixtures";
import { generateLayout, type LayoutParams, type Refusal } from "./layoutTemplate";
import { PACKAGE, setPackage } from "./packages";
import { LAYOUT, REQUESTED_PARAMS, applyLayout } from "./room";
import { rebuildSlots } from "./slots";

/**
 * Changing the room, in the one order that leaves it consistent.
 *
 * The derived modules form a chain — the slots stand in the runs, the fittings
 * stand in the slots' cabinets, the carcass is cut around both — and rebuilding
 * them out of order draws a run from one layout around appliances from another.
 * So there is exactly one function that changes the room, and it is this.
 *
 * A refusal does not empty the screen. The room that is standing stays
 * standing, the parameters that were asked for are remembered so the control
 * still shows what you dragged it to, and the reasons come back for the
 * interface to print underneath. Answering "no, because the back wall cannot
 * take a range, a sink, a dishwasher and a tower" is the useful outcome; going
 * blank is not.
 */
export function setLayoutParams(params: LayoutParams): { ok: boolean; reasons: Refusal[] } {
  const attempt = generateLayout(params);

  if (!attempt.ok) {
    applyLayout(LAYOUT, params, attempt.reasons);
    return { ok: false, reasons: attempt.reasons };
  }

  applyLayout(attempt.layout, params, []);
  rebuildSlots();
  rebuildFixtures();
  rebuildCabinets();
  return { ok: true, reasons: [] };
}

/**
 * Changing which package the room is built to.
 *
 * The same chain, one link further back: the package decides how wide each
 * opening is, so it has to move before the layout is generated rather than
 * after.
 *
 * A package that will not fit the walls as they stand is rolled back. The room
 * on screen is still the old package's, and leaving the data saying otherwise
 * would draw a 30" range in a 36" hole — so the refusal comes back to be
 * printed, and what is standing stays standing and stays consistent. That is
 * the same bargain a refused slider makes, applied to a bigger change.
 */
export function setActivePackage(id: string): { ok: boolean; reasons: Refusal[] } {
  const previous = PACKAGE.id;
  if (previous === id) return { ok: true, reasons: [] };

  setPackage(id);
  const result = setLayoutParams(REQUESTED_PARAMS);
  if (result.ok) return result;

  setPackage(previous);
  setLayoutParams(REQUESTED_PARAMS);
  return { ok: false, reasons: result.reasons };
}
