import {
  CABINET_STANDARDS,
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
 * The steps are the trade's. The ends are D13's: both legs of an L are between
 * 96" and 144" measured from the inside corner, so a back wall shorter than
 * 132" cannot carry a 36" corner and a legal leg behind it.
 */
export const PARAM_LIMITS = {
  backWallIn: { min: 132, max: 168, step: 6 },
  leftWallIn: { min: 96, max: 144, step: 6 },
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

export type GenerateResult =
  | { ok: true; layout: GeneratedLayout }
  | { ok: false; reasons: string[] };

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
  },
  blind: {
    alongIn: CABINET_STANDARDS.corner.blindIn,
    acrossIn: 24,
    depthIn: CABINET_STANDARDS.base.depthIn,
    code: `BBC${CABINET_STANDARDS.corner.blindIn}`,
  },
} as const;

/** A corner wall cabinet reaches 24" into each leg, whatever is below it. */
const CORNER_UPPER_IN = 24;

/** The openings, dimensioned to the appliances that go in them. */
const OPENING_IN = { range: 36, dishwasher: 24, microwave: 24, wine: 24, fridge: 42 };
/** Counter beside the range (D11 rule 4) and beside the tower (rule 6). */
const LANDING_IN = { range: 12, fridge: 15, corner: 12 };

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

const gap = (id: string, minIn: number, optional = false): Item => ({
  kind: "gap",
  id,
  minIn,
  optional,
});

/** Two stretches of counter with nothing between them are one stretch. */
function mergeGaps(items: Item[]): Item[] {
  const merged: Item[] = [];
  for (const item of items) {
    const last = merged[merged.length - 1];
    if (item.kind === "gap" && last?.kind === "gap") {
      merged[merged.length - 1] = gap(
        last.id,
        last.minIn + item.minIn,
        Boolean(last.optional && item.optional),
      );
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

function step(name: keyof typeof PARAM_LIMITS, value: number, noun: string): string | null {
  const { min, max, step: increment } = PARAM_LIMITS[name];
  if (value < min || value > max) {
    return `${noun} runs from ${min}" to ${max}"; ${value}" is outside that.`;
  }
  if ((value - min) % increment !== 0) {
    const below = Math.floor((value - min) / increment) * increment + min;
    return (
      `${noun} comes in ${increment}" steps from ${min}"; ` +
      `${value}" falls between ${below}" and ${below + increment}".`
    );
  }
  return null;
}

/**
 * Check the parameters before building anything.
 *
 * Refusing is a first-class outcome: the answer to "can I have a 50 inch
 * island?" is no, and the useful part is the sentence that follows.
 */
function validate(params: LayoutParams): string[] {
  const reasons: string[] = [];
  const push = (reason: string | null) => {
    if (reason) reasons.push(reason);
  };

  push(step("backWallIn", params.backWallIn, "The back wall"));
  push(step("leftWallIn", params.leftWallIn, "The left wall"));

  // The tower and the sink base both need a run's worth of wall behind them,
  // and D13 caps a leg at 144". One leg will not carry a range, a sink, a
  // dishwasher and a 42" tower however long the wall is.
  if (params.fridgeEnd === params.sinkLeg) {
    const leg = params.sinkLeg === "back" ? "back" : "left";
    reasons.push(
      `The ${leg} leg cannot take both the sink and the refrigerator: a leg stops at ` +
        `${CABINET_STANDARDS.legIn.longMax}" and those two plus the range need more than that. ` +
        `Put one of them on the other leg.`,
    );
  }

  if (params.hasIsland) {
    push(step("islandLengthIn", params.islandLengthIn, "An island"));
    push(step("islandDepthIn", params.islandDepthIn, "An island's depth"));
    push(step("aisleIn", params.aisleIn, "The aisle"));

    // The island stands clear of the left run by an aisle, and everything from
    // there to the far side of the room is what it has to fit in.
    const alongIn = params.backWallIn - CABINET_STANDARDS.base.depthIn - params.aisleIn;
    if (params.islandLengthIn > alongIn) {
      reasons.push(
        `A ${params.islandLengthIn}" island will not fit: with a ${params.aisleIn}" aisle off the ` +
          `left run there is ${alongIn}" of room across a ${params.backWallIn}" wall.`,
      );
    }
    const acrossIn = CABINET_STANDARDS.base.depthIn + params.aisleIn + params.islandDepthIn;
    if (acrossIn > params.leftWallIn) {
      reasons.push(
        `The back run, a ${params.aisleIn}" aisle and a ${params.islandDepthIn}" island come to ` +
          `${acrossIn}", which is more than the ${params.leftWallIn}" the room is deep.`,
      );
    }
  }

  return reasons;
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

  const opening = (slot: SlotId, id: string, widthIn: number) =>
    fixed(id, widthIn, "appliance", M(`RO${widthIn}`, "opening", widthIn, { slot }), { slot });

  const sink = fixed(
    "sink",
    30,
    "fixture",
    M("SB30", "sink-base", 30, { fixture: "fixture-sink" }),
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

  const left: Item[] = [
    fixed(
      "corner",
      corner.alongIn,
      "corner",
      M(corner.code, "corner", corner.alongIn, { depthIn: corner.depthIn }),
    ),
    gap("corner-landing", LANDING_IN.corner),
  ];
  if (params.sinkLeg === "left") left.push(sink, dishwasher);
  if (!params.hasIsland) left.push(opening("slot-wine", "wine", OPENING_IN.wine));

  const back: Item[] = [
    gap("range-landing-left", LANDING_IN.range),
    opening("slot-range", "range", OPENING_IN.range),
    gap("range-landing-right", LANDING_IN.range),
  ];
  if (params.sinkLeg === "back") back.push(sink, dishwasher);
  if (!params.hasIsland) back.push(opening("slot-microwave", "microwave", OPENING_IN.microwave));

  // The tower finishes its leg, with a landing before it (D11 rule 6).
  if (params.fridgeEnd === "left") {
    left.push(gap("fridge-landing", LANDING_IN.fridge), tower);
    back.push(gap("back-end", LANDING_IN.corner, true));
  } else {
    back.push(gap("fridge-landing", LANDING_IN.fridge), tower);
    left.push(gap("left-end", LANDING_IN.corner, true));
  }

  return {
    left: { items: mergeGaps(left), availableIn: params.leftWallIn },
    back: { items: mergeGaps(back), availableIn: params.backWallIn - corner.acrossIn },
  };
}

/** Wall cabinets over a stretch of leg: a corner box, then whatever fills it. */
function bankFor(id: string, from: number, to: number, withCorner: boolean): UpperBank {
  const totalIn = Math.round((to - from) * 12);
  const rest = withCorner ? totalIn - CORNER_UPPER_IN : totalIn;
  return {
    id,
    from,
    to,
    band: [ROOM.upperBottom, ROOM.upperTop] as const,
    modules: [
      ...(withCorner
        ? [
            M(`WER${CORNER_UPPER_IN}42`, "corner", CORNER_UPPER_IN, {
              heightIn: 42,
              depthIn: CORNER_UPPER_IN,
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
  withCorner: boolean,
): UpperBank[] {
  const range = segments.find((segment) => segment.slot === "slot-range");
  const stop = bankStop(segments);
  if (!range) return [bankFor(`upper-${runId}`, start, stop, withCorner)];

  const hood = [range.from - ft(3), range.to + ft(3)] as const;
  return [
    bankFor(`upper-${runId}-left`, start, hood[0], withCorner),
    {
      id: `upper-${runId}-hood`,
      from: hood[0],
      to: hood[1],
      modules: [M("W42", "bridge", 42, { slot: "slot-hood" })],
    },
    bankFor(`upper-${runId}-right`, hood[1], stop, false),
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

  const packedLeft = packLeg(plan.left.availableIn, plan.left.items);
  const packedBack = packLeg(plan.back.availableIn, plan.back.items);

  // Two shortfalls are reported together: fixing one and finding the other
  // waiting is the worst way to learn a room is too small.
  const shortfall = (leg: "left" | "back", other: "left" | "back", by: number) => {
    const alternative =
      params.cornerType === "lazy-susan"
        ? 'turn the corner with a blind cabinet, which gives the back wall 12" more'
        : "take something off it";
    return (
      `The ${leg} wall is ${by}" short of what has to go on it. ` +
      `Lengthen it, move something to the ${other} wall, or ${alternative}.`
    );
  };
  const backShort = "shortIn" in packedBack ? [shortfall("back", "left", packedBack.shortIn)] : [];
  if ("shortIn" in packedLeft) {
    return { ok: false, reasons: [shortfall("left", "back", packedLeft.shortIn), ...backShort] };
  }
  if ("shortIn" in packedBack) return { ok: false, reasons: backShort };

  const leftSegments = layOut("left", -halfZ, plan.left.items, packedLeft.widths);
  const backSegments = layOut(
    "back",
    -halfX + ft(corner.acrossIn),
    plan.back.items,
    packedBack.widths,
  );
  const island = islandFor(params, halfX, halfZ);

  // The wall cabinets pick up 24" in from the corner on both legs, whatever
  // turns the corner underneath them.
  const runs: CabinetRun[] = [
    {
      id: "left",
      axis: "z",
      centre: -halfX + ROOM.counterDepth / 2,
      segments: leftSegments,
      uppers: [bankFor("upper-left", -halfZ, bankStop(leftSegments), true)],
    },
    {
      id: "back",
      axis: "x",
      centre: -halfZ + ROOM.counterDepth / 2,
      segments: backSegments,
      uppers: banksAroundHood("back", backSegments, -halfX + ft(CORNER_UPPER_IN), false),
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
