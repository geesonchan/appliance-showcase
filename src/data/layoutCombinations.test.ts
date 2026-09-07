import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { counterOutline, isRectilinearL } from "./counter";
import { setLayoutParams } from "./layoutState";
import { checkLayout } from "./layoutRules";
import { DEFAULT_PARAMS, PARAM_LIMITS, type LayoutParams } from "./layoutTemplate";
import { ISLAND, ROOM, RUN_BY_ID, segmentForSlot } from "./room";
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
function attempt(over: Partial<LayoutParams>): { built: true } | { built: false; reasons: string[] } {
  const result = setLayoutParams(params(over));
  if (!result.ok) return { built: false, reasons: result.reasons };
  const problems = checkLayout();
  expect(problems.map((p) => `${p.code}: ${p.message}`), JSON.stringify(over)).toEqual([]);
  return { built: true };
}

/** Every refusal has to be a sentence a salesperson could read out loud. */
function expectSentences(reasons: string[], where: string) {
  expect(reasons.length, where).toBeGreaterThan(0);
  for (const reason of reasons) {
    expect(reason.length, `${where}: "${reason}"`).toBeGreaterThan(20);
    expect(reason, where).toMatch(/\.$/);
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
    for (const backWallIn of [150, 162, 168]) {
      const result = setLayoutParams(params({ backWallIn }));
      expect(result.ok, `${backWallIn}"`).toBe(true);
      expect(inches(ROOM.halfX * 2)).toBe(backWallIn);
      const back = RUN_BY_ID.back.segments;
      expect(inches(back[back.length - 1].to)).toBeCloseTo(inches(ROOM.halfX), 6);
    }
  });

  it("refuses a wall off the step, and names the two lengths that would work", () => {
    const result = setLayoutParams(params({ backWallIn: 155 }));
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain('150"');
    expect(result.reasons.join(" ")).toContain('156"');
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
    expect(long.reasons.join(" ")).toContain("will not fit");

    const deep = setLayoutParams(params({ leftWallIn: 96, islandDepthIn: 42, aisleIn: 42 }));
    expect(deep.ok).toBe(false);
    expect(deep.reasons.join(" ")).toContain("deep");
  });

  it("takes the island out of the room when it is switched off", () => {
    // Without an island the back leg has two more openings to carry, which a
    // lazy susan does not leave room for — the blind corner is what buys it.
    const result = setLayoutParams(params({ hasIsland: false, cornerType: "blind" }));
    expect(result.ok, result.reasons.join(" ")).toBe(true);

    expect(ISLAND.present).toBe(false);
    expect(CABINETS.filter((box) => box.id.startsWith("island"))).toEqual([]);
    // The two openings are on the perimeter now, and on opposite legs, which is
    // what keeps them facing opposite ways. See D11 rule 7.
    expect(segmentForSlot("slot-microwave")!.id.startsWith("back")).toBe(true);
    expect(segmentForSlot("slot-wine")!.id.startsWith("left")).toBe(true);
    expect(
      Math.abs(
        Math.cos(SLOT_BY_ID["slot-microwave"].rotationY) -
          Math.cos(SLOT_BY_ID["slot-wine"].rotationY),
      ),
    ).toBeGreaterThan(0.5);
  });

  it("says what is short when there is nowhere to put them", () => {
    const result = setLayoutParams(params({ hasIsland: false, cornerType: "lazy-susan" }));
    expect(result.ok).toBe(false);
    expectSentences(result.reasons, "no island, lazy susan");
    expect(result.reasons.join(" ")).toContain("blind");
  });
});
