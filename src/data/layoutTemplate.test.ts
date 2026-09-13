import { describe, expect, it } from "vitest";
import { checkLayout } from "./layoutRules";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  generateLayout,
  packLeg,
  type Item,
  type LayoutParams,
} from "./layoutTemplate";
import { CABINET_STANDARDS, LAYOUT_LIMITS, ROOM } from "./roomShell";

const inches = (feet: number) => feet * 12;
const build = (over: Partial<LayoutParams> = {}) =>
  generateLayout({ ...DEFAULT_PARAMS, ...over });
/**
 * A kitchen with the refrigerator at one end. The sink goes on the other leg,
 * because one leg will not carry both — the generator refuses that pairing, so
 * the tests ask for the kitchen rather than for half of it.
 */
const kitchen = (fridgeEnd: "left" | "back", over: Partial<LayoutParams> = {}) => ({
  fridgeEnd,
  sinkLeg: fridgeEnd === "left" ? ("back" as const) : ("left" as const),
  ...over,
});
const built = (over: Partial<LayoutParams> = {}) => {
  const result = build(over);
  if (!result.ok) throw new Error(result.reasons.map((r) => r.key).join(" "));
  return result.layout;
};

describe("the generator produces layouts that can be built", () => {
  const lengths = [48, 54, 60, 66, 72, 78, 84, 90, 96];

  it.each(lengths)("passes every rule at %i inches of island", (islandLengthIn) => {
    for (const fridgeEnd of ["left", "back"] as const) {
      const layout = built(kitchen(fridgeEnd, { islandLengthIn }));
      expect(
        checkLayout(layout.runs),
        `${islandLengthIn}" island, fridge ${fridgeEnd}`,
      ).toEqual([]);
    }
  });

  it("adds every segment's cabinets up to the segment exactly", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      for (const run of built(kitchen(fridgeEnd)).runs) {
        for (const segment of run.segments) {
          const built_ = segment.modules.reduce((sum, m) => sum + m.widthIn, 0);
          expect(built_, `${segment.id}`).toBeCloseTo(inches(segment.to - segment.from), 6);
        }
        for (const bank of run.uppers) {
          const built_ = bank.modules.reduce((sum, m) => sum + m.widthIn, 0);
          if (bank.modules.some((m) => m.kind === "bridge")) continue;
          expect(built_, `${bank.id}`).toBeCloseTo(inches(bank.to - bank.from), 6);
        }
      }
    }
  });

  it("gives every cabinet a trade code", () => {
    for (const run of built().runs) {
      for (const module of run.segments.flatMap((s) => s.modules)) {
        expect(module.code, JSON.stringify(module)).toMatch(/^[A-Z]{1,4}\d{0,4}$/);
      }
    }
  });
});

describe("the island grows with its parameter", () => {
  it("is exactly as long as asked", () => {
    for (const islandLengthIn of [48, 72, 96]) {
      const island = built({ islandLengthIn }).island;
      expect(inches(island.x[1] - island.x[0])).toBeCloseTo(islandLengthIn, 6);
    }
  });

  it("keeps a 42 inch aisle to the back run at every length", () => {
    for (const islandLengthIn of [48, 72, 96]) {
      const island = built({ islandLengthIn }).island;
      const runFace = -ROOM.halfZ + ROOM.counterDepth;
      expect(inches(island.z[0] - runFace)).toBeGreaterThanOrEqual(42);
    }
  });

  // Both openings are 24" deep in a 36" island, so they cannot share a stretch
  // of it: they have to sit side by side along its length.
  it("keeps the two openings clear of each other", () => {
    for (const islandLengthIn of [48, 60, 96]) {
      const island = built({ islandLengthIn }).island;
      expect(island.microwave[1]).toBeLessThanOrEqual(island.wine[0] + 1e-9);
      expect(inches(island.microwave[1] - island.microwave[0])).toBeCloseTo(24, 6);
      expect(inches(island.wine[1] - island.wine[0])).toBeCloseTo(24, 6);
    }
  });

  it("keeps both openings inside the island", () => {
    for (const islandLengthIn of [48, 96]) {
      const island = built({ islandLengthIn }).island;
      expect(island.microwave[0]).toBeGreaterThanOrEqual(island.x[0] - 1e-9);
      expect(island.wine[1]).toBeLessThanOrEqual(island.x[1] + 1e-9);
    }
  });
});

describe("moving the refrigerator moves the sink with it", () => {
  it("finishes the left leg with the tower by default", () => {
    const left = built(kitchen("left")).runs.find((r) => r.id === "left")!;
    expect(left.segments[left.segments.length - 1].slot).toBe("slot-fridge");
  });

  // A 14ft wall will not take a range, a sink, a dishwasher and a 42" tower.
  it("finishes the back leg with the tower and moves the plumbing across", () => {
    const layout = built(kitchen("back"));
    const back = layout.runs.find((r) => r.id === "back")!;
    const left = layout.runs.find((r) => r.id === "left")!;
    expect(back.segments[back.segments.length - 1].slot).toBe("slot-fridge");
    expect(left.segments.some((s) => s.fixture === "fixture-sink")).toBe(true);
    expect(left.segments.some((s) => s.slot === "slot-dishwasher")).toBe(true);
    expect(back.segments.some((s) => s.fixture === "fixture-sink")).toBe(false);
  });

  it("turns the appliances to face the leg they end up on", () => {
    const onBack = built(kitchen("back")).slots;
    const onLeft = built(kitchen("left")).slots;
    expect(onLeft["slot-fridge"]!.rotationY).toBeCloseTo(Math.PI / 2, 6);
    expect(onBack["slot-fridge"]!.rotationY).toBeCloseTo(0, 6);
    expect(onBack["slot-dishwasher"]!.rotationY).toBeCloseTo(Math.PI / 2, 6);
  });

  it("keeps both legs inside the room whichever end the tower is at", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      for (const run of built(kitchen(fridgeEnd)).runs) {
        const end = run.segments[run.segments.length - 1].to;
        const limit = run.axis === "x" ? ROOM.halfX : ROOM.halfZ;
        expect(end, `${run.id} leg, fridge ${fridgeEnd}`).toBeLessThanOrEqual(limit + 1e-9);
      }
    }
  });
});

describe("what it refuses, and what it says", () => {
  it("refuses a length off the 6 inch step, and names the two that would work", () => {
    const result = build({ islandLengthIn: 50 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons[0].key).toBe("refusal.offStep");
    expect(result.reasons[0].vars).toMatchObject({ value: 50, below: 48, above: 54 });
  });

  it("refuses a length outside the range", () => {
    for (const islandLengthIn of [36, 120]) {
      const result = build({ islandLengthIn });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reasons[0].key).toBe("refusal.outOfRange");
      expect(result.reasons[0].vars.max).toBe(PARAM_LIMITS.islandLengthIn.max);
    }
  });

  it("says why rather than just no", () => {
    const result = build({ islandLengthIn: 50 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const reason of result.reasons) {
      // Every figure it prints is one it was given, so the sentence can be
      // written in either language without the generator knowing which.
      expect(reason.key).toMatch(/^refusal\./);
      expect(Object.keys(reason.vars).length).toBeGreaterThan(0);
    }
  });

  it("builds the default, which is the one set that always has to work", () => {
    expect(build().ok).toBe(true);
    expect(DEFAULT_PARAMS.islandLengthIn % PARAM_LIMITS.islandLengthIn.step).toBe(0);
  });
});

describe("the canopy still lands where D13 puts it", () => {
  it("hangs over the range wherever the range is", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      const slots = built(kitchen(fridgeEnd)).slots;
      expect(slots["slot-hood"]!.position[0]).toBeCloseTo(slots["slot-range"]!.position[0], 6);
      expect(slots["slot-hood"]!.position[2]).toBeCloseTo(slots["slot-range"]!.position[2], 6);
      expect(inches(slots["slot-hood"]!.position[1])).toBeGreaterThanOrEqual(
        CABINET_STANDARDS.base.counterHeightIn + CABINET_STANDARDS.hood.aboveCooktopMinIn,
      );
    }
  });
});

describe("what it returns is a list somebody can edit", () => {
  // D14, registered before M3-4 is built: the composer will splice items into
  // these arrays, so they cannot be getters, memos or frozen constants.
  it("hands back plain arrays, not derived values", () => {
    const layout = built();
    for (const run of layout.runs) {
      expect(Array.isArray(run.segments)).toBe(true);
      expect(Object.isFrozen(run.segments)).toBe(false);
      expect(Object.getOwnPropertyDescriptor(run, "segments")?.get).toBeUndefined();
      for (const segment of run.segments) {
        expect(Array.isArray(segment.modules)).toBe(true);
        expect(Object.isFrozen(segment)).toBe(false);
      }
    }
  });

  it("survives an item being spliced out of a track", () => {
    const layout = built();
    const run = layout.runs[0];
    const before = run.segments.length;
    run.segments.splice(1, 1);
    expect(run.segments).toHaveLength(before - 1);
    // And the edit is visible to whatever reads it next, rather than being
    // recomputed away.
    expect(layout.runs[0].segments).toHaveLength(before - 1);
  });

  it("gives each call its own arrays, so one edit cannot reach another layout", () => {
    const a = built();
    const b = built();
    a.runs[0].segments.pop();
    expect(b.runs[0].segments.length).toBeGreaterThan(a.runs[0].segments.length);
  });
});

/**
 * How a leg's spare inches are shared out.
 *
 * Stated against a leg made up for the purpose, because the rule is about the
 * arithmetic rather than about any one kitchen: a stretch that asks for a
 * width is given it before anything else is handed a thing, and a wall that
 * cannot pay for it builds narrower rather than refusing.
 */
describe("a stretch that asks for a width is served first", () => {
  const { wantIn } = LAYOUT_LIMITS.towerSpacer;

  /** A leg: a machine, the stretch beside it, and two ordinary landings. */
  const leg = (): Item[] => [
    { kind: "fixed", id: "range", widthIn: 36, segmentKind: "appliance", modules: [] },
    { kind: "gap", id: "landing", minIn: 15, rule: "d11-4", labelKey: "requirement.landing" },
    {
      kind: "gap",
      id: "tower-clearance",
      minIn: 6,
      wantIn,
      maxIn: wantIn,
      rule: "d11-12",
      labelKey: "requirement.tower-clearance",
    },
    { kind: "gap", id: "end", minIn: 3, rule: "d13-terminal", labelKey: "requirement.end" },
  ];
  const widthsFor = (availableIn: number) => {
    const packed = packLeg(availableIn, leg());
    if ("shortIn" in packed) throw new Error(`short by ${packed.shortIn}"`);
    return { landing: packed.widths[0], clearance: packed.widths[1], end: packed.widths[2] };
  };

  it("gives it what it asks for before the others are given anything", () => {
    // Sixty of leg: 36 of machine and 24 of stretches, which is their minimum
    // plus twelve — exactly what the landing asks for on top of its six.
    const widths = widthsFor(36 + 24 + 12);
    expect(widths.clearance).toBe(wantIn);
    expect(widths.landing).toBe(15);
    expect(widths.end).toBe(3);
  });

  it("stops at what it asked for, and the rest goes round the others", () => {
    const widths = widthsFor(36 + 24 + 12 + 24);
    expect(widths.clearance).toBe(wantIn);
    expect(widths.landing + widths.end).toBe(24 + 15 + 3);
  });

  it("comes down three inches at a time when the wall is short", () => {
    for (const [spare, expected] of [
      [0, 6],
      [3, 9],
      [6, 12],
      [9, 15],
      [12, 18],
    ] as const) {
      const widths = widthsFor(36 + 24 + spare);
      expect(widths.clearance, `${spare}" spare`).toBe(expected);
    }
  });

  it("never takes it under the width a piece can be made at", () => {
    const packed = packLeg(36 + 24 - 3, leg());
    expect("shortIn" in packed && packed.shortIn).toBe(3);
  });
});
