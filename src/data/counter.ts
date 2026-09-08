import { bowlExtent, FIXTURE_BY_ID } from "./fixtures";
import { ROOM, RUNS, ft, type CabinetRun } from "./room";
import type { Appliance } from "../types";

/** A point on the floor plan, in world feet. */
export type Point2 = readonly [number, number];

/** One slab: its edge, and the openings cut through it. */
export interface CounterPiece {
  outline: Point2[];
  /** Openings that do not reach an edge — a sink bowl, a slide-in's cutout. */
  holes: Point2[][];
}

export interface CounterOutline {
  /**
   * The pieces of stone. Usually one, turning the corner; a freestanding range
   * cuts the run clean through and makes two.
   */
  pieces: CounterPiece[];
  /** Underside and top, in feet. */
  band: readonly [number, number];
}

/** What a slide-in laps over, which is the one bit of counter that stays. */
const RANGE_LIP_IN = 1;

/**
 * The countertop.
 *
 * It used to be a box per run, which left a hole at the inside corner where
 * neither leg reached. A countertop is a single fabricated slab that turns the
 * corner, so it is described here as one L-shaped polygon and drawn once.
 *
 * Two kinds of opening go through it, and they are not the same kind.
 *
 * An undermount sink and a slide-in range drop *into* the top: the stone
 * carries on all round them, and they are holes. A freestanding range does not
 * drop into anything — it stands on the floor between two runs of cabinets and
 * the stone stops at each side of it. That is not a hole, it is the end of one
 * slab and the start of the next, which is why this returns pieces.
 *
 * The distinction is not pedantry. A hole that reaches the edge of its own
 * outline is not a hole: the triangulator quietly drops it and the slab comes
 * back solid, which is exactly what a freestanding range looked like here.
 *
 * What also stops the stone is a tall cabinet, which goes through to the
 * ceiling — so each leg runs from the corner to whichever comes first, its
 * tower or its end.
 */
export function counterOutline(
  runs: CabinetRun[] = RUNS,
  /** The range that is specified, which decides how its cutout is shaped. */
  range?: Appliance,
): CounterOutline {
  const left = runs.find((run) => run.axis === "z")!;
  const back = runs.find((run) => run.axis === "x")!;

  // Back edges sit on the walls; front edges stand proud by the overhang.
  const xBack = left.centre - ROOM.counterDepth / 2;
  const xFront = left.centre + ROOM.counterDepth / 2 + ROOM.counterOverhang;
  const zBack = back.centre - ROOM.counterDepth / 2;
  const zFront = back.centre + ROOM.counterDepth / 2 + ROOM.counterOverhang;

  // Each leg as a band from the corner outward, split wherever a freestanding
  // range cuts it through.
  const leftSpans = spans(zBack, legEnd(left), cuts(left, range));
  const backSpans = spans(xBack, legEnd(back), cuts(back, range));

  // The first span of each leg meets at the corner and is one piece of stone;
  // anything past a cut is a slab of its own.
  const outlines: Point2[][] = [
    lShape(
      { back: xBack, front: xFront, to: leftSpans[0][1] },
      { back: zBack, front: zFront, to: backSpans[0][1] },
    ),
    ...leftSpans.slice(1).map((span) => rect(span, [xBack, xFront], "z")),
    ...backSpans.slice(1).map((span) => rect(span, [zBack, zFront], "x")),
  ];

  const holes = [...rangeHoles(runs, range), ...sinkHoles(runs)];

  return {
    pieces: outlines.map((outline) => ({
      outline,
      holes: holes.filter((hole) => inside(centroid(hole), outline)),
    })),
    band: [ROOM.counterHeight - ROOM.counterThickness, ROOM.counterHeight] as const,
  };
}

/** Where a leg's counter stops: at its tower, or at the end of the run. */
function legEnd(run: CabinetRun): number {
  const tower = run.segments.find((segment) => segment.kind === "tall");
  return tower ? tower.from : run.segments[run.segments.length - 1].to;
}

/** True when the machine specified stands on the floor rather than dropping in. */
const standsOnTheFloor = (range?: Appliance) =>
  !range || range.installType.some((type) => /freestanding/i.test(type));

/** Where a leg's stone is cut clean through, along the run. */
function cuts(run: CabinetRun, range?: Appliance): [number, number][] {
  if (!standsOnTheFloor(range)) return [];
  return run.segments
    .filter((segment) => segment.slot === "slot-range")
    .map((segment) => [segment.from, segment.to] as [number, number]);
}

/** A run from `from` to `to`, minus the stretches cut out of it. */
function spans(from: number, to: number, gaps: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let cursor = from;
  for (const [a, b] of [...gaps].sort((x, y) => x[0] - y[0])) {
    if (a > cursor) out.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (to > cursor) out.push([cursor, to]);
  return out.length > 0 ? out : [[from, from]];
}

/** The corner piece: two bands meeting, written clockwise from the inside. */
function lShape(
  leftLeg: { back: number; front: number; to: number },
  backLeg: { back: number; front: number; to: number },
): Point2[] {
  return [
    [leftLeg.back, backLeg.back],
    [backLeg.to, backLeg.back],
    [backLeg.to, backLeg.front],
    [leftLeg.front, backLeg.front],
    [leftLeg.front, leftLeg.to],
    [leftLeg.back, leftLeg.to],
  ];
}

/**
 * A slide-in range and a rangetop both drop into the top, so the cutout is a
 * hole with an inch of stone left at the front for the deck to lap over.
 *
 * The hole is the drawing's where the machine publishes one — a 36" rangetop
 * asks for 35-1/8" x 22-13/16", not for the whole 36" of cabinet under it —
 * and the segment's own extent only when it does not.
 */
function rangeHoles(runs: CabinetRun[], appliance?: Appliance): Point2[][] {
  if (standsOnTheFloor(appliance)) return [];

  const holes: Point2[][] = [];
  for (const run of runs) {
    const range = run.segments.find((segment) => segment.slot === "slot-range");
    if (!range) continue;
    const front = ROOM.counterDepth / 2 + ROOM.counterOverhang - ft(RANGE_LIP_IN);
    const published = appliance?.cutoutDepthIn ? ft(appliance.cutoutDepthIn) : null;
    const back = published
      ? front - published
      : -ROOM.counterDepth / 2 + ft(0.5);
    const centre = (range.from + range.to) / 2;
    const half = appliance?.cutoutWidthIn
      ? ft(appliance.cutoutWidthIn) / 2
      : (range.to - range.from) / 2;
    holes.push(
      rect([centre - half, centre + half], [run.centre + back, run.centre + front], run.axis),
    );
  }
  return holes;
}

/** And so does an undermount basin. */
function sinkHoles(runs: CabinetRun[]): Point2[][] {
  const holes: Point2[][] = [];
  for (const run of runs) {
    for (const segment of run.segments) {
      if (!segment.fixture) continue;
      const bowl = bowlExtent(FIXTURE_BY_ID[segment.fixture]);
      if (!bowl) continue;
      const centre = (segment.from + segment.to) / 2;
      const across = [
        run.centre + bowl.acrossCentre - bowl.acrossHalf,
        run.centre + bowl.acrossCentre + bowl.acrossHalf,
      ] as const;
      holes.push(rect([centre - bowl.alongHalf, centre + bowl.alongHalf], across, run.axis));
    }
  }
  return holes;
}

function rect(
  along: readonly [number, number],
  across: readonly [number, number],
  axis: "x" | "z",
): Point2[] {
  if (axis === "x") {
    return [
      [along[0], across[0]],
      [along[1], across[0]],
      [along[1], across[1]],
      [along[0], across[1]],
    ];
  }
  return [
    [across[0], along[0]],
    [across[1], along[0]],
    [across[1], along[1]],
    [across[0], along[1]],
  ];
}

const centroid = (points: Point2[]): Point2 => [
  points.reduce((sum, p) => sum + p[0], 0) / points.length,
  points.reduce((sum, p) => sum + p[1], 0) / points.length,
];

/** Ray casting, to say which piece of stone an opening belongs to. */
function inside([x, z]: Point2, outline: Point2[]): boolean {
  let within = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i];
    const [xj, zj] = outline[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) within = !within;
  }
  return within;
}

/**
 * True when a polygon traces an L: six corners, every edge square to an axis.
 *
 * The property the corner fix exists to keep, stated as something a test can
 * ask. A slab that has come apart at the corner reads as two rectangles, and a
 * slab that has gained a notch reads as more than six corners.
 */
export function isRectilinearL(outline: Point2[]): boolean {
  if (outline.length !== 6) return false;
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const square = Math.abs(a[0] - b[0]) < 1e-9 || Math.abs(a[1] - b[1]) < 1e-9;
    if (!square) return false;
  }
  return true;
}
