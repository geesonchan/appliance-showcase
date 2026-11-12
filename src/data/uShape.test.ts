/**
 * U-1, the U's data and generator, the page unchanged (Leo, 2026-11-11: 「照计划动手」;
 * docs/plans/u1-plan.md). The U as `shape=U` builds it: three runs, the left
 * leg every tall unit, the right leg the cooking surface in its middle, the back
 * leg the sink and the dishwasher; the stone in three slabs seamed at the back
 * leg's two ends (乙) and split at 120". Its lists are the plan's section 2,
 * as Leo confirmed them (3" steps, the seam rule, D's microwave drawer 12" off
 * the corner), and B's columns refrigerator first (Leo, 2026-11-11, after U-1).
 *
 * The new functions are reached through the modules rather than imported by
 * name, so on code without them each case fails on its own, for its own reason.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as layoutShape from "./layoutShape";
import * as template from "./layoutTemplate";
import * as rules from "./layoutRules";
import * as counter from "./counter";
import * as layoutState from "./layoutState";
import * as room from "./room";
import * as packages from "./packages";
import * as catalogue from "./catalogue";
import { resetRoom } from "./testRoom";
import { translate } from "../i18n";
import type { CabinetRun, RunSegment } from "./room";
import type { SlotId } from "../types";

const IN = (feet: number) => Math.round(feet * 12 * 10000) / 10000;
const widths = (run: CabinetRun) => run.segments.map((s) => IN(s.to - s.from));
const signature = (run: CabinetRun) =>
  run.segments.map((s) => s.slot ?? s.fixture ?? (s.modules[0]?.kind === ("pantry" as string) ? "pantry" : s.kind));
const pkgOf = (code: string) => packages.PACKAGES.find((p) => p.code === code)!;

/**
 * The walls each package's U is built at, shortest (the plan's section 2).
 * B's, D's and E's since the new order (Leo, 2026-11-11 and 2026-11-12; the oven
 * tower on the cooking leg): 141", 177", 147" — they were 157-1/2", 207", 177".
 */
const WALLS: Record<string, { back: number; side: number }> = {
  A: { back: 132, side: 155.25 },
  B: { back: 132, side: 141 },
  C: { back: 132, side: 159.75 },
  D: { back: 132, side: 177 },
  E: { back: 132, side: 147 },
};

/** A package's U, generated at its own walls from the params it opens with. */
function generated(code: string, extra: Record<string, unknown> = {}) {
  resetRoom();
  const pkg = pkgOf(code);
  layoutState.setActivePackage(pkg.id);
  const asked = { ...room.REQUESTED_PARAMS, shape: "U", backWallIn: WALLS[code].back, leftWallIn: WALLS[code].side, ...extra };
  return template.generateLayout(asked as never, pkg);
}
const runsOf = (code: string, extra: Record<string, unknown> = {}) => {
  const result = generated(code, extra);
  if (!result.ok) throw new Error(`${code}: ${JSON.stringify(result.reasons).slice(0, 300)}`);
  return Object.fromEntries(result.layout.runs.map((run) => [run.id, run])) as Record<string, CabinetRun>;
};

afterAll(() => resetRoom());

// --- 1 -----------------------------------------------------------------------
describe("U-1 (1): the U is a shape the generator builds", () => {
  it("is in the shape table, three runs and two corners, and says what it means", () => {
    const spec = (layoutShape.SHAPES as Record<string, layoutShape.ShapeSpec>).U;
    expect(spec?.runs.map((run) => run.id)).toEqual(["left", "back", "right"]);
    expect(() => layoutShape.validateShape(spec)).not.toThrow();
  });

  // Until U-2 the U was built but not offered; U-2 (2026-11-11, Leo: 「照计划第 10 节
  // 动手」) puts it on the switch, last (`uInterface.test.ts`, group 1).
  it("is offered on the page's shape switch since U-2, after the L and one wall", () => {
    expect(layoutShape.LAYOUT_SHAPES).toEqual(["L", "one-wall", "U"]);
  });

  for (const code of ["A", "B", "C", "D", "E"]) {
    it(`builds ${code}'s U`, () => {
      expect(generated(code).ok).toBe(true);
    });
  }
});

// --- 2 -----------------------------------------------------------------------
describe("U-1 (2): each package's three runs, segment by segment (the plan's section 2)", () => {
  const BACK = { widths: [12, 24, 30, 18], signature: ["counter", "slot-dishwasher", "fixture-sink", "counter"] };
  const PLAN: Record<string, Record<"left" | "right", { widths: number[]; signature: string[] }>> = {
    A: {
      left: { widths: [42, 12, 24, 0.75, 24, 15, 37.5], signature: ["corner", "counter", "slot-microwave", "counter", "slot-wine", "counter", "slot-fridge"] },
      right: { widths: [42, 21, 19.5, 36, 36, 0.75], signature: ["corner", "counter", "counter", "slot-range", "counter", "counter"] },
    },
    C: {
      left: { widths: [42, 12, 24, 0.75, 24, 15, 42], signature: ["corner", "counter", "slot-microwave", "counter", "slot-wine", "counter", "slot-fridge"] },
      right: { widths: [42, 24, 21, 30, 21, 21, 0.75], signature: ["corner", "counter", "counter", "slot-range", "counter", "counter", "counter"] },
    },
    // B, D and E: the new order since 2026-11-12 (the oven tower on the cooking
    // leg, the pantry cabinet at the tall leg's open end), segment by segment in
    // `uOrder.test.ts` (2). Their U-1 lists were here.
  };
  for (const code of Object.keys(PLAN)) {
    for (const leg of ["left", "right"] as const) {
      it(`${code}'s ${leg} leg`, () => {
        const run = runsOf(code)[leg];
        expect({ widths: widths(run), signature: signature(run) }).toEqual(PLAN[code][leg]);
      });
    }
    it(`${code}'s back leg`, () => {
      const run = runsOf(code).back;
      expect({ widths: widths(run), signature: signature(run) }).toEqual(BACK);
    });
  }
});

// --- 3 -----------------------------------------------------------------------
describe("U-1 (3): the walls a package's U is built at, and the aisle", () => {
  for (const code of Object.keys(WALLS)) {
    it(`${code}: ${WALLS[code].back}" back wall, ${WALLS[code].side}" side walls`, () => {
      resetRoom();
      const pkg = pkgOf(code);
      layoutState.setActivePackage(pkg.id);
      const wanted = (template as Record<string, any>).uWantedIn({ ...room.REQUESTED_PARAMS, shape: "U" }, pkg);
      expect(wanted).toEqual({ backWallIn: WALLS[code].back, leftWallIn: WALLS[code].side });
    });
  }

  it("leaves 82\" between the side legs' counter edges at a 132\" back wall, past the 48\" least", () => {
    const runs = runsOf("A");
    const front = (run: CabinetRun) => run.centre + run.facing.sign * (room.ROOM.counterDepth / 2 + room.ROOM.counterOverhang);
    const aisle = IN(Math.abs(front(runs.right) - front(runs.left)));
    expect(aisle).toBe(82);
  });

  it("refuses a back wall that leaves the aisle under 48\" — none can, the back leg needs more", () => {
    const result = generated("A", { backWallIn: 126 });
    expect(result.ok).toBe(false);
  });
});

// --- 4 -----------------------------------------------------------------------
describe("U-1 (4): the back leg is eaten at both ends, its wall cabinets too", () => {
  for (const [corner, base, upper] of [["blind", 24, 12], ["lazy-susan", 36, 24]] as const) {
    it(`with a ${corner} corner: the base run ${base}" in from each side wall, the wall cabinets ${upper}"`, () => {
      const backWallIn = corner === "blind" ? 132 : 156;
      const runs = runsOf("C", { cornerType: corner, backWallIn });
      // The generated room's own half width, not the room installed before it.
      const halfX = backWallIn / 24;
      const back = runs.back;
      const banks = back.uppers;
      expect([
        IN(back.segments[0].from + halfX),
        IN(halfX - back.segments[back.segments.length - 1].to),
        IN(banks[0].from + halfX),
        IN(halfX - banks[banks.length - 1].to),
      ]).toEqual([base, base, upper, upper]);
    });
  }
});

// --- 5 -----------------------------------------------------------------------
describe("U-1 (5): every package's U passes every rule, both corners", () => {
  for (const code of Object.keys(WALLS)) {
    for (const corner of ["blind", "lazy-susan"] as const) {
      it(`${code}, ${corner}`, () => {
        resetRoom();
        const pkg = pkgOf(code);
        layoutState.setActivePackage(pkg.id);
        const asked = { ...room.REQUESTED_PARAMS, shape: "U", cornerType: corner } as never;
        const wanted = (template as Record<string, any>).uWantedIn(asked, pkg);
        const result = layoutState.setLayoutParams({ ...(asked as object), ...wanted } as never);
        expect(result.ok, JSON.stringify((result as { reasons?: unknown }).reasons ?? "").slice(0, 300)).toBe(true);
        expect(rules.checkLayout().map((v) => `${v.code}: ${v.message}`)).toEqual([]);
      });
    }
  }
});

// --- 6 -----------------------------------------------------------------------
describe("U-1 (6): a dishwasher keeps 12\" of counter off the corner (D11 rule 10, 2026-11-10)", () => {
  const near = (runs: CabinetRun[]) => rules.checkLayout(runs).filter((v) => v.code === "d11-10" && /dishwasher/.test(v.message));
  const ft = (inches: number) => inches / 12;
  const seg = (id: string, widthIn: number, at: number, extra: Partial<RunSegment>, code: string, kind: string): RunSegment => ({
    id,
    kind: "counter",
    from: at,
    to: at + ft(widthIn),
    modules: [{ code, kind: kind as never, widthIn }],
    ...extra,
  });
  // On the L's own back leg (package A as it opens), which every shape's rule
  // reads the same way: what is between the corner and the dishwasher.
  function backWith(gapIn: number): CabinetRun[] {
    resetRoom();
    layoutState.setActivePackage(pkgOf("A").id);
    const runs = structuredClone(room.RUNS) as CabinetRun[];
    const back = runs.find((run) => run.id === "back")!;
    const end = back.segments[back.segments.length - 1].to;
    let at = back.segments[0].from;
    const pieces: RunSegment[] = [];
    const add = (s: RunSegment) => { pieces.push(s); at = s.to; };
    if (gapIn > 0) add(seg("back-a", gapIn, at, {}, `B${gapIn}`, "base"));
    add(seg("back-dishwasher", 24, at, { kind: "appliance", slot: "slot-dishwasher" }, "RO24", "opening"));
    add(seg("back-sink", 30, at, { kind: "fixture", fixture: "fixture-sink" }, "SB30", "sink-base"));
    const restIn = IN(end - at);
    add(seg("back-b", restIn, at, {}, `B${restIn}`, "base"));
    back.segments = pieces;
    return runs;
  }

  it("flags a dishwasher 9\" of counter off the corner", () => {
    expect(near(backWith(9))).toHaveLength(1);
  });

  it("passes it 12\" off", () => {
    expect(near(backWith(12))).toHaveLength(0);
  });
});

// --- 7 -----------------------------------------------------------------------
describe("U-1 (7): where the island's machines go in a U", () => {
  it("puts A's microwave drawer and wine cabinet on the tall leg", () => {
    const runs = runsOf("A");
    expect(["slot-microwave", "slot-wine"].map((slot) => runs.left.segments.some((s) => s.slot === slot))).toEqual([true, true]);
  });

  // Leo, 2026-11-11: 「D 再改一处：微波抽屉放在灶和烤箱塔之间，不放在转角和灶之间」 (丙). It
  // was 12" off the corner (U-1, Leo, 2026-11-11).
  it("puts D's microwave drawer on the cooking leg between the cooking surface and the oven tower, 15\" past the cooking surface", () => {
    const runs = runsOf("D");
    const at = runs.right.segments.findIndex((s) => s.slot === "slot-microwave");
    const seg = (i: number) => runs.right.segments[i];
    expect([seg(at - 2).slot, IN(seg(at - 1).to - seg(at - 1).from), seg(at + 2).slot]).toEqual(["slot-range", 15, "slot-oven"]);
  });

  it("keeps them on the tall leg while it is 216\" or less, and moves them past that", () => {
    const go = (template as Record<string, any>).sparesRun;
    expect([go(216), go(216.75), go(219)]).toEqual(["tall", "cooking", "cooking"]);
  });
});

// --- 8 -----------------------------------------------------------------------
// Since the new order (2026-11-12) the oven tower is on the cooking leg, at its
// open end, and every column and the coffee tower on the tall leg: the two rules
// hold by the legs (the columns' 1-3/16" from a heat source, Leo 2026-11-10;
// TCM24PS p. 9). U-1 had them side by side on the tall leg, the pantry between.
describe("U-1 (8): the oven tower never against a column, the coffee tower never against the oven", () => {
  for (const code of ["B", "D", "E"]) {
    it(`${code}`, () => {
      const runs = runsOf(code);
      const ovenSlot = code === "D" ? "slot-oven" : "slot-microwave";
      const right = runs.right.segments;
      const oven = right.findIndex((s) => s.slot === ovenSlot);
      const cold = ["slot-fridge", "slot-freezer", "slot-wine", "slot-coffee"];
      expect({
        ovenAtTheOpenEnd: oven === right.length - 1,
        besideOven: (right[oven - 1] as RunSegment).kind,
        coldOnTheCookingLeg: right.filter((s) => cold.includes(s.slot ?? "")).map((s) => s.slot),
      }).toEqual({ ovenAtTheOpenEnd: true, besideOven: "counter", coldOnTheCookingLeg: [] });
    });
  }
});

// --- 9 -----------------------------------------------------------------------
describe("U-1 (9): the stone — three slabs seamed at the back leg's ends, none over 120\"", () => {
  const STONE: Record<string, number[]> = {
    // left, back, right pieces, in inches along each run (the plan's section 2)
    A: [117.75, 82, 82.5, 37.75],
    // B, D, E since the new order (2026-11-12): worked out again by the same rule.
    B: [70.5, 82, 111],
    C: [117.75, 82, 87, 43.75],
    D: [57, 82, 42, 105],
    E: [57, 82, 117],
  };
  const lengths = (code: string) => {
    const result = generated(code);
    if (!result.ok) throw new Error("not built");
    room.applyLayout(result.layout, result.layout.params, []);
    const sel = Object.fromEntries(Object.entries(packages.packageInShape(pkgOf(code), "U" as never).defaultSelection).map(([s, id]) => [s, catalogue.APPLIANCE_BY_ID[id as string]]));
    const outline = counter.counterOutline(result.layout.runs, sel["slot-range"], undefined, sel["slot-cooktop"]);
    return outline.pieces.map((piece) => {
      const xs = piece.outline.map((p) => p[0]);
      const zs = piece.outline.map((p) => p[1]);
      const dx = Math.max(...xs) - Math.min(...xs);
      const dz = Math.max(...zs) - Math.min(...zs);
      return IN(Math.max(dx, dz));
    });
  };
  for (const code of Object.keys(STONE)) {
    it(`${code}`, () => {
      expect(lengths(code)).toEqual(STONE[code]);
    });
  }

  it("moves the seam off a cutout to the next cabinet joint", () => {
    const seam = (counter as Record<string, any>).firstSeam;
    // A 178" slab whose first joint past 58" is inside a cutout from 60" to 96",
    // and the next at its edge, which is over it too: the one after, 108".
    expect(seam({ length: 178, joints: [42, 66, 96, 108, 120], avoid: [[60, 96]] })).toBe(108);
  });
});

// --- 10 ----------------------------------------------------------------------
describe("U-1 (10): a link with shape=U opens a U", () => {
  beforeEach(() => resetRoom());

  it("reads U as a shape a link may carry", () => {
    expect((layoutShape as Record<string, any>).BUILT_SHAPES).toEqual(["L", "one-wall", "U"]);
  });

  it("builds the room a v=2 link with shape=U names", async () => {
    const { openSharedLink } = await import("../store/openLink");
    const pkg = pkgOf("C");
    openSharedLink(`?v=2&pkg=C&shape=U&back=132&left=159.75&corner=blind`);
    expect([room.LAYOUT_PARAMS.shape, room.RUNS.map((run) => run.id).join(",")]).toEqual(["U", "left,back,right"]);
    void pkg;
  });
});

// --- 11 ----------------------------------------------------------------------
describe("U-1 (11): the pantry cabinet, T1596", () => {
  it("stands in B's, D's and E's tall leg as a 15\" pantry cabinet coded T1596", () => {
    for (const code of ["B", "D", "E"]) {
      const pantry = runsOf(code).left.segments.find((s) => (s.modules[0]?.kind as string) === "pantry");
      expect([code, pantry?.modules[0].code, IN(pantry!.to - pantry!.from)]).toEqual([code, "T1596", 15]);
    }
  });

  it("is called 储物高柜 / Pantry Cabinet; the towers keep 高柜 / Tall tower", () => {
    expect([
      translate("zh", "cabinet.pantry"),
      translate("en", "cabinet.pantry"),
      translate("zh", "cabinet.tall"),
      translate("en", "cabinet.tall"),
    ]).toEqual(["储物高柜", "Pantry Cabinet", "高柜", "Tall tower"]);
  });

  it("is orderable: no d13 finding for it in any package's U", () => {
    resetRoom();
    const result = generated("D");
    if (!result.ok) throw new Error("not built");
    expect(rules.checkLayout(result.layout.runs).filter((v) => /T1596|pantry/.test(v.message))).toEqual([]);
  });

  // A doored cabinet like any base: a column beside it with no base cabinet on
  // either side has its socket there. B's wine column, the refrigerator on one
  // side and the pantry on the other since Leo's order of 2026-11-11, asks for
  // a receptacle in the cabinet on its left (T18IW100SP's sheet) — the pantry.
  // Without it the point was dropped from the list in 25 of B's 27 U rooms.
  it("holds the socket of the column beside it: B's wine column", async () => {
    resetRoom();
    const { openSharedLink } = await import("../store/openLink");
    const { resolveRoughIn } = await import("./roughIn");
    const { defaultSelectionOf } = await import("./testRoom");
    openSharedLink(`?v=2&pkg=B&shape=U&back=${WALLS.B.back}&left=${WALLS.B.side}&corner=blind`);
    const pantry = room.RUNS.find((run) => run.id === "left")!.segments.find((s) => (s.modules[0]?.kind as string) === "pantry")!;
    const power = resolveRoughIn("slot-wine", defaultSelectionOf("package-b")["slot-wine"]).find((r) => r.point.type === "power");
    expect([power?.noCabinet, power?.host.id === undefined ? undefined : power.host.id.startsWith(pantry.id)]).toEqual([false, true]);
  });
});

// --- 12 ----------------------------------------------------------------------
describe("U-1 (12): the services come in on the cooking surface's wall, 4' from its far end", () => {
  // Leo, 2026-11-11: 「炉头在哪边就假设从那一头进来厨房」; 「同意，右墙（炉头那一段）、离开放端 4'，
  // 和 L 型对应」. The L's is today's: the back wall, 4' back from the room's far end.
  it("puts the U's on the right wall, 4' from its open end", () => {
    const runs = runsOf("C");
    const entry = (room as Record<string, any>).serviceEntry(Object.values(runs));
    expect([entry.run, IN(WALLS.C.side / 24 * 1 - entry.along / 1) ]).toEqual(["right", 48]);
  });

  // The rule's figure for the L too. The utility layer draws the L's 4 INCHES
  // from that end today, its comment saying four feet: registered, not changed
  // (Open items, "The services' entry: 4" or 4'").
  it("puts the L's on the back wall, 4' from its far end", () => {
    resetRoom();
    layoutState.setActivePackage(pkgOf("A").id);
    const entry = (room as Record<string, any>).serviceEntry(room.RUNS);
    expect([entry.run, IN(room.ROOM.halfX - entry.along)]).toEqual(["back", 48]);
  });
});

void ({} as SlotId);
