import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { counterOutline, isRectilinearL } from "./counter";
import { setLayoutParams } from "./layoutState";
import { checkLayout } from "./layoutRules";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  feasibleRange,
  generateLayout,
  wallRequirement,
  type LayoutParams,
  type Refusal,
} from "./layoutTemplate";
import { CABINET_STANDARDS, ISLAND, LAYOUT_LIMITS, ROOM, RUN_BY_ID, RUNS, segmentForSlot } from "./room";
import { SLOT_BY_ID } from "./slots";

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

  it("refuses a wall off the step, and names the two lengths that would work", () => {
    const result = setLayoutParams(params({ backWallIn: 155 }));
    expect(result.ok).toBe(false);
    expect(result.reasons[0].key).toBe("refusal.offStep");
    expect(result.reasons[0].vars).toMatchObject({ value: 155, below: 150, above: 156 });
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
      expect(isRectilinearL(counterOutline().outline), cornerType).toBe(true);
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

  it("takes the island out of the room when it is switched off", () => {
    const result = setLayoutParams(params({ hasIsland: false }));
    expect(result.ok, result.reasons.map((r) => r.key).join(" ")).toBe(true);

    expect(ISLAND.present).toBe(false);
    expect(CABINETS.filter((box) => box.id.startsWith("island"))).toEqual([]);
    // Both openings go on the leg the sink is not on: the other one is already
    // carrying the range, the sink base and the dishwasher, and 48" more of
    // opening is exactly what it does not have.
    expect(segmentForSlot("slot-microwave")!.id.startsWith("left")).toBe(true);
    expect(segmentForSlot("slot-wine")!.id.startsWith("left")).toBe(true);
    expect(SLOT_BY_ID["slot-microwave"].mount).toBe("wall");
    expect(SLOT_BY_ID["slot-wine"].mount).toBe("wall");
  });

  it("says what is short when there is nowhere to put them", () => {
    // A blind corner takes 6" more of its own leg than a lazy susan, and with
    // two extra openings already on that leg those 6" are what runs out.
    const result = setLayoutParams(params({ hasIsland: false, cornerType: "blind" }));
    expect(result.ok).toBe(false);
    expectSentences(result.reasons, "no island, blind corner");
    expect(result.reasons[0].key).toBe("refusal.wallShort");
    expect(result.reasons[0].occupancy?.map((item) => item.code)).toContain("BBC42");
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

  it("puts the dishwasher on the range side of the sink", () => {
    for (const [fridgeEnd, sinkLeg] of [
      ["left", "back"],
      ["back", "left"],
    ] as const) {
      expect(setLayoutParams(params({ fridgeEnd, sinkLeg })).ok).toBe(true);
      const run = RUN_BY_ID[sinkLeg];
      const dishwasher = run.segments.findIndex((s) => s.slot === "slot-dishwasher");
      const sink = run.segments.findIndex((s) => s.fixture === "fixture-sink");
      // Both runs are ordered from the corner outward and the range is always
      // at the corner end, so "toward the range" is the lower index.
      expect(dishwasher, `${sinkLeg} leg`).toBe(sink - 1);
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
      const across = leg === "back" ? 36 : 0;
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
      const range = feasibleRange(params(), key);
      expect(range?.minIn).toBe(wallRequirement(params(), leg).minimumIn);
    }
  });
});

describe("a refusal comes with a way out", () => {
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
