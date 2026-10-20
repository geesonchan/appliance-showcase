import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams, setLayoutParamsGrowing } from "./layoutState";
import {
  DEFAULT_PARAMS,
  ONE_WALL_MAX_IN,
  PARAM_LIMITS,
  generateLayout,
  oneWallWantedIn,
  type LayoutParams,
} from "./layoutTemplate";
import { BUILDABLE_PACKAGES, PACKAGE, PACKAGES, PACKAGE_BY_ID, packageInShape } from "./packages";
import { LAYOUT_PARAMS, OMITTED_FOR_WALL, REQUESTED_PARAMS, RUNS, SLOT_PLACEMENT, WINDOWS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import { sinkFromWindow } from "./windows";
import type { Appliance, SlotId } from "../types";

/**
 * One wall. Round 98b (docs/plans/round-98b-one-wall-plan.md; Leo's answers in
 * docs/decisions.md, round 98 and round 98b).
 *
 * Each package is put on one wall the way the shape switch puts it there: the
 * package's own room, its shape changed, its back wall grown to what the
 * package asks for on one wall (D18; Leo, round 98, first batch 4). The figures
 * below are Leo's arrangement worked through the template's own rules, and
 * were reported to him before they were written here.
 */

afterAll(() => resetRoom());

const CODES = BUILDABLE_PACKAGES.map((entry) => entry.code);
const idOf = (code: string) => PACKAGES.find((entry) => entry.code === code)!.id;

/** A package's room, switched to one wall at the wall it asks for there. */
function oneWall(code: string, patch: Partial<LayoutParams> = {}) {
  resetRoom();
  if (!setActivePackage(idOf(code)).ok) throw new Error(`${code} will not build`);
  const asked: LayoutParams = { ...REQUESTED_PARAMS, ...patch, shape: "one-wall" };
  const backWallIn = Math.max(asked.backWallIn, oneWallWantedIn(asked, PACKAGE_BY_ID[idOf(code)]));
  return setLayoutParamsGrowing({ ...asked, backWallIn });
}

/** What stands on the run, left to right as you face it: a slot, the sink, or the piece's own name. */
const leftToRight = () =>
  RUNS[0].segments.map((s) => s.slot ?? s.fixture ?? s.id.replace("back-", "").replace(/-\d+$/, ""));

/** The models standing in the room, by slot. */
const standing = () =>
  Object.fromEntries(
    PACKAGE.slots.map((slot) => [slot.slotId, APPLIANCE_BY_ID[PACKAGE.defaultSelection[slot.slotId]!]]),
  ) as Record<SlotId, Appliance>;

describe("each package on one wall (round 98b)", () => {
  it("is built at the wall it asks for there, to the eighth", () => {
    const walls = Object.fromEntries(CODES.map((code) => [code, oneWall(code).ok ? LAYOUT_PARAMS.backWallIn : null]));
    expect(walls).toEqual({ A: 237.75, B: 244.125, C: 232.25, D: 249.25, E: 261.625 });
  });

  it("tops the one-wall slider at the next 6-inch step over the longest of them, which is package E's", () => {
    const wanted = CODES.map((code) => ({ code, wallIn: oneWallWantedIn({ ...DEFAULT_PARAMS, ...PACKAGE_BY_ID[idOf(code)].defaultLayout }, PACKAGE_BY_ID[idOf(code)]) }));
    const longest = wanted.reduce((a, b) => (b.wallIn > a.wallIn ? b : a));
    const { min, step } = PARAM_LIMITS.backWallIn;
    expect({ longest: longest.code, maxIn: min + Math.ceil((longest.wallIn - min) / step) * step }).toEqual({
      longest: "E",
      maxIn: ONE_WALL_MAX_IN,
    });
  });

  it("has one run, along the back wall, against a wall at its left end and open at its right", () => {
    const runs = CODES.map((code) => {
      oneWall(code);
      return RUNS.map((run) => `${run.id} ${run.axis} ${run.ends.join("-")}`).join(", ");
    });
    expect(new Set(runs)).toEqual(new Set(["back x wall-open"]));
  });

  it("stands everything left to right as Leo arranged it", () => {
    const runs = Object.fromEntries(CODES.map((code) => [code, (oneWall(code), leftToRight())]));
    expect(runs).toEqual({
      // The refrigerator at the wall; the wine cabinet and the microwave drawer
      // on the wall where an L without its island puts them, straightened
      // (round 98, second batch 3); then the range, the sink, the dishwasher.
      A: ["slot-fridge", "fridge-landing", "slot-wine", "spare-divider", "slot-microwave", "range-landing-left", "slot-range", "range-landing-right", "fixture-sink", "slot-dishwasher", "back-end", "back-end-panel"],
      // The refrigerator and its wine column at the wall; the oven tower on the
      // refrigerator's side of the rangetop, 18" of counter between (third
      // batch 2 and 4).
      B: ["tall-outer", "slot-fridge", "tall-spacer", "slot-wine", "tall-inner", "fridge-landing", "slot-microwave", "tower-clearance", "slot-range", "range-landing", "fixture-sink", "slot-dishwasher", "back-end", "back-end-panel"],
      C: ["slot-fridge", "fridge-landing", "slot-wine", "spare-divider", "slot-microwave", "range-landing-left", "slot-range", "range-landing-right", "fixture-sink", "slot-dishwasher", "back-end", "back-end-panel"],
      // Freezer, refrigerator, wine as you face them; no coffee cabinet and no
      // microwave drawer; the combination oven beside the rangetop (round 98b, 1).
      D: ["tall-clearance", "tall-outer", "slot-freezer", "tall-spacer", "slot-fridge", "tall-spacer", "slot-wine", "tall-inner", "fridge-landing", "slot-oven", "tower-clearance", "slot-range", "range-landing", "fixture-sink", "slot-dishwasher", "back-end", "back-end-panel"],
      // Leo's E (round 98b): the coffee tower at the left wall, then the
      // freezer and the refrigerator, 15", the oven tower, 18", the cooktop.
      E: ["wall-end", "coffee-panel-start", "slot-coffee", "coffee-panel-end", "tall-outer", "slot-freezer", "tall-spacer", "slot-fridge", "tall-inner", "fridge-landing", "slot-microwave", "tower-clearance", "slot-cooktop", "range-landing", "fixture-sink", "slot-dishwasher", "back-end", "back-end-panel"],
    });
  });

  it("puts the refrigerator's outer side against the wall, and E's coffee tower there instead", () => {
    const ends = Object.fromEntries(
      CODES.map((code) => {
        oneWall(code);
        return [code, `${LAYOUT_PARAMS.fridgeEndAbuts} ${RUNS[0].segments[0].modules[0].code}`];
      }),
    );
    // A's built-in stands in its own 42" enclosure against the wall (D11 rule
    // 11 asks a door clearance of a freestanding machine and a bank); B's, C's
    // and D's take the 3-1/2"; E's coffee tower takes the 3" any run takes at a
    // wall (D13), and its refrigeration stands beside a cabinet.
    expect(ends).toEqual({ A: "wall T4296", B: "wall BF3.5", C: "wall BF3.5", D: "wall BF3.5", E: "cabinet BF3" });
  });

  it("has no island, whatever the room it came from had", () => {
    const islands = CODES.map((code) => (oneWall(code, { hasIsland: true }), LAYOUT_PARAMS.hasIsland));
    expect(islands).toEqual(CODES.map(() => false));
  });

  it("hangs the window over the sink, on the back wall", () => {
    const placed = CODES.map((code) => {
      oneWall(code);
      const sink = RUNS[0].segments.find((s) => s.fixture === "fixture-sink")!;
      return `${WINDOWS.map((w) => w.wall).join()} ${sinkFromWindow(sink, WINDOWS[0]).near}`;
    });
    expect(placed).toEqual(CODES.map(() => "back true"));
  });

  it("passes every layout rule, in every package", () => {
    const problems = Object.fromEntries(
      CODES.map((code) => {
        oneWall(code);
        return [code, checkLayout(RUNS, standing()).map((p) => `${p.code} ${p.message}`)];
      }),
    );
    expect(problems).toEqual(Object.fromEntries(CODES.map((code) => [code, []])));
  });
});

describe("package D on one wall (Leo, round 98b, 1)", () => {
  it("has no coffee machine, second dishwasher or microwave drawer", () => {
    oneWall("D");
    expect(PACKAGE.slots.map((slot) => slot.slotId)).toEqual([
      "slot-freezer",
      "slot-fridge",
      "slot-wine",
      "slot-range",
      "slot-hood",
      "slot-oven",
      "slot-dishwasher",
    ]);
  });

  it("opens with the 18-, 24- and 18-inch columns and the combination oven MEM301WS", () => {
    oneWall("D");
    const slots = ["slot-freezer", "slot-fridge", "slot-wine", "slot-oven"] as const;
    expect(
      Object.fromEntries(slots.map((id) => [id, `${PACKAGE.slots.find((s) => s.slotId === id)!.widthIn} ${PACKAGE.defaultSelection[id]}`])),
    ).toEqual({
      "slot-freezer": "18 thermador-t18if900sp",
      "slot-fridge": "24 thermador-t24ir905sp",
      "slot-wine": "18 thermador-t18iw905sp",
      "slot-oven": "30 thermador-mem301ws",
    });
  });

  it("hangs its oven from where the microwave's handle lands, as a combination oven is hung", () => {
    oneWall("D", { microwaveHandleIn: 50 });
    const at = SLOT_PLACEMENT["slot-oven"]!.position[1] * 12;
    oneWall("D", { microwaveHandleIn: 56 });
    expect(SLOT_PLACEMENT["slot-oven"]!.position[1] * 12 - at).toBeCloseTo(6, 6);
  });

  it("calls its oven a combination oven", () => {
    oneWall("D");
    expect(SLOT_BY_ID["slot-oven"].labelKey).toBe("slot.comboOven");
  });

  it("leaves the L's package D as it was written", () => {
    oneWall("D");
    resetRoom();
    setActivePackage(idOf("D"));
    expect(PACKAGE).toBe(PACKAGE_BY_ID[idOf("D")]);
  });
});

describe("package E on one wall (Leo, round 98, second batch 13; round 98b)", () => {
  it("stands its cooktop on the run, over a cabinet with a door", () => {
    oneWall("E");
    const cooktop = RUNS[0].segments.find((s) => s.slot === "slot-cooktop")!;
    expect(cooktop.modules.map((m) => `${m.code} ${m.kind}`)).toEqual(["B36 base"]);
  });

  it("opens with the 36-inch chimney hood HMCB36WS, centred over the cooktop", () => {
    oneWall("E");
    const off = Math.abs(SLOT_PLACEMENT["slot-hood"]!.position[0] - SLOT_PLACEMENT["slot-cooktop"]!.position[0]);
    expect({ hood: PACKAGE.defaultSelection["slot-hood"], mount: SLOT_BY_ID["slot-hood"].mount, off }).toEqual({
      hood: "thermador-hmcb36ws",
      mount: "wall",
      off: 0,
    });
  });

  it("stands its oven tower 18 inches of counter from the cooktop, on the refrigerator's side", () => {
    oneWall("E");
    const segments = RUNS[0].segments;
    const oven = segments.findIndex((s) => s.slot === "slot-microwave");
    const cooktop = segments.findIndex((s) => s.slot === "slot-cooktop");
    const between = segments.slice(oven + 1, cooktop).reduce((sum, s) => sum + (s.to - s.from) * 12, 0);
    expect({ ovenFirst: oven < cooktop, between }).toEqual({ ovenFirst: true, between: 18 });
  });

  it("stands its freezer to the left of its refrigerator, as it is in the L", () => {
    oneWall("E");
    const x = (slot: SlotId) => SLOT_PLACEMENT[slot]!.position[0];
    expect(x("slot-freezer") < x("slot-fridge")).toBe(true);
  });
});

describe("the walls one wall takes", () => {
  it("refuses a back wall over its own top, and the L keeps its 240", () => {
    resetRoom();
    const over = (shape: LayoutParams["shape"], backWallIn: number) => {
      const result = generateLayout({ ...DEFAULT_PARAMS, shape, backWallIn });
      return result.ok ? "builds" : result.reasons[0].key;
    };
    expect({
      oneWall: over("one-wall", ONE_WALL_MAX_IN + 6),
      lAt246: over("L", 246),
    }).toEqual({ oneWall: "refusal.outOfRange", lAt246: "refusal.outOfRange" });
  });

  it("builds a wall dragged short of the drawer and the wine cabinet without them, and says so (D18)", () => {
    oneWall("A");
    const short = setLayoutParams({ ...LAYOUT_PARAMS, backWallIn: 200 });
    expect({ ok: short.ok, omitted: OMITTED_FOR_WALL }).toEqual({ ok: true, omitted: ["slot-microwave", "slot-wine"] });
  });

  it("leaves every package's L as it was written: one wall changes only D's and E's", () => {
    const changed = PACKAGES.filter((entry) => packageInShape(entry, "one-wall") !== entry).map((entry) => entry.code);
    expect({ changed, lUnchanged: PACKAGES.every((entry) => packageInShape(entry, "L") === entry) }).toEqual({
      changed: ["D", "E"],
      lUnchanged: true,
    });
  });
});
