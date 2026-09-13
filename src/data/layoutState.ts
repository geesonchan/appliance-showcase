import { rebuildCabinets } from "./cabinets";
import { rebuildFixtures } from "./fixtures";
import {
  generateLayout,
  wallRequirement,
  type LayoutParams,
  type Refusal,
} from "./layoutTemplate";
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
 * Only the two wall lengths move, and they move to the wall the package asks
 * for rather than to the shortest one that will take it: a room grown to the
 * inch leaves every stretch of counter at the minimum a rule will accept,
 * which is not a kitchen anybody would draw. The rearrangements a refusal
 * offers are still left alone — moving the sink to the other leg to make a
 * package fit is not this function's decision.
 *
 * Where a package has made that decision itself, it says so: `defaultLayout`
 * is the arrangement the package is designed around, and choosing the package
 * applies it. Package B's cooking wall carries an oven tower, and a leg with
 * the tower, the cooking surface and the sink on it has no room left for the
 * landings each side of the burners — so B puts the sink on the other leg.
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
  // The arrangement the package is designed around, where it names one.
  const arranged = { ...asked, ...PACKAGE.defaultLayout };
  const moved: Partial<LayoutParams> = {};
  for (const [key, value] of Object.entries(PACKAGE.defaultLayout)) {
    if (asked[key as keyof LayoutParams] !== value) {
      (moved as Record<string, unknown>)[key] = value;
    }
  }

  const result = setLayoutParams(arranged);
  if (result.ok) {
    return Object.keys(moved).length > 0
      ? { ok: true, reasons: [], adjusted: moved }
      : result;
  }

  // Taken from the refusal's own figures rather than from the change it
  // offers: a wall that is short says how short, where the suggestion beside
  // it may be to move the sink instead, which is not this function's business.
  //
  // The figure taken is the wall the package asks for, not the shortest one
  // that will take it. They are the same wall wherever nothing on the leg
  // wants more than its rule requires; where something does — eighteen inches
  // of landing each side of a cooking surface — this is where it gets it.
  const walls: Partial<LayoutParams> = {};
  for (const reason of result.reasons) {
    if (reason.key !== "refusal.wallShort") continue;
    const key = String(reason.vars.paramKey).replace("param.", "");
    const wantedIn = Number(reason.vars.wantedIn ?? reason.vars.minimumIn);
    if ((key === "backWallIn" || key === "leftWallIn") && Number.isFinite(wantedIn)) {
      walls[key] = wantedIn;
    }
  }
  if (Object.keys(walls).length > 0) {
    const grown = setLayoutParams({ ...arranged, ...walls });
    if (grown.ok) return { ok: true, reasons: [], adjusted: { ...moved, ...walls } };
  }

  // A room shaped for another package can refuse this one for a reason that
  // is not length at all: package D's 175-1/4" left wall is long enough for
  // package B's sink leg, and B's window will not sit evenly in it. Choosing a
  // package is still choosing the kitchen, so it gets the room it asks for —
  // both walls at what its own legs want — before the switch is given up.
  const asksFor: Partial<LayoutParams> = {
    backWallIn: wallRequirement(arranged, "back").wantedIn,
    leftWallIn: wallRequirement(arranged, "left").wantedIn,
  };
  if (asksFor.backWallIn !== arranged.backWallIn || asksFor.leftWallIn !== arranged.leftWallIn) {
    const sized = setLayoutParams({ ...arranged, ...asksFor });
    if (sized.ok) return { ok: true, reasons: [], adjusted: { ...moved, ...asksFor } };
  }

  setPackage(previous);
  setLayoutParams(asked);
  return { ok: false, reasons: result.reasons };
}
