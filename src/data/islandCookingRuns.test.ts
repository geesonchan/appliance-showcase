import { describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { DEFAULT_PARAMS, generateLayout, type LayoutParams } from "./layoutTemplate";
import { PACKAGE_BY_ID } from "./packages";
import { toLocal } from "./frame";
import type { Appliance, Package } from "../types";

/**
 * Package E's two runs, before package E exists. Round 56.
 *
 * Two things the configuration will rely on and that nothing else pins down:
 * which way round a bank of columns stands, and where two towers that both
 * stand on their own in a run can go. Both are measured on a package built to
 * E's shape, because no package that ships has a freezer beside a refrigerator
 * without a wine column after them, or two free-standing towers.
 */

const CATALOGUE = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
const byModel = (model: string) => CATALOGUE.find((entry) => entry.model === model)!;

function packageE(columnOrder: string[]): Package {
  const a = PACKAGE_BY_ID["package-a"];
  const d = PACKAGE_BY_ID["package-d"];
  const b = PACKAGE_BY_ID["package-b"];
  const take = (pkg: Package, slotId: string) => pkg.slots.find((s) => s.slotId === slotId)!;
  const hood = take(a, "slot-hood");
  return {
    ...d,
    id: "test-island-cooking-runs",
    columnOrder: columnOrder as Package["columnOrder"],
    slots: [
      { ...take(d, "slot-freezer"), widthIn: 18 },
      take(d, "slot-fridge"),
      { ...take(b, "slot-microwave"), beside: "run" },
      { ...take(d, "slot-coffee"), standsOver: null },
      take(a, "slot-dishwasher"),
      {
        ...hood,
        slotId: "slot-cooktop",
        category: "cooktop",
        widthIn: 36,
        installType: "drop-in",
        builtForCooktopIn: null,
        heightIn: null,
        depthIn: null,
        utilities: { gas: null, power: { voltage: 240, amps: 50, dedicated: true }, duct: null },
      },
      // Ducted as HMIB42WS's guide shows; an island hood may not be declared
      // up through a cabinet or out through a wall (round 58).
      { ...hood, widthIn: 42, installType: "island", builtForCooktopIn: 36, utilities: { gas: null, power: null, duct: { diameterIn: 8, route: "through-ceiling" } } },
    ],
    defaultSelection: {
      "slot-freezer": byModel("T18IF900SP").id,
      "slot-fridge": byModel("T30IR905SP").id,
      "slot-microwave": byModel("MEM301WS").id,
      "slot-coffee": byModel("TCM24PS").id,
      "slot-dishwasher": byModel("SHV78CM3N").id,
      "slot-cooktop": byModel("CIT367YG").id,
      "slot-hood": byModel("HMIB42WS").id,
    },
  } as Package;
}

/**
 * E's room at D20's figures. Round 54's prototype built its island from A-D's
 * 36" default; D20 says 24" of cabinet and 40" of counter, which is what
 * makes its 157" across and its 168" default room agree.
 */
const eRoom = (overrides: Partial<LayoutParams> = {}): LayoutParams => ({
  ...DEFAULT_PARAMS,
  backWallIn: 240,
  leftWallIn: 168,
  sinkLeg: "back",
  fridgeEnd: "left",
  coffeeLeg: "back",
  islandLengthIn: 72,
  islandDepthIn: 24,
  islandOverhangIn: 15,
  aisleIn: 48,
  ...overrides,
});

const built = (pkg: Package, params: LayoutParams) => {
  const result = generateLayout(params, pkg);
  expect(result.ok, JSON.stringify("reasons" in result ? result.reasons : "")).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  return result.layout;
};

/**
 * The order of a bank is absolute, and it is Leo's site practice (D20, round
 * 57): **as you face the columns, a freezer stands to the left of the
 * refrigerator and a wine column to its right.** `columnOrder` is that list,
 * left to right. The same on either leg — which is why this is asked in the
 * refrigerator's own frame and on both legs, and not as "next to the landing"
 * or "at the outer end", which is how D20 used to put it and which reads the
 * other way round once the refrigerator is on the back wall.
 */
const sideOf = (layout: ReturnType<typeof built>, slot: string, of: string) => {
  const reference = layout.slots[of as keyof typeof layout.slots]!;
  const other = layout.slots[slot as keyof typeof layout.slots]!;
  // A machine's local +x is the right hand of somebody facing it.
  return toLocal(reference, other.position[0], other.position[2]).across < 0 ? "left" : "right";
};

describe.each([
  ["left", { fridgeEnd: "left", sinkLeg: "back", coffeeLeg: "back" }],
  ["back", { fridgeEnd: "back", sinkLeg: "left", coffeeLeg: "left", leftWallIn: 216 }],
] as const)("a freezer and a refrigerator column, the refrigerator on the %s leg", (_leg, legs) => {
  it("stands the freezer to the left of the refrigerator as you face them", () => {
    const layout = built(packageE(["slot-freezer", "slot-fridge"]), eRoom(legs));
    expect(sideOf(layout, "slot-freezer", "slot-fridge")).toBe("left");
  });

  it("follows the list: written the other way round, the freezer is on the right", () => {
    const layout = built(packageE(["slot-fridge", "slot-freezer"]), eRoom(legs));
    expect(sideOf(layout, "slot-freezer", "slot-fridge")).toBe("right");
  });
});

describe.each([
  ["left", { fridgeEnd: "left", sinkLeg: "back", coffeeLeg: "left" }],
  ["back", { fridgeEnd: "back", sinkLeg: "left", coffeeLeg: "left" }],
] as const)("package D's three columns, the refrigerator on the %s leg", (_leg, legs) => {
  it("stands the freezer to its left and the wine column to its right", () => {
    const d = PACKAGE_BY_ID["package-d"];
    const layout = built(d, { ...DEFAULT_PARAMS, ...d.defaultLayout, ...legs, backWallIn: 240, leftWallIn: 216 });
    expect(sideOf(layout, "slot-freezer", "slot-fridge")).toBe("left");
    expect(sideOf(layout, "slot-wine", "slot-fridge")).toBe("right");
  });
});

/**
 * `inRunGroup` puts every tower marked `beside: "run"` on the one leg
 * `coffeeLeg` names. A to D have at most one; E has two — the 30" combination
 * oven and the coffee cabinet — and they go together. This is a limit of the
 * template that E works round, not a decision about where the two belong (Leo,
 * round 55); it is pinned so that lifting it is a change somebody makes on
 * purpose.
 */
describe("two towers that each stand on their own in a run", () => {
  it("both go on the back leg, beside each other, when that is the leg named", () => {
    const layout = built(packageE(["slot-freezer", "slot-fridge"]), eRoom());
    const back = layout.runs.find((r) => r.id === "back")!;
    const oven = back.segments.findIndex((s) => s.slot === "slot-microwave");
    const coffee = back.segments.findIndex((s) => s.slot === "slot-coffee");
    expect(oven, "the combination oven on the back leg").toBeGreaterThanOrEqual(0);
    expect(coffee, "the coffee cabinet on the back leg").toBeGreaterThanOrEqual(0);
    // Nothing between them but their own panels.
    const between = back.segments.slice(Math.min(oven, coffee) + 1, Math.max(oven, coffee));
    expect(between.every((s) => s.modules.every((m) => m.kind === "panel"))).toBe(true);
  });

  it("cannot be split: naming the left leg puts both there with the columns, and the leg refuses", () => {
    // 176-1/8" of left wall for both towers and the bank, against E's 168".
    const result = generateLayout(eRoom({ coffeeLeg: "left" }), packageE(["slot-freezer", "slot-fridge"]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const short = result.reasons.find((reason) => reason.key === "refusal.wallShort");
    expect(short, JSON.stringify(result.reasons)).toBeTruthy();
    // And what it offers is to put them both on the other leg.
    expect(short!.suggestion?.patch).toEqual({ coffeeLeg: "back" });
  });
});

/**
 * How deep E's room has to be, which is the island's to say and not the
 * columns'. D20: a 24" run, its 1" lap, the 48" aisle, the island's 40" of top
 * and 44" behind the seats — 157". The bank on that wall is 50-1/8" and the
 * whole leg's cabinetry 107-1/8"; neither decides it.
 */
describe("the wall the island stands across", () => {
  it("builds at 157 inches, D20's own figure", () => {
    const result = generateLayout(eRoom({ leftWallIn: 157 }), packageE(["slot-freezer", "slot-fridge"]));
    expect(result.ok, JSON.stringify("reasons" in result ? result.reasons : "")).toBe(true);
  });

  it("refuses 156, and says the island is what needs the inch", () => {
    const result = generateLayout(eRoom({ leftWallIn: 156 }), packageE(["slot-freezer", "slot-fridge"]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.map((reason) => reason.key)).toContain("refusal.islandDeep");
    const deep = result.reasons.find((reason) => reason.key === "refusal.islandDeep")!;
    expect(deep.vars.needIn).toBe(157);
  });
});
