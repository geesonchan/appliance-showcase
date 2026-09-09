import {
  CABINET_STANDARDS,
  LAYOUT_LIMITS,
  PANEL,
  PANEL_IN,
  ROOM,
  ft,
  type CabinetModule,
  type CabinetRun,
  type HousingStyle,
  type ModuleKind,
  type RunSegment,
  type UpperBank,
} from "./roomShell";
import type { FixtureId, Package, PackageSlot, SlotId } from "../types";
import { PACKAGE, slotsOf } from "./packages";
import { LAYOUT_POLICY, shrinkRank, type ShrinkGroup } from "./layoutPolicy";
import { comboSillFor } from "./columnModel";
import { hoodCabinetBand } from "./insertHood";

/**
 * The L-with-island template.
 *
 * A layout is a template plus a set of parameters, and the generator's job is
 * to turn those into a list of cabinets you could order — not into a picture
 * that looks about right. Everything it emits goes through `checkLayout`, so a
 * set of parameters that cannot be built comes back as a refusal with a reason
 * rather than a room with a 2" gap in it.
 *
 * The nine parameters are the whole of the L: how long each wall is, what turns
 * the corner, where the refrigerator and the sink go, and whether there is an
 * island. That is deliberately not "anything you like" — U-shapes and galleys
 * are different templates, and a free 2D canvas is not a template at all.
 *
 * What comes back is a plain array of plain objects. That is D14, and it
 * matters before M3-4 exists: the composer will splice items into these tracks,
 * and a derived value has nowhere to write "edit item 3".
 */
export interface LayoutParams {
  /** The wall the L's long leg runs along, in inches. */
  backWallIn: number;
  /** The wall the short leg runs along. */
  leftWallIn: number;
  /** A lazy susan turns the corner; a blind corner runs past it. */
  cornerType: "lazy-susan" | "blind";
  /** Which leg of the L the refrigerator tower finishes. */
  fridgeEnd: "left" | "back";
  /**
   * Which side of the cooking surface an oven tower stands, in packages that
   * have one. See D11 rule 12.
   */
  towerSide: "left" | "right";
  /**
   * Which shape the hood housing is built in, where the hood is an insert.
   *
   * A straight breast boarded in shiplap, or a face that sweeps up and in to a
   * narrow flue. The liner, the clearance and the duct are the same either
   * way: this is the joinery round them, and it is the one part of a hood a
   * customer has an opinion about. See `insertHood.ts`.
   */
  housingStyle: HousingStyle;
  /** Which way the island's long side runs: along the back wall, or across it. */
  islandOrientation: "parallel" | "perpendicular";
  /**
   * How high off the floor the microwave's handle lands, in packages with an
   * oven tower.
   *
   * The tower is built round this rather than the other way round: a person
   * reaches to a height, and the joiner cuts the hole that puts the handle
   * there. 54" is the chest of somebody six foot. What the drawing allows is
   * 4-3/4" to 18" of sill, so the reachable band is 43-3/4" to 57" and a
   * figure outside it is clamped — with the install list saying by how much.
   */
  microwaveHandleIn: number;
  /**
   * What is at the far end of that leg, past the refrigerator.
   *
   * A refrigerator door opens through more than the machine's own width. Beside
   * a standard 24" cabinet that costs nothing: the door sweeps past its front
   * and the manufacturer asks for an eighth of an inch. Beside a return wall it
   * costs three and a half inches, or the door will not open far enough to pull
   * the drawers out. See docs/decisions.md D11 rule 11.
   */
  fridgeEndAbuts: "cabinet" | "wall";
  /** Which leg carries the sink, and therefore the dishwasher beside it. */
  sinkLeg: "left" | "back";
  hasIsland: boolean;
  islandLengthIn: number;
  islandDepthIn: number;
  /** The working aisle between the island and the perimeter run. */
  aisleIn: number;
}

/**
 * The range each dimension may take, and the step it moves in.
 *
 * The steps are the trade's. The ends are the whole of what a wall could
 * physically be, not what this configuration can use — what it can use is
 * `feasibleRange`, which is narrower and moves as the other parameters move.
 * A slider that silently shortens itself teaches nothing; one that greys out
 * what it cannot do, with the arithmetic underneath, teaches the constraint.
 */
export const PARAM_LIMITS = {
  // Two hundred and four: a 180" run plus the corner cabinet's own depth at
  // the end of it, which is the longest wall the leg rule allows.
  backWallIn: { min: 96, max: 204, step: 6 },
  leftWallIn: { min: 96, max: 204, step: 6 },
  islandLengthIn: { min: 48, max: 96, step: 6 },
  islandDepthIn: { min: 24, max: 42, step: 6 },
  aisleIn: { min: 42, max: 60, step: 3 },
  microwaveHandleIn: { min: 44, max: 60, step: 1 },
};

export const DEFAULT_PARAMS: LayoutParams = {
  backWallIn: 168,
  leftWallIn: 144,
  // A blind corner is what most kitchens actually have: it is the cheaper box
  // and the one a cabinetmaker reaches for unless somebody asks for a susan.
  cornerType: "blind",
  fridgeEnd: "left",
  // Right, because a right-handed cook turns from the burners to the oven and
  // the sink is the other way. It is a parameter because kitchens are not.
  towerSide: "right",
  // The straight breast, which is the commoner of the two and the one that
  // takes the least explaining when it is not what somebody wanted.
  housingStyle: "box",
  islandOrientation: "parallel",
  microwaveHandleIn: 54,
  fridgeEndAbuts: "cabinet",
  sinkLeg: "back",
  hasIsland: true,
  islandLengthIn: 72,
  islandDepthIn: 36,
  aisleIn: 42,
};

export interface SlotPlacement {
  position: [number, number, number];
  rotationY: number;
  mount: "wall" | "island";
}

export interface IslandLayout {
  /** False when the parameters asked for no island; the extents are then empty. */
  present: boolean;
  x: readonly [number, number];
  z: readonly [number, number];
  /**
   * Which way the long side runs.
   *
   * `x` is parallel to the back wall, which is what an island in an L-shaped
   * kitchen usually is. `z` turns it a quarter turn so the long side faces the
   * left run instead — the same island, in a room that is deeper than it is
   * wide. Everything on it is spaced along this axis.
   */
  axis: "x" | "z";
  /** The face a cook works at, as a coordinate on the other axis. */
  working: number;
  /** And the face people sit at, which is the far side of it. */
  seating: number;
  height: number;
  /** The two openings, measured along `axis`. */
  microwave: readonly [number, number];
  wine: readonly [number, number];
}

/** The island's extent across its long axis: its depth, in room coordinates. */
export const islandAcross = (island: IslandLayout) =>
  island.axis === "x" ? island.z : island.x;

/**
 * A point on the island, from a distance along it and one across it.
 *
 * Everything about an island is easier to say in its own terms — this far
 * along, this far across — and only the last step needs to know which way it
 * is turned.
 */
export const islandPoint = (
  island: IslandLayout,
  alongAt: number,
  acrossAt: number,
  y = 0,
): [number, number, number] =>
  island.axis === "x" ? [alongAt, y, acrossAt] : [acrossAt, y, alongAt];

export interface GeneratedLayout {
  params: LayoutParams;
  runs: CabinetRun[];
  island: IslandLayout;
  slots: Record<SlotId, SlotPlacement>;
  fixtures: Record<FixtureId, SlotPlacement>;
  /**
   * What the package names and the room was built without.
   *
   * Only ever the island's two machines, and only ever in a room with no
   * island to put them on. Everything that draws or counts reads this; the
   * checklist says it out loud.
   */
  omitted: readonly SlotId[];
}

/**
 * One thing taking up a wall, and what says it has to be there.
 *
 * Every figure the interface prints about a refusal comes from one of these,
 * so every number on screen is traceable to a cabinet somebody orders or a rule
 * somebody wrote down. "The back wall is 6 inches short" is an assertion; "36"
 * of range, 30" of sink base, 24" of dishwasher and three landings" is an
 * argument.
 */
export interface RequirementItem {
  widthIn: number;
  /** The module it is, when it is a cabinet: LS36, RO36, SB30. */
  code?: string;
  /** The rule that puts it there, when it is a stretch of counter: "d11-4". */
  rule?: string;
  labelKey: string;
}

/** What has to go on a leg, and the wall lengths that hold it. */
export interface WallRequirement {
  leg: "left" | "back";
  items: RequirementItem[];
  /** Including whatever the corner takes out of this leg's wall. */
  minimumIn: number;
  /**
   * The wall this leg would be built to if nothing were tight.
   *
   * The minimum plus what its stretches ask for over it: eighteen inches of
   * landing each side of a cooking surface rather than the six a rule will
   * accept. It is not a constraint — a shorter wall builds, and says what it
   * gave up — it is the wall a package is put into when the package is chosen
   * and the room has to be sized for it.
   */
  wantedIn: number;
  /** D13 caps a leg at 180"; past that it is two runs, not one. */
  maximumIn: number;
}

/**
 * A refusal, as a message the interface can render and act on.
 *
 * The text is a key and its values rather than a sentence, because a refusal is
 * as much a part of the product as the room is and the product is bilingual. A
 * value whose name ends in `Key` is itself a key, translated before it is
 * substituted.
 */
export interface Refusal {
  key: string;
  vars: Record<string, string | number>;
  /** What is on the wall, when the wall being too short is the problem. */
  occupancy?: RequirementItem[];
  /** A change that would make this build, ready to apply. */
  suggestion?: { key: string; vars: Record<string, string | number>; patch: Partial<LayoutParams> };
}

export type GenerateResult =
  | { ok: true; layout: GeneratedLayout }
  | { ok: false; reasons: Refusal[] };

const M = (
  code: string,
  kind: ModuleKind,
  widthIn: number,
  extra: Partial<CabinetModule> = {},
): CabinetModule => ({ code, kind, widthIn, ...extra });

const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;

/**
 * The two corners, in the two dimensions that matter.
 *
 * `along` is how much of its own leg the corner cabinet takes; `across` is how
 * far into the other leg it reaches, which is where that leg has to start. A
 * lazy susan is a 36" square, so both are 36. A blind corner is a 42" box on
 * one leg with a 24" blind end, so the other leg picks up 24" in — twelve
 * inches of extra wall, which is often the difference between a layout that
 * builds and one that does not.
 */
export const CORNERS = {
  "lazy-susan": {
    alongIn: CABINET_STANDARDS.corner.lazySusanIn,
    acrossIn: CABINET_STANDARDS.corner.lazySusanIn,
    /** Square: it is as deep as it is wide, which is why it fills the corner. */
    depthIn: CABINET_STANDARDS.corner.lazySusanIn,
    code: `LS${CABINET_STANDARDS.corner.lazySusanIn}`,
    /**
     * The wall cabinet over it. A diagonal corner box is square like the susan
     * below it, so the other leg's bank starts 24" in; a blind wall corner is
     * an ordinary 12" deep box with a blind end, so that bank picks up at 12".
     * The two go together — you do not put a blind base under a diagonal wall
     * cabinet, and the door swings would not agree if you did.
     */
    upper: { code: "WER2442", alongIn: 24, acrossIn: 24, depthIn: 24 },
  },
  blind: {
    alongIn: CABINET_STANDARDS.corner.blindIn,
    acrossIn: 24,
    depthIn: CABINET_STANDARDS.base.depthIn,
    code: `BBC${CABINET_STANDARDS.corner.blindIn}`,
    upper: { code: "WBC2442", alongIn: 24, acrossIn: 12, depthIn: CABINET_STANDARDS.upper.depthIn },
  },
} as const;

/** The openings, dimensioned to the appliances that go in them. */
/** The sink base, which is a fixture's cabinet rather than an opening. */
const SINK_BASE_IN = 30;

/**
 * The opening a slot needs, in inches.
 *
 * The appliance's own width, plus a finished panel each side where the
 * cabinetmaker builds round it. A built-in refrigerator is 36" of appliance in
 * a 42" hole; a freestanding one is 36" of appliance and nothing else, and
 * charging it for panels nobody ordered is how a wall comes out 6" short.
 */
export const openingIn = (slot: PackageSlot) =>
  slot.widthIn + (slot.enclosure ? PANEL_IN * 2 : 0);

/** How far in from its opening the appliance itself sits. */
export const insetOf = (slot: PackageSlot) => (slot.enclosure ? PANEL : 0);

/**
 * Where each category stands in the L.
 *
 * The package says what is on the list and how wide it is; this says what the
 * template does with it. They are different kinds of knowledge: a new package
 * is a data file, but a kitchen with a second oven in it is a new template.
 * A category with no entry here is a package the template cannot build, and it
 * says so rather than quietly leaving the appliance out.
 */
const ROLES = {
  refrigerator: "tower",
  "wall-oven": "tower",
  range: "range",
  hood: "over-range",
  dishwasher: "sink-group",
  microwave: "island-or-perimeter",
  wine: "island-or-perimeter",
} as const;

/**
 * The bank of full-height units at the end of a run, inner end first.
 *
 * D11 rule 12. The refrigerator is outermost because it is the widest and the
 * one people walk to from the room rather than along the counter; the wine
 * column stands beside it, hinged away from it so the two doors open back to
 * back; the oven tower is innermost, nearest the counter it loads onto.
 *
 * A package with one tall unit builds the tower it always built. This is the
 * order the rest of them stand in when there is more than one.
 */
const TALL_ORDER: readonly SlotId[] = ["slot-microwave", "slot-wine", "slot-fridge"];

/**
 * What goes between two refrigeration columns standing side by side.
 *
 * Thermador's own kit rather than a piece of panel: two columns share a
 * 5/8" divider that carries the trim and keeps the doors from fouling each
 * other. Ovens and joinery do not take one — a tall oven cabinet already has
 * its own sides inside its 30".
 */
const COLUMN_SPACER = { code: "COMBIKIT10", widthIn: 0.625 } as const;

/**
 * How far off the floor a tall unit's opening starts.
 *
 * The package's own figure for anything that stands on the floor of its
 * opening. For the oven tower it is worked backwards from where the
 * microwave's handle should land — the parameter is the reach, and this is the
 * hole that produces it, clamped to what the machine's drawing allows.
 */
export function sillFor(slot: PackageSlot, params: LayoutParams): number {
  if (slot.beside !== "range") return slot.sillIn;
  return comboSillFor(params.microwaveHandleIn).sillIn;
}

/**
 * Whether a slot is one of the two an island carries.
 *
 * The island's machines are the ones that are neither on the perimeter by
 * rule nor standing in the tall bank. A package whose wine is an 84" column
 * has no island machine in it, and its island — if the room has one — is a
 * prep island, which is what an island is when nobody puts an appliance in it.
 */
const isSpare = (slot: PackageSlot | undefined) => !!slot && !slot.tallUnit;

/** Whether two adjacent tall slots are the pair that kit is for. */
const takesSpacer = (a: PackageSlot | undefined, b: PackageSlot | undefined) =>
  !!a &&
  !!b &&
  ["refrigerator", "wine"].includes(a.category) &&
  ["refrigerator", "wine"].includes(b.category);

// --- packing a leg --------------------------------------------------------

/**
 * One thing on a leg: either a fixed width, or a stretch of counter that takes
 * whatever is left over.
 */
export type Item =
  | {
      kind: "fixed";
      id: string;
      widthIn: number;
      segmentKind: RunSegment["kind"];
      /**
       * The cabinets it is built from, in order along the run. Usually one; a
       * refrigerator surround is a panel, the opening and whatever closes the
       * far end, which is three.
       */
      modules: CabinetModule[];
      slot?: SlotId;
      fixture?: FixtureId;
    }
  | {
      kind: "gap";
      id: string;
      minIn: number;
      /**
       * What it may not exceed, where something says so.
       *
       * Most stretches take whatever the wall has left; a few are a part
       * rather than a remainder. The cabinet between a rangetop and the oven
       * tower beside it is six inches because the machine's sheet asks for
       * five to a combustible surface, and a foot of it is a spice pull-out —
       * wider than that and it is a gap somebody forgot to fill.
       */
      maxIn?: number;
      /**
       * What it is built at when the wall can pay for it.
       *
       * A minimum is what a rule forbids going under; this is what somebody
       * would build if nothing were tight. The counter between a rangetop and
       * the oven tower beside it is the case the distinction exists for: five
       * inches is the machine's clearance to a combustible surface and six is
       * the narrowest piece anybody makes, but eighteen is a landing you can
       * put a pan down on — so the wall's spare inches go here before they go
       * anywhere else, and a wall that cannot pay for it builds narrower and
       * says so.
       */
      wantIn?: number;
      /** The rule that asks for it, for the breakdown under the slider. */
      rule: string;
      labelKey: string;
      /**
       * How readily this stretch gives up its slack, from
       * `layout.shrinkOrder` in data/rules.json. Nothing is ever dropped: a
       * stretch shrinks to its minimum and stops, and the wall's minimum is
       * the sum of them all.
       */
      shrink?: ShrinkGroup;
    };

const fixed = (
  id: string,
  widthIn: number,
  segmentKind: RunSegment["kind"],
  module: CabinetModule,
  extra: { slot?: SlotId; fixture?: FixtureId } = {},
): Item => ({ kind: "fixed", id, widthIn, segmentKind, modules: [module], ...extra });

/** Eighths of an inch, which is how a cabinetmaker writes a part width. */
const round8 = (value: number) => Math.round(value * 8) / 8;

const gap = (
  id: string,
  minIn: number,
  rule: string,
  extra: { shrink?: ShrinkGroup; maxIn?: number; wantIn?: number } = {},
): Item => ({ kind: "gap", id, minIn, rule, labelKey: `requirement.${id}`, ...extra });

/**
 * Two stretches of counter with nothing between them are one stretch.
 *
 * Its minimum is the larger of the two, not their sum: one run of counter
 * between the corner cabinet and the refrigerator tower answers both "the
 * tower is not hard against the corner" and "the tower has 15" to land on".
 * Adding them would charge the wall twice for the same cabinet.
 */
function mergeGaps(items: Item[]): Item[] {
  const merged: Item[] = [];
  for (const item of items) {
    const last = merged[merged.length - 1];
    if (item.kind === "gap" && last?.kind === "gap") {
      const wider = item.minIn > last.minIn ? item : last;
      // One stretch, with the stricter minimum and the readier shrink: what has
      // to be protected is protected by the minimum, and the slack above it is
      // free to go first.
      const readier = shrinkRank(item.shrink) < shrinkRank(last.shrink) ? item : last;
      merged[merged.length - 1] = { ...wider, id: last.id, shrink: readier.shrink };
      continue;
    }
    merged.push(item);
  }
  return merged;
}

/**
 * Fit a leg's items into the wall it has.
 *
 * The fixed items are what they are; the stretches of counter between them take
 * the remainder, each at least its minimum. Nothing is ever dropped to make a
 * wall fit — a wall that will not take every element at its minimum is refused
 * with the bill, because the alternative is what used to happen: the cabinet
 * after the dishwasher was deleted and the dishwasher finished hard against the
 * wall with nothing for its door to swing past.
 *
 * The surplus goes out in the reverse of `layout.shrinkOrder`, so a stretch
 * that gives up its slack first is the last to be handed any. Within one rank
 * it is shared 3" at a time, which is what keeps the landings either side of a
 * range looking like a pair. Before any of that, a stretch that asks for a
 * width is given it: see `wantIn`.
 *
 * Exported for its own tests. Every dimension in the room comes out of this
 * function, and a rule about how the slack is shared is easier to state
 * against a leg somebody made up than against whichever leg a package happens
 * to produce.
 */
export function packLeg(
  availableIn: number,
  items: Item[],
): { widths: number[] } | { shortIn: number } {
  const fixedIn = items.reduce((sum, item) => sum + (item.kind === "fixed" ? item.widthIn : 0), 0);
  const gaps = items.filter((item) => item.kind === "gap") as Extract<Item, { kind: "gap" }>[];

  const minimums = gaps.map((item) => item.minIn);
  const minimum = minimums.reduce((sum, value) => sum + value, 0);
  let spare = availableIn - fixedIn - minimum;

  if (spare < 0) return { shortIn: -spare };
  if (gaps.length === 0) return spare === 0 ? { widths: [] } : { shortIn: 0 };

  const widths = [...minimums];
  // Last to give, first to receive. Stable, so equal ranks keep run order and
  // the pair either side of a range stays a pair.
  const order = gaps
    .map((_, i) => i)
    .sort((a, b) => shrinkRank(gaps[b].shrink) - shrinkRank(gaps[a].shrink));

  // A stretch is a cabinet or it is nothing. Some have a minimum of zero — the
  // landing beside a range that a microwave drawer's own counter already
  // supplies — and handing one of those three inches of surplus orders a 6"
  // base nobody stocks. So a stretch at zero is opened at a whole cabinet or
  // left closed.
  const minBox = CABINET_STANDARDS.widthIn.min;
  for (const i of order) {
    if (widths[i] === 0 && spare >= minBox) {
      widths[i] += minBox;
      spare -= minBox;
    }
  }

  // What a stretch asks for, before anything is shared out.
  //
  // A minimum is what a rule forbids going under, and sharing the surplus
  // evenly over stretches that are all at their minimum treats them as equally
  // deserving. They are not: the counter each side of a cooking surface is
  // where the pan lands, and it is built at what it asks for while there is
  // wall to pay for it. What is left after that goes round the rest as before,
  // so a long wall still spreads.
  //
  // Three inches at a time to whichever is furthest from what it asked for, so
  // that a wall which cannot pay for both leaves them level rather than
  // finishing one and starving the other. The landings either side of a range
  // are a pair, and they come down as a pair.
  const wanting = order.filter((i) => gaps[i].wantIn !== undefined);
  while (spare >= 3) {
    const short = (i: number) => gaps[i].wantIn! - widths[i];
    const next = wanting
      .filter((i) => short(i) >= 3)
      .sort((a, b) => short(b) - short(a))[0];
    if (next === undefined) break;
    widths[next] += 3;
    spare -= 3;
  }

  // A stretch that has taken all it may is done: the rest goes to the others.
  const room = (i: number) => gaps[i].maxIn === undefined || widths[i] + 3 <= gaps[i].maxIn!;
  const growable = order.filter((i) => widths[i] > 0);
  for (let n = 0; spare >= 3 && growable.some(room); n += 1) {
    const i = growable[n % growable.length];
    if (!room(i)) continue;
    widths[i] += 3;
    spare -= 3;
  }
  // Wall lengths and cabinet widths are both multiples of 3, so there is
  // rarely a remainder; when one appears it belongs to the stretch that gives
  // its slack up last — and never to one that is already at its ceiling.
  const last = growable.find((i) => gaps[i].maxIn === undefined) ?? order[0];
  widths[last] += spare;
  return { widths };
}

/**
 * A stretch of counter as one or more cabinets' worth of run.
 *
 * D13 caps a base cabinet at 36", so 66" of counter is two segments, not one
 * 66" segment that no supplier would quote. Splitting so the remainder is never
 * under 12" keeps both halves orderable.
 */
function counterWidths(totalIn: number): { widths: number[]; scribeIn: number } {
  const { max, step } = CABINET_STANDARDS.widthIn;
  const count = Math.max(1, Math.ceil(totalIn / max));
  const each = Math.floor(totalIn / count / step) * step;
  const widths = Array.from({ length: count }, () => each);
  // Whatever the even split leaves over goes onto the boxes one at a time, so
  // 66" comes out 33 + 33 rather than 36 + 30. A run of matched cabinets is
  // what a kitchen looks like; a big one with an offcut beside it is not.
  let spare = totalIn - each * count;
  for (let i = 0; spare >= step - 1e-6; i = (i + 1) % count) {
    widths[i] += step;
    spare -= step;
  }
  // What is left is less than a module step, and it is a scribe rather than a
  // wider box: adding half an inch to a 35" cabinet orders a 35-1/2" cabinet,
  // which nobody stocks. A strip of finished panel is what actually goes there.
  return { widths, scribeIn: spare > 1e-6 ? spare : 0 };
}

/**
 * What a stretch of counter is built from.
 *
 * A cabinet and, where the run did not divide, a scribe beside it. Below the
 * smallest stock box the whole stretch is filler: a nine-inch base is not
 * something a supplier lists, and a strip of finished panel is what actually
 * goes in a gap that size.
 */
function counterModules(widthIn: number, scribeIn: number): CabinetModule[] {
  if (widthIn < CABINET_STANDARDS.widthIn.min) {
    return fillWidth(widthIn + scribeIn, (w) => M(`BF${round8(w)}`, "filler", w));
  }
  return scribeIn
    ? [baseModule(widthIn), M(`BF${round8(scribeIn)}`, "filler", scribeIn)]
    : [baseModule(widthIn)];
}

/** A base cabinet: drawers at the sizes a drawer base is actually made in. */
const baseModule = (widthIn: number) =>
  widthIn === 18 || widthIn === 21
    ? M(`DB${widthIn}`, "drawer-base", widthIn)
    : M(`B${widthIn}`, "base", widthIn);

const wallModule = (widthIn: number) => M(`W${widthIn}42`, "wall", widthIn, { heightIn: 42 });

/** Lay the packed items end to end from `start`. */
function layOut(runId: string, start: number, items: Item[], gapWidths: number[]): RunSegment[] {
  const segments: RunSegment[] = [];
  let cursor = start;
  let g = 0;

  for (const item of items) {
    if (item.kind === "fixed") {
      const to = cursor + ft(item.widthIn);
      segments.push({
        id: `${runId}-${item.id}`,
        kind: item.segmentKind,
        from: cursor,
        to,
        modules: item.modules,
        ...(item.slot ? { slot: item.slot } : {}),
        ...(item.fixture ? { fixture: item.fixture } : {}),
      });
      cursor = to;
      continue;
    }

    const total = gapWidths[g++];
    if (total <= 0) continue;
    const counter = counterWidths(total);
    for (const [i, widthIn] of counter.widths.entries()) {
      // The scribe goes on the last box of the stretch, where the run meets
      // whatever is next to it.
      const last = i === counter.widths.length - 1;
      const scribe = last ? counter.scribeIn : 0;
      const to = cursor + ft(widthIn + scribe);
      segments.push({
        id: `${runId}-${item.id}-${i}`,
        kind: "counter",
        from: cursor,
        to,
        modules: counterModules(widthIn, scribe),
      });
      cursor = to;
    }
  }
  return segments;
}

/**
 * Compose a width out of stock boxes.
 *
 * Largest first, but never leaving a remainder too small to be a cabinet: 78"
 * as 36 + 36 + 6 is arithmetically fine and nobody would hang it. Taking the
 * biggest box that leaves either nothing or at least another 12" gives
 * 36 + 30 + 12, which is what a supplier would quote. What no box covers
 * becomes a filler, scribed to the wall.
 */
/**
 * The wall cabinets a supplier lists, widest first.
 *
 * Twelve inches is the narrowest of them, and that figure is a rule as much as
 * a size: a stretch of wall shorter than one cannot be a bank, only a scribe.
 */
const WALL_STOCK = [36, 33, 30, 27, 24, 21, 18, 15, 12];

/** The narrowest wall cabinet anybody stocks, in feet. */
const narrowestBank = () => ft(WALL_STOCK[WALL_STOCK.length - 1]);

function fillWidth(
  totalIn: number,
  make: (widthIn: number) => CabinetModule,
  /**
   * Which end the scribe goes. A filler is a strip of finished panel with
   * nothing behind it, and it belongs where nothing has to reach past it —
   * against a wall. Beside a hood it is a gap you cannot get a cloth into and
   * a foot of shelf nobody has. See docs/decisions.md D13.
   */
  fillerAt: "start" | "end" = "end",
): CabinetModule[] {
  const stock = WALL_STOCK;
  const boxes: CabinetModule[] = [];
  const fillers: CabinetModule[] = [];
  // Wall cabinets come off a list of 3" steps, so whatever the bank is not a
  // multiple of three is a scribe — the fraction included. Taking it off first
  // leaves the search below on the grid it assumes; leaving it in sent the
  // search past the end of the bank an inch at a time.
  const { step } = CABINET_STANDARDS.widthIn;
  let left = Math.floor(totalIn / step + 1e-6) * step;
  const scribeIn = totalIn - left;
  while (left > 0) {
    const next = stock.find((width) => {
      if (width > left) return false;
      const rest = left - width;
      return rest % 3 === 0 && (rest === 0 || rest >= 12);
    });
    if (next === undefined) {
      const filler = left >= 6 ? 6 : 3;
      fillers.push(M(`BF${filler}`, "filler", filler));
      left -= filler;
      continue;
    }
    boxes.push(make(next));
    left -= next;
  }
  // The sub-inch remainder joins the filler, or becomes one if the boxes
  // happened to divide the bank exactly.
  if (scribeIn > 1e-6) {
    if (fillers.length > 0) {
      const last = fillers[fillers.length - 1];
      const widthIn = round8(last.widthIn + scribeIn);
      fillers[fillers.length - 1] = M(`BF${widthIn}`, "filler", widthIn);
    } else {
      const widthIn = round8(scribeIn);
      fillers.push(M(`BF${widthIn}`, "filler", widthIn));
    }
  }
  return fillerAt === "start" ? [...fillers, ...boxes] : [...boxes, ...fillers];
}

// --- validation -----------------------------------------------------------

/** Inside the parameter's own range, whatever the slider's step is. */
function within(name: keyof typeof PARAM_LIMITS, value: number): Refusal | null {
  const { min, max, step: increment } = PARAM_LIMITS[name];
  const vars = { paramKey: `param.${name}`, min, max, step: increment, value };
  return value < min || value > max ? { key: "refusal.outOfRange", vars } : null;
}

/**
 * On the step as well, which is a fact about the control and not about the
 * room — so it is asked of the island's dimensions and not of the walls.
 *
 * A wall is whatever length it is. What the slider will land on is the wall's
 * own minimum and then the step above it, and pinning a room to a grid
 * anchored somewhere else was what stopped a 147" wall from ever being drawn
 * at 147".
 */
function step(name: keyof typeof PARAM_LIMITS, value: number): Refusal | null {
  const { min, step: increment } = PARAM_LIMITS[name];
  const outside = within(name, value);
  if (outside) return outside;
  const vars = { paramKey: `param.${name}`, min, max: PARAM_LIMITS[name].max, step: increment, value };
  if ((value - min) % increment !== 0) {
    const below = Math.floor((value - min) / increment) * increment + min;
    return {
      key: "refusal.offStep",
      vars: { ...vars, below, above: below + increment },
      suggestion: {
        key: "suggestion.round",
        vars: { paramKey: `param.${name}`, value: below },
        patch: { [name]: below } as Partial<LayoutParams>,
      },
    };
  }
  return null;
}

/**
 * Check the parameters before building anything.
 *
 * Refusing is a first-class outcome: the answer to "can I have a 50 inch
 * island?" is no, and the useful part is what follows — which is why a refusal
 * carries a key, its figures, and where it can a change that would fix it.
 */
function validate(params: LayoutParams): Refusal[] {
  const reasons: Refusal[] = [];
  const push = (reason: Refusal | null) => {
    if (reason) reasons.push(reason);
  };

  push(within("backWallIn", params.backWallIn));
  push(within("leftWallIn", params.leftWallIn));
  // A height a hand reaches to, so it is an inch at a time rather than a step.
  push(within("microwaveHandleIn", params.microwaveHandleIn));

  // The tower and the sink base both need a run's worth of wall behind them,
  // and D13 caps a leg at 144". One leg will not carry a range, a sink, a
  // dishwasher and a 42" tower however long the wall is.
  if (params.fridgeEnd === params.sinkLeg) {
    const other = params.sinkLeg === "back" ? "left" : "back";
    reasons.push({
      key: "refusal.oneLegBoth",
      vars: { legKey: `leg.${params.sinkLeg}`, maxIn: CABINET_STANDARDS.legIn.longMax },
      suggestion: {
        key: "suggestion.moveSink",
        vars: { legKey: `leg.${other}` },
        patch: { sinkLeg: other },
      },
    });
  }

  if (params.hasIsland) {
    push(step("islandLengthIn", params.islandLengthIn));
    push(step("islandDepthIn", params.islandDepthIn));
    push(step("aisleIn", params.aisleIn));

    /**
     * Which wall the island's length runs along, and which its depth does.
     *
     * Turned parallel, its long side runs across the room and its depth runs
     * into it; turned perpendicular, the two swap. The arithmetic is the same
     * either way and so are the two refusals — what changes is which wall each
     * one is measured against, so a perpendicular island in a shallow room is
     * refused for being long rather than for being deep.
     */
    const turned = params.islandOrientation === "perpendicular";
    const alongWallIn = turned ? params.leftWallIn : params.backWallIn;
    const acrossWallIn = turned ? params.backWallIn : params.leftWallIn;
    const alongWall = turned ? ("param.leftWallIn" as const) : ("param.backWallIn" as const);
    const acrossWall = turned ? ("param.backWallIn" as const) : ("param.leftWallIn" as const);

    // The island stands clear of the run behind it by an aisle, and everything
    // from there to the far side of the room is what it has to fit in.
    const alongIn = alongWallIn - CABINET_STANDARDS.base.depthIn - params.aisleIn;
    if (params.islandLengthIn > alongIn) {
      const step_ = PARAM_LIMITS.islandLengthIn.step;
      const fits = Math.floor(alongIn / step_) * step_;
      reasons.push({
        key: "refusal.islandLong",
        vars: {
          islandIn: params.islandLengthIn,
          aisleIn: params.aisleIn,
          roomIn: alongIn,
          wallIn: alongWallIn,
          paramKey: alongWall,
        },
        suggestion:
          fits >= PARAM_LIMITS.islandLengthIn.min
            ? {
                key: "suggestion.shortenIsland",
                vars: { value: fits },
                patch: { islandLengthIn: fits },
              }
            : undefined,
      });
    }
    const acrossIn = CABINET_STANDARDS.base.depthIn + params.aisleIn + params.islandDepthIn;
    if (acrossIn > acrossWallIn) {
      reasons.push({
        key: "refusal.islandDeep",
        vars: {
          aisleIn: params.aisleIn,
          islandIn: params.islandDepthIn,
          needIn: acrossIn,
          wallIn: acrossWallIn,
          paramKey: acrossWall,
        },
        suggestion: {
          key: "suggestion.lengthen",
          vars: { paramKey: acrossWall, value: acrossIn },
          patch: turned ? { backWallIn: acrossIn } : { leftWallIn: acrossIn },
        },
      });
    }
  }

  return reasons;
}

/**
 * A change that would let this configuration build, given a wall that is short.
 *
 * The order is what a designer would try in the room, cheapest first: move the
 * sink to the other leg, then change what turns the corner, then give in and
 * lengthen the wall. Each candidate is generated before it is offered, so the
 * button never hands back another refusal.
 */
let suggesting = false;

function suggestionForWall(
  params: LayoutParams,
  key: "backWallIn" | "leftWallIn",
  pkg: Package,
): Refusal["suggestion"] {
  // Working out whether a suggestion builds means generating it, and a
  // generation that fails would otherwise go looking for a suggestion of its
  // own. One level is all this question needs.
  if (suggesting) return undefined;
  suggesting = true;
  try {
    return firstSuggestion(params, key, pkg);
  } finally {
    suggesting = false;
  }
}

function firstSuggestion(
  params: LayoutParams,
  key: "backWallIn" | "leftWallIn",
  pkg: Package,
): Refusal["suggestion"] {
  const otherLeg = params.sinkLeg === "back" ? ("left" as const) : ("back" as const);
  const otherCorner =
    params.cornerType === "blind" ? ("lazy-susan" as const) : ("blind" as const);

  const candidates: NonNullable<Refusal["suggestion"]>[] = [
    {
      key: "suggestion.moveSinkMinimum",
      vars: { legKey: `leg.${otherLeg}`, paramKey: `param.${key}` },
      // The refrigerator has to go somewhere, and it cannot share a leg with
      // the sink, so it takes the leg the sink just left.
      patch: { sinkLeg: otherLeg, fridgeEnd: params.sinkLeg },
    },
    {
      key: "suggestion.corner",
      vars: { cornerKey: `panel.room.corner.${otherCorner === "blind" ? "blind" : "lazySusan"}`, paramKey: `param.${key}` },
      patch: { cornerType: otherCorner },
    },
    // An island is where the microwave drawer and the wine cabinet want to be;
    // putting it back takes 48" of opening off the perimeter run.
    ...(params.hasIsland
      ? []
      : [
          {
            key: "suggestion.island",
            vars: { paramKey: `param.${key}` } as Record<string, string | number>,
            patch: { hasIsland: true } as Partial<LayoutParams>,
          },
        ]),
  ];

  for (const candidate of candidates) {
    const patched = { ...params, ...candidate.patch };
    if (!generateLayout(patched, pkg).ok) continue;
    const range = feasibleRange(patched, key, pkg);
    if (range) candidate.vars.minimumIn = range.minIn;
    return candidate;
  }

  // Nothing rearranges into it: the wall itself has to move.
  const here = feasibleRange(params, key, pkg);
  if (here) {
    const nearest = params[key] < here.minIn ? here.minIn : here.maxIn;
    return {
      key: nearest > params[key] ? "suggestion.lengthen" : "suggestion.shorten",
      vars: { paramKey: `param.${key}`, value: nearest },
      patch: { [key]: nearest } as Partial<LayoutParams>,
    };
  }
  return undefined;
}

// --- the layout itself ----------------------------------------------------

function islandFor(
  params: LayoutParams,
  spec: Record<SlotId, PackageSlot>,
  halfX: number,
  halfZ: number,
): IslandLayout {
  const backFace = -halfZ + ROOM.counterDepth;
  const leftFace = -halfX + ROOM.counterDepth;
  const length = ft(params.hasIsland ? params.islandLengthIn : 0);
  const depth = ft(params.islandDepthIn);
  const aisle = ft(params.aisleIn);

  /**
   * Which way it is turned, and where that puts it.
   *
   * Parallel: the long side runs along the back wall, the island is centred in
   * what is left of the room past the left run's aisle, and it stands an aisle
   * off the back run.
   *
   * Perpendicular: the same island a quarter turn round, its long side facing
   * the left run. It stands an aisle off both runs and reaches into the room
   * from there, which is the shape a deep narrow kitchen wants. Whether it
   * fits is arithmetic either way, and `validate` refuses it with the figures
   * when it does not.
   */
  const axis = params.islandOrientation === "perpendicular" ? ("z" as const) : ("x" as const);
  const alongFrom = axis === "x" ? (leftFace + aisle + halfX) / 2 - length / 2 : backFace + aisle;
  const acrossFrom = axis === "x" ? backFace + aisle : leftFace + aisle;
  const along = [alongFrom, alongFrom + length] as const;
  const across = [acrossFrom, acrossFrom + depth] as const;
  const x = axis === "x" ? along : across;
  const z = axis === "x" ? across : along;

  // Zero for a machine that stands in the tall bank instead: the island is
  // then a prep island, and an extent for something that is not on it would be
  // a place for the scene to put a machine that is somewhere else.
  const microwave = isSpare(spec["slot-microwave"]) ? ft(openingIn(spec["slot-microwave"])) : 0;
  const wine = isSpare(spec["slot-wine"]) ? ft(openingIn(spec["slot-wine"])) : 0;
  // Flush to the ends on a short island, inset on a long one.
  const inset = Math.min(ft(6), Math.max(0, (length - microwave - wine) / 2));

  return {
    present: params.hasIsland,
    x,
    z,
    axis,
    // The working side is the one facing the runs, whichever axis that is on:
    // the cook stands between the island and the counter.
    working: across[0],
    seating: across[1],
    height: ROOM.counterHeight,
    microwave: [along[0] + inset, along[0] + inset + microwave] as const,
    wine: [along[1] - inset - wine, along[1] - inset] as const,
  };
}

/**
 * What goes on each leg.
 *
 * The refrigerator finishes whichever leg it is on and the sink takes the
 * dishwasher with it — those are the two parameters that change the kitchen
 * rather than resize it. Without an island the microwave and the wine cabinet
 * have to live on the perimeter, and they go on opposite legs: it is the only
 * way they still face opposite ways, which is what D11 rule 7 is about.
 */
function planLegs(params: LayoutParams, pkg: Package, omitted: readonly SlotId[] = []) {
  const corner = CORNERS[params.cornerType];
  const { sink: sinkRule } = LAYOUT_LIMITS;
  const spec = slotsOf(pkg);

  // Every slot the package lists has to have somewhere to go. A package the
  // template cannot build is a loud failure at import, not an appliance that
  // quietly never appears in the room.
  for (const slot of pkg.slots) {
    if (!(slot.category in ROLES)) {
      throw new Error(
        `layoutTemplate: ${pkg.id} puts a ${slot.category} in ${slot.slotId}, ` +
          "and the L-with-island template has nowhere to stand one",
      );
    }
  }

  const opening = (slotId: SlotId, id: string) => {
    const widthIn = openingIn(spec[slotId]);
    return fixed(
      id,
      widthIn,
      "appliance",
      M(`RO${widthIn}`, "opening", widthIn, { slot: slotId }),
      { slot: slotId },
    );
  };

  const sink = fixed(
    "sink",
    SINK_BASE_IN,
    "fixture",
    M(`SB${SINK_BASE_IN}`, "sink-base", SINK_BASE_IN, { fixture: "fixture-sink" }),
    { fixture: "fixture-sink" },
  );
  const dishwasher = opening("slot-dishwasher", "dishwasher");

  /**
   * The cooking slot, which is a hole in the counter or a hole in the run.
   *
   * A range is a machine standing on the floor between two cabinets: the run
   * leaves it an opening. A rangetop is a cooking surface dropped into the
   * stone with a cabinet under it — Thermador's own drawing shows a drawer
   * base — so the run orders that cabinet and the counter is what is cut.
   */
  const cooking = (): Item => {
    const slot = spec["slot-range"];
    const widthIn = openingIn(slot);
    if (slot.installType !== "rangetop") return opening("slot-range", "range");
    return fixed(
      "range",
      widthIn,
      "appliance",
      M(`DB${widthIn}`, "drawer-base", widthIn, { slot: "slot-range" }),
      { slot: "slot-range" },
    );
  };

  /**
   * What finishes a run the refrigerator does not.
   *
   * Never the appliance itself. Against a wall it is a filler: a dishwasher
   * finishing hard against the plaster has nowhere for its door to swing, which
   * is the same thing the refrigerator's own filler is for on the other leg —
   * one rule, applied to both machines rather than to one of them.
   *
   * In the open it is a whole cabinet with an end panel: a run that stops at a
   * carcass edge wants a box, and the exposed side of that box wants finishing
   * the way a tower's does. Neither has a policy figure — the cabinet is a
   * cabinet, so its minimum is the narrowest box anybody stocks, and the panel
   * is the panel. What the wall has to find for it is those two added up.
   *
   * The filler and the panel are fixed: they are the elements that must not
   * shrink, so they are not stretches that can be squeezed to zero.
   */
  const terminal = (id: string, at: "wall" | "open"): Item[] => {
    if (at === "open") {
      return [
        gap(id, CABINET_STANDARDS.widthIn.min, "d13-terminal", { shrink: "landing" }),
        fixed(`${id}-panel`, PANEL_IN, "counter", M(`PNL${PANEL_IN}`, "panel", PANEL_IN)),
      ];
    }
    const widthIn = LAYOUT_POLICY.terminalIn.atWall;
    return [
      {
        kind: "fixed",
        id,
        widthIn,
        segmentKind: "counter",
        modules: [M(`BF${widthIn}`, "filler", widthIn)],
      },
    ];
  };

  /**
   * The refrigerator, which finishes a leg either way.
   *
   * Built in, it is a tower: two finished panels that wrap its doors, the
   * opening between them, and a cabinet bridging over from the head of that
   * opening.
   *
   * Freestanding, it is still surrounded — but by a different set of parts.
   * The panels are 24" deep, so the doors and their handles stand proud of them
   * rather than being buried in them; there is a wall cabinet over the machine
   * starting an inch above its top rather than a bridge over the opening; and
   * what goes at the far end depends on what is there. Against cabinetry, a
   * panel and the manufacturer's eighth of an inch. Against a return wall,
   * three and a half inches of filler, or the door will not open ninety
   * degrees. See docs/decisions.md D11 rule 11.
   */
  const fridge = spec["slot-fridge"];
  const single = fridge.enclosure
    ? (() => {
        const widthIn = openingIn(fridge);
        return fixed(
          "fridge",
          widthIn,
          fridge.tallUnit ? "tall" : "appliance",
          M(`T${widthIn}96`, "tall", widthIn, { heightIn: 96, slot: "slot-fridge" }),
          { slot: "slot-fridge" },
        );
      })()
    : (() => {
        const rule = LAYOUT_LIMITS.fridge;
        // The opening is the package's own: a 36" opening round a 35-5/8"
        // machine is already three sixteenths a side, which clears the
        // manufacturer's eighth. Adding the eighth on top would be counting
        // the same gap twice and asking the wall for it.
        const openIn = fridge.widthIn;
        const outerIn = params.fridgeEndAbuts === "wall" ? rule.fromWallIn : PANEL_IN;
        const widthIn = PANEL_IN + openIn + outerIn;
        return {
          kind: "fixed" as const,
          id: "fridge",
          widthIn,
          segmentKind: (fridge.tallUnit ? "tall" : "appliance") as RunSegment["kind"],
          slot: "slot-fridge" as SlotId,
          modules: [
            M(`PNL${PANEL_IN}`, "panel", PANEL_IN, { slot: "slot-fridge" }),
            M(`RO${round8(openIn)}`, "tall-open", openIn, { slot: "slot-fridge" }),
            params.fridgeEndAbuts === "wall"
              ? M(`BF${round8(outerIn)}`, "filler", outerIn, { slot: "slot-fridge" })
              : M(`PNL${outerIn}`, "panel", outerIn, { slot: "slot-fridge" }),
          ],
        };
      })();

  /**
   * The full-height units at the end of the run, as one bank.
   *
   * D11 rule 12. One tall unit is the tower this template has always built and
   * is left exactly as it was. Two or more are a bank: a finished panel where
   * it meets the counter, then the columns in `TALL_ORDER`, then whatever the
   * far end wants — a panel against cabinetry, three and a half inches of
   * filler against a wall so the refrigerator door still opens.
   *
   * Each column is its own segment because each holds its own machine, and
   * every one of them is `tall`: they are one carcass to look at and one run
   * of 96" boxes to order.
   */
  // The bank at the end of the run. A tall unit that stands beside the range
  // is not part of it — it is built into the middle of the back leg, which is
  // the exception rule 12 makes to rule 1.
  const tallSlots = TALL_ORDER.filter(
    (slotId) => spec[slotId]?.tallUnit && !spec[slotId]?.beside,
  );

  /**
   * One full-height unit: the machine's own opening in a 96" carcass.
   *
   * A refrigerator stands on the floor of its opening; an oven hangs in a hole
   * with a drawer base under it, and how high that hole starts is `sillFor`.
   * `cabinets.ts` builds the base, the opening and the door above it from the
   * one module.
   */
  const column = (slotId: SlotId): Item => {
    const slot = spec[slotId];
    return fixed(
      slotId.replace("slot-", ""),
      slot.widthIn,
      "tall",
      M(`T${slot.widthIn}96`, "tall", slot.widthIn, {
        heightIn: 96,
        slot: slotId,
        sillIn: sillFor(slot, params),
        // The opening is the whole of it: the bank's panels are at its ends,
        // and a tower beside the range has its own each side as items of the
        // run rather than as inches taken out of the machine's hole.
        insetIn: 0,
      }),
      { slot: slotId },
    );
  };
  const bank = (): Item[] => {
    const outerIn = params.fridgeEndAbuts === "wall" ? LAYOUT_LIMITS.fridge.fromWallIn : PANEL_IN;
    const items: Item[] = [
      fixed("tall-inner", PANEL_IN, "tall", M(`PNL${PANEL_IN}`, "panel", PANEL_IN)),
    ];
    tallSlots.forEach((slotId, index) => {
      const slot = spec[slotId];
      if (takesSpacer(spec[tallSlots[index - 1]], slot)) {
        items.push(
          fixed(
            `tall-spacer-${index}`,
            COLUMN_SPACER.widthIn,
            "tall",
            M(COLUMN_SPACER.code, "spacer", COLUMN_SPACER.widthIn),
          ),
        );
      }
      items.push(column(slotId));
    });
    items.push(
      params.fridgeEndAbuts === "wall"
        ? fixed("tall-outer", outerIn, "tall", M(`BF${round8(outerIn)}`, "filler", outerIn))
        : fixed("tall-outer", outerIn, "tall", M(`PNL${outerIn}`, "panel", outerIn)),
    );
    return items;
  };
  const tower: Item[] = tallSlots.length > 1 ? bank() : [single];

  /**
   * The sink group, laid out to D11 rule 10.
   *
   * Range, landing, sink, dishwasher: the work goes past the counter you put
   * the pan down on, then the bowl, then the machine you load from it. The
   * dishwasher stands in for the wide side the rule asks for — 24" of surface
   * at counter height is 24" of surface at counter height — and the landing
   * before the sink is the narrow one. Both legs read from the corner outward
   * and the range is always at the corner end, so the landing comes first.
   */
  const sinkGroup = (): Item[] => [
    gap("sink-landing", sinkRule.narrowIn, "d11-10"),
    sink,
    dishwasher,
  ];

  const left: Item[] = [
    fixed(
      "corner",
      corner.alongIn,
      "corner",
      M(corner.code, "corner", corner.alongIn, { depthIn: corner.depthIn }),
    ),
    // A sink base hard against a corner cabinet stops its door opening, so this
    // stretch is required when the sink is what follows the corner. Otherwise
    // it is only wanted: rule 1 already keeps the tower off the corner through
    // its own landing, and a drawer base beside a lazy susan is ordinary.
    params.sinkLeg === "left"
      ? gap("corner-landing", sinkRule.fromCornerIn, "d11-10")
      : gap("corner-landing", LAYOUT_LIMITS.cornerLandingIn, "d11-1", {
          shrink: "corner-to-range",
        }),
  ];
  if (params.sinkLeg === "left") left.push(...sinkGroup());

  // The narrow landing goes on the corner side, where a corner already eats
  // into what you can reach; the wide one goes toward the sink, which is where
  // a pan actually lands.
  const landing = LAYOUT_LIMITS.rangeLanding;

  /**
   * The cooking surface, and whatever stands beside it.
   *
   * Without an oven tower it is a landing each side, and the run reads
   * corner, range, sink. With one — D11 rule 12 — the tower goes on the side
   * the parameter picks and there is a cabinet between the two of them:
   * PCG366W wants 5" to a combustible surface, so six inches of joinery is the
   * least that may be there and a foot of it is a spice pull-out. The other
   * side keeps the wide landing, which is where a pan comes off the burner.
   */
  const besideRange = TALL_ORDER.filter((slotId) => spec[slotId]?.beside === "range");
  const cookingBlock = (): Item[] => {
    if (besideRange.length === 0) {
      return [
        gap("range-landing-left", landing.narrowIn, "d11-4", { shrink: "corner-to-range" }),
        cooking(),
        gap("range-landing-right", landing.wideIn, "d11-4", { shrink: "range-to-sink" }),
      ];
    }
    const beside = besideRange.map(column);
    const { counterIn, wantIn, panelIn } = LAYOUT_LIMITS.towerSpacer;
    // The tower's own side, floor to top: a board rather than a cabinet.
    const side = fixed("tower-panel", panelIn, "tall", M(`PNL${panelIn}`, "panel", panelIn));
    // And the counter between it and the machine, which is the clearance the
    // rangetop's sheet asks for. It takes slack readily: five inches is the
    // least it may be, not what it wants to be.
    //
    // Eighteen is what it is built at: a landing wide enough to put a pan down
    // on, and enough open counter that the tower does not crowd the cooking.
    // Six is where it stops when the wall will not pay for eighteen — five
    // inches of counter is a piece nobody makes, since under the cabinet
    // minimum it is a filler and a filler stops at six — and it comes down
    // from eighteen three inches at a time, with the install list saying where
    // it landed.
    const clearance = gap("tower-clearance", Math.max(counterIn, 6), "d11-12", {
      shrink: "range-to-sink",
      // What it is built at, and what it stops at. Both are `wantIn`: the
      // stretch is served first up to it, and the round-robin that shares out
      // what is left does not push it past what it asked for — a wall with
      // sixty spare inches wants them at the sink, not here.
      wantIn,
      maxIn: wantIn,
    });
    // The other side of the burners, which asks for the same eighteen inches:
    // a landing is a landing whichever side of the machine it is on, and a
    // cooking surface with a pan's worth of counter on one side and a foot on
    // the other is the arrangement rule 4's two figures were meant to avoid,
    // not the one it wants. No ceiling on it, though — it is the general
    // landing, and a long wall may as well spend itself here.
    const away = gap("range-landing", landing.wideIn, "d11-4", {
      shrink: "range-to-sink",
      wantIn,
    });
    return params.towerSide === "left"
      ? [...beside, side, clearance, cooking(), away]
      : [away, cooking(), clearance, side, ...beside];
  };

  /**
   * The back leg, read from the corner outward.
   *
   * Without a tower it is what it always was: the range with a landing each
   * side, then the sink group if this is the sink's leg.
   *
   * With one, the run has an end that is not the corner's, and the tower takes
   * it. `towerSide: "right"` means the far end — corner, sink, landing, range,
   * spacer, tower — which is the order Leo laid out: you come round the corner
   * to the sink, work along the counter, and the oven is at the end of it.
   * `"left"` puts the tower nearest the corner instead, and everything else
   * follows it.
   */
  const hasTower = besideRange.length > 0;
  const sinkFirst = hasTower && params.towerSide === "right";
  const back: Item[] = [];
  if (params.sinkLeg === "back" && sinkFirst) {
    // The sink stands clear of the corner cabinet so its door still opens,
    // which is the same 15" rule 10 asks for on the other leg.
    back.push(gap("back-corner-landing", sinkRule.fromCornerIn, "d11-10"));
    back.push(...sinkGroup());
  } else if (hasTower && !sinkFirst) {
    // A tower hard against the corner blocks the corner cabinet's door.
    back.push(gap("back-corner-landing", LAYOUT_LIMITS.cornerLandingIn, "d11-1"));
  }
  back.push(...cookingBlock());
  if (params.sinkLeg === "back" && !sinkFirst) back.push(...sinkGroup());

  // The tower finishes its leg, with a landing before it (D11 rule 6) — and,
  // with no island, the wine cabinet past it at the very end of the run.
  /**
   * Where the island's two machines go when there is no island.
   *
   * Both onto the refrigerator's leg, the last base cabinets before the
   * tower's landing — D11 rule 1 keeps the tower itself last. That leg is the
   * one not carrying the range and the sink, which is the only place 48" of
   * opening is going to come from.
   *
   * And when it will not take them, the room is built without them rather than
   * refused. A wine cabinet and a microwave drawer are the two things a kitchen
   * can do without; refusing to draw a room over them would be refusing over
   * the wrong thing. What is left out is said, on the checklist and beside the
   * appliance count, rather than quietly missing.
   */
  const spare = params.hasIsland
    ? []
    : SPARE_SLOTS.filter((slot) => isSpare(spec[slot]) && !omitted.includes(slot)).map((slot) =>
        opening(slot, slot.replace("slot-", "")),
      );

  if (params.fridgeEnd === "left") {
    left.push(...spare, gap("fridge-landing", LAYOUT_LIMITS.fridgeLandingIn, "d11-6"), ...tower);
    back.push(...terminal("back-end", "wall"));
  } else {
    back.push(...spare, gap("fridge-landing", LAYOUT_LIMITS.fridgeLandingIn, "d11-6"), ...tower);
    left.push(...terminal("left-end", "open"));
  }

  return {
    left: { items: mergeGaps(left), availableIn: params.leftWallIn },
    back: { items: mergeGaps(back), availableIn: params.backWallIn - corner.acrossIn },
  };
}

/**
 * What has to go on a leg, and the shortest wall that holds it.
 *
 * This is the same plan the generator packs, read as a bill rather than as a
 * layout: every fixed item at its own width and every stretch of counter at the
 * minimum its rule asks for. D13's floor on a leg is added as a line of its own
 * when it is the binding constraint, because "96" because a leg is never
 * shorter than that" is as real a reason as a cabinet.
 */
function requirementFor(
  params: LayoutParams,
  leg: "left" | "back",
  pkg: Package,
  omitted: readonly SlotId[],
): WallRequirement {
  const plan = planLegs(params, pkg, omitted)[leg];
  const corner = CORNERS[params.cornerType];
  const items: RequirementItem[] = [];

  // The corner cabinet stands on one leg and eats into the other, so it is on
  // both bills: 36" of the left wall as a cabinet, and 36" of the back wall as
  // the bite it takes out of it. One box, two walls.
  if (leg === "back") {
    items.push({
      widthIn: corner.acrossIn,
      code: corner.code,
      labelKey: "requirement.cornerAcross",
    });
  }

  for (const item of plan.items) {
    if (item.kind === "fixed") {
      items.push({
        widthIn: item.widthIn,
        // The cabinet it is, or the pieces it is made of: a refrigerator
        // surround is a panel, an opening and whatever closes the far end, and
        // the bill under a refusal should say so rather than name one of them.
        code: item.modules.map((module) => module.code).join(" + "),
        labelKey: `requirement.${item.id}`,
      });
    } else {
      // Every stretch, at its minimum. Nothing is optional any more, so the
      // bill under a refusal is the whole wall rather than the part of it that
      // happened to survive.
      items.push({ widthIn: item.minIn, rule: item.rule, labelKey: item.labelKey });
    }
  }

  const across = leg === "back" ? corner.acrossIn : 0;
  const legIn = items.reduce((sum, item) => sum + item.widthIn, 0) - across;
  const floor = CABINET_STANDARDS.legIn.shortMin;
  if (legIn < floor) {
    items.push({ widthIn: floor - legIn, rule: "d13-leg", labelKey: "requirement.legFloor" });
  }

  let minimumIn = Math.max(legIn, floor) + across;

  // A wall is two things at once: the length of its own run, and the width or
  // depth of the room the island stands in. Whichever asks for more is the
  // minimum, and the difference goes on the bill so the figure still adds up.
  if (params.hasIsland) {
    const clearance =
      CABINET_STANDARDS.base.depthIn +
      params.aisleIn +
      (leg === "back" ? params.islandLengthIn : params.islandDepthIn);
    if (clearance > minimumIn) {
      items.push({
        widthIn: clearance - minimumIn,
        rule: "d11-7",
        labelKey: "requirement.islandClearance",
      });
      minimumIn = clearance;
    }
  }

  // What the stretches on this leg ask for over their minimums, which is what
  // the room grows by when a package is chosen rather than dragged into.
  const maximumIn = CABINET_STANDARDS.legIn.longMax + across;
  const wanted = plan.items.reduce(
    (sum, item) =>
      sum + (item.kind === "gap" ? Math.max(0, (item.wantIn ?? 0) - item.minIn) : 0),
    0,
  );
  return {
    leg,
    items,
    minimumIn,
    wantedIn: Math.min(maximumIn, minimumIn + wanted),
    maximumIn,
  };
}

/**
 * The two machines a room can be built without.
 *
 * They are the island's, and in a room with no island they move onto the
 * refrigerator's leg. Everything else in the package is the kitchen: a room
 * with no range is not a smaller kitchen, it is a refusal.
 */
export const SPARE_SLOTS = ["slot-microwave", "slot-wine"] as const;

/**
 * What this room cannot find room for — never more than the spare two.
 *
 * A wall too short for the microwave drawer and the wine cabinet is not a
 * refusal. Refusing to draw a kitchen over the two things a kitchen can do
 * without would be refusing over the wrong thing, so they are left out and
 * said out loud instead: on the install checklist, and beside the appliance
 * count that drops when they go.
 *
 * The test is the leg at its own minimum. If everything on it stood at the
 * least its rule allows and the wall is still short, no amount of shrinking
 * gets the two machines on, and they go. Anything longer keeps them.
 */
export function omittedSlots(params: LayoutParams, pkg: Package = PACKAGE): readonly SlotId[] {
  if (params.hasIsland) return [];
  const spec = slotsOf(pkg);
  const spare = SPARE_SLOTS.filter(
    (slotId) => pkg.slots.some((slot) => slot.slotId === slotId) && isSpare(spec[slotId]),
  );
  if (spare.length === 0) return [];
  // Only the leg they would stand on is asked. A room refused over the *other*
  // wall is a room that is too small for a kitchen, and leaving the wine
  // cabinet out would not make it any bigger.
  const leg = params.fridgeEnd === "left" ? ("left" as const) : ("back" as const);
  const key = leg === "back" ? ("backWallIn" as const) : ("leftWallIn" as const);
  const fits = params[key] >= requirementFor(params, leg, pkg, []).minimumIn;
  return fits ? [] : spare;
}

/**
 * What has to go on a leg, and the shortest wall that holds it.
 *
 * The bill for the room as it will actually be built, which in a small
 * no-island room is a room without the spare two. Printing the fuller bill
 * under a slider that will happily go below it would be printing a figure the
 * interface itself does not believe.
 */
export function wallRequirement(
  params: LayoutParams,
  leg: "left" | "back",
  pkg: Package = PACKAGE,
): WallRequirement {
  return requirementFor(params, leg, pkg, omittedSlots(params, pkg));
}

/**
 * The lengths of one wall this configuration can actually be built at.
 *
 * Probed rather than derived: the constraints on a wall come from four
 * directions — what has to stand on it, D13's cap on a leg, the island's length
 * and the island's depth — and a second copy of that arithmetic would be a
 * second thing to keep right. There are at most a dozen steps to try.
 */
export function feasibleRange(
  params: LayoutParams,
  key: "backWallIn" | "leftWallIn",
  pkg: Package = PACKAGE,
): { minIn: number; maxIn: number } | null {
  const { min, max, step } = PARAM_LIMITS[key];
  let onStep: number | null = null;
  let maxIn = min;
  for (let value = min; value <= max; value += step) {
    if (!generateLayout({ ...params, [key]: value }, pkg).ok) continue;
    if (onStep === null) onStep = value;
    maxIn = value;
  }
  if (onStep === null) return null;

  // The floor is the wall's own minimum, to the inch — not the first step
  // above it. A room that builds at 147" says 147", and the slider stops
  // there; the step is how the control moves between the floor and the
  // ceiling, which is no reason to print a figure the room does not believe.
  let minIn = onStep;
  while (minIn - 1 >= min && generateLayout({ ...params, [key]: minIn - 1 }, pkg).ok) minIn -= 1;
  return { minIn, maxIn };
}

/**
 * Wall cabinets over a stretch of leg: the corner box, then whatever fills it.
 *
 * The corner box is the one the parameter chose. A diagonal wall cabinet goes
 * over a lazy susan and a blind wall corner over a blind base — they are bought
 * as a pair, and mixing them puts a door swing where the box behind it is not.
 */
function bankFor(
  id: string,
  from: number,
  to: number,
  corner: (typeof CORNERS)[keyof typeof CORNERS] | null,
  /** Which end of this bank the scribe goes. Away from the hood, always. */
  fillerAt: "start" | "end" = "end",
): UpperBank {
  // Not rounded: a bank over a leg carrying a half-inch clearance is half an
  // inch shorter than a whole number of inches, and rounding it up made the
  // cabinets longer than the wall they are on.
  const totalIn = (to - from) * 12;
  const rest = corner ? totalIn - corner.upper.alongIn : totalIn;
  return {
    id,
    from,
    to,
    band: [ROOM.upperBottom, ROOM.upperTop] as const,
    modules: [
      ...(corner
        ? [
            M(corner.upper.code, "corner", corner.upper.alongIn, {
              heightIn: 42,
              depthIn: corner.upper.depthIn,
            }),
          ]
        : []),
      ...(rest > 0 ? fillWidth(rest, wallModule, fillerAt) : []),
    ],
  };
}

/**
 * Where a leg's wall cabinets stop: at the tall units that finish it, or at
 * the end of the run.
 *
 * The *trailing* block of them, not the first one on the leg. A tower standing
 * beside the cooking surface has counter and cabinets after it, and stopping
 * the bank at it would leave the rest of the wall bare.
 */
function bankStop(segments: RunSegment[]): number {
  let at = segments.length;
  while (at > 0 && segments[at - 1].kind === "tall") at -= 1;
  return at === segments.length ? segments[segments.length - 1].to : segments[at].from;
}

/**
 * The banks on the leg carrying the range, which the canopy interrupts.
 *
 * The bridge over the hood has no band of its own: its floor is the canopy's
 * top, which moves with whichever range goes in. See `hoodBridgeBand`.
 *
 * Whether there is a bridge at all is the hood's own business. An
 * under-cabinet hood is screwed to the underside of one and the duct runs up
 * inside it, so the box is structural. A chimney hood carries its own duct
 * cover to the ceiling, and a cabinet over it would be a cabinet with a
 * stainless flue through the middle of it — the space above a chimney hood is
 * meant to be empty.
 */
function banksAroundHood(
  runId: string,
  segments: RunSegment[],
  start: number,
  corner: (typeof CORNERS)[keyof typeof CORNERS] | null,
  spec: Record<SlotId, PackageSlot>,
  housingStyle: HousingStyle,
): UpperBank[] {
  const range = segments.find((segment) => segment.slot === "slot-range");
  const stop = bankStop(segments);
  if (!range) return [bankFor(`upper-${runId}`, start, stop, corner)];

  // The bank stops exactly at the hood's flank. A gap there is one you cannot
  // get a cloth into and a foot of shelf nobody has.
  //
  // Which flank that is depends on the hood: a canopy is as wide as the range
  // under it, and a housing built round an insert liner is wider than both —
  // 42" over a 36" rangetop is what a chimney breast looks like. So the span
  // is the hood's own width where that is the greater, centred on the range,
  // because the hood is centred on the range by rule.
  const centre = (range.from + range.to) / 2;
  const half = Math.max((range.to - range.from) / 2, ft(spec["slot-hood"].widthIn) / 2);
  const hood = [centre - half, centre + half] as const;
  const hoodIn = Math.round((hood[1] - hood[0]) * 12);
  const install = spec["slot-hood"].installType;
  const bridged = install === "under-cabinet";
  // A housing is cabinetry, and it is the cabinetry over this stretch of wall:
  // from where the liner hangs to the ceiling, in one piece, in the door
  // finish. `hoodCabinetParts` gives it its shape.
  const housed = install === "insert";
  const mountY = ft(
    (spec["slot-hood"].builtForCooktopIn ?? 36) + CABINET_STANDARDS.hood.aboveCooktopMinIn,
  );

  const hoodBank: UpperBank = {
    id: `upper-${runId}-hood`,
    from: hood[0],
    to: hood[1],
    ...(housed ? { band: hoodCabinetBand(mountY) } : {}),
    modules: [
      housed
        ? M(`HC${hoodIn}`, "hood-cabinet", hoodIn, {
            slot: "slot-hood",
            // As deep as the base run below it: a chimney breast is built off
            // the wall, not hung like a 12" wall cabinet.
            depthIn: CABINET_STANDARDS.base.depthIn,
            housing: housingStyle,
          })
        : M(`W${hoodIn}`, "bridge", hoodIn, { slot: "slot-hood" }),
    ],
  };

  /**
   * What breaks the run of wall cabinets, in order along the wall.
   *
   * The hood, and any tall unit standing in the middle of the leg — an oven
   * tower is 96" of carcass and there is no shelf over it. The tall units that
   * *finish* the leg are not in this list: they are where the bank stops.
   */
  /**
   * The stretch beside a mid-run tower that is filled to its top.
   *
   * The far side only. What is between the tower and the cooking surface is
   * the clearance the machine's sheet asks for and stays counter, with wall
   * cabinets over it like any other stretch. See `besideTheTower` in
   * cabinets.ts, which draws the same distinction.
   */
  const rangeAt = segments.findIndex((segment) => segment.slot === "slot-range");
  const filled = (at: number) =>
    [at - 1, at + 1]
      .filter((i) => !(rangeAt >= 0 && Math.sign(rangeAt - at) === Math.sign(i - at)))
      .map((i) => segments[i])
      .filter((neighbour) => neighbour && neighbour.kind === "counter");

  const towers = segments.filter(
    (segment) => segment.kind === "tall" && segment.from < stop - 1e-9,
  );
  const cuts = [
    ...towers.map((segment) => ({ from: segment.from, to: segment.to, hood: false })),
    // And what is filled beside them: a wall cabinet over a stretch that is
    // already finished panel to the ceiling is a cabinet inside a cabinet.
    ...towers
      .flatMap((tower) => filled(segments.indexOf(tower)))
      .map((segment) => ({ from: segment!.from, to: segment!.to, hood: false })),
    // Always the hood, whatever hangs there: a chimney carries its own cover
    // to the ceiling and takes no cabinet, and the bank still stops at it.
    { from: hood[0], to: hood[1], hood: true },
  ]
    .filter((cut) => cut.to > start && cut.from < stop)
    .sort((a, b) => a.from - b.from);

  if (cuts.length === 0) return [bankFor(`upper-${runId}`, start, stop, corner, "end")];

  const banks: UpperBank[] = [];
  /**
   * What the housing swallows: a stretch beside it too narrow to be a bank.
   *
   * A 42" breast over a 36" rangetop overhangs the machine by three inches
   * each side, so the six inches of clearance counter beside it leaves three
   * inches of wall between the breast and the oven tower's end panel. Three
   * inches is not a cabinet — it is a scribe — and hung on its own between two
   * things that are 24" deep it reads as a narrow board standing by itself.
   * So the housing takes it, in the housing's own depth, and its flank meets
   * the tower.
   */
  const scribes: { from: number; to: number }[] = [];
  const narrowest = narrowestBank();
  let cursor = start;
  for (const [i, cut] of cuts.entries()) {
    // The scribe goes away from what it abuts: at the corner end of the first
    // bank, at the far end of the rest.
    if (cut.from > cursor) {
      const beside = cut.hood || (i > 0 && cuts[i - 1].hood);
      if (housed && beside && cut.from - cursor < narrowest) {
        scribes.push({ from: cursor, to: cut.from });
      } else {
        banks.push(
          bankFor(`upper-${runId}-${i}`, cursor, cut.from, i === 0 ? corner : null, i === 0 ? "start" : "end"),
        );
      }
    }
    if (cut.hood && (bridged || housed)) banks.push(hoodBank);
    cursor = Math.max(cursor, cut.to);
  }
  if (stop > cursor) {
    if (housed && cuts[cuts.length - 1].hood && stop - cursor < narrowest) {
      scribes.push({ from: cursor, to: stop });
    } else {
      banks.push(bankFor(`upper-${runId}-end`, cursor, stop, null, "end"));
    }
  }

  for (const scribe of scribes) {
    const widthIn = round8((scribe.to - scribe.from) * 12);
    // As deep as the housing, so the two faces are one face.
    const module = M(`BF${widthIn}`, "filler", widthIn, {
      depthIn: CABINET_STANDARDS.base.depthIn,
    });
    if (scribe.to <= hoodBank.from + 1e-9) {
      hoodBank.from = scribe.from;
      hoodBank.modules.unshift(module);
    } else {
      hoodBank.to = scribe.to;
      hoodBank.modules.push(module);
    }
  }
  return banks;
}

/** Where each appliance and fixture ends up, given the runs and the island. */
function placements(
  runs: CabinetRun[],
  island: IslandLayout,
  spec: Record<SlotId, PackageSlot>,
  omitted: readonly SlotId[],
  params: LayoutParams,
) {
  const onRun = (run: CabinetRun, at: number): [number, number, number] =>
    run.axis === "x" ? [at, 0, run.centre] : [run.centre, 0, at];
  const facing = (run: CabinetRun) => (run.axis === "x" ? 0 : Math.PI / 2);

  const find = (match: (segment: RunSegment) => boolean) => {
    for (const run of runs) {
      const segment = run.segments.find(match);
      if (segment) return { run, segment };
    }
    throw new Error("layoutTemplate: the template left something off the runs");
  };

  /**
   * An opening on a perimeter run, optionally inset by a finished panel.
   *
   * On the floor of its opening unless the package hangs it higher: an oven
   * tower's hole starts 18" up with a drawer base under it, and the machine
   * stands on that sill rather than on the floor.
   */
  const wall = (slot: SlotId, inset = 0): SlotPlacement => {
    const { run, segment } = find((s) => s.slot === slot);
    const at = onRun(run, mid([segment.from + inset, segment.to - inset]));
    return {
      position: [at[0], ft(sillFor(spec[slot], params)), at[2]],
      rotationY: facing(run),
      mount: "wall",
    };
  };

  const range = find((s) => s.slot === "slot-range");
  const rangeAt = onRun(range.run, mid([range.segment.from, range.segment.to]));
  // A placeholder height: `slots.ts` hangs the canopy off the cooking surface
  // the wall was actually drilled for. See docs/decisions.md D13.
  const hoodY = ft(36.75 + CABINET_STANDARDS.hood.aboveCooktopMinIn);

  const islandSlot = (
    opening: readonly [number, number],
    face: "seating" | "working",
  ): SlotPlacement => {
    // Set in from the face it opens through by half a cabinet, which is where
    // the machine sits in the carcass — and turned to face out of it.
    const across =
      face === "seating"
        ? island.seating - ROOM.counterDepth / 2
        : island.working + ROOM.counterDepth / 2;
    const outward = face === "seating" ? 0 : Math.PI;
    return {
      position: islandPoint(island, mid(opening), across),
      // A quarter turn of the island is a quarter turn of everything in it.
      rotationY: island.axis === "x" ? outward : outward + Math.PI / 2,
      mount: "island",
    };
  };

  const sink = find((s) => s.fixture === "fixture-sink");

  /**
   * A machine the room was built without still answers when it is asked for.
   *
   * Everything in the scene is keyed by slot, and a missing key is a crash
   * rather than an absence. So an omitted machine keeps a placement, standing
   * at the origin where nothing draws it: `layout.omitted` is what the scene
   * actually reads before it draws anything.
   */
  const spare = (slot: SlotId, placed: () => SlotPlacement): SlotPlacement =>
    omitted.includes(slot) ? { position: [0, 0, 0], rotationY: 0, mount: "wall" } : placed();

  /**
   * Whether the run carries this machine, which is the question rather than
   * whether the room has an island. A package whose wine is a column stands it
   * in the tall bank whether or not there is an island to put it on.
   */
  const onARun = (slot: SlotId) =>
    runs.some((run) => run.segments.some((segment) => segment.slot === slot));

  return {
    slots: {
      // Inset by a panel inside its enclosure; hard against the run's own line
      // when there is no enclosure to be inside.
      "slot-fridge": wall("slot-fridge", insetOf(spec["slot-fridge"])),
      "slot-range": wall("slot-range"),
      "slot-hood": {
        position: [rangeAt[0], hoodY, rangeAt[2]] as [number, number, number],
        rotationY: facing(range.run),
        mount: "wall" as const,
      },
      "slot-dishwasher": wall("slot-dishwasher"),
      "slot-microwave": spare("slot-microwave", () =>
        onARun("slot-microwave")
          ? wall("slot-microwave")
          : islandSlot(island.microwave, "working"),
      ),
      "slot-wine": spare("slot-wine", () =>
        onARun("slot-wine") ? wall("slot-wine") : islandSlot(island.wine, "seating"),
      ),
    },
    fixtures: {
      "fixture-sink": {
        position: onRun(sink.run, mid([sink.segment.from, sink.segment.to])),
        rotationY: facing(sink.run),
        mount: "wall" as const,
      },
    },
  };
}

export function generateLayout(
  params: LayoutParams,
  pkg: Package = PACKAGE,
): GenerateResult {
  const reasons = validate(params);
  if (reasons.length > 0) return { ok: false, reasons };

  const halfX = ft(params.backWallIn) / 2;
  const halfZ = ft(params.leftWallIn) / 2;
  const corner = CORNERS[params.cornerType];
  const spec = slotsOf(pkg);
  const omitted = omittedSlots(params, pkg);
  const plan = planLegs(params, pkg, omitted);

  // Both walls are judged before either is built: fixing one and finding the
  // other waiting is the worst way to learn a room is too small. A wall that is
  // wrong carries what is standing on it and one change that would make it fit.
  const wrongLength: Refusal[] = [];
  for (const leg of ["left", "back"] as const) {
    const key = leg === "back" ? ("backWallIn" as const) : ("leftWallIn" as const);
    const requirement = requirementFor(params, leg, pkg, omitted);
    const vars = {
      paramKey: `param.${key}`,
      wallIn: params[key],
      minimumIn: requirement.minimumIn,
      wantedIn: requirement.wantedIn,
      maximumIn: requirement.maximumIn,
    };
    if (params[key] < requirement.minimumIn) {
      wrongLength.push({
        key: "refusal.wallShort",
        vars: { ...vars, shortIn: requirement.minimumIn - params[key] },
        occupancy: requirement.items,
        suggestion: suggestionForWall(params, key, pkg),
      });
    } else if (params[key] > requirement.maximumIn) {
      // Not a shortage: D13 stops a single run at 144", and a longer wall is
      // two runs with something between them, which is a different template.
      wrongLength.push({
        key: "refusal.wallLong",
        vars: { ...vars, overIn: params[key] - requirement.maximumIn },
        suggestion: {
          key: "suggestion.shorten",
          vars: { paramKey: `param.${key}`, value: requirement.maximumIn },
          patch: { [key]: requirement.maximumIn } as Partial<LayoutParams>,
        },
      });
    }
  }
  if (wrongLength.length > 0) return { ok: false, reasons: wrongLength };

  const packedLeft = packLeg(plan.left.availableIn, plan.left.items);
  const packedBack = packLeg(plan.back.availableIn, plan.back.items);
  if ("shortIn" in packedLeft || "shortIn" in packedBack) {
    // The requirement above is the same arithmetic, so this cannot normally
    // happen; if it ever does, it is a bug rather than a room that is too small.
    throw new Error("layoutTemplate: a wall passed its requirement and would not pack");
  }

  const leftSegments = layOut("left", -halfZ, plan.left.items, packedLeft.widths);
  const backSegments = layOut(
    "back",
    -halfX + ft(corner.acrossIn),
    plan.back.items,
    packedBack.widths,
  );
  const island = islandFor(params, spec, halfX, halfZ);

  // The left leg's bank starts at the wall; the back leg's picks up where the
  // corner wall cabinet stops, which is 24" in over a lazy susan and 12" in
  // over a blind corner.
  const runs: CabinetRun[] = [
    {
      id: "left",
      axis: "z",
      centre: -halfX + ROOM.counterDepth / 2,
      segments: leftSegments,
      uppers: [bankFor("upper-left", -halfZ, bankStop(leftSegments), corner)],
    },
    {
      id: "back",
      axis: "x",
      centre: -halfZ + ROOM.counterDepth / 2,
      segments: backSegments,
      uppers: banksAroundHood(
        "back",
        backSegments,
        -halfX + ft(corner.upper.acrossIn),
        null,
        spec,
        params.housingStyle,
      ),
    },
  ];

  const placed = placements(runs, island, spec, omitted, params);

  return {
    ok: true,
    layout: {
      params,
      runs,
      island,
      slots: placed.slots,
      fixtures: placed.fixtures,
      omitted,
    },
  };
}

/**
 * The refrigerator opening, for the scene that draws the enclosure.
 *
 * Inside the panels where there are panels; the whole segment where there are
 * none, because then the opening and the appliance are the same thing.
 */
export function fridgeOpeningOf(
  layout: GeneratedLayout,
  pkg: Package = PACKAGE,
): readonly [number, number] {
  const inset = insetOf(slotsOf(pkg)["slot-fridge"]);
  for (const run of layout.runs) {
    const tower = run.segments.find((s) => s.slot === "slot-fridge");
    if (tower) return [tower.from + inset, tower.to - inset] as const;
  }
  return [0, 0] as const;
}
