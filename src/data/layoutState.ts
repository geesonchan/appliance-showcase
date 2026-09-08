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
 * A package that needs more wall than the room has gets it. Three tall units
 * in one run are 90-5/8" of cabinetry, and a room that was drawn for one
 * refrigerator is a foot short of them — but "no" is the wrong answer to
 * picking a package. A slider is the customer moving one wall and is refused
 * on its own terms; choosing the package is choosing the kitchen, and the room
 * grows to the shortest wall that will take it. What changed is said out loud
 * rather than happening quietly: `adjusted` is what the caller announces.
 *
 * Only the two wall lengths move, and only up to the minimum the refusal
 * itself prints. The rearrangements a refusal also offers are left alone:
 * moving the sink to the other leg to make a package fit would be answering a
 * question nobody asked.
 *
 * A package that still will not fit is rolled back. The room on screen is
 * still the old package's, and leaving the data saying otherwise would draw a
 * 30" range in a 36" hole — so the refusal comes back to be printed, and what
 * is standing stays standing and stays consistent.
 */
export function setActivePackage(id: string): {
  ok: boolean;
  reasons: Refusal[];
  adjusted?: Partial<LayoutParams>;
} {
  const previous = PACKAGE.id;
  if (previous === id) return { ok: true, reasons: [] };

  const asked = REQUESTED_PARAMS;
  setPackage(id);
  const result = setLayoutParams(asked);
  if (result.ok) return result;

  // Taken from the refusal's own figures rather than from the change it
  // offers: a wall that is short says how short, where the suggestion beside
  // it may be to move the sink instead, which is not this function's business.
  const walls: Partial<LayoutParams> = {};
  for (const reason of result.reasons) {
    if (reason.key !== "refusal.wallShort") continue;
    const key = String(reason.vars.paramKey).replace("param.", "");
    const minimumIn = Number(reason.vars.minimumIn);
    if ((key === "backWallIn" || key === "leftWallIn") && Number.isFinite(minimumIn)) {
      walls[key] = minimumIn;
    }
  }
  if (Object.keys(walls).length > 0) {
    const grown = setLayoutParams({ ...asked, ...walls });
    if (grown.ok) return { ok: true, reasons: [], adjusted: walls };
  }

  setPackage(previous);
  setLayoutParams(asked);
  return { ok: false, reasons: result.reasons };
}
