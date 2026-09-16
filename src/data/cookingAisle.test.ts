import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { resetRoom } from "./testRoom";
import { checkLayout } from "./layoutRules";
import { DEFAULT_PARAMS, generateLayout, type IslandLayout, type LayoutParams } from "./layoutTemplate";
import { PACKAGE_BY_ID } from "./packages";
import { ISLAND, LAYOUT_LIMITS, RUNS } from "./room";
import type { Appliance, Package } from "../types";

/**
 * The aisle in front of a cooktop is 48 inches. Round 56, from D20.
 *
 * Forty-two is D11 rule 7's aisle, and it is right for an island somebody walks
 * past. An island with a cooktop in it has somebody standing at the burners,
 * under the hood, with the oven tower opposite and its door down: D20 settled
 * 48" on that side, counter edge to counter edge. Held two ways, as rule 4's
 * island landings were in round 50 — by the rule, and by the generator refusing
 * a room that falls short, because `checkLayout` is not called by the app and a
 * rule on its own would let a customer drag the aisle straight back to 42.
 *
 * And a hole found on the way. The aisle check sat inside rule 7's block about
 * the microwave drawer and the wine cabinet, which only runs when the island
 * carries both. So package B's prep island, whose wine is a column, never had
 * its aisle checked at all, and an island with a cooktop and nothing else — E's
 * — would not have either.
 */

const CATALOGUE = (appliancesFile as unknown as { appliances: Appliance[] }).appliances;
const byModel = (model: string) => CATALOGUE.find((entry) => entry.model === model)!;
const E_ID = "test-cooking-aisle";

function packageE(): Package {
  const a = PACKAGE_BY_ID["package-a"];
  const d = PACKAGE_BY_ID["package-d"];
  const b = PACKAGE_BY_ID["package-b"];
  const take = (pkg: Package, slotId: string) => pkg.slots.find((s) => s.slotId === slotId)!;
  const hood = take(a, "slot-hood");
  return {
    ...d,
    id: E_ID,
    columnOrder: ["slot-freezer", "slot-fridge"],
    // With its own aisle: without it, choosing the package applies the
    // ordinary 42" and is refused by the very rule this file is about.
    defaultLayout: {
      sinkLeg: "back",
      fridgeEnd: "left",
      coffeeLeg: "back",
      backWallIn: 240,
      leftWallIn: 168,
      islandLengthIn: 72,
      // D20: "for E that is a 24\" cabinet and 40\" of counter".
      islandDepthIn: 24,
      islandOverhangIn: 15,
      aisleIn: 48,
    },
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
 * E's room at D20's own figures: 24" island cabinets, 40" of top, 168" deep —
 * 11" more than the 157" a 48" aisle and 44" behind the seats need.
 */
const eRoom = (aisleIn: number): LayoutParams => ({
  ...DEFAULT_PARAMS,
  backWallIn: 240,
  leftWallIn: 168,
  sinkLeg: "back",
  fridgeEnd: "left",
  coffeeLeg: "back",
  islandLengthIn: 72,
  islandDepthIn: 24,
  islandOverhangIn: 15,
  aisleIn,
});

afterAll(() => {
  delete PACKAGE_BY_ID[E_ID];
  resetRoom();
});

describe("the generator will not build a cooktop island with a walk-past aisle", () => {
  it("refuses 42 inches in front of a cooktop, and offers 48", () => {
    const result = generateLayout(eRoom(42), packageE());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const refusal = result.reasons.find((reason) => reason.key === "refusal.cooktopAisle");
    expect(refusal, JSON.stringify(result.reasons)).toBeTruthy();
    expect(refusal!.suggestion?.patch).toEqual({ aisleIn: 48 });
  });

  it("refuses 45, which is on the slider and still short", () => {
    const result = generateLayout(eRoom(45), packageE());
    expect(result.ok).toBe(false);
  });

  it("builds at 48", () => {
    const result = generateLayout(eRoom(48), packageE());
    expect(result.ok, JSON.stringify("reasons" in result ? result.reasons : "")).toBe(true);
  });

  it("still builds package A's island at 42, which has no cooktop in it", () => {
    const result = generateLayout({ ...DEFAULT_PARAMS, aisleIn: 42 }, PACKAGE_BY_ID["package-a"]);
    expect(result.ok).toBe(true);
  });

  it("takes its figure from the one constant, not a second 48", () => {
    expect(LAYOUT_LIMITS.cooktopAisleIn).toBe(48);
    expect(LAYOUT_LIMITS.aisleIn).toBe(42);
  });
});

/**
 * The rule, asked directly of an island moved toward the run. An island nudged
 * a few inches is what a hand-drawn room or a future template could produce,
 * and the rule has to see it whatever the generator would have done.
 */
function nudged(island: IslandLayout, towardRunIn: number): IslandLayout {
  const by = towardRunIn / 12;
  const shiftAcross = (range: readonly [number, number]) => [range[0] - by, range[1] - by] as const;
  return {
    ...island,
    working: island.working - by,
    seating: island.seating - by,
    ...(island.axis === "x" ? { z: shiftAcross(island.z) } : { x: shiftAcross(island.x) }),
  };
}

const aisleFailures = () =>
  checkLayout(RUNS, undefined, nudged(ISLAND, 3)).filter(
    (problem) => problem.code === "d11-7" && problem.message.includes("aisle"),
  );

describe("the rule checks the aisle of every island, not only one carrying the two machines", () => {
  it("fails a cooktop island three inches short of 48", () => {
    PACKAGE_BY_ID[E_ID] = packageE();
    resetRoom();
    expect(setActivePackage(E_ID).ok).toBe(true);
    expect(setLayoutParams(eRoom(48)).ok).toBe(true);
    const failures = aisleFailures();
    expect(failures.length, "an aisle of 45 in front of a cooktop").toBeGreaterThan(0);
    expect(failures[0].message).toContain("48");
  });

  it("fails package B's prep island when it is moved inside 42", () => {
    // B's wine is a column, so its island carries neither machine, and the
    // aisle check never ran for it. Nudged three inches it is 39".
    resetRoom();
    expect(setActivePackage("package-b").ok).toBe(true);
    expect(aisleFailures().length).toBeGreaterThan(0);
  });

  it("passes every package as it is built, so nothing that ships is now refused", () => {
    for (const id of ["package-a", "package-b", "package-c", "package-d"]) {
      resetRoom();
      expect(setActivePackage(id).ok).toBe(true);
      const failures = checkLayout(RUNS, undefined, ISLAND).filter((p) => p.message.includes("aisle"));
      expect(failures, `${id}: ${JSON.stringify(failures)}`).toEqual([]);
    }
  });
});
