import {
  CABINET_STANDARDS,
  PANEL,
  ROOM,
  ft,
  type CabinetModule,
  type CabinetRun,
  type ModuleKind,
  type RunSegment,
} from "./roomShell";
import type { FixtureId, SlotId } from "../types";

/**
 * The L-with-island template.
 *
 * A layout is a template plus a handful of parameters, and the generator's job
 * is to turn those into a list of cabinets you could order — not into a picture
 * that looks about right. Everything it emits goes through `checkLayout`, so a
 * set of parameters that cannot be built comes back as a refusal with a reason
 * rather than a room with a 2" gap in it.
 *
 * Step one carries two parameters, which is enough to prove the generator
 * rather than to design with: how long the island is, and which end of the L
 * the refrigerator stands at. Moving the refrigerator is the interesting one —
 * it does not just slide, it displaces the sink and the dishwasher onto the
 * other leg, because a 14ft wall will not carry a range, a sink, a dishwasher
 * and a 42" tower at once.
 */
export interface LayoutParams {
  /** 48" to 96", in 6" steps. */
  islandLengthIn: number;
  /** Which leg of the L the refrigerator tower finishes. */
  fridgeEnd: "left" | "back";
}

export const PARAM_LIMITS = {
  islandLengthIn: { min: 48, max: 96, step: 6 },
};

export const DEFAULT_PARAMS: LayoutParams = { islandLengthIn: 72, fridgeEnd: "left" };

export interface SlotPlacement {
  position: [number, number, number];
  rotationY: number;
  mount: "wall" | "island";
}

export interface IslandLayout {
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

/** Lay modules end to end from `start`, returning the segment they make. */
function segment(
  id: string,
  kind: RunSegment["kind"],
  start: number,
  modules: CabinetModule[],
  extra: Partial<RunSegment> = {},
): RunSegment {
  const width = modules.reduce((sum, module) => sum + module.widthIn, 0);
  return { id, kind, from: start, to: start + ft(width), modules, ...extra };
}

/** Chain segments, each starting where the last one stopped. */
function chain(start: number, build: ((at: number) => RunSegment)[]): RunSegment[] {
  const segments: RunSegment[] = [];
  let cursor = start;
  for (const make of build) {
    const next = make(cursor);
    segments.push(next);
    cursor = next.to;
  }
  return segments;
}

const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;

/**
 * Check the parameters before building anything.
 *
 * Refusing is a first-class outcome: the answer to "can I have a 50 inch
 * island?" is no, and the useful part is the sentence that follows.
 */
function validate(params: LayoutParams): string[] {
  const reasons: string[] = [];
  const { min, max, step } = PARAM_LIMITS.islandLengthIn;
  const length = params.islandLengthIn;

  if (length < min || length > max) {
    reasons.push(`An island is ${min}" to ${max}" long; ${length}" is outside that.`);
  } else if ((length - min) % step !== 0) {
    reasons.push(
      `Islands come in ${step}" steps from ${min}"; ${length}" falls between ` +
        `${Math.floor((length - min) / step) * step + min}" and ` +
        `${Math.ceil((length - min) / step) * step + min}".`,
    );
  }

  // Two 24" openings on opposite faces cannot share the same stretch of island:
  // 24 deep plus 24 deep is more than the 36 the island has.
  const needed = 24 * 2;
  if (length >= min && length < needed) {
    reasons.push(
      `A microwave and a wine cabinet need ${needed}" of island between them; ` +
        `${length}" fits one of them.`,
    );
  }

  return reasons;
}

/** The island, centred in the room's open half with its working aisle kept. */
function islandFor(params: LayoutParams): IslandLayout {
  const backFace = -ROOM.halfZ + ROOM.counterDepth;
  const leftFace = -ROOM.halfX + ROOM.counterDepth;
  const length = ft(params.islandLengthIn);
  const depth = ft(36);

  // The zone it may occupy: clear of the left run's aisle, out to the open edge.
  const from = leftFace + ft(42);
  const to = ROOM.halfX;
  const centre = (from + to) / 2;
  const x = [centre - length / 2, centre + length / 2] as const;

  const z = [backFace + ft(42), backFace + ft(42) + depth] as const;
  const opening = ft(24);
  // Flush to the ends on a short island, inset on a long one.
  const inset = Math.min(ft(6), (length - opening * 2) / 2);

  return {
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
 * The perimeter runs.
 *
 * With the refrigerator on the left leg the back wall carries the whole working
 * triangle. Move it to the back leg and the sink and dishwasher have to go
 * somewhere: a 14ft wall will not take a range, a sink, a dishwasher and a 42"
 * tower, so they move onto the left leg. That displacement is the point of the
 * parameter — it is a different kitchen, not the same one mirrored.
 */
function runsFor(params: LayoutParams): CabinetRun[] {
  const leftCentre = -ROOM.halfX + ROOM.counterDepth / 2;
  const backCentre = -ROOM.halfZ + ROOM.counterDepth / 2;
  const corner = CABINET_STANDARDS.corner.lazySusanIn;
  const leftStart = -ROOM.halfZ;
  const backStart = -ROOM.halfX + ft(corner);

  const lazySusan = (at: number) =>
    segment("corner", "corner", at, [M(`LS${corner}`, "corner", corner)]);
  const range = (at: number) =>
    segment("range", "appliance", at, [M("RO36", "opening", 36, { slot: "slot-range" })], {
      slot: "slot-range",
    });
  const sink = (at: number) =>
    segment("sink", "fixture", at, [M("SB30", "sink-base", 30, { fixture: "fixture-sink" })], {
      fixture: "fixture-sink",
    });
  const dishwasher = (at: number) =>
    segment(
      "dishwasher",
      "appliance",
      at,
      [M("RO24", "opening", 24, { slot: "slot-dishwasher" })],
      { slot: "slot-dishwasher" },
    );
  const tower = (at: number) =>
    segment("fridge", "tall", at, [M("T4296", "tall", 42, { heightIn: 96, slot: "slot-fridge" })], {
      slot: "slot-fridge",
    });
  const base = (id: string, widthIn: number, kind: ModuleKind = "base") => (at: number) =>
    segment(id, "counter", at, [M(`${kind === "drawer-base" ? "DB" : "B"}${widthIn}`, kind, widthIn)]);

  const uppers = (id: string, from: number, to: number, modules: CabinetModule[]) => ({
    id,
    from,
    to,
    band: [ROOM.upperBottom, ROOM.upperTop] as const,
    modules,
  });
  const W = (widthIn: number) => M(`W${widthIn}42`, "wall", widthIn, { heightIn: 42 });

  if (params.fridgeEnd === "left") {
    const left = chain(leftStart, [
      lazySusan,
      base("left-base", 24),
      base("left-drawers", 18, "drawer-base"),
      base("left-fridge-landing", 18),
      tower,
    ]);
    const back = chain(backStart, [
      base("back-range-landing-left", 15),
      range,
      base("back-range-landing-right", 15),
      sink,
      dishwasher,
      base("back-end", 12),
    ]);
    return [
      {
        id: "left",
        axis: "z",
        centre: leftCentre,
        segments: prefix("left", left),
        uppers: [leftUppers(left, leftStart, W, uppers)],
      },
      {
        id: "back",
        axis: "x",
        centre: backCentre,
        segments: prefix("back", back),
        uppers: backUppers(back, backStart, W),
      },
    ];
  }

  // The refrigerator finishes the back leg; the sink and dishwasher move.
  const left = chain(leftStart, [
    lazySusan,
    base("left-base", 15),
    sink,
    dishwasher,
    base("left-end", 12),
  ]);
  const back = chain(backStart, [
    base("back-range-landing-left", 15),
    range,
    base("back-range-landing-right", 21),
    base("back-fridge-landing", 18),
    tower,
  ]);
  return [
    {
      id: "left",
      axis: "z",
      centre: leftCentre,
      segments: prefix("left", left),
      uppers: [leftUppers(left, leftStart, W, uppers)],
    },
    {
      id: "back",
      axis: "x",
      centre: backCentre,
      segments: prefix("back", back),
      uppers: backUppers(back, backStart, W),
    },
  ];
}

/**
 * The wall cabinets on the left run: a corner box, then whatever fills the
 * stretch up to the tower — or to the end of the run, when the tower is on the
 * other leg.
 */
function leftUppers(
  segments: RunSegment[],
  start: number,
  W: (widthIn: number) => CabinetModule,
  bank: (
    id: string,
    from: number,
    to: number,
    modules: CabinetModule[],
  ) => { id: string; from: number; to: number; band: readonly [number, number]; modules: CabinetModule[] },
) {
  const tower = segments.find((s) => s.kind === "tall");
  const end = tower ? tower.from : segments[segments.length - 1].to;
  const cornerIn = 24;
  const rest = Math.round((end - start) * 12) - cornerIn;
  return bank("upper-left", start, end, [
    M("WER2442", "corner", cornerIn, { heightIn: 42 }),
    ...fillWidth(rest, W),
  ]);
}

/** Namespace the ids by run, so two runs may both have a "sink". */
function prefix(run: string, segments: RunSegment[]): RunSegment[] {
  return segments.map((s) => ({ ...s, id: s.id.startsWith(run) ? s.id : `${run}-${s.id}` }));
}

/**
 * The wall cabinets on the back run: one bank each side of the canopy, and the
 * bridge over it whose band is derived from the canopy rather than declared.
 */
function backUppers(
  segments: RunSegment[],
  start: number,
  W: (widthIn: number) => CabinetModule,
) {
  const range = segments.find((s) => s.slot === "slot-range")!;
  const end = segments[segments.length - 1];
  const hood = [range.from - ft(3), range.to + ft(3)] as const;
  const rightIn = Math.round((end.to - hood[1]) * 12);

  return [
    {
      id: "upper-back-left",
      from: start,
      to: hood[0],
      band: [ROOM.upperBottom, ROOM.upperTop] as const,
      modules: [W(Math.round((hood[0] - start) * 12))],
    },
    {
      id: "upper-back-hood",
      from: hood[0],
      to: hood[1],
      modules: [M("W42", "bridge", 42, { slot: "slot-hood" })],
    },
    {
      id: "upper-back-right",
      from: hood[1],
      to: end.to,
      band: [ROOM.upperBottom, ROOM.upperTop] as const,
      modules: fillWidth(rightIn, W),
    },
  ];
}

/**
 * Compose a width out of stock wall cabinets.
 *
 * Largest first, but never leaving a remainder too small to be a cabinet: 78"
 * as 36 + 36 + 6 is arithmetically fine and nobody would hang it. Taking the
 * biggest box that leaves either nothing or at least another 12" gives
 * 36 + 30 + 12, which is what a supplier would quote.
 */
function fillWidth(totalIn: number, W: (widthIn: number) => CabinetModule): CabinetModule[] {
  const stock = [36, 33, 30, 27, 24, 21, 18, 15, 12];
  const modules: CabinetModule[] = [];
  let left = totalIn;
  while (left > 0) {
    const next = stock.find((width) => {
      if (width > left) return false;
      const rest = left - width;
      return rest % 3 === 0 && (rest === 0 || rest >= 12);
    });
    if (next === undefined) break;
    modules.push(W(next));
    left -= next;
  }
  return modules;
}

/** Where each appliance and fixture ends up, given the runs and the island. */
function placements(runs: CabinetRun[], island: IslandLayout) {
  const find = (slot: SlotId) => {
    for (const run of runs) {
      const found = run.segments.find((s) => s.slot === slot);
      if (found) return { run, segment: found };
    }
    return null;
  };
  const onRun = (run: CabinetRun, at: number): [number, number, number] =>
    run.axis === "x" ? [at, 0, run.centre] : [run.centre, 0, at];
  const facing = (run: CabinetRun) => (run.axis === "x" ? 0 : Math.PI / 2);

  const range = find("slot-range")!;
  const fridge = find("slot-fridge")!;
  const dishwasher = find("slot-dishwasher")!;
  const sinkRun = runs.find((run) => run.segments.some((s) => s.fixture === "fixture-sink"))!;
  const sink = sinkRun.segments.find((s) => s.fixture === "fixture-sink")!;

  // The tower's opening is inset from its enclosure by a finished panel a side.
  const fridgeOpening = [fridge.segment.from + PANEL, fridge.segment.to - PANEL] as const;
  const hoodY = ft(
    (36.75 as number) + CABINET_STANDARDS.hood.aboveCooktopMinIn,
  );

  return {
    slots: {
      "slot-fridge": {
        position: onRun(fridge.run, mid(fridgeOpening)),
        rotationY: facing(fridge.run),
        mount: "wall" as const,
      },
      "slot-range": {
        position: onRun(range.run, mid([range.segment.from, range.segment.to])),
        rotationY: facing(range.run),
        mount: "wall" as const,
      },
      "slot-hood": {
        position: (() => {
          const [x, , z] = onRun(range.run, mid([range.segment.from, range.segment.to]));
          return [x, hoodY, z] as [number, number, number];
        })(),
        rotationY: facing(range.run),
        mount: "wall" as const,
      },
      "slot-dishwasher": {
        position: onRun(
          dishwasher.run,
          mid([dishwasher.segment.from, dishwasher.segment.to]),
        ),
        rotationY: facing(dishwasher.run),
        mount: "wall" as const,
      },
      "slot-microwave": {
        position: [
          mid(island.microwave),
          0,
          island.workingZ + ROOM.counterDepth / 2,
        ] as [number, number, number],
        rotationY: Math.PI,
        mount: "island" as const,
      },
      "slot-wine": {
        position: [mid(island.wine), 0, island.seatingZ - ROOM.counterDepth / 2] as [
          number,
          number,
          number,
        ],
        rotationY: 0,
        mount: "island" as const,
      },
    },
    fixtures: {
      "fixture-sink": {
        position: onRun(sinkRun, mid([sink.from, sink.to])),
        rotationY: facing(sinkRun),
        mount: "wall" as const,
      },
    },
    fridgeOpening,
  };
}

export function generateLayout(params: LayoutParams): GenerateResult {
  const reasons = validate(params);
  if (reasons.length > 0) return { ok: false, reasons };

  const island = islandFor(params);
  const runs = runsFor(params);
  const placed = placements(runs, island);

  return {
    ok: true,
    layout: {
      params,
      runs,
      island,
      slots: placed.slots,
      fixtures: placed.fixtures,
    },
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
