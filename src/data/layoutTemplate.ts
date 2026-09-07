import {
  CABINET_STANDARDS,
  LAYOUT_LIMITS,
  PANEL,
  ROOM,
  ft,
  type CabinetModule,
  type CabinetRun,
  type ModuleKind,
  type RunSegment,
  type UpperBank,
} from "./roomShell";
import type { FixtureId, SlotId } from "../types";

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
  backWallIn: { min: 96, max: 168, step: 6 },
  leftWallIn: { min: 96, max: 168, step: 6 },
  islandLengthIn: { min: 48, max: 96, step: 6 },
  islandDepthIn: { min: 24, max: 42, step: 6 },
  aisleIn: { min: 42, max: 60, step: 3 },
};

export const DEFAULT_PARAMS: LayoutParams = {
  backWallIn: 168,
  leftWallIn: 144,
  cornerType: "lazy-susan",
  fridgeEnd: "left",
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
  workingZ: number;
  seatingZ: number;
  height: number;
  microwave: readonly [number, number];
  wine: readonly [number, number];
}

export interface GeneratedLayout {
  params: LayoutParams;
  runs: CabinetRun[];
  island: IslandLayout;
  slots: Record<SlotId, SlotPlacement>;
  fixtures: Record<FixtureId, SlotPlacement>;
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
  /** D13 caps a leg at 144"; past that it is two runs, not one. */
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
const CORNERS = {
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
const OPENING_IN = { range: 36, dishwasher: 24, microwave: 24, wine: 24, fridge: 42 };
/** The sink base, which is a fixture's cabinet rather than an opening. */
const SINK_BASE_IN = 30;

// --- packing a leg --------------------------------------------------------

/**
 * One thing on a leg: either a fixed width, or a stretch of counter that takes
 * whatever is left over.
 */
type Item =
  | {
      kind: "fixed";
      id: string;
      widthIn: number;
      segmentKind: RunSegment["kind"];
      module: CabinetModule;
      slot?: SlotId;
      fixture?: FixtureId;
    }
  | {
      kind: "gap";
      id: string;
      minIn: number;
      /** The rule that asks for it, for the breakdown under the slider. */
      rule: string;
      labelKey: string;
      /**
       * A stretch that is wanted but not needed: the base cabinet finishing a
       * run at the open end of the room. It is the first thing to go when the
       * wall is too short, which is what a designer drops first too.
       */
      optional?: boolean;
    };

const fixed = (
  id: string,
  widthIn: number,
  segmentKind: RunSegment["kind"],
  module: CabinetModule,
  extra: { slot?: SlotId; fixture?: FixtureId } = {},
): Item => ({ kind: "fixed", id, widthIn, segmentKind, module, ...extra });

const gap = (
  id: string,
  minIn: number,
  rule: string,
  extra: { optional?: boolean } = {},
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
      merged[merged.length - 1] = {
        ...wider,
        id: last.id,
        optional: Boolean(last.optional && item.optional),
      };
      continue;
    }
    merged.push(item);
  }
  return merged;
}

/**
 * Fit a leg's items into the wall it has.
 *
 * The fixed items are what they are; the stretches of counter between them
 * take the remainder, each at least its minimum. Sharing what is left in 3"
 * steps rather than giving it all to one is what a designer does with the same
 * problem — the landings either side of a range want to look like a pair.
 */
function packLeg(availableIn: number, items: Item[]): { widths: number[] } | { shortIn: number } {
  const fixedIn = items.reduce((sum, item) => sum + (item.kind === "fixed" ? item.widthIn : 0), 0);
  const gaps = items.filter((item) => item.kind === "gap") as Extract<Item, { kind: "gap" }>[];

  // Everything at its minimum; if that will not fit, drop the stretches that
  // were only wanted and try again.
  for (const keepOptional of [true, false]) {
    const minimums = gaps.map((item) => (item.optional && !keepOptional ? 0 : item.minIn));
    const minimum = minimums.reduce((sum, value) => sum + value, 0);
    let spare = availableIn - fixedIn - minimum;

    if (spare < 0) {
      if (keepOptional && gaps.some((item) => item.optional)) continue;
      return { shortIn: -spare };
    }
    if (gaps.length === 0) return spare === 0 ? { widths: [] } : { shortIn: 0 };

    const widths = [...minimums];
    // Share the remainder round the stretches that are actually there, so the
    // landings either side of a range come out as a pair. A stretch that was
    // dropped stays dropped rather than reappearing as the leftover.
    const kept = minimums.map((value, i) => (value > 0 ? i : -1)).filter((i) => i >= 0);
    const spread = kept.length > 0 ? kept : minimums.map((_, i) => i);
    for (let n = 0; spare >= 3; n += 1) {
      widths[spread[n % spread.length]] += 3;
      spare -= 3;
    }
    // Wall lengths and cabinet widths are both multiples of 3, so there is
    // never a remainder; if one appears it belongs to the first stretch.
    widths[spread[0]] += spare;
    return { widths };
  }
  return { shortIn: 0 };
}

/**
 * A stretch of counter as one or more cabinets' worth of run.
 *
 * D13 caps a base cabinet at 36", so 66" of counter is two segments, not one
 * 66" segment that no supplier would quote. Splitting so the remainder is never
 * under 12" keeps both halves orderable.
 */
function counterWidths(totalIn: number): number[] {
  const { max, step } = CABINET_STANDARDS.widthIn;
  const count = Math.max(1, Math.ceil(totalIn / max));
  const each = Math.floor(totalIn / count / step) * step;
  const widths = Array.from({ length: count }, () => each);
  // Whatever the even split leaves over goes onto the boxes one at a time, so
  // 66" comes out 33 + 33 rather than 36 + 30. A run of matched cabinets is
  // what a kitchen looks like; a big one with an offcut beside it is not.
  let spare = totalIn - each * count;
  for (let i = 0; spare >= step; i = (i + 1) % count) {
    widths[i] += step;
    spare -= step;
  }
  widths[0] += spare;
  return widths;
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
        modules: [item.module],
        ...(item.slot ? { slot: item.slot } : {}),
        ...(item.fixture ? { fixture: item.fixture } : {}),
      });
      cursor = to;
      continue;
    }

    const total = gapWidths[g++];
    if (total <= 0) continue;
    for (const [i, widthIn] of counterWidths(total).entries()) {
      const to = cursor + ft(widthIn);
      segments.push({
        id: `${runId}-${item.id}-${i}`,
        kind: "counter",
        from: cursor,
        to,
        modules: [baseModule(widthIn)],
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
function fillWidth(totalIn: number, make: (widthIn: number) => CabinetModule): CabinetModule[] {
  const stock = [36, 33, 30, 27, 24, 21, 18, 15, 12];
  const modules: CabinetModule[] = [];
  let left = Math.round(totalIn);
  while (left > 0) {
    const next = stock.find((width) => {
      if (width > left) return false;
      const rest = left - width;
      return rest % 3 === 0 && (rest === 0 || rest >= 12);
    });
    if (next === undefined) {
      const filler = left >= 6 ? 6 : 3;
      modules.push(M(`BF${filler}`, "filler", filler));
      left -= filler;
      continue;
    }
    modules.push(make(next));
    left -= next;
  }
  return modules;
}

// --- validation -----------------------------------------------------------

function step(name: keyof typeof PARAM_LIMITS, value: number): Refusal | null {
  const { min, max, step: increment } = PARAM_LIMITS[name];
  const vars = { paramKey: `param.${name}`, min, max, step: increment, value };
  if (value < min || value > max) return { key: "refusal.outOfRange", vars };
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

  push(step("backWallIn", params.backWallIn));
  push(step("leftWallIn", params.leftWallIn));

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

    // The island stands clear of the left run by an aisle, and everything from
    // there to the far side of the room is what it has to fit in.
    const alongIn = params.backWallIn - CABINET_STANDARDS.base.depthIn - params.aisleIn;
    if (params.islandLengthIn > alongIn) {
      const step_ = PARAM_LIMITS.islandLengthIn.step;
      const fits = Math.floor(alongIn / step_) * step_;
      reasons.push({
        key: "refusal.islandLong",
        vars: {
          islandIn: params.islandLengthIn,
          aisleIn: params.aisleIn,
          roomIn: alongIn,
          wallIn: params.backWallIn,
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
    if (acrossIn > params.leftWallIn) {
      reasons.push({
        key: "refusal.islandDeep",
        vars: {
          aisleIn: params.aisleIn,
          islandIn: params.islandDepthIn,
          needIn: acrossIn,
          wallIn: params.leftWallIn,
        },
        suggestion: {
          key: "suggestion.lengthen",
          vars: { paramKey: "param.leftWallIn", value: acrossIn },
          patch: { leftWallIn: acrossIn },
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
): Refusal["suggestion"] {
  // Working out whether a suggestion builds means generating it, and a
  // generation that fails would otherwise go looking for a suggestion of its
  // own. One level is all this question needs.
  if (suggesting) return undefined;
  suggesting = true;
  try {
    return firstSuggestion(params, key);
  } finally {
    suggesting = false;
  }
}

function firstSuggestion(
  params: LayoutParams,
  key: "backWallIn" | "leftWallIn",
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
    if (!generateLayout(patched).ok) continue;
    const range = feasibleRange(patched, key);
    if (range) candidate.vars.minimumIn = range.minIn;
    return candidate;
  }

  // Nothing rearranges into it: the wall itself has to move.
  const here = feasibleRange(params, key);
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

function islandFor(params: LayoutParams, halfX: number, halfZ: number): IslandLayout {
  const backFace = -halfZ + ROOM.counterDepth;
  const leftFace = -halfX + ROOM.counterDepth;
  const length = ft(params.hasIsland ? params.islandLengthIn : 0);
  const depth = ft(params.islandDepthIn);

  // Centred in what is left of the room once the aisle off the left run is kept.
  const centre = (leftFace + ft(params.aisleIn) + halfX) / 2;
  const x = [centre - length / 2, centre + length / 2] as const;
  const z = [backFace + ft(params.aisleIn), backFace + ft(params.aisleIn) + depth] as const;

  const opening = ft(OPENING_IN.microwave);
  // Flush to the ends on a short island, inset on a long one.
  const inset = Math.min(ft(6), Math.max(0, (length - opening * 2) / 2));

  return {
    present: params.hasIsland,
    x,
    z,
    workingZ: z[0],
    seatingZ: z[1],
    height: ROOM.counterHeight,
    microwave: [x[0] + inset, x[0] + inset + opening] as const,
    wine: [x[1] - inset - opening, x[1] - inset] as const,
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
function planLegs(params: LayoutParams) {
  const corner = CORNERS[params.cornerType];
  const { sink: sinkRule } = LAYOUT_LIMITS;

  const opening = (slot: SlotId, id: string, widthIn: number) =>
    fixed(id, widthIn, "appliance", M(`RO${widthIn}`, "opening", widthIn, { slot }), { slot });

  const sink = fixed(
    "sink",
    SINK_BASE_IN,
    "fixture",
    M(`SB${SINK_BASE_IN}`, "sink-base", SINK_BASE_IN, { fixture: "fixture-sink" }),
    { fixture: "fixture-sink" },
  );
  const dishwasher = opening("slot-dishwasher", "dishwasher", OPENING_IN.dishwasher);
  const tower = fixed(
    "fridge",
    OPENING_IN.fridge,
    "tall",
    M(`T${OPENING_IN.fridge}96`, "tall", OPENING_IN.fridge, {
      heightIn: 96,
      slot: "slot-fridge",
    }),
    { slot: "slot-fridge" },
  );

  /**
   * The sink group, laid out to D11 rule 10.
   *
   * The dishwasher goes on the side toward the range, so the cook turns from
   * the cooktop to the dishwasher to the sink without crossing the kitchen, and
   * it stands in for the wide side the rule asks for — 24" of counter-height
   * surface is 24" of counter-height surface. The far side is plain counter at
   * the narrow figure. Both legs read from the corner outward and the range is
   * always at the corner end of the run, so "toward the range" is always first.
   */
  const sinkGroup = (): Item[] => [
    dishwasher,
    sink,
    gap("sink-landing", sinkRule.narrowIn, "d11-10"),
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
      : gap("corner-landing", LAYOUT_LIMITS.cornerLandingIn, "d11-1", { optional: true }),
  ];
  if (params.sinkLeg === "left") left.push(...sinkGroup());
  // With no island the microwave drawer and the wine cabinet have to stand in
  // the perimeter run, and they go on the leg the sink is not on: that leg is
  // already carrying the range, the sink base and the dishwasher, and 48" more
  // of opening is exactly what it does not have.
  if (!params.hasIsland && params.sinkLeg === "back") {
    left.push(
      opening("slot-microwave", "microwave", OPENING_IN.microwave),
      opening("slot-wine", "wine", OPENING_IN.wine),
    );
  }

  const back: Item[] = [
    gap("range-landing-left", LAYOUT_LIMITS.rangeLandingIn, "d11-4"),
    opening("slot-range", "range", OPENING_IN.range),
    gap("range-landing-right", LAYOUT_LIMITS.rangeLandingIn, "d11-4"),
  ];
  if (params.sinkLeg === "back") back.push(...sinkGroup());
  if (!params.hasIsland && params.sinkLeg === "left") {
    back.push(
      opening("slot-microwave", "microwave", OPENING_IN.microwave),
      opening("slot-wine", "wine", OPENING_IN.wine),
    );
  }

  // The tower finishes its leg, with a landing before it (D11 rule 6).
  if (params.fridgeEnd === "left") {
    left.push(gap("fridge-landing", LAYOUT_LIMITS.fridgeLandingIn, "d11-6"), tower);
    back.push(gap("back-end", LAYOUT_LIMITS.cornerLandingIn, "d13-modules", { optional: true }));
  } else {
    back.push(gap("fridge-landing", LAYOUT_LIMITS.fridgeLandingIn, "d11-6"), tower);
    left.push(gap("left-end", LAYOUT_LIMITS.cornerLandingIn, "d13-modules", { optional: true }));
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
export function wallRequirement(params: LayoutParams, leg: "left" | "back"): WallRequirement {
  const plan = planLegs(params)[leg];
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
        code: item.module.code,
        labelKey: `requirement.${item.id}`,
      });
    } else if (!item.optional) {
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

  return { leg, items, minimumIn, maximumIn: CABINET_STANDARDS.legIn.longMax + across };
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
): { minIn: number; maxIn: number } | null {
  const { min, max, step } = PARAM_LIMITS[key];
  let minIn: number | null = null;
  let maxIn = min;
  for (let value = min; value <= max; value += step) {
    if (!generateLayout({ ...params, [key]: value }).ok) continue;
    if (minIn === null) minIn = value;
    maxIn = value;
  }
  return minIn === null ? null : { minIn, maxIn };
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
): UpperBank {
  const totalIn = Math.round((to - from) * 12);
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
      ...(rest > 0 ? fillWidth(rest, wallModule) : []),
    ],
  };
}

/** Where a leg's wall cabinets stop: at its tower, or at the end of the run. */
function bankStop(segments: RunSegment[]): number {
  const tower = segments.find((segment) => segment.kind === "tall");
  return tower ? tower.from : segments[segments.length - 1].to;
}

/**
 * The banks on the leg carrying the range, which the canopy interrupts.
 *
 * The bridge over the hood has no band of its own: its floor is the canopy's
 * top, which moves with whichever range goes in. See `hoodBridgeBand`.
 */
function banksAroundHood(
  runId: string,
  segments: RunSegment[],
  start: number,
  corner: (typeof CORNERS)[keyof typeof CORNERS] | null,
): UpperBank[] {
  const range = segments.find((segment) => segment.slot === "slot-range");
  const stop = bankStop(segments);
  if (!range) return [bankFor(`upper-${runId}`, start, stop, corner)];

  const hood = [range.from - ft(3), range.to + ft(3)] as const;
  return [
    bankFor(`upper-${runId}-left`, start, hood[0], corner),
    {
      id: `upper-${runId}-hood`,
      from: hood[0],
      to: hood[1],
      modules: [M("W42", "bridge", 42, { slot: "slot-hood" })],
    },
    bankFor(`upper-${runId}-right`, hood[1], stop, null),
  ];
}

/** Where each appliance and fixture ends up, given the runs and the island. */
function placements(runs: CabinetRun[], island: IslandLayout) {
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

  /** An opening on a perimeter run, optionally inset by a finished panel. */
  const wall = (slot: SlotId, inset = 0): SlotPlacement => {
    const { run, segment } = find((s) => s.slot === slot);
    return {
      position: onRun(run, mid([segment.from + inset, segment.to - inset])),
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
  ): SlotPlacement => ({
    position: [
      mid(opening),
      0,
      face === "seating"
        ? island.seatingZ - ROOM.counterDepth / 2
        : island.workingZ + ROOM.counterDepth / 2,
    ],
    rotationY: face === "seating" ? 0 : Math.PI,
    mount: "island",
  });

  const sink = find((s) => s.fixture === "fixture-sink");

  return {
    slots: {
      "slot-fridge": wall("slot-fridge", PANEL),
      "slot-range": wall("slot-range"),
      "slot-hood": {
        position: [rangeAt[0], hoodY, rangeAt[2]] as [number, number, number],
        rotationY: facing(range.run),
        mount: "wall" as const,
      },
      "slot-dishwasher": wall("slot-dishwasher"),
      "slot-microwave": island.present
        ? islandSlot(island.microwave, "working")
        : wall("slot-microwave"),
      "slot-wine": island.present ? islandSlot(island.wine, "seating") : wall("slot-wine"),
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

export function generateLayout(params: LayoutParams): GenerateResult {
  const reasons = validate(params);
  if (reasons.length > 0) return { ok: false, reasons };

  const halfX = ft(params.backWallIn) / 2;
  const halfZ = ft(params.leftWallIn) / 2;
  const corner = CORNERS[params.cornerType];
  const plan = planLegs(params);

  // Both walls are judged before either is built: fixing one and finding the
  // other waiting is the worst way to learn a room is too small. A wall that is
  // wrong carries what is standing on it and one change that would make it fit.
  const wrongLength: Refusal[] = [];
  for (const leg of ["left", "back"] as const) {
    const key = leg === "back" ? ("backWallIn" as const) : ("leftWallIn" as const);
    const requirement = wallRequirement(params, leg);
    const vars = {
      paramKey: `param.${key}`,
      wallIn: params[key],
      minimumIn: requirement.minimumIn,
      maximumIn: requirement.maximumIn,
    };
    if (params[key] < requirement.minimumIn) {
      wrongLength.push({
        key: "refusal.wallShort",
        vars: { ...vars, shortIn: requirement.minimumIn - params[key] },
        occupancy: requirement.items,
        suggestion: suggestionForWall(params, key),
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
  const island = islandFor(params, halfX, halfZ);

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
      uppers: banksAroundHood("back", backSegments, -halfX + ft(corner.upper.acrossIn), null),
    },
  ];

  const placed = placements(runs, island);

  return {
    ok: true,
    layout: { params, runs, island, slots: placed.slots, fixtures: placed.fixtures },
  };
}

/** The refrigerator opening, for the scene that draws the enclosure. */
export function fridgeOpeningOf(layout: GeneratedLayout): readonly [number, number] {
  for (const run of layout.runs) {
    const tower = run.segments.find((s) => s.slot === "slot-fridge");
    if (tower) return [tower.from + PANEL, tower.to - PANEL] as const;
  }
  return [0, 0] as const;
}
