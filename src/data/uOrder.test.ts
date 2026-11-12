/**
 * The U's new order (Leo, 2026-11-11 and 2026-11-12; docs/plans/u-order-plan.md,
 * third draft). B, D and E: the oven tower moves from the tall leg to the
 * cooking leg's open end — 「B，D，E套仓的烤箱塔为什么不分布在Rangetop或者cooktop那边去」.
 *
 * - The cooking leg from the corner: 15" of counter, the cooking surface, then
 *   B and E 18" of counter (D11 rule 12's want) and D 15", its microwave drawer
 *   and 15" (「D 右段照丙」), and the oven tower at the open end.
 * - One rule for the three: 「灶离转角 15"，多出来的墙长加在灶和烤箱塔之间（E 是 18" 变
 *   24"）。写成一条规则，B、D、E 都照它」 — the wall's spare inches go to the counter
 *   before the oven tower.
 * - The tall leg: the columns, D's and E's coffee tower, the pantry cabinet at
 *   its open end (「储物高柜留着，放在左段开放端」).
 * - The side walls count what the right leg wants as well as what it needs
 *   (「U 的左右墙长度要把"想要的"18" 也算进去：同意改」).
 * - The stone by the rule already confirmed (乙, 120" slabs, the first cabinet
 *   joint), worked out again.
 * - The oven tower's socket in the counter cabinet before it; the coffee
 *   machine's still in the pantry.
 *
 * A and C have no oven tower and are not touched (uShape.test.ts keeps theirs).
 * Reached through the modules, so on code without a function each case fails
 * on its own.
 */
import { afterAll, describe, expect, it } from "vitest";
import * as template from "./layoutTemplate";
import * as rules from "./layoutRules";
import * as counter from "./counter";
import * as layoutState from "./layoutState";
import * as room from "./room";
import * as packages from "./packages";
import * as catalogue from "./catalogue";
import * as view from "./defaultView";
import { resetRoom, defaultSelectionOf } from "./testRoom";
import type { CabinetRun } from "./room";

const IN = (feet: number) => Math.round(feet * 12 * 10000) / 10000;
const widths = (run: CabinetRun) => run.segments.map((s) => IN(s.to - s.from));
const signature = (run: CabinetRun) =>
  run.segments.map((s) => s.slot ?? s.fixture ?? (s.modules[0]?.kind === ("pantry" as string) ? "pantry" : s.kind));
const pkgOf = (code: string) => packages.PACKAGES.find((p) => p.code === code)!;
const any = (m: unknown) => m as Record<string, any>;

/** The walls each package's U opens at: everything it has, what each leg wants. */
const OPENS: Record<string, { backWallIn: number; leftWallIn: number }> = {
  A: { backWallIn: 132, leftWallIn: 155.25 },
  B: { backWallIn: 132, leftWallIn: 141 },
  C: { backWallIn: 132, leftWallIn: 159.75 },
  D: { backWallIn: 132, leftWallIn: 177 },
  E: { backWallIn: 132, leftWallIn: 147 },
};

function generated(code: string, sideIn = OPENS[code].leftWallIn) {
  resetRoom();
  const pkg = pkgOf(code);
  layoutState.setActivePackage(pkg.id);
  const asked = { ...room.REQUESTED_PARAMS, shape: "U", cornerType: "blind", backWallIn: OPENS[code].backWallIn, leftWallIn: sideIn };
  return template.generateLayout(asked as never, pkg);
}
const runsOf = (code: string, sideIn?: number) => {
  const result = generated(code, sideIn);
  if (!result.ok) throw new Error(`${code}: ${JSON.stringify(result.reasons).slice(0, 300)}`);
  return Object.fromEntries(result.layout.runs.map((run) => [run.id, run])) as Record<string, CabinetRun>;
};

afterAll(() => resetRoom());

// --- 1 -----------------------------------------------------------------------
describe("U order (1): the walls each package's U opens at", () => {
  for (const code of Object.keys(OPENS)) {
    it(`${code}: ${OPENS[code].backWallIn}" back, ${OPENS[code].leftWallIn}" sides`, () => {
      resetRoom();
      const pkg = pkgOf(code);
      layoutState.setActivePackage(pkg.id);
      const asked = { ...room.REQUESTED_PARAMS, shape: "U", cornerType: "blind" };
      expect(template.uWantedIn(asked as never, pkg)).toEqual(OPENS[code]);
    });
  }
});

// --- 2 -----------------------------------------------------------------------
describe("U order (2): B's, D's and E's legs, segment by segment, at those walls", () => {
  const PLAN: Record<string, Record<"left" | "right", { widths: number[]; signature: string[] }>> = {
    B: {
      left: { widths: [42, 28.5, 0.75, 36, 18, 0.75, 15], signature: ["corner", "counter", "tall", "slot-fridge", "slot-wine", "tall", "pantry"] },
      right: { widths: [42, 15, 36, 18, 30], signature: ["corner", "counter", "slot-range", "counter", "slot-microwave"] },
    },
    D: {
      left: {
        widths: [42, 15, 0.75, 24, 30, 24, 0.75, 0.75, 24, 0.75, 15],
        signature: ["corner", "counter", "tall", "slot-wine", "slot-fridge", "slot-freezer", "tall", "tall", "slot-coffee", "tall", "pantry"],
      },
      right: {
        widths: [42, 15, 36, 15, 24, 15, 30],
        signature: ["corner", "counter", "slot-range", "counter", "slot-microwave", "counter", "slot-oven"],
      },
    },
    E: {
      left: {
        widths: [42, 15, 0.75, 30, 18, 0.75, 0.75, 24, 0.75, 15],
        signature: ["corner", "counter", "tall", "slot-fridge", "slot-freezer", "tall", "tall", "slot-coffee", "tall", "pantry"],
      },
      right: { widths: [42, 15, 36, 24, 30], signature: ["corner", "counter", "slot-cooktop", "counter", "slot-microwave"] },
    },
  };
  for (const code of Object.keys(PLAN)) {
    for (const leg of ["left", "right"] as const) {
      it(`${code}'s ${leg} leg`, () => {
        const run = runsOf(code)[leg];
        expect({ widths: widths(run), signature: signature(run) }).toEqual(PLAN[code][leg]);
      });
    }
  }
});

// --- 3 -----------------------------------------------------------------------
describe("U order (3): one rule — the cooking surface 15\" off the corner, the spare inches before the oven tower", () => {
  // Each package's walls 6" longer than it opens at: the 15" off the corner
  // stays, the counter before the oven tower takes all six.
  const MORE: Record<string, number[]> = {
    B: [42, 15, 36, 24, 30],
    D: [42, 15, 36, 15, 24, 21, 30],
    E: [42, 15, 36, 30, 30],
  };
  for (const code of Object.keys(MORE)) {
    it(`${code} at ${OPENS[code].leftWallIn + 6}"`, () => {
      expect(widths(runsOf(code, OPENS[code].leftWallIn + 6).right)).toEqual(MORE[code]);
    });
  }

  it("is written once, for every package with an oven tower on the cooking leg", () => {
    const rule = any(template).U_SPARE_BEFORE_OVEN_TOWER;
    expect(typeof rule === "object" && rule !== null ? Object.keys(rule).sort() : rule).toEqual(["cookingFromCornerIn", "rule"]);
  });
});

// --- 4 -----------------------------------------------------------------------
describe("U order (4): the side walls count what each leg wants", () => {
  // B's right leg needs 129" — 6" before its oven tower, the floor a slider
  // dragged short builds to (`asDragged`, the 9" round) — and wants 141" (18");
  // its left leg needs 127-1/2". The side walls open at the right leg's want.
  it("B: needs 129\", opens at 141\"", () => {
    resetRoom();
    const pkg = pkgOf("B");
    layoutState.setActivePackage(pkg.id);
    const asked = { ...room.REQUESTED_PARAMS, shape: "U", cornerType: "blind", backWallIn: 132, leftWallIn: 216 };
    const need = template.wallRequirement(asked as never, "left", pkg);
    expect([need.minimumIn, need.wantedIn]).toEqual([129, 141]);
  });
});

// --- 5 -----------------------------------------------------------------------
describe("U order (5): every rule passes, both corners", () => {
  for (const code of ["B", "D", "E"]) {
    for (const corner of ["blind", "lazy-susan"] as const) {
      it(`${code}, ${corner}`, () => {
        resetRoom();
        const pkg = pkgOf(code);
        layoutState.setActivePackage(pkg.id);
        const asked = { ...room.REQUESTED_PARAMS, shape: "U", cornerType: corner };
        const walls = template.uWantedIn(asked as never, pkg);
        // Applied, as U-1's group 5 does: the check reads the room as built.
        const result = layoutState.setLayoutParams({ ...asked, ...walls } as never);
        expect(result.ok, JSON.stringify((result as { reasons?: unknown }).reasons ?? "").slice(0, 300)).toBe(true);
        expect(rules.checkLayout().map((v) => `${v.code}: ${v.message}`)).toEqual([]);
      });
    }
  }
});

// --- 6 -----------------------------------------------------------------------
describe("U order (6): the stone, by the rule confirmed (乙, 120\" slabs, the first cabinet joint)", () => {
  const STONE: Record<string, number[]> = {
    B: [70.5, 82, 111],
    D: [57, 82, 42, 105],
    E: [57, 82, 117],
  };
  for (const code of Object.keys(STONE)) {
    it(`${code}`, () => {
      const result = generated(code);
      if (!result.ok) throw new Error("not built");
      room.applyLayout(result.layout, result.layout.params, []);
      const sel = Object.fromEntries(
        Object.entries(packages.packageInShape(pkgOf(code), "U" as never).defaultSelection).map(([s, id]) => [s, catalogue.APPLIANCE_BY_ID[id as string]]),
      );
      const outline = counter.counterOutline(result.layout.runs, sel["slot-range"], undefined, sel["slot-cooktop"]);
      expect(
        outline.pieces.map((piece) => {
          const xs = piece.outline.map((p) => p[0]);
          const zs = piece.outline.map((p) => p[1]);
          return IN(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)));
        }),
      ).toEqual(STONE[code]);
    });
  }
});

// --- 7 -----------------------------------------------------------------------
describe("U order (7): the connections", () => {
  const OVEN: Record<string, string> = { B: "slot-microwave", D: "slot-oven", E: "slot-microwave" };
  for (const code of Object.keys(OVEN)) {
    it(`${code}: the oven tower's socket in the counter cabinet before it`, async () => {
      resetRoom();
      const { openSharedLink } = await import("../store/openLink");
      const { resolveRoughIn } = await import("./roughIn");
      openSharedLink(`?v=2&pkg=${code}&shape=U&back=${OPENS[code].backWallIn}&left=${OPENS[code].leftWallIn}&corner=blind`);
      const right = room.RUNS.find((run) => run.id === "right")!;
      const at = right.segments.findIndex((s) => s.slot === OVEN[code]);
      const before = right.segments[at - 1];
      const power = resolveRoughIn(OVEN[code] as never, defaultSelectionOf(pkgOf(code).id)[OVEN[code] as never]).find((r) => r.point.type === "power");
      expect([at, before.kind, power?.noCabinet, power?.host.id.startsWith(before.id)]).toEqual([right.segments.length - 1, "counter", false, true]);
    });
  }

  for (const code of ["D", "E"]) {
    it(`${code}: the coffee machine's connections in the pantry cabinet beside it`, async () => {
      resetRoom();
      const { openSharedLink } = await import("../store/openLink");
      const { resolveRoughIn } = await import("./roughIn");
      openSharedLink(`?v=2&pkg=${code}&shape=U&back=${OPENS[code].backWallIn}&left=${OPENS[code].leftWallIn}&corner=blind`);
      const pantry = room.RUNS.find((run) => run.id === "left")!.segments.find((s) => (s.modules[0]?.kind as string) === "pantry")!;
      const points = resolveRoughIn("slot-coffee", defaultSelectionOf(pkgOf(code).id)["slot-coffee"]);
      expect(points.map((p) => [p.noCabinet, p.host.id.startsWith(pantry.id)])).toEqual(points.map(() => [false, true]));
    });
  }
});

// --- 8 -----------------------------------------------------------------------
// Changed later on 2026-11-12 (Leo: 「U 的默认视角定：正前方，往下 50°」, which overturns the
// night's 「往左 45°、往下 25°」): turned left, most labels were hidden; only straight in
// front at 50° to 60° showed every label in all five packages (tests/uLabels.test.ts).
describe("U order (8): the U's default view (Leo, 2026-11-12: 「正前方，往下 50°」)", () => {
  it("is straight in front and 50° down; the L and one wall keep 45° and 35°", () => {
    expect([view.defaultView("U"), view.defaultView("L"), view.defaultView("one-wall")]).toEqual([
      { azimuthDeg: 0, pitchDeg: 50 },
      { azimuthDeg: 45, pitchDeg: 35 },
      { azimuthDeg: 45, pitchDeg: 35 },
    ]);
  });
});
