import { rebuildCabinets } from "./cabinets";
import { rebuildFixtures } from "./fixtures";
import { generateLayout, type LayoutParams } from "./layoutTemplate";
import { LAYOUT, applyLayout } from "./room";
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
export function setLayoutParams(params: LayoutParams): { ok: boolean; reasons: string[] } {
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
