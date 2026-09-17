import { rebuildCabinets } from "./cabinets";
import { rebuildFixtures } from "./fixtures";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  generateLayout,
  wallRequirement,
  type LayoutParams,
  type Refusal,
} from "./layoutTemplate";
import { PACKAGE, PACKAGE_BY_ID, setPackage } from "./packages";
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

type WallKey = "backWallIn" | "leftWallIn";
const WALL_KEYS: WallKey[] = ["backWallIn", "leftWallIn"];

/** A wall the room grew so a change would fit, and by how much. */
export interface WallGrowth {
  key: WallKey;
  fromIn: number;
  toIn: number;
}

/**
 * The longer walls a refusal could be cured by, or null if it is not about
 * length.
 *
 * A wall that is short says how short. A room whose island will not fit across
 * it offers a longer wall as its way out, and that is the same cure. Anything
 * else — a window that will not sit evenly, a sink and a refrigerator on one
 * leg — is not something more wall fixes.
 */
function wallsFor(reason: Refusal): Partial<Record<WallKey, number>> | null {
  const key = String(reason.vars.paramKey ?? "").replace("param.", "") as WallKey;
  if (reason.key === "refusal.wallShort") {
    const minimumIn = Number(reason.vars.minimumIn);
    return WALL_KEYS.includes(key) && Number.isFinite(minimumIn) ? { [key]: minimumIn } : null;
  }
  // An island too long for the wall its length runs along — which is what
  // turning it across the room does in a shallow room. Its own figures say how
  // much wall it wants: the island, plus the run and the aisle behind it, which
  // is the difference between the wall and the room it left.
  if (reason.key === "refusal.islandLong") {
    const needIn =
      Number(reason.vars.islandIn) + (Number(reason.vars.wallIn) - Number(reason.vars.roomIn));
    return WALL_KEYS.includes(key) && Number.isFinite(needIn) ? { [key]: needIn } : null;
  }
  // A window that will not sit evenly in its wall. The two banks each side of it
  // finish on whatever the wall leaves, so the wall grows an eighth at a time
  // until they match, which is the same cure as any other length and a better
  // one than the refusal's own offer to narrow the window.
  //
  // Round 35's example of it — package D refused at a 178-3/4" left wall and
  // building at 178-7/8" — was not a fact about the room: the window was
  // searched a quarter inch at a time against an eighth-inch tolerance, and
  // 178-3/4" builds since round 60. This path stays for the walls that really
  // do leave the two banks uneven.
  if (reason.key === "refusal.windowGap") {
    const leg = String(reason.vars.wallKey ?? "").replace("leg.", "");
    const wall = leg === "back" ? "backWallIn" : leg === "left" ? "leftWallIn" : null;
    return wall ? { [wall]: Number.NaN } : null;
  }
  const patch = reason.suggestion?.patch;
  if (!patch) return null;
  const keys = Object.keys(patch);
  if (keys.length === 0 || !keys.every((key) => WALL_KEYS.includes(key as WallKey))) return null;
  return patch as Partial<Record<WallKey, number>>;
}

/**
 * Change the room, growing a wall to the shortest length that takes the change.
 *
 * Round 34, Leo: a switch that asks for more wall than the room has — a return
 * wall past the refrigerator, the tower on the other side of the range — gets
 * it, and the room is rebuilt at once, rather than refusing in front of a
 * customer and making somebody go and find the slider. The wall grows only as
 * far as the change needs, never shrinks, and what grew is returned for the
 * interface to say out loud and offer to undo.
 *
 * It still refuses, with exactly the reasons it always gave, when growing is
 * not the answer: when a wall would have to pass the slider's 204", or when
 * something other than length is in the way. The wall sliders do not come
 * through here at all — dragging one is asking for that length, and a length
 * that will not build is refused on its own terms.
 */
export function setLayoutParamsGrowing(params: LayoutParams): {
  ok: boolean;
  reasons: Refusal[];
  params: LayoutParams;
  grown: WallGrowth[];
} {
  const first = setLayoutParams(params);
  if (first.ok) return { ...first, params, grown: [] };

  const refuse = () => {
    // Leave the room standing and the request remembered, as a refusal always has.
    setLayoutParams(params);
    return { ok: false, reasons: first.reasons, params, grown: [] as WallGrowth[] };
  };

  let next = params;
  let reasons = first.reasons;
  // Growing one wall can change what the other is asked for, so it is tried
  // again with what the new refusal says. A window that will not sit evenly
  // is cured an eighth of an inch at a time, so there are enough rounds for a
  // couple of inches of that on top of the lengths themselves.
  for (let round = 0; round < 24; round += 1) {
    const wanted: Partial<Record<WallKey, number>> = {};
    for (const reason of reasons) {
      const walls = wallsFor(reason);
      if (!walls) return refuse();
      for (const key of WALL_KEYS) {
        const asked = walls[key];
        if (asked === undefined) continue;
        // NaN is a window's "a little more": the next eighth up from here.
        const value = Number.isNaN(asked) ? next[key] + 1 / 8 : asked;
        wanted[key] = Math.max(wanted[key] ?? 0, value);
      }
    }
    let changed = false;
    for (const key of WALL_KEYS) {
      const value = wanted[key];
      if (value === undefined) continue;
      if (value > PARAM_LIMITS[key].max) return refuse();
      if (value > next[key]) {
        next = { ...next, [key]: value };
        changed = true;
      }
    }
    if (!changed) return refuse();

    const attempt = setLayoutParams(next);
    if (attempt.ok) {
      const grown = WALL_KEYS.filter((key) => next[key] !== params[key]).map((key) => ({
        key,
        fromIn: params[key],
        toIn: next[key],
      }));
      return { ok: true, reasons: [], params: next, grown };
    }
    reasons = attempt.reasons;
  }
  return refuse();
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
/** The island figures a package's default room may name. */
const ISLAND_FIELDS = ["islandLengthIn", "islandDepthIn", "islandOverhangIn", "aisleIn"] as const;

export function setActivePackage(id: string): {
  ok: boolean;
  reasons: Refusal[];
  /** Everything the switch changed from the room asked for: arrangement and walls. */
  adjusted?: Partial<LayoutParams>;
  /**
   * Only the walls that came out longer than they were. Round 60: a package's
   * own arrangement — B's sink on the left leg — is an adjustment, not the room
   * growing, and the store used to announce any adjustment as growth, so D's
   * room chosen as B said "the room is now 224.3″ × 178.9″" with no wall moved.
   */
  grown?: Partial<Pick<LayoutParams, "backWallIn" | "leftWallIn">>;
} {
  const previous = PACKAGE.id;
  if (previous === id) return { ok: true, reasons: [] };

  const asked = REQUESTED_PARAMS;
  setPackage(id);
  // The arrangement the package is designed around, where it names one. Its
  // wall lengths are a floor rather than a setting: a package's default room
  // has the slack its switches need (round 34), and choosing it never shrinks a
  // room somebody has already made bigger.
  const defaults = PACKAGE.defaultLayout;
  // The island a package names is that package's. Leaving it for one that
  // names none puts the ordinary island back rather than carrying a 15"
  // seating overhang and a 48" cooking aisle into a kitchen that has neither.
  // A package that names nothing about its island, arriving from another that
  // names nothing either, leaves the customer's island exactly as it was —
  // which is every switch between A and D. Round 56.
  const left = PACKAGE_BY_ID[previous]?.defaultLayout ?? {};
  const released: Partial<LayoutParams> = {};
  for (const key of ISLAND_FIELDS) {
    if (left[key] !== undefined && defaults[key] === undefined) {
      (released as Record<string, unknown>)[key] = DEFAULT_PARAMS[key];
    }
  }
  const arranged: LayoutParams = {
    ...asked,
    ...released,
    ...defaults,
    backWallIn: Math.max(asked.backWallIn, defaults.backWallIn ?? 0),
    leftWallIn: Math.max(asked.leftWallIn, defaults.leftWallIn ?? 0),
  };
  const moved: Partial<LayoutParams> = {};
  for (const key of [...Object.keys(defaults), ...Object.keys(released)] as (keyof LayoutParams)[]) {
    if (asked[key] !== arranged[key]) {
      (moved as Record<string, unknown>)[key] = arranged[key];
    }
  }

  // Which walls a room that built came out longer than the room asked for.
  const grownFrom = (built: LayoutParams) => {
    const grown: Partial<Pick<LayoutParams, "backWallIn" | "leftWallIn">> = {};
    for (const key of ["backWallIn", "leftWallIn"] as const) {
      if (built[key] > asked[key]) grown[key] = built[key];
    }
    return Object.keys(grown).length > 0 ? { grown } : {};
  };

  const result = setLayoutParams(arranged);
  if (result.ok) {
    return Object.keys(moved).length > 0
      ? { ok: true, reasons: [], adjusted: moved, ...grownFrom(arranged) }
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
    if (grown.ok) {
      return { ok: true, reasons: [], adjusted: { ...moved, ...walls }, ...grownFrom({ ...arranged, ...walls }) };
    }
  }

  // A room shaped for another package can refuse this one for a reason that
  // is not length at all: package D's left wall is long enough for
  // package B's sink leg, and B's window will not sit evenly in it. Choosing a
  // package is still choosing the kitchen, so it gets the room it asks for —
  // both walls at what its own legs want — before the switch is given up.
  const asksFor: Partial<LayoutParams> = {
    backWallIn: wallRequirement(arranged, "back").wantedIn,
    leftWallIn: wallRequirement(arranged, "left").wantedIn,
  };
  if (asksFor.backWallIn !== arranged.backWallIn || asksFor.leftWallIn !== arranged.leftWallIn) {
    const sized = setLayoutParams({ ...arranged, ...asksFor });
    if (sized.ok) {
      return { ok: true, reasons: [], adjusted: { ...moved, ...asksFor }, ...grownFrom({ ...arranged, ...asksFor }) };
    }
  }

  setPackage(previous);
  setLayoutParams(asked);
  return { ok: false, reasons: result.reasons };
}
