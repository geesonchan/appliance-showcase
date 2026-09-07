import { describe, expect, it } from "vitest";
import { checkLayout } from "./layoutRules";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  generateLayout,
  type LayoutParams,
} from "./layoutTemplate";
import { CABINET_STANDARDS, ROOM } from "./roomShell";

const inches = (feet: number) => feet * 12;
const build = (over: Partial<LayoutParams> = {}) =>
  generateLayout({ ...DEFAULT_PARAMS, ...over });
const built = (over: Partial<LayoutParams> = {}) => {
  const result = build(over);
  if (!result.ok) throw new Error(result.reasons.join(" "));
  return result.layout;
};

describe("the generator produces layouts that can be built", () => {
  const lengths = [48, 54, 60, 66, 72, 78, 84, 90, 96];

  it.each(lengths)("passes every rule at %i inches of island", (islandLengthIn) => {
    for (const fridgeEnd of ["left", "back"] as const) {
      const layout = built({ islandLengthIn, fridgeEnd });
      expect(
        checkLayout(layout.runs),
        `${islandLengthIn}" island, fridge ${fridgeEnd}`,
      ).toEqual([]);
    }
  });

  it("adds every segment's cabinets up to the segment exactly", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      for (const run of built({ fridgeEnd }).runs) {
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
    const left = built({ fridgeEnd: "left" }).runs.find((r) => r.id === "left")!;
    expect(left.segments[left.segments.length - 1].slot).toBe("slot-fridge");
  });

  // A 14ft wall will not take a range, a sink, a dishwasher and a 42" tower.
  it("finishes the back leg with the tower and moves the plumbing across", () => {
    const layout = built({ fridgeEnd: "back" });
    const back = layout.runs.find((r) => r.id === "back")!;
    const left = layout.runs.find((r) => r.id === "left")!;
    expect(back.segments[back.segments.length - 1].slot).toBe("slot-fridge");
    expect(left.segments.some((s) => s.fixture === "fixture-sink")).toBe(true);
    expect(left.segments.some((s) => s.slot === "slot-dishwasher")).toBe(true);
    expect(back.segments.some((s) => s.fixture === "fixture-sink")).toBe(false);
  });

  it("turns the appliances to face the leg they end up on", () => {
    const onBack = built({ fridgeEnd: "back" }).slots;
    const onLeft = built({ fridgeEnd: "left" }).slots;
    expect(onLeft["slot-fridge"].rotationY).toBeCloseTo(Math.PI / 2, 6);
    expect(onBack["slot-fridge"].rotationY).toBeCloseTo(0, 6);
    expect(onBack["slot-dishwasher"].rotationY).toBeCloseTo(Math.PI / 2, 6);
  });

  it("keeps both legs inside the room whichever end the tower is at", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      for (const run of built({ fridgeEnd }).runs) {
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
    expect(result.reasons.join(" ")).toContain('48"');
    expect(result.reasons.join(" ")).toContain('54"');
  });

  it("refuses a length outside the range", () => {
    for (const islandLengthIn of [36, 120]) {
      const result = build({ islandLengthIn });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reasons.join(" ")).toContain(`${PARAM_LIMITS.islandLengthIn.max}"`);
    }
  });

  it("says why rather than just no", () => {
    const result = build({ islandLengthIn: 50 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const reason of result.reasons) {
      expect(reason.length).toBeGreaterThan(20);
      expect(reason).toMatch(/\.$/);
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
      const slots = built({ fridgeEnd }).slots;
      expect(slots["slot-hood"].position[0]).toBeCloseTo(slots["slot-range"].position[0], 6);
      expect(slots["slot-hood"].position[2]).toBeCloseTo(slots["slot-range"].position[2], 6);
      expect(inches(slots["slot-hood"].position[1])).toBeGreaterThanOrEqual(
        CABINET_STANDARDS.base.counterHeightIn + CABINET_STANDARDS.hood.aboveCooktopMinIn,
      );
    }
  });
});
