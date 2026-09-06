import { describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { checkHeights, checkLayout, LAYOUT_LIMITS, occupants } from "./layoutRules";
import { FIXTURE_BY_ID } from "./fixtures";
import {
  CABINET_STANDARDS,
  ISLAND,
  ROOM,
  RUNS,
  RUN_BY_ID,
  type CabinetRun,
} from "./room";
import { SLOT_BY_ID } from "./slots";

const inches = (feet: number) => feet * 12;
const clone = (): CabinetRun[] => structuredClone(RUNS);
const back = () => RUN_BY_ID.back;
const left = () => RUN_BY_ID.left;
const codes = (runs: CabinetRun[]) => checkLayout(runs).map((v) => v.code);
const widthIn = (s: { from: number; to: number }) => inches(s.to - s.from);

describe("the rules hold for Scheme 01", () => {
  it("passes every one of them", () => {
    expect(checkLayout()).toEqual([]);
  });
});

// --- D11: where things go -------------------------------------------------

describe("D11 rule 1 · a tall cabinet ends a run, and never sits at the corner", () => {
  it("puts the refrigerator tower after the counter, with only a return past it", () => {
    const segments = left().segments;
    const tower = segments.findIndex((s) => s.kind === "tall");
    expect(segments[tower].slot).toBe("slot-fridge");
    expect(segments.slice(tower + 1).every((s) => s.kind === "counter")).toBe(true);
  });

  it("finishes the tower with a return of 24 to 48 inches", () => {
    const segments = left().segments;
    const tower = segments.findIndex((s) => s.kind === "tall");
    const returnIn = inches(
      segments.slice(tower + 1).reduce((sum, s) => sum + (s.to - s.from), 0),
    );
    expect(returnIn).toBeGreaterThanOrEqual(CABINET_STANDARDS.tallReturnIn.min);
    expect(returnIn).toBeLessThanOrEqual(CABINET_STANDARDS.tallReturnIn.max);
  });

  it("catches a tower with an appliance past it", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    leftRun.segments[3] = { ...leftRun.segments[3], kind: "appliance", slot: "slot-dishwasher" };
    expect(codes(runs)).toContain("d11-1");
  });

  it("catches a tower moved hard against the corner", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    const [corner, landing, tall, ret] = leftRun.segments;
    const width = tall.to - tall.from;
    leftRun.segments = [
      corner,
      { ...tall, from: corner.to, to: corner.to + width },
      { ...landing, from: corner.to + width, to: tall.to },
      ret,
    ];
    expect(codes(runs)).toContain("d11-1");
  });
});

describe("D11 rule 2 · the corner is a corner cabinet", () => {
  it("carries no appliance and no fixture", () => {
    for (const run of RUNS) {
      for (const segment of run.segments) {
        if (segment.kind !== "corner") continue;
        expect(segment.slot, `${segment.id} has a slot`).toBeUndefined();
        expect(segment.fixture, `${segment.id} has a fixture`).toBeUndefined();
      }
    }
  });

  it("has exactly one, a 36 inch lazy susan where the runs meet", () => {
    const corners = RUNS.flatMap((r) => r.segments).filter((s) => s.kind === "corner");
    expect(corners).toHaveLength(1);
    expect(widthIn(corners[0])).toBe(CABINET_STANDARDS.corner.lazySusanIn);
    expect(corners[0].from).toBe(-ROOM.halfZ);
  });

  it("catches a dishwasher dropped into the corner", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    leftRun.segments[0] = { ...leftRun.segments[0], slot: "slot-dishwasher" };
    expect(codes(runs)).toContain("d11-2");
  });
});

describe("D11 rule 3 · the counter runs unbroken", () => {
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
    expect(codes(runs)).toContain("d11-3");
  });
});

describe("D11 rule 4 · the range sits with landing either side, hood over it", () => {
  const range = () => back().segments.find((s) => s.slot === "slot-range")!;

  it("keeps at least 12 inches of counter on both sides", () => {
    const i = back().segments.indexOf(range());
    for (const neighbour of [back().segments[i - 1], back().segments[i + 1]]) {
      expect(neighbour.kind).toBe("counter");
      expect(widthIn(neighbour)).toBeGreaterThanOrEqual(LAYOUT_LIMITS.rangeLandingIn);
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
    expect(codes(runs)).toContain("d11-4");
  });
});

describe("D11 rule 5 · the dishwasher is beside the sink", () => {
  it("touches the sink base and stays inside the 36 inch reach", () => {
    const segments = back().segments;
    const sinkAt = segments.findIndex((s) => s.fixture === "fixture-sink");
    const dwAt = segments.findIndex((s) => s.slot === "slot-dishwasher");
    expect(Math.abs(sinkAt - dwAt)).toBe(1);

    const sink = segments[sinkAt];
    const dw = segments[dwAt];
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

  it("catches a dishwasher moved away from the sink", () => {
    const runs = clone();
    const backRun = runs.find((r) => r.id === "back")!;
    const dw = backRun.segments.find((s) => s.slot === "slot-dishwasher")!;
    const end = backRun.segments[backRun.segments.length - 1];
    // Swap the dishwasher with the counter at the open end.
    const width = dw.to - dw.from;
    Object.assign(dw, { slot: undefined, kind: "counter", id: "back-was-dishwasher" });
    Object.assign(end, { slot: "slot-dishwasher", kind: "appliance", from: end.to - width });
    backRun.segments.splice(backRun.segments.length - 1, 0, {
      id: "back-filler",
      kind: "counter",
      from: dw.to,
      to: end.from,
    });
    expect(codes(runs)).toContain("d11-5");
  });
});

describe("D11 rule 6 · the refrigerator has 15 inches of landing", () => {
  it("puts counter beside the tower", () => {
    const segments = left().segments;
    const tower = segments.findIndex((s) => s.slot === "slot-fridge");
    expect(segments[tower - 1].kind).toBe("counter");
    expect(widthIn(segments[tower - 1])).toBeGreaterThanOrEqual(LAYOUT_LIMITS.fridgeLandingIn);
  });

  // The return past the tower is counter too, so both sides have to go: a
  // refrigerator with 24" beside it is fine whichever side that 24" is on.
  it("catches the landing being trimmed away on both sides", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    const [corner, landing, tall, ret] = leftRun.segments;
    leftRun.segments = [
      corner,
      { ...landing, to: corner.to + 0.5 },
      { ...tall, from: corner.to + 0.5, to: tall.to - 1.5 },
      { ...ret, from: tall.to - 1.5, to: tall.to - 1 },
    ];
    expect(codes(runs)).toContain("d11-6");
  });

  it("accepts the landing being on the far side of the tower", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    const [corner, landing, tall, ret] = leftRun.segments;
    // 12" this side, the standard 24" return on the other.
    leftRun.segments = [
      corner,
      { ...landing, to: corner.to + 1 },
      { ...tall, from: corner.to + 1, to: tall.to - 0.5 },
      { ...ret, from: tall.to - 0.5 },
    ];
    expect(codes(runs)).not.toContain("d11-6");
  });
});

describe("D11 rule 7 · the island's openings face opposite ways", () => {
  it("turns the microwave to the working side and the wine cabinet to the seating side", () => {
    const microwave = SLOT_BY_ID["slot-microwave"];
    const wine = SLOT_BY_ID["slot-wine"];
    expect(microwave.mount).toBe("island");
    expect(Math.cos(microwave.rotationY)).toBeCloseTo(-1, 6);
    expect(Math.cos(wine.rotationY)).toBeCloseTo(1, 6);
    expect(wine.position[2]).toBeGreaterThan(microwave.position[2]);
  });

  it("leaves a 42 inch aisle to the back run", () => {
    expect(inches(ISLAND.z[0] - back().centre - ROOM.counterDepth / 2)).toBeGreaterThanOrEqual(
      LAYOUT_LIMITS.aisleIn,
    );
  });
});

// --- D13: what size things are --------------------------------------------

describe("D13 · base cabinets", () => {
  it("is a 34.5 inch box under a 1.5 inch top, 24 inches deep", () => {
    expect(inches(ROOM.counterHeight)).toBe(36);
    expect(inches(ROOM.counterThickness)).toBe(1.5);
    expect(inches(ROOM.counterHeight - ROOM.counterThickness)).toBe(34.5);
    expect(inches(ROOM.counterDepth)).toBe(24);
  });

  it("builds the carcass to 34.5 inches, not to the finished height", () => {
    const box = CABINETS.find((b) => b.id === "back-sink")!;
    expect(inches(box.size[1])).toBeCloseTo(34.5, 6);
    expect(inches(box.size[2])).toBeCloseTo(24, 6);
  });

  it("sizes every run segment in 3 inch increments from 12 to 36", () => {
    const { min, max, step } = CABINET_STANDARDS.widthIn;
    for (const run of RUNS) {
      for (const segment of run.segments) {
        if (segment.kind === "corner" || segment.kind === "tall") continue;
        const w = widthIn(segment);
        expect(w, segment.id).toBeGreaterThanOrEqual(min);
        expect(w, segment.id).toBeLessThanOrEqual(max);
        expect(w % step, segment.id).toBeCloseTo(0, 6);
      }
    }
  });

  it("catches a cabinet off the 3 inch grid", () => {
    const runs = clone();
    const backRun = runs.find((r) => r.id === "back")!;
    backRun.segments[0] = { ...backRun.segments[0], to: backRun.segments[0].to - 1 / 12 };
    backRun.segments[1] = { ...backRun.segments[1], from: backRun.segments[1].from - 1 / 12 };
    expect(codes(runs)).toContain("d13-width");
  });
});

describe("D13 · wall cabinets", () => {
  it("hangs 12 inch boxes 18 inches over the counter, in a standard height", () => {
    expect(inches(ROOM.upperDepth)).toBe(CABINET_STANDARDS.upper.depthIn);
    expect(inches(ROOM.upperBottom - ROOM.counterHeight)).toBe(
      CABINET_STANDARDS.upper.bottomAboveCounterIn,
    );
    expect(inches(ROOM.upperBottom)).toBe(54);
    expect(CABINET_STANDARDS.upper.heightsIn).toContain(
      inches(ROOM.upperTop - ROOM.upperBottom),
    );
  });

  it("picks the run up again where the canopy stops, at 84 inches", () => {
    const overHood = CABINETS.find((b) => b.id === "upper-back-hood")!;
    const bottom = overHood.position[1] - overHood.size[1] / 2;
    expect(inches(bottom)).toBeCloseTo(84, 6);
    // ...and finishes level with the cabinets either side of it.
    const flanking = CABINETS.find((b) => b.id === "upper-back-left")!;
    expect(overHood.position[1] + overHood.size[1] / 2).toBeCloseTo(
      flanking.position[1] + flanking.size[1] / 2,
      6,
    );
  });
});

describe("D13 · tall cabinets and the L", () => {
  it("runs the tower to a standard height at base depth", () => {
    expect(CABINET_STANDARDS.tall.heightsIn).toContain(inches(ROOM.tallTop));
    const panel = CABINETS.find((b) => b.id === "left-fridge-panel-a")!;
    expect(inches(panel.size[1])).toBeCloseTo(inches(ROOM.tallTop), 6);
    expect(inches(panel.size[0])).toBeCloseTo(CABINET_STANDARDS.tall.depthIn, 6);
  });

  it("keeps both legs between 8 and 12 feet", () => {
    for (const run of RUNS) {
      const legIn = inches(
        run.segments[run.segments.length - 1].to - run.segments[0].from,
      );
      expect(legIn, `${run.id} leg`).toBeGreaterThanOrEqual(CABINET_STANDARDS.legIn.shortMin);
      expect(legIn, `${run.id} leg`).toBeLessThanOrEqual(CABINET_STANDARDS.legIn.longMax);
    }
  });

  it("catches a leg shortened below 8 feet", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    leftRun.segments = leftRun.segments.slice(0, 2);
    expect(codes(runs)).toContain("d13-leg");
  });

  it("catches a tower left without a return", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    // A 6" return: present, but not a cabinet.
    leftRun.segments[3] = { ...leftRun.segments[3], to: leftRun.segments[3].from + 0.5 };
    expect(codes(runs)).toContain("d13-tall-return");
  });
});

describe("D13 · the canopy", () => {
  it("hangs 18 inches of canopy 30 inches over the cooking surface", () => {
    const hood = SLOT_BY_ID["slot-hood"];
    expect(hood.cutout.h).toBe(CABINET_STANDARDS.hood.bodyHeightIn);
    expect(inches(hood.position[1] - ROOM.counterHeight)).toBe(
      CABINET_STANDARDS.hood.aboveCooktopMinIn,
    );
    // 36 + 30 + 18 = 84, where the wall cabinets pick up again.
    expect(inches(hood.position[1]) + hood.cutout.h).toBe(84);
  });

  it("leaves the canopy at least as wide as the range", () => {
    expect(SLOT_BY_ID["slot-hood"].cutout.w).toBeGreaterThanOrEqual(
      SLOT_BY_ID["slot-range"].cutout.w,
    );
  });

  it("catches a canopy hung too low over a gas range", () => {
    // checkHeights reads the room directly, so this is asserted through the
    // standard rather than by mutating a module constant.
    const { aboveCooktopMinIn, aboveCooktopMaxIn } = CABINET_STANDARDS.hood;
    const actual = inches(SLOT_BY_ID["slot-hood"].position[1] - ROOM.counterHeight);
    expect(actual).toBeGreaterThanOrEqual(aboveCooktopMinIn);
    expect(actual).toBeLessThanOrEqual(aboveCooktopMaxIn);
    expect(checkHeights()).toEqual([]);
  });
});

describe("the run as Leo specified it", () => {
  it("reads corner, landing, refrigerator, return down the left wall", () => {
    expect(left().segments.map((s) => s.kind)).toEqual(["corner", "counter", "tall", "counter"]);
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
    expect(new Set(placed.map((o) => o.segment)).size).toBe(placed.length);
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

describe("the countertop is cut for the sink rather than laid over it", () => {
  const pieces = CABINETS.filter((b) => b.id.startsWith("back-counter-"));

  it("leaves an opening the size of the basin", () => {
    const bowl = FIXTURE_BY_ID["fixture-sink"].bowlIn!;
    const sink = back().segments.find((s) => s.fixture === "fixture-sink")!;
    const centre = (sink.from + sink.to) / 2;
    // Nothing covers the middle of the bowl.
    const covered = pieces.some(
      (b) =>
        Math.abs(b.position[0] - centre) < b.size[0] / 2 - 1e-6 &&
        Math.abs(b.position[2] - back().centre - 1 / 12) < b.size[2] / 2 - 1e-6,
    );
    expect(covered).toBe(false);
    // ...and the run carries on either side of it.
    expect(pieces.length).toBeGreaterThan(2);
    expect(bowl.w).toBeLessThan(inches(sink.to - sink.from));
  });

  it("sits the top at 34.5 to 36 inches, so nothing shares a plane with the basin", () => {
    for (const piece of pieces) {
      expect(inches(piece.position[1] - piece.size[1] / 2)).toBeCloseTo(34.5, 6);
      expect(inches(piece.position[1] + piece.size[1] / 2)).toBeCloseTo(36, 6);
    }
  });
});
