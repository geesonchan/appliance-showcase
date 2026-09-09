import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { FIXTURE_BY_ID, sinkParts } from "./fixtures";
import { counterOutline, isRectilinearL } from "./counter";
import { setLayoutParams } from "./layoutState";
import { checkLayout } from "./layoutRules";
import {
  CORNERS,
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  feasibleRange,
  generateLayout,
  wallRequirement,
  type LayoutParams,
  type Refusal,
} from "./layoutTemplate";
import { CABINET_STANDARDS, ISLAND, LAYOUT, LAYOUT_LIMITS, ROOM, RUN_BY_ID, RUNS, segmentForSlot } from "./room";
import { SLOTS, SLOT_BY_ID } from "./slots";

/**
 * One set of combinations per parameter.
 *
 * A generator with nine parameters has more combinations than anyone can look
 * at, so this does not try: for each parameter it sweeps that parameter's whole
 * range against the rest, and then pairs the ones that actually interact — the
 * wall lengths against the corner, the island's dimensions against the room it
 * has to fit in, the sink against the refrigerator.
 *
 * The assertion is the same in every case, and it is the one that matters: a
 * set of parameters either produces a room that passes every rule in
 * `checkLayout`, or it is refused with a sentence saying why. There is no third
 * outcome — in particular there is no "builds, with a 2" gap in it".
 */

const inches = (feet: number) => feet * 12;
const params = (over: Partial<LayoutParams> = {}): LayoutParams => ({ ...DEFAULT_PARAMS, ...over });
const values = (limit: { min: number; max: number; step: number }) => {
  const all: number[] = [];
  for (let v = limit.min; v <= limit.max; v += limit.step) all.push(v);
  return all;
};

/**
 * Build a room and hold it to the rules, or collect why it was refused.
 *
 * The whole chain runs, not just the generator: the room is installed, the
 * slots are re-placed in it and the carcass is re-cut, and only then is it
 * checked. A generator whose output is fine until something downstream reads it
 * has not produced a buildable kitchen.
 */
function attempt(over: Partial<LayoutParams>): { built: true } | { built: false; reasons: Refusal[] } {
  const result = setLayoutParams(params(over));
  if (!result.ok) return { built: false, reasons: result.reasons };
  const problems = checkLayout();
  expect(problems.map((p) => `${p.code}: ${p.message}`), JSON.stringify(over)).toEqual([]);
  return { built: true };
}

/**
 * Every refusal has to be something the interface can print and act on: a key
 * it can translate, figures it can substitute, and — where the shape of the
 * room is the problem — the bill and a way out.
 */
function expectSentences(reasons: Refusal[], where: string) {
  expect(reasons.length, where).toBeGreaterThan(0);
  for (const reason of reasons) {
    expect(reason.key, where).toMatch(/^refusal\./);
    expect(Object.keys(reason.vars).length, `${where}: ${reason.key}`).toBeGreaterThan(0);
    if (reason.key === "refusal.wallShort") {
      expect(reason.occupancy?.length, `${where}: no bill`).toBeGreaterThan(0);
      expect(reason.suggestion, `${where}: no way out`).toBeDefined();
    }
  }
}

/** Sweep one parameter's whole range and account for every value. */
function sweep(name: string, over: (value: number) => Partial<LayoutParams>, all: number[]) {
  let builtAny = false;
  for (const value of all) {
    const result = attempt(over(value));
    if (result.built) builtAny = true;
    else expectSentences(result.reasons, `${name} = ${value}`);
  }
  expect(builtAny, `${name} builds at no value at all`).toBe(true);
}

afterAll(() => {
  setLayoutParams(DEFAULT_PARAMS);
});

describe("the wall lengths", () => {
  it("builds or refuses at every length of back wall, with both corners", () => {
    for (const cornerType of ["lazy-susan", "blind"] as const) {
      sweep(
        `back wall / ${cornerType}`,
        (backWallIn) => ({ backWallIn, cornerType }),
        values(PARAM_LIMITS.backWallIn),
      );
    }
  });

  it("builds or refuses at every length of left wall, with both corners", () => {
    for (const cornerType of ["lazy-susan", "blind"] as const) {
      sweep(
        `left wall / ${cornerType}`,
        (leftWallIn) => ({ leftWallIn, cornerType }),
        values(PARAM_LIMITS.leftWallIn),
      );
    }
  });

  it("fills the wall it was given, to the inch", () => {
    for (const backWallIn of [156, 162, 168]) {
      const result = setLayoutParams(params({ backWallIn, cornerType: "blind" }));
      expect(result.ok, `${backWallIn}"`).toBe(true);
      expect(inches(ROOM.halfX * 2)).toBe(backWallIn);
      const back = RUN_BY_ID.back.segments;
      expect(inches(back[back.length - 1].to)).toBeCloseTo(inches(ROOM.halfX), 6);
    }
  });

  /**
   * A wall is whatever length it is.
   *
   * The 6" step is the slider's, not the room's: it is how the control moves
   * between the wall's own minimum and its ceiling. Refusing 155" because it
   * falls between two of the control's stops was a rule about the interface
   * dressed up as a rule about the kitchen — and it was what kept a wall whose
   * minimum is 147" from ever being drawn at 147".
   */
  it("builds a wall that falls between two of the slider's steps", () => {
    const result = setLayoutParams(params({ backWallIn: 155 }));
    expect(result.ok, result.reasons.map((r) => r.key).join(" ")).toBe(true);
    expect(inches(ROOM.halfX * 2)).toBe(155);
    expect(checkLayout()).toEqual([]);
  });

  it("still refuses a wall outside the range altogether", () => {
    const result = setLayoutParams(params({ backWallIn: 240 }));
    expect(result.ok).toBe(false);
    expect(result.reasons[0].key).toBe("refusal.outOfRange");
  });
});

describe("the corner", () => {
  it("is a 36 inch square or a 42 inch blind box, and nothing else", () => {
    for (const cornerType of ["lazy-susan", "blind"] as const) {
      expect(setLayoutParams(params({ cornerType })).ok).toBe(true);
      const corner = RUN_BY_ID.left.segments.find((s) => s.kind === "corner")!;
      expect(inches(corner.to - corner.from)).toBe(cornerType === "blind" ? 42 : 36);
    }
  });

  // A blind corner is 42" long and still a 24" deep box. Drawing every corner
  // as a square put a foot of cabinet out into the floor.
  it("stands as deep as it really is, not as deep as it is wide", () => {
    for (const [cornerType, depthIn] of [
      ["lazy-susan", 36],
      ["blind", 24],
    ] as const) {
      expect(setLayoutParams(params({ cornerType })).ok).toBe(true);
      const box = CABINETS.find((b) => b.module?.kind === "corner" && b.kind === "base")!;
      // The left run travels along z, so its boxes measure depth on x.
      expect(inches(box.size[0]), cornerType).toBeCloseTo(depthIn, 6);
    }
  });

  // D11 rule 8: whatever turns the corner, the countertop over it is one slab.
  it("keeps the countertop a single L at either corner", () => {
    for (const cornerType of ["lazy-susan", "blind"] as const) {
      expect(setLayoutParams(params({ cornerType })).ok).toBe(true);
      // The piece that turns the corner is an L, whatever else the range has
      // cut off the end of a leg.
      const pieces = counterOutline().pieces;
      expect(pieces.some((piece) => isRectilinearL(piece.outline)), cornerType).toBe(true);
    }
  });

  // The reason to offer the choice at all: a blind corner only reaches 24" into
  // the other leg, so the back wall gets a foot of run back.
  it("gives the back leg twelve inches more when it is blind", () => {
    const legIn = (cornerType: LayoutParams["cornerType"]) => {
      expect(setLayoutParams(params({ cornerType })).ok).toBe(true);
      const back = RUN_BY_ID.back.segments;
      return inches(back[back.length - 1].to - back[0].from);
    };
    expect(legIn("blind") - legIn("lazy-susan")).toBe(12);
  });
});

describe("the refrigerator and the sink", () => {
  it("puts each on the leg it was asked for", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      const sinkLeg = fridgeEnd === "left" ? "back" : "left";
      expect(setLayoutParams(params({ fridgeEnd, sinkLeg })).ok).toBe(true);

      expect(segmentForSlot("slot-fridge")!.id.startsWith(fridgeEnd)).toBe(true);
      const sink = RUN_BY_ID[sinkLeg].segments.find((s) => s.fixture === "fixture-sink");
      expect(sink, `sink on the ${sinkLeg} leg`).toBeDefined();
      // Rule 5: the dishwasher goes wherever the sink goes.
      const dishwasher = RUN_BY_ID[sinkLeg].segments.find((s) => s.slot === "slot-dishwasher");
      expect(dishwasher, `dishwasher on the ${sinkLeg} leg`).toBeDefined();
    }
  });

  it("refuses to put both on one leg, at any wall length", () => {
    for (const leg of ["left", "back"] as const) {
      for (const backWallIn of values(PARAM_LIMITS.backWallIn)) {
        const result = setLayoutParams(params({ fridgeEnd: leg, sinkLeg: leg, backWallIn }));
        expect(result.ok, `${leg} leg at ${backWallIn}"`).toBe(false);
        expectSentences(result.reasons, `${leg} leg at ${backWallIn}"`);
      }
    }
  });
});

describe("the island", () => {
  it("builds or refuses at every length, depth and aisle", () => {
    sweep("island length", (islandLengthIn) => ({ islandLengthIn }), values(PARAM_LIMITS.islandLengthIn));
    sweep("island depth", (islandDepthIn) => ({ islandDepthIn }), values(PARAM_LIMITS.islandDepthIn));
    sweep("aisle", (aisleIn) => ({ aisleIn }), values(PARAM_LIMITS.aisleIn));
  });

  it("is the size it was asked for, and keeps the aisle it was asked for", () => {
    for (const aisleIn of [42, 48, 54]) {
      for (const islandDepthIn of [24, 36]) {
        const result = setLayoutParams(params({ aisleIn, islandDepthIn }));
        expect(result.ok, `${aisleIn}" aisle, ${islandDepthIn}" island`).toBe(true);
        expect(inches(ISLAND.z[1] - ISLAND.z[0])).toBeCloseTo(islandDepthIn, 6);
        expect(
          inches(ISLAND.z[0] - RUN_BY_ID.back.centre - ROOM.counterDepth / 2),
        ).toBeCloseTo(aisleIn, 6);
      }
    }
  });

  // Every dimension of the island fights the room for space, so each of them
  // has a length of wall it cannot be had at.
  it("refuses an island the room cannot hold, and says which way it does not fit", () => {
    const long = setLayoutParams(params({ backWallIn: 132, islandLengthIn: 96 }));
    expect(long.ok).toBe(false);
    expect(long.reasons.map((r) => r.key)).toContain("refusal.islandLong");

    const deep = setLayoutParams(params({ leftWallIn: 96, islandDepthIn: 42, aisleIn: 42 }));
    expect(deep.ok).toBe(false);
    expect(deep.reasons.map((r) => r.key)).toContain("refusal.islandDeep");
  });

  /**
   * Where the island's two machines go when there is no island.
   *
   * Both onto the refrigerator's leg, the last base cabinets before its
   * landing: that is the leg not already carrying the range and the sink, and
   * 48" of opening is not coming from anywhere else.
   *
   * It takes a long wall. Each of them is an enclosure — a finished panel
   * each side — so the pair costs 60" of run, and under D13's old 144" cap no
   * legal wall was long enough. At 168" most of the combinations reach it; the
   * two with a lazy susan on the refrigerator's own leg still do not, because
   * the susan eats 36" of that run before anything else stands on it.
   */
  it("carries both once the leg is long enough, and leaves them out below that", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      const sinkLeg = fridgeEnd === "left" ? ("back" as const) : ("left" as const);
      const key = fridgeEnd === "left" ? ("leftWallIn" as const) : ("backWallIn" as const);
      const at = (value: number) => params({ hasIsland: false, fridgeEnd, sinkLeg, [key]: value });

      // Once they are on they stay on: there is one threshold, not a band of
      // lengths that happen to work.
      let carried: number | null = null;
      for (const value of values(PARAM_LIMITS[key])) {
        const built = generateLayout(at(value));
        if (!built.ok) continue;
        const both = built.layout.omitted.length === 0;
        if (both && carried === null) carried = value;
        expect(both, `${fridgeEnd} leg at ${value}"`).toBe(carried !== null);
        if (!both) {
          expect([...built.layout.omitted], `${fridgeEnd} leg at ${value}"`).toEqual([
            "slot-microwave",
            "slot-wine",
          ]);
        }
      }

      // And where they are on, the room is a legal one with both in the run.
      if (carried === null) continue;
      expect(setLayoutParams(at(carried)).ok).toBe(true);
      const fridgeRun = RUNS.find((run) => run.segments.some((s) => s.slot === "slot-fridge"))!;
      const order = fridgeRun.segments.map((s) => s.slot);
      expect(order, `${fridgeEnd} leg at ${carried}"`).toContain("slot-microwave");
      expect(order, `${fridgeEnd} leg at ${carried}"`).toContain("slot-wine");
      expect(order.indexOf("slot-wine")).toBeLessThan(order.indexOf("slot-fridge"));
      expect(fridgeRun.segments[fridgeRun.segments.length - 1].slot).toBe("slot-fridge");
      expect(checkLayout(), `${fridgeEnd} leg at ${carried}"`).toEqual([]);
    }
  });

  /**
   * And when the leg will not take them, the room is built without them.
   *
   * The two machines an island carries are the two a kitchen can do without,
   * so a wall too short for them is not a refusal: it is a room with four
   * appliances in it and a line saying which two are missing and how to get
   * them back. Refusing here would be refusing over the wrong thing.
   */
  it("builds the room without them rather than refusing, and says which", () => {
    const result = setLayoutParams(params({ hasIsland: false }));
    expect(result.ok, result.reasons.map((r) => r.key).join(" ")).toBe(true);

    expect(ISLAND.present).toBe(false);
    expect(CABINETS.filter((box) => box.id.startsWith("island"))).toEqual([]);
    expect([...LAYOUT.omitted]).toEqual(["slot-microwave", "slot-wine"]);
    // Not in the room, and so not in the list the scene and the count read.
    expect(SLOTS.map((slot) => slot.id)).not.toContain("slot-microwave");
    expect(SLOTS.map((slot) => slot.id)).not.toContain("slot-wine");
    // Still a kitchen, and still a legal one.
    expect(RUNS.flatMap((run) => run.segments).map((s) => s.slot)).toContain("slot-range");
    expect(checkLayout()).toEqual([]);
  });

  it("does that with a blind corner too, which it used to refuse", () => {
    // A blind corner takes 6" more of its own leg than a lazy susan. With both
    // machines stacked on one leg those 6" were what ran out; split, they are
    // not.
    const result = setLayoutParams(params({ hasIsland: false, cornerType: "blind" }));
    expect(result.ok, result.reasons.map((r) => r.key).join(" ")).toBe(true);
    expect(checkLayout()).toEqual([]);
  });

  it("still says what is short when even the fallback will not fit", () => {
    const result = setLayoutParams(params({ hasIsland: false, backWallIn: 96 }));
    expect(result.ok).toBe(false);
    expectSentences(result.reasons, "no island, short back wall");
    expect(result.reasons[0].key).toBe("refusal.wallShort");
    expect(result.reasons[0].occupancy?.length).toBeGreaterThan(0);
  });
});

describe("D11 rule 10 · the sink has counter on both sides", () => {
  /** Usable surface beside the sink: counter, or the dishwasher standing in. */
  const beside = (direction: -1 | 1) => {
    const run = RUNS.find((r) => r.segments.some((seg) => seg.fixture === "fixture-sink"))!;
    const index = run.segments.findIndex((seg) => seg.fixture === "fixture-sink");
    let total = 0;
    for (let i = index + direction; i >= 0 && i < run.segments.length; i += direction) {
      const segment = run.segments[i];
      if (segment.slot === "slot-dishwasher") return inches(segment.to - segment.from);
      if (segment.kind !== "counter") break;
      total += inches(segment.to - segment.from);
    }
    return total;
  };

  /** Counter between the corner cabinet — or where it stops — and the sink. */
  const fromCorner = () => {
    const run = RUNS.find((r) => r.segments.some((seg) => seg.fixture === "fixture-sink"))!;
    const index = run.segments.findIndex((seg) => seg.fixture === "fixture-sink");
    const corner = run.segments.findIndex((seg) => seg.kind === "corner");
    return run.segments
      .slice(corner + 1, index)
      .filter((seg) => seg.kind === "counter")
      .reduce((sum, seg) => sum + inches(seg.to - seg.from), 0);
  };

  // Leo's case: with the refrigerator finishing the back leg the sink is
  // displaced onto the left one, where the corner is, so both halves of the
  // rule are live at once.
  const combinations = [
    ...values(PARAM_LIMITS.leftWallIn).map((leftWallIn) => ({ leftWallIn })),
    ...(["lazy-susan", "blind"] as const).map((cornerType) => ({ cornerType })),
    ...values(PARAM_LIMITS.islandLengthIn).map((islandLengthIn) => ({ islandLengthIn })),
  ];

  it.each(combinations)("holds with the refrigerator on the back leg: %o", (over) => {
    const result = setLayoutParams(params({ fridgeEnd: "back", sinkLeg: "left", ...over }));
    if (!result.ok) {
      expectSentences(result.reasons, JSON.stringify(over));
      return;
    }

    const { wideIn, narrowIn, fromCornerIn } = LAYOUT_LIMITS.sink;
    const sides = [beside(-1), beside(1)];
    expect(Math.max(...sides), `wide side ${JSON.stringify(over)}`).toBeGreaterThanOrEqual(wideIn);
    expect(Math.min(...sides), `narrow side ${JSON.stringify(over)}`).toBeGreaterThanOrEqual(
      narrowIn,
    );
    expect(fromCorner(), `off the corner ${JSON.stringify(over)}`).toBeGreaterThanOrEqual(
      fromCornerIn,
    );
    expect(checkLayout()).toEqual([]);
  });

  it("puts the dishwasher on the far side of the sink from the range", () => {
    for (const [fridgeEnd, sinkLeg] of [
      ["left", "back"],
      ["back", "left"],
    ] as const) {
      expect(setLayoutParams(params({ fridgeEnd, sinkLeg })).ok).toBe(true);
      const run = RUN_BY_ID[sinkLeg];
      const dishwasher = run.segments.findIndex((s) => s.slot === "slot-dishwasher");
      const sink = run.segments.findIndex((s) => s.fixture === "fixture-sink");
      // Both runs are ordered from the corner outward and the range is always
      // at the corner end, so "away from the range" is the higher index: the
      // work runs range, landing, sink, dishwasher.
      expect(dishwasher, `${sinkLeg} leg`).toBe(sink + 1);
    }
  });

  it("catches a sink pushed up against the corner", () => {
    expect(setLayoutParams(params({ fridgeEnd: "back", sinkLeg: "left" })).ok).toBe(true);
    const runs = structuredClone(RUNS);
    const left = runs.find((r) => r.id === "left")!;
    // Swap the counter after the corner with the dishwasher-and-sink pair, so
    // the sink base finishes hard against the corner cabinet.
    const order = ["left-corner", "left-sink", "left-dishwasher"].concat(
      left.segments
        .map((s) => s.id)
        .filter((id) => !["left-corner", "left-sink", "left-dishwasher"].includes(id)),
    );
    const by = new Map(left.segments.map((s) => [s.id, s]));
    let cursor = left.segments[0].from;
    left.segments = order.map((id) => {
      const segment = by.get(id)!;
      const moved = { ...segment, from: cursor, to: cursor + (segment.to - segment.from) };
      cursor = moved.to;
      return moved;
    });
    expect(checkLayout(runs).map((v) => v.code)).toContain("d11-10");
  });
});

describe("the corner cabinet and the one over it are bought as a pair", () => {
  it("changes both when the parameter changes", () => {
    for (const [cornerType, base, upper] of [
      ["lazy-susan", "LS36", "WER2442"],
      ["blind", "BBC42", "WBC2442"],
    ] as const) {
      expect(setLayoutParams(params({ cornerType })).ok).toBe(true);

      const corners = RUNS.flatMap((run) => run.segments)
        .flatMap((segment) => segment.modules)
        .filter((module) => module.kind === "corner");
      expect(corners.map((m) => m.code), cornerType).toEqual([base]);

      const wallCorners = RUNS.flatMap((run) => run.uppers)
        .flatMap((bank) => bank.modules)
        .filter((module) => module.kind === "corner");
      expect(wallCorners.map((m) => m.code), cornerType).toEqual([upper]);
    }
  });

  // A diagonal wall cabinet is square and the next leg's bank starts where it
  // stops; a blind one is an ordinary 12" deep box, so that bank picks up
  // sooner. Getting this wrong leaves the two banks overlapping in the corner.
  it("starts the other leg's wall run where its own corner box stops", () => {
    for (const [cornerType, acrossIn] of [
      ["lazy-susan", 24],
      ["blind", 12],
    ] as const) {
      expect(setLayoutParams(params({ cornerType })).ok).toBe(true);
      const first = RUN_BY_ID.back.uppers[0];
      expect(inches(first.from + ROOM.halfX), cornerType).toBeCloseTo(acrossIn, 6);
    }
  });
});

describe("what the shortest wall is made of", () => {
  it("adds up to the minimum it claims, item by item", () => {
    for (const cornerType of ["lazy-susan", "blind"] as const) {
      for (const leg of ["left", "back"] as const) {
        const requirement = wallRequirement(params({ cornerType }), leg);
        const sum = requirement.items.reduce((total, item) => total + item.widthIn, 0);
        expect(sum, `${leg} / ${cornerType}`).toBe(requirement.minimumIn);
      }
    }
  });

  // Leo's rule: every number the interface prints has to be traceable to a
  // cabinet somebody orders or a rule somebody wrote down.
  it("traces every figure to a module or a rule", () => {
    for (const leg of ["left", "back"] as const) {
      for (const item of wallRequirement(params(), leg).items) {
        expect(Boolean(item.code) !== Boolean(item.rule), JSON.stringify(item)).toBe(true);
        expect(item.labelKey).toMatch(/^requirement\./);
        expect(item.widthIn).toBeGreaterThan(0);
      }
    }
  });

  it("never claims a leg shorter than D13 allows", () => {
    for (const leg of ["left", "back"] as const) {
      const requirement = wallRequirement(params(), leg);
      // The back leg's wall is measured past whatever the corner takes out of
      // it, which is the corner's own figure rather than a constant: a lazy
      // susan reaches 36" into the back run and a blind corner 12".
      const across = leg === "back" ? CORNERS[params().cornerType].acrossIn : 0;
      expect(requirement.minimumIn - across).toBeGreaterThanOrEqual(
        CABINET_STANDARDS.legIn.shortMin,
      );
      expect(requirement.maximumIn - across).toBe(CABINET_STANDARDS.legIn.longMax);
    }
  });
});

describe("the greyed-out half of a slider", () => {
  it("is exactly the lengths that will not build", () => {
    for (const key of ["backWallIn", "leftWallIn"] as const) {
      for (const cornerType of ["lazy-susan", "blind"] as const) {
        const base = params({ cornerType });
        const range = feasibleRange(base, key);
        for (const value of values(PARAM_LIMITS[key])) {
          const built = generateLayout({ ...base, [key]: value }).ok;
          const inside = range !== null && value >= range.minIn && value <= range.maxIn;
          expect(inside, `${key} ${value}" / ${cornerType}`).toBe(built);
        }
      }
    }
  });

  it("agrees with the minimum printed under it", () => {
    for (const [key, leg] of [
      ["backWallIn", "back"],
      ["leftWallIn", "left"],
    ] as const) {
      const range = feasibleRange(params(), key)!;
      const wanted = wallRequirement(params(), leg).minimumIn;
      // Exactly, not to within a step. The floor of the slider is the figure
      // printed under it: a room that builds at 147" says 147".
      expect(range.minIn, leg).toBe(wanted);
    }
  });
});

/**
 * The island, turned a quarter round.
 *
 * The same island in a room that is deeper than it is wide: its long side
 * faces the left run instead of the back one, the two machines are spaced
 * along it as before, and the aisle rule is the aisle rule. What changes is
 * which wall each of the two refusals is measured against.
 */
describe("which way the island runs", () => {
  it("stands it off the left run instead, and passes every rule", () => {
    const result = setLayoutParams(params({ islandOrientation: "perpendicular" }));
    expect(result.ok, result.reasons.map((r) => r.key).join(" ")).toBe(true);

    expect(ISLAND.axis).toBe("z");
    // Long along z, deep across x — the parallel island's dimensions, swapped.
    expect(inches(ISLAND.z[1] - ISLAND.z[0])).toBeCloseTo(DEFAULT_PARAMS.islandLengthIn, 6);
    expect(inches(ISLAND.x[1] - ISLAND.x[0])).toBeCloseTo(DEFAULT_PARAMS.islandDepthIn, 6);

    // An aisle off the left run, which is the one it now stands beside.
    const leftFront = RUN_BY_ID.left.centre + ROOM.counterDepth / 2;
    expect(inches(ISLAND.x[0] - leftFront)).toBeGreaterThanOrEqual(DEFAULT_PARAMS.aisleIn);

    // The machines are spaced along it, and still face opposite ways.
    const microwave = SLOT_BY_ID["slot-microwave"];
    const wine = SLOT_BY_ID["slot-wine"];
    expect(microwave.position[2]).not.toBeCloseTo(wine.position[2], 6);
    expect(microwave.position[0]).toBeLessThan(wine.position[0]);
    expect(checkLayout()).toEqual([]);
  });

  it("refuses a turned island by the wall it is actually too long for", () => {
    // 96" of island along a left wall that has a 24" run and a 42" aisle on it
    // is 66" of room: it is refused for its length, where the same island
    // parallel to the back wall would have fitted.
    const result = setLayoutParams(
      params({ islandOrientation: "perpendicular", islandLengthIn: 96, leftWallIn: 120 }),
    );
    expect(result.ok).toBe(false);
    expect(result.reasons.map((r) => r.key)).toContain("refusal.islandLong");
    for (const reason of result.reasons) {
      if (reason.key !== "refusal.islandLong") continue;
      expect(reason.vars.paramKey).toBe("param.leftWallIn");
      expect(reason.vars.wallIn).toBe(120);
    }
  });
});

describe("a refusal comes with a way out", () => {
  /**
   * The figures below are wall lengths that will not build against a lazy
   * susan, which reaches 36" into the back run where a blind corner reaches
   * 12". What is under test — that a refusal carries a change which actually
   * builds — is the same either way, so the corner is pinned rather than the
   * numbers re-chosen every time the default moves.
   */
  const params = (over: Partial<LayoutParams> = {}): LayoutParams => ({
    ...DEFAULT_PARAMS,
    cornerType: "lazy-susan",
    ...over,
  });

  const shortWall = (over: Partial<LayoutParams>) => {
    const result = generateLayout(params(over));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    return result.reasons.find((r) => r.key === "refusal.wallShort")!;
  };

  it("hands back a change that actually builds", () => {
    for (const over of [
      { backWallIn: 132, islandLengthIn: 48 },
      { backWallIn: 150, islandLengthIn: 48 },
      {
        leftWallIn: 96,
        islandDepthIn: 24,
        fridgeEnd: "back" as const,
        sinkLeg: "left" as const,
      },
    ]) {
      const refusal = shortWall(over);
      expect(refusal.suggestion, JSON.stringify(over)).toBeDefined();
      const applied = generateLayout({ ...params(over), ...refusal.suggestion!.patch });
      expect(applied.ok, `${refusal.suggestion!.key} on ${JSON.stringify(over)}`).toBe(true);
    }
  });

  it("shows the bill for the wall it is refusing", () => {
    const refusal = shortWall({ backWallIn: 132, islandLengthIn: 48 });
    expect(refusal.occupancy?.map((item) => item.code)).toContain("SB30");
    expect(refusal.occupancy?.map((item) => item.rule)).toContain("d11-10");
    expect(refusal.vars.shortIn).toBe(
      Number(refusal.vars.minimumIn) - Number(refusal.vars.wallIn),
    );
  });
});

describe("the sink faces the way its run does", () => {
  /** The tap's world position, which is the fixture's frame turned into the room's. */
  const faucet = () => {
    const sink = FIXTURE_BY_ID["fixture-sink"];
    const parts = sinkParts(sink)!;
    const [x, , z] = sink.position;
    const angle = sink.rotationY;
    // Three.js turns (x, z) about Y into (x·cos + z·sin, −x·sin + z·cos).
    return {
      x: x + parts.riser.x * Math.cos(angle) + parts.riser.z * Math.sin(angle),
      z: z - parts.riser.x * Math.sin(angle) + parts.riser.z * Math.cos(angle),
    };
  };

  // Leo's check: wherever the sink ends up, the tap is against a wall. A sink
  // drawn in world coordinates kept its tap pointing at the back wall after the
  // run moved to the left one, which put it out over the floor.
  it("keeps the tap within four inches of a wall, on either leg", () => {
    for (const [fridgeEnd, sinkLeg] of [
      ["left", "back"],
      ["back", "left"],
    ] as const) {
      expect(setLayoutParams(params({ fridgeEnd, sinkLeg })).ok).toBe(true);
      const at = faucet();
      const toBack = Math.abs(at.z + ROOM.halfZ);
      const toLeft = Math.abs(at.x + ROOM.halfX);
      expect(inches(Math.min(toBack, toLeft)), `sink on the ${sinkLeg} leg`).toBeLessThan(4);
    }
  });

  it("turns the basin with the run, so its long side stays along the wall", () => {
    for (const [sinkLeg, angle] of [
      ["back", 0],
      ["left", Math.PI / 2],
    ] as const) {
      const fridgeEnd = sinkLeg === "back" ? "left" : "back";
      expect(setLayoutParams(params({ fridgeEnd, sinkLeg })).ok).toBe(true);
      expect(FIXTURE_BY_ID["fixture-sink"].rotationY, sinkLeg).toBeCloseTo(angle, 6);
    }
  });
});
