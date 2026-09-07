import { describe, expect, it } from "vitest";
import { CABINETS, hoodBridgeBand } from "./cabinets";
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

describe("D11 rule 1 - a tall cabinet goes at the end of a run, never at a corner", () => {
  it("puts the refrigerator tower last on its run", () => {
    const segments = left().segments;
    expect(segments[segments.length - 1].kind).toBe("tall");
    expect(segments[segments.length - 1].slot).toBe("slot-fridge");
    expect(segments.filter((s) => s.kind === "tall")).toHaveLength(1);
  });

  it("catches anything placed past the tower", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    const tower = leftRun.segments[leftRun.segments.length - 1];
    leftRun.segments.push({
      id: "left-extra",
      kind: "counter",
      from: tower.to,
      to: tower.to + 2,
      modules: [{ code: "B24", kind: "base", widthIn: 24 }],
    });
    expect(codes(runs)).toContain("d11-1");
  });

  it("catches a tower moved hard against the corner", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    const corner = leftRun.segments[0];
    const tower = leftRun.segments[leftRun.segments.length - 1];
    const rest = leftRun.segments.slice(1, -1);
    let cursor = corner.to + (tower.to - tower.from);
    leftRun.segments = [
      corner,
      { ...tower, from: corner.to, to: cursor },
      ...rest.map((segment) => {
        const moved = { ...segment, from: cursor, to: cursor + (segment.to - segment.from) };
        cursor = moved.to;
        return moved;
      }),
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
      modules: [],
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
  // Contiguous counter all counts, so the whole stretch beside the tower has
  // to go — trimming one cabinet of three leaves the other two as landing.
  it("catches the landing being trimmed away", () => {
    const runs = clone();
    const leftRun = runs.find((r) => r.id === "left")!;
    const landing = leftRun.segments[leftRun.segments.length - 2];
    const tower = leftRun.segments[leftRun.segments.length - 1];
    // Break the run of counter, then trim what is left beside the tower.
    leftRun.segments[leftRun.segments.length - 3].kind = "appliance";
    landing.to = landing.from + 0.5;
    tower.from = landing.to;
    expect(codes(runs)).toContain("d11-6");
  });

  it("takes the landing from the cabinet the door opens onto", () => {
    const segments = left().segments;
    const beside = segments[segments.length - 2];
    expect(beside.kind).toBe("counter");
    expect(widthIn(beside)).toBeGreaterThanOrEqual(LAYOUT_LIMITS.fridgeLandingIn);
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
    const box = CABINETS.find((b) => b.id === "back-sink-SB30")!;
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

  it("picks the run up again exactly where the canopy stops", () => {
    const overHood = CABINETS.find((b) => b.id === "upper-back-hood-W42")!;
    const bottom = overHood.position[1] - overHood.size[1] / 2;
    const hood = SLOT_BY_ID["slot-hood"];
    expect(inches(bottom)).toBeCloseTo(inches(hood.position[1]) + hood.cutout.h, 6);
  });

  // It cannot finish level with them: 96" less an 84-3/4" canopy top is
  // 11-1/4", and nobody lists an 11" bridge. Made to size, with the remainder
  // as the closing scribe D13 allows.
  it("orders the bridge to a whole inch and scribes the rest", () => {
    const [floor, top] = hoodBridgeBand();
    expect(inches(top - floor) % 1).toBeCloseTo(0, 6);
    const gap = inches(ROOM.wallHeight - top);
    expect(gap).toBeGreaterThanOrEqual(CABINET_STANDARDS.closingGapIn.min);
    expect(gap).toBeLessThanOrEqual(CABINET_STANDARDS.closingGapIn.max);
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

  it("catches a run whose cabinets do not add up to it", () => {
    const runs = clone();
    const backRun = runs.find((r) => r.id === "back")!;
    // Widen a segment without widening the box that is supposed to fill it.
    backRun.segments[0].to += 0.25;
    for (const segment of backRun.segments.slice(1)) {
      segment.from += 0.25;
      segment.to += 0.25;
    }
    const problems = checkLayout(runs).filter((v) => v.code === "d13-modules");
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("short");
  });
});

describe("D13 · the canopy", () => {
  // Above the cooking surface, which is the range's own top: a slide-in range's
  // grates stand proud of the counter beside it.
  it("hangs 18 inches of canopy 30 inches over the cooking surface", () => {
    const hood = SLOT_BY_ID["slot-hood"];
    expect(hood.cutout.h).toBe(CABINET_STANDARDS.hood.bodyHeightIn);
    expect(hood.builtForCooktopIn).not.toBeNull();
    expect(inches(hood.position[1]) - hood.builtForCooktopIn!).toBe(
      CABINET_STANDARDS.hood.aboveCooktopMinIn,
    );
    expect(hood.builtForCooktopIn!).toBeGreaterThan(CABINET_STANDARDS.base.counterHeightIn);
  });

  it("leaves the canopy at least as wide as the range", () => {
    expect(SLOT_BY_ID["slot-hood"].cutout.w).toBeGreaterThanOrEqual(
      SLOT_BY_ID["slot-range"].cutout.w,
    );
  });

  it("clears the cooking surface by the amount the manufacturer allows", () => {
    const { aboveCooktopMinIn, aboveCooktopMaxIn } = CABINET_STANDARDS.hood;
    const hood = SLOT_BY_ID["slot-hood"];
    const actual = inches(hood.position[1]) - hood.builtForCooktopIn!;
    expect(actual).toBeGreaterThanOrEqual(aboveCooktopMinIn);
    expect(actual).toBeLessThanOrEqual(aboveCooktopMaxIn);
    expect(checkHeights()).toEqual([]);
  });
});

describe("the run as Leo specified it", () => {
  it("reads corner, cabinets, landing, refrigerator down the left wall", () => {
    expect(left().segments.map((s) => s.kind)).toEqual([
      "corner",
      "counter",
      "counter",
      "counter",
      "tall",
    ]);
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

describe("D13 · the run is built out of cabinets you can order", () => {
  const modules = RUNS.flatMap((run) => [
    ...run.segments.flatMap((s) => s.modules),
    ...run.uppers.flatMap((b) => b.modules),
  ]);

  it("gives every cabinet a trade code", () => {
    expect(modules.length).toBeGreaterThan(10);
    for (const module of modules) {
      expect(module.code, JSON.stringify(module)).toMatch(/^[A-Z]{1,4}\d{2,4}(-\d+)?$/);
      expect(module.widthIn, module.code).toBeGreaterThan(0);
    }
  });

  it("adds each segment's cabinets up to the segment exactly", () => {
    for (const run of RUNS) {
      for (const segment of run.segments) {
        const built = segment.modules.reduce((sum, m) => sum + m.widthIn, 0);
        expect(built, `${segment.id} (${segment.modules.map((m) => m.code).join(" + ")})`).toBe(
          widthIn(segment),
        );
      }
    }
  });

  it("adds each bank of wall cabinets up to the bank exactly", () => {
    for (const run of RUNS) {
      for (const bank of run.uppers) {
        const built = bank.modules.reduce((sum, m) => sum + m.widthIn, 0);
        expect(built, `${bank.id} (${bank.modules.map((m) => m.code).join(" + ")})`).toBe(
          inches(bank.to - bank.from),
        );
      }
    }
  });

  // Every width in the doc's size lists, and nothing off them.
  it("uses only stock widths", () => {
    const stock = [6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48];
    for (const module of modules) {
      if (module.kind === "opening" || module.kind === "filler") continue;
      expect(stock, `${module.code} is ${module.widthIn}"`).toContain(module.widthIn);
    }
  });

  // A bridge over a canopy is the exception: its floor is the canopy's top,
  // which moves with the range, so it is made to size.
  it("uses only stock wall heights, bar the bridge over the hood", () => {
    const heights = [12, 15, 18, 21, 24, 30, 36, 42];
    for (const run of RUNS) {
      for (const bank of run.uppers) {
        for (const module of bank.modules) {
          if (module.kind === "bridge") {
            expect(module.heightIn).toBeUndefined();
            continue;
          }
          expect(heights, module.code).toContain(module.heightIn);
        }
      }
    }
  });

  it("sizes the sink base and the corner off their own lists", () => {
    const sink = modules.find((m) => m.kind === "sink-base")!;
    expect([30, 33, 36, 42]).toContain(sink.widthIn);
    const corner = RUNS.flatMap((r) => r.segments)
      .flatMap((s) => s.modules)
      .find((m) => m.kind === "corner")!;
    expect([33, 36]).toContain(corner.widthIn);
  });

  it("draws one box per cabinet, carrying its code", () => {
    const coded = CABINETS.filter((box) => box.module);
    expect(coded.length).toBeGreaterThan(10);
    for (const box of coded) {
      if (box.module!.kind === "tall") continue; // an enclosure is three pieces
      expect(inches(box.size[0]) === box.module!.widthIn || inches(box.size[2]) === box.module!.widthIn,
        `${box.id} is ${inches(box.size[0])} x ${inches(box.size[2])}, code says ${box.module!.widthIn}`,
      ).toBe(true);
    }
  });

  it("catches a cabinet in a width nobody stocks", () => {
    const runs = clone();
    const backRun = runs.find((r) => r.id === "back")!;
    backRun.segments[0].modules = [{ code: "B14", kind: "base", widthIn: 14 }];
    backRun.segments[0].to = backRun.segments[0].from + 14 / 12;
    for (const segment of backRun.segments.slice(1)) {
      segment.from -= 1 / 12;
      segment.to -= 1 / 12;
    }
    expect(codes(runs)).toContain("d13-modules");
  });
});
