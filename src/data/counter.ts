import { bowlExtent, FIXTURE_BY_ID } from "./fixtures";
import { ROOM, RUNS, ft, type CabinetRun } from "./room";
import { SLOT_BY_ID } from "./slots";

/** A point on the floor plan, in world feet. */
export type Point2 = readonly [number, number];

export interface CounterOutline {
  /** The slab's edge, as one closed polygon. */
  outline: Point2[];
  /** Openings cut through it: the sink bowl, the range. */
  holes: Point2[][];
  /** Underside and top, in feet. */
  band: readonly [number, number];
}

/**
 * The countertop, as one piece.
 *
 * It used to be a box per run, which left a hole at the inside corner where
 * neither leg reached — the two legs each stopped at their own centre line and
 * the 12" square between them belonged to nobody. A countertop is a single
 * fabricated slab that turns the corner, so it is described here as a single
 * L-shaped polygon and drawn once.
 *
 * Two things cut through it rather than breaking it. A slide-in range drops
 * into a cutout, and an undermount sink drops into another; the slab carries on
 * around both. What does stop it is a tall cabinet, which goes through to the
 * ceiling — so each leg of the L runs from the corner to whichever comes first,
 * its tower or its end.
 */
export function counterOutline(runs: CabinetRun[] = RUNS): CounterOutline {
  const left = runs.find((run) => run.axis === "z")!;
  const back = runs.find((run) => run.axis === "x")!;

  // Back edges sit on the walls; front edges stand proud by the overhang.
  const xBack = left.centre - ROOM.counterDepth / 2;
  const xFront = left.centre + ROOM.counterDepth / 2 + ROOM.counterOverhang;
  const zBack = back.centre - ROOM.counterDepth / 2;
  const zFront = back.centre + ROOM.counterDepth / 2 + ROOM.counterOverhang;

  const leftEnd = legEnd(left);
  const backEnd = legEnd(back);

  // Clockwise from the inside corner of the room.
  const outline: Point2[] = [
    [xBack, zBack],
    [backEnd, zBack],
    [backEnd, zFront],
    [xFront, zFront],
    [xFront, leftEnd],
    [xBack, leftEnd],
  ];

  return {
    outline,
    holes: [...rangeHoles(runs), ...sinkHoles(runs)],
    band: [ROOM.counterHeight - ROOM.counterThickness, ROOM.counterHeight] as const,
  };
}

/** Where a leg's counter stops: at its tower, or at the end of the run. */
function legEnd(run: CabinetRun): number {
  const tower = run.segments.find((segment) => segment.kind === "tall");
  return tower ? tower.from : run.segments[run.segments.length - 1].to;
}

/** A slide-in range drops into the top rather than interrupting it. */
function rangeHoles(runs: CabinetRun[]): Point2[][] {
  const holes: Point2[][] = [];
  for (const run of runs) {
    const range = run.segments.find((segment) => segment.slot === "slot-range");
    if (!range) continue;
    // The cutout is the appliance's own width, set back from the front edge.
    const depth = ft(SLOT_BY_ID["slot-range"].cutout.d);
    const across = [run.centre - depth / 2, run.centre + depth / 2] as const;
    holes.push(rect([range.from, range.to], across, run.axis));
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
      holes.push(
        rect([centre - bowl.alongHalf, centre + bowl.alongHalf], across, run.axis),
      );
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
