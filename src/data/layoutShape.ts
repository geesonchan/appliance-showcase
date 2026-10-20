import { alongOf, type Axis, type Facing } from "./frame";

/**
 * A layout's shape: which walls its runs stand on, which way each faces, what
 * is at each end of each, and which corner belongs to which run.
 *
 * Round 98a (docs/plans/round-98-layout-shape-plan.md). The package says which
 * machines a kitchen has; the shape says which wall each run is on (Leo, round
 * 98: "套餐管放哪些机器，形状管机器放在哪面墙，两件事分开" — D16's split). Until
 * round 98a the L was written into the generator and into every place that
 * needed a run's facing, as "the left run on z, the back run on x, both facing
 * their +1 side, one corner at the back left". This is that L written down once,
 * so that a one-wall kitchen (98b), a galley and a U are a new entry here and
 * not a new set of assumptions.
 *
 * What goes on each run — the refrigerator's leg, the sink's — is still the L
 * template's own (layoutTemplate.ts); it is 98b's to say for one wall, from
 * Leo's answers.
 */

/** The shapes this page builds: the L, and one wall since round 98b. */
export type LayoutShape = "L" | "one-wall";
export const LAYOUT_SHAPES: readonly LayoutShape[] = ["L", "one-wall"];

/** A run's name. The L's two legs; a later shape adds its own. */
export type RunId = "back" | "left";

/**
 * What is at one end of a run.
 *
 * `corner`: the corner box, shared with the run it turns to. `wall`: a wall
 * across the end, which the run finishes against with a filler. `open`: the
 * room, which the run finishes toward with a cabinet and a finished end (D13,
 * "What finishes a run").
 */
export type RunEnd = "corner" | "wall" | "open";

export interface ShapeRun {
  id: RunId;
  /** The axis the run travels along. */
  axis: Axis;
  /** Which way its cabinetry and machines face: away from the wall it stands on. */
  facing: Facing;
  /** What is at its low end and its high end along its axis. */
  ends: readonly [RunEnd, RunEnd];
}

/**
 * A corner: the run whose first box it is, and the run it eats into, whose
 * cabinetry starts where the corner box stops (D11 rule 8).
 */
export interface ShapeCorner {
  owner: RunId;
  other: RunId;
}

export interface ShapeSpec {
  runs: readonly ShapeRun[];
  corners: readonly ShapeCorner[];
}

/**
 * The L: the left run along the left wall (z), facing +x; the back run along
 * the back wall (x), facing +z. Both start at the corner at the back left, which
 * is the left run's first box. The back run's far end is the right-hand wall,
 * which it finishes against; the left run's far end is open to the room. That
 * is what the template has built since round 18; until round 98a it was written
 * as literals where each fact was needed.
 */
export const SHAPES: Record<LayoutShape, ShapeSpec> = {
  L: {
    runs: [
      { id: "left", axis: "z", facing: { axis: "x", sign: 1 }, ends: ["corner", "open"] },
      { id: "back", axis: "x", facing: { axis: "z", sign: 1 }, ends: ["corner", "wall"] },
    ],
    corners: [{ owner: "left", other: "back" }],
  },
  /**
   * One wall: one run along the back wall, facing +z, with no corner. Round
   * 98b, Leo (round 98, second batch 1, 4 and 6): on the back wall; the
   * refrigerator at the left end as you face it, and that end against a wall;
   * the right end open to the room. The left wall is drawn whole (Leo, round
   * 98b: "画整面左墙"); nothing stands along it.
   */
  "one-wall": {
    runs: [{ id: "back", axis: "x", facing: { axis: "z", sign: 1 }, ends: ["wall", "open"] }],
    corners: [],
  },
};

/**
 * Which way the room's left wall faces, whether or not a run stands along it:
 * the way the L's left run faces, which backs onto it. One wall draws it whole
 * with nothing on it (round 98b), and a service still turns the corner onto it
 * only where a run is there to need one.
 */
export const LEFT_WALL_FACING: Facing = SHAPES.L.runs.find((run) => run.id === "left")!.facing;

/** The shape's description, or a loud refusal for a shape no template builds. */
export function shapeSpec(shape: string): ShapeSpec {
  const spec = (SHAPES as Record<string, ShapeSpec | undefined>)[shape];
  if (!spec) throw new Error(`layoutTemplate: no template builds the shape "${shape}"`);
  return spec;
}

/** One run of a shape, by its name. */
export function shapeRun(spec: ShapeSpec, id: RunId): ShapeRun {
  const run = spec.runs.find((entry) => entry.id === id);
  if (!run) throw new Error(`layoutTemplate: the shape has no run "${id}"`);
  return run;
}

/**
 * Where a run's centre line is: half a counter depth out from the wall it
 * stands on, toward the room it faces. `halfX` and `halfZ` are the room's, in
 * feet; the wall behind a run facing +x is at -halfX.
 */
export function runCentre(run: Pick<ShapeRun, "facing">, halfX: number, halfZ: number, counterDepth: number): number {
  const half = alongOf(run.facing.axis, halfX, halfZ);
  return -run.facing.sign * half + run.facing.sign * (counterDepth / 2);
}
