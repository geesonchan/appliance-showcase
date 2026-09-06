import { describe, expect, it } from "vitest";
import { checkLayout, LAYOUT_LIMITS, occupants } from "./layoutRules";
import { FIXTURE_BY_ID } from "./fixtures";
import { ISLAND, ROOM, RUNS, RUN_BY_ID, type CabinetRun } from "./room";
import { SLOT_BY_ID } from "./slots";

const inches = (feet: number) => feet * 12;
const clone = (): CabinetRun[] => structuredClone(RUNS);
const back = () => RUN_BY_ID.back;
const left = () => RUN_BY_ID.left;
const rulesBroken = (runs: CabinetRun[]) => checkLayout(runs).map((v) => v.rule);

describe("the layout rules hold for Scheme 01", () => {
  it("passes every rule", () => {
    expect(checkLayout()).toEqual([]);
  });
});

describe("rule 1 · a tall cabinet goes at the end of a run, never at the corner", () => {
  it("puts the refrigerator tower last on its run", () => {
    const segments = left().segments;
    expect(segments[segments.length - 1].slot).toBe("slot-fridge");
    expect(segments[segments.length - 1].kind).toBe("tall");
  });

  it("catches a tower moved into the middle", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    // Swap the tower with the landing beside it.
    const [corner, landing, tall] = leftRun.segments;
    const width = tall.to - tall.from;
    leftRun.segments = [
      corner,
      { ...tall, from: corner.to, to: corner.to + width },
      { ...landing, from: corner.to + width, to: tall.to },
    ];
    expect(rulesBroken(runs)).toContain(1);
  });
});

describe("rule 2 · the corner is a corner cabinet", () => {
  it("carries no appliance and no fixture", () => {
    for (const run of RUNS) {
      for (const segment of run.segments) {
        if (segment.kind !== "corner") continue;
        expect(segment.slot, `${segment.id} has a slot`).toBeUndefined();
        expect(segment.fixture, `${segment.id} has a fixture`).toBeUndefined();
      }
    }
  });

  it("has exactly one, and it is where the two runs meet", () => {
    const corners = RUNS.flatMap((r) => r.segments).filter((s) => s.kind === "corner");
    expect(corners).toHaveLength(1);
    // A cabinet depth square, which is what a lazy susan occupies.
    expect(inches(corners[0].to - corners[0].from)).toBe(inches(ROOM.counterDepth));
    expect(corners[0].from).toBe(-ROOM.halfZ);
  });

  it("catches a dishwasher dropped into the corner", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    leftRun.segments[0] = { ...leftRun.segments[0], slot: "slot-dishwasher" };
    expect(rulesBroken(runs)).toContain(2);
  });
});

describe("rule 3 · the counter runs unbroken from the corner to the tall cabinet", () => {
  it("tiles each run with no gap and no overlap", () => {
    for (const run of RUNS) {
      for (let i = 1; i < run.segments.length; i += 1) {
        expect(
          run.segments[i].from,
          `${run.id}: ${run.segments[i - 1].id} → ${run.segments[i].id}`,
        ).toBeCloseTo(run.segments[i - 1].to, 6);
      }
    }
  });

  it("catches a gap left between two segments", () => {
    const runs = clone();
    const backRun = runs.find((r) => r.id === "back")!;
    backRun.segments[1] = { ...backRun.segments[1], from: backRun.segments[1].from + 0.5 };
    expect(rulesBroken(runs)).toContain(3);
  });
});

describe("rule 4 · the range sits centred with landing either side, hood over it", () => {
  const range = back().segments.find((s) => s.slot === "slot-range")!;

  it("keeps at least 12 inches of counter on both sides", () => {
    const i = back().segments.indexOf(range);
    const before = back().segments[i - 1];
    const after = back().segments[i + 1];
    expect(before.kind).toBe("counter");
    expect(after.kind).toBe("counter");
    expect(inches(before.to - before.from)).toBeGreaterThanOrEqual(LAYOUT_LIMITS.rangeLandingIn);
    expect(inches(after.to - after.from)).toBeGreaterThanOrEqual(LAYOUT_LIMITS.rangeLandingIn);
  });

  it("does not sit against the corner or a tower", () => {
    const i = back().segments.indexOf(range);
    for (const neighbour of [back().segments[i - 1], back().segments[i + 1]]) {
      expect(neighbour.kind).not.toBe("corner");
      expect(neighbour.kind).not.toBe("tall");
    }
  });

  it("puts a hood at least as wide as the range, centred over it", () => {
    expect(SLOT_BY_ID["slot-hood"].cutout.w).toBeGreaterThanOrEqual(
      SLOT_BY_ID["slot-range"].cutout.w,
    );
    expect(SLOT_BY_ID["slot-hood"].position[0]).toBeCloseTo(
      SLOT_BY_ID["slot-range"].position[0],
      6,
    );
  });

  it("catches a range shoved up against the corner", () => {
    const runs = clone();
    const backRun = runs.find((r) => r.id === "back")!;
    const [landingLeft, rangeSeg, ...rest] = backRun.segments;
    const width = rangeSeg.to - rangeSeg.from;
    backRun.segments = [
      { ...rangeSeg, from: landingLeft.from, to: landingLeft.from + width },
      { ...landingLeft, from: landingLeft.from + width, to: rangeSeg.to },
      ...rest,
    ];
    expect(rulesBroken(runs)).toContain(4);
  });
});

describe("rule 5 · the dishwasher is beside the sink", () => {
  it("touches the sink base", () => {
    const segments = back().segments;
    const sink = segments.findIndex((s) => s.fixture === "fixture-sink");
    const dishwasher = segments.findIndex((s) => s.slot === "slot-dishwasher");
    expect(Math.abs(sink - dishwasher)).toBe(1);
  });

  it("stays inside the 36-inch reach", () => {
    const segments = back().segments;
    const sink = segments.find((s) => s.fixture === "fixture-sink")!;
    const dw = segments.find((s) => s.slot === "slot-dishwasher")!;
    const centres = Math.abs((sink.from + sink.to) / 2 - (dw.from + dw.to) / 2);
    expect(inches(centres)).toBeLessThanOrEqual(LAYOUT_LIMITS.dishwasherToSinkIn);
  });

  // The sink is a fixture, not an appliance: no brand, no price, no swap.
  it("keeps the sink out of the appliance catalogue", () => {
    const sink = FIXTURE_BY_ID["fixture-sink"];
    expect(sink.type).toBe("sink");
    expect(sink.utilities.water).toEqual({ supply: true, drain: true });
    expect(Object.keys(sink)).not.toContain("msrpUSD");
    expect(Object.keys(sink)).not.toContain("brand");
  });

  it("catches a dishwasher moved to the far end of the run", () => {
    const runs = clone();
    const backRun = runs.find((r) => r.id === "back")!;
    const dw = backRun.segments.find((s) => s.slot === "slot-dishwasher")!;
    const end = backRun.segments[backRun.segments.length - 1];
    const width = dw.to - dw.from;
    // Swap the dishwasher with the counter run at the open end.
    Object.assign(dw, { slot: undefined, kind: "counter", id: "back-was-dishwasher" });
    Object.assign(end, {
      slot: "slot-dishwasher",
      kind: "appliance",
      from: end.to - width,
    });
    backRun.segments.splice(backRun.segments.length - 1, 0, {
      id: "back-filler",
      kind: "counter",
      from: dw.to,
      to: end.from,
    });
    expect(rulesBroken(runs)).toContain(5);
  });
});

describe("rule 6 · the refrigerator has 15 inches of landing", () => {
  it("puts counter beside the tower", () => {
    const segments = left().segments;
    const tower = segments.findIndex((s) => s.slot === "slot-fridge");
    const beside = segments[tower - 1];
    expect(beside.kind).toBe("counter");
    expect(inches(beside.to - beside.from)).toBeGreaterThanOrEqual(
      LAYOUT_LIMITS.fridgeLandingIn,
    );
  });

  it("catches the landing being trimmed away", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    const [corner, landing, tall] = leftRun.segments;
    // Give the tower the landing's space, leaving 6".
    leftRun.segments = [
      corner,
      { ...landing, to: corner.to + 0.5 },
      { ...tall, from: corner.to + 0.5 },
    ];
    expect(rulesBroken(runs)).toContain(6);
  });
});

describe("rule 7 · the island's openings face opposite ways", () => {
  it("turns the microwave to the working side and the wine cabinet to the seating side", () => {
    const microwave = SLOT_BY_ID["slot-microwave"];
    const wine = SLOT_BY_ID["slot-wine"];
    expect(microwave.mount).toBe("island");
    expect(wine.mount).toBe("island");
    // Facing opposite ways along Z.
    expect(Math.cos(microwave.rotationY)).toBeCloseTo(-1, 6);
    expect(Math.cos(wine.rotationY)).toBeCloseTo(1, 6);
    // ...and the wine cabinet is the one on the seating side.
    expect(wine.position[2]).toBeGreaterThan(microwave.position[2]);
  });

  it("leaves a 42-inch aisle to the back run", () => {
    const runFront = back().centre + ROOM.counterDepth / 2;
    expect(inches(ISLAND.z[0] - runFront)).toBeGreaterThanOrEqual(LAYOUT_LIMITS.aisleIn);
  });
});

describe("the run as Leo specified it", () => {
  it("reads corner, landing, refrigerator down the left wall", () => {
    expect(left().segments.map((s) => s.kind)).toEqual(["corner", "counter", "tall"]);
  });

  it("reads counter, range, counter, sink, dishwasher, counter along the back", () => {
    expect(back().segments.map((s) => s.kind)).toEqual([
      "counter",
      "appliance",
      "counter",
      "fixture",
      "appliance",
      "counter",
    ]);
  });

  it("places every appliance and fixture in exactly one segment", () => {
    const placed = occupants();
    expect(placed.map((o) => o.segment)).toHaveLength(new Set(placed.map((o) => o.segment)).size);
    // The four things on the perimeter; the island's two are not on a run.
    expect(placed.map((o) => o.label).sort()).toEqual([
      "fixture.sink",
      "slot.dishwasher",
      "slot.fridge",
      "slot.range",
    ]);
  });

  it("sizes each opening to what goes in it", () => {
    for (const occupant of occupants()) {
      if (occupant.kind === "tall") {
        // A tower is the opening plus a finished panel each side.
        expect(occupant.widthIn).toBe(SLOT_BY_ID["slot-fridge"].cutout.w + 6);
      } else if (occupant.segment === "back-range") {
        expect(occupant.widthIn).toBe(SLOT_BY_ID["slot-range"].cutout.w);
      } else if (occupant.segment === "back-dishwasher") {
        expect(occupant.widthIn).toBe(SLOT_BY_ID["slot-dishwasher"].cutout.w);
      } else if (occupant.segment === "back-sink") {
        expect(occupant.widthIn).toBe(FIXTURE_BY_ID["fixture-sink"].cutout.w);
      }
    }
  });
});
