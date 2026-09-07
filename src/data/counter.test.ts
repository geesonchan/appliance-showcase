import { afterAll, describe, expect, it } from "vitest";
import { applianceBox } from "./applianceBox";
import { CABINETS } from "./cabinets";
import { counterOutline, isRectilinearL } from "./counter";
import { setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS, PARAM_LIMITS, type LayoutParams } from "./layoutTemplate";
import { ROOM, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { FIXTURES } from "./testFixtures";
import type { Appliance } from "../types";

/**
 * The countertop stops at a freestanding range.
 *
 * This lives on the generated layouts rather than on the one room, because
 * that is where it was wrong: the hand-written room had the cutout and the
 * generator's did not, which is exactly the shape of bug a test against one
 * fixed layout cannot see. So it sweeps the same combinations the generator is
 * held to everywhere else.
 */

const inches = (feet: number) => feet * 12;
const params = (over: Partial<LayoutParams> = {}): LayoutParams => ({ ...DEFAULT_PARAMS, ...over });
const range = (installType: string[]) =>
  ({ ...FIXTURES.gasRange36, installType }) as Appliance;

/** Every combination the generator will build, one parameter at a time. */
function combinations(): Partial<LayoutParams>[] {
  const out: Partial<LayoutParams>[] = [{}];
  for (const cornerType of ["lazy-susan", "blind"] as const) {
    out.push({ cornerType });
    out.push({ cornerType, fridgeEnd: "back", sinkLeg: "left" });
    for (let backWallIn = PARAM_LIMITS.backWallIn.min; backWallIn <= PARAM_LIMITS.backWallIn.max; backWallIn += 6) {
      out.push({ cornerType, backWallIn });
      out.push({ cornerType, backWallIn, fridgeEnd: "back", sinkLeg: "left" });
    }
    for (let leftWallIn = PARAM_LIMITS.leftWallIn.min; leftWallIn <= PARAM_LIMITS.leftWallIn.max; leftWallIn += 6) {
      out.push({ cornerType, leftWallIn });
    }
  }
  out.push({ hasIsland: false });
  return out;
}

/** The range's footprint in plan, in world feet. */
function rangeFootprint() {
  for (const run of RUNS) {
    const segment = run.segments.find((s) => s.slot === "slot-range");
    if (!segment) continue;
    const box = applianceBox(SLOT_BY_ID["slot-range"], range(["freestanding"]));
    const centre = (segment.from + segment.to) / 2;
    const along = [centre - box.w / 2, centre + box.w / 2] as const;
    const across = [run.centre - box.d / 2, run.centre + box.d / 2] as const;
    return run.axis === "x"
      ? { x: along, z: across, segment }
      : { x: across, z: along, segment };
  }
  throw new Error("no range on any run");
}

const overlaps = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 1e-6;

/** Every piece of stone, as a plan rectangle. */
function slabRects() {
  return counterOutline(RUNS, range(["freestanding"])).pieces.flatMap((piece) => {
    // A rectilinear piece is covered by the rectangles between its vertical
    // edges; for an L that is two, which is what makes this a real test of
    // whether the stone is there rather than of how the polygon is written.
    const xs = [...new Set(piece.outline.map((p) => p[0]))].sort((a, b) => a - b);
    const rects: { x: readonly [number, number]; z: readonly [number, number] }[] = [];
    for (let i = 1; i < xs.length; i += 1) {
      const band = [xs[i - 1], xs[i]] as const;
      const mid = (band[0] + band[1]) / 2;
      // Which z the outline covers at this x: the span of the edges crossing it.
      const zs: number[] = [];
      for (let j = 0; j < piece.outline.length; j += 1) {
        const a = piece.outline[j];
        const b = piece.outline[(j + 1) % piece.outline.length];
        if (Math.min(a[0], b[0]) < mid && mid < Math.max(a[0], b[0])) zs.push(a[1]);
      }
      if (zs.length >= 2) rects.push({ x: band, z: [Math.min(...zs), Math.max(...zs)] as const });
    }
    return rects;
  });
}

afterAll(() => {
  setLayoutParams(DEFAULT_PARAMS);
});

describe("no countertop where a freestanding range stands", () => {
  it.each(combinations())("holds for %o", (over) => {
    const result = setLayoutParams(params(over));
    if (!result.ok) return;

    const machine = rangeFootprint();
    for (const rect of slabRects()) {
      const clash = overlaps(rect.x, machine.x) && overlaps(rect.z, machine.z);
      expect(clash, `stone over the range at ${JSON.stringify(over)}`).toBe(false);
    }
  });

  it.each(combinations())("puts no cabinet in the range's opening, for %o", (over) => {
    const result = setLayoutParams(params(over));
    if (!result.ok) return;

    const machine = rangeFootprint();
    for (const box of CABINETS) {
      // Wall cabinets are above the machine, and the hood bridge is meant to be.
      if (box.kind === "upper") continue;
      const x = [box.position[0] - box.size[0] / 2, box.position[0] + box.size[0] / 2] as const;
      const z = [box.position[2] - box.size[2] / 2, box.position[2] + box.size[2] / 2] as const;
      const clash = overlaps(x, machine.x) && overlaps(z, machine.z);
      expect(clash, `${box.id} stands in the range's opening at ${JSON.stringify(over)}`).toBe(
        false,
      );
    }
  });
});

describe("the slab is still one piece where the run is", () => {
  it("turns the corner in one piece, with the range cut out beyond it", () => {
    expect(setLayoutParams(DEFAULT_PARAMS).ok).toBe(true);
    const { pieces } = counterOutline(RUNS, range(["freestanding"]));

    // The piece that contains the corner is the L; a freestanding range cuts
    // the run in two, so what is past it is a rectangle of its own.
    const corner = pieces.find((piece) => isRectilinearL(piece.outline));
    expect(corner, "no L-shaped piece turning the corner").toBeDefined();
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(piece.outline.length === 4 || piece.outline.length === 6).toBe(true);
    }
  });

  it("stays one piece for a slide-in, which drops into the top", () => {
    expect(setLayoutParams(DEFAULT_PARAMS).ok).toBe(true);
    const { pieces } = counterOutline(RUNS, range(["slide-in"]));
    expect(pieces).toHaveLength(1);
    expect(isRectilinearL(pieces[0].outline)).toBe(true);
  });

  it("keeps the sink's cutout a hole rather than a break", () => {
    expect(setLayoutParams(DEFAULT_PARAMS).ok).toBe(true);
    const { pieces } = counterOutline(RUNS, range(["freestanding"]));
    const holes = pieces.flatMap((piece) => piece.holes);
    expect(holes.length).toBeGreaterThan(0);
    for (const hole of holes) {
      const zs = hole.map((p) => p[1]);
      // Strictly inside: a hole that reaches an edge is a notch, and the
      // triangulator quietly drops it.
      expect(Math.min(...zs)).toBeGreaterThan(-ROOM.halfZ + 1e-6);
      expect(inches(Math.max(...zs) - Math.min(...zs))).toBeLessThan(inches(ROOM.counterDepth));
    }
  });
});

describe("the wall cabinets come right up to the canopy", () => {
  /** The bridge over the hood, and the boxes either side of it, along the run. */
  function aroundTheHood() {
    const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
    const along = run.axis === "x" ? 0 : 2;
    const uppers = CABINETS.filter(
      (box) => box.kind === "upper" && box.id.startsWith(`upper-${run.id}`),
    );
    const bridge = uppers.find((box) => box.module?.kind === "bridge")!;
    const edge = (box: (typeof uppers)[number]) => ({
      low: box.position[along] - box.size[along] / 2,
      high: box.position[along] + box.size[along] / 2,
    });
    const hood = edge(bridge);
    const left = uppers
      .filter((box) => box !== bridge && edge(box).high <= hood.low + 1e-9)
      .sort((a, b) => edge(b).high - edge(a).high)[0];
    const right = uppers
      .filter((box) => box !== bridge && edge(box).low >= hood.high - 1e-9)
      .sort((a, b) => edge(a).low - edge(b).low)[0];
    return { hood, bridge, left, right, edge };
  }

  // Leo's rule: a gap beside a canopy is one you cannot get a cloth into and a
  // foot of shelf nobody has.
  it.each(combinations())("leaves no gap either side of it, for %o", (over) => {
    const result = setLayoutParams(params(over));
    if (!result.ok) return;

    const { hood, left, right, edge } = aroundTheHood();
    expect(left, `nothing to the left of the canopy at ${JSON.stringify(over)}`).toBeDefined();
    expect(right, `nothing to the right of the canopy at ${JSON.stringify(over)}`).toBeDefined();
    expect(inches(hood.low - edge(left).high), "gap on the left").toBeCloseTo(0, 6);
    expect(inches(edge(right).low - hood.high), "gap on the right").toBeCloseTo(0, 6);
  });

  // A filler is a strip of finished panel with nothing behind it. It belongs
  // against a wall, not against the one thing in the run you have to clean.
  it.each(combinations())("puts a cabinet against it, not a scribe, for %o", (over) => {
    const result = setLayoutParams(params(over));
    if (!result.ok) return;

    const { left, right } = aroundTheHood();
    expect(left.module?.kind, `filler left of the canopy at ${JSON.stringify(over)}`).not.toBe(
      "filler",
    );
    expect(right.module?.kind, `filler right of the canopy at ${JSON.stringify(over)}`).not.toBe(
      "filler",
    );
  });

  it("makes the bridge exactly as wide as the canopy under it", () => {
    expect(setLayoutParams(DEFAULT_PARAMS).ok).toBe(true);
    const { bridge } = aroundTheHood();
    const hood = SLOT_BY_ID["slot-hood"];
    const along = bridge.size[0] > bridge.size[2] ? 0 : 2;
    expect(inches(bridge.size[along])).toBeCloseTo(hood.cutout.w, 6);
  });
});
