import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { fitCheck } from "./fit";
import { setActivePackage } from "./layoutState";
import { checkLayout } from "./layoutRules";
import { PACKAGE_BY_ID } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import type { Appliance, SlotId } from "../types";

/**
 * Package E as configured in round 69, held to D20. One assertion each.
 *
 * Which way round its column bank stands is `islandCookingRuns.test.ts`; its
 * overhang line and hood label, `overhang.test.ts`; rule 4 over its island,
 * `islandRule4.test.ts`; the heights over its cooktop,
 * `islandDimensions.test.ts`.
 */
const E = PACKAGE_BY_ID["package-e"];

beforeEach(() => {
  resetRoom();
  const result = setActivePackage("package-e");
  if (!result.ok) throw new Error(`E will not build: ${JSON.stringify(result.reasons)}`);
});
afterAll(() => resetRoom());

describe("package E, configured", () => {
  it("opens at 180 by 168: 180 for a lazy susan's slack, 168 as D20 set it", () => {
    expect([REQUESTED_PARAMS.backWallIn, REQUESTED_PARAMS.leftWallIn]).toEqual([180, 168]);
  });

  it("builds its own room passing every rule", () => {
    expect(checkLayout().map((v) => `${v.code}: ${v.message}`)).toEqual([]);
  });

  it("has an 18-inch freezer column, not package D's 24", () => {
    expect(SLOT_BY_ID["slot-freezer"].cutout.w).toBe(18);
  });

  it("stands its two columns as one bank of 50-1/8 inches: board, 18, kit, 30, board", () => {
    const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-fridge"))!;
    const at = (slot: string) => run.segments.findIndex((s) => s.slot === slot);
    const [first, last] = [Math.min(at("slot-freezer"), at("slot-fridge")), Math.max(at("slot-freezer"), at("slot-fridge"))];
    // The bank runs from the board before its first column to the board after
    // its last: every tall segment either side of the two, contiguously.
    let from = first;
    while (from > 0 && run.segments[from - 1].kind === "tall") from -= 1;
    let to = last;
    while (to < run.segments.length - 1 && run.segments[to + 1].kind === "tall") to += 1;
    const widthIn = run.segments.slice(from, to + 1).reduce((sum, s) => sum + (s.to - s.from) * 12, 0);
    expect(Math.round(widthIn * 1000) / 1000).toBe(50.125);
  });

  it("takes no separate blower: HMIB42WS carries its own", () => {
    expect(E.defaultBlower).toBeNull();
  });

  it("hangs its hood over the island with the underside at 72 inches", () => {
    expect(Math.round(SLOT_BY_ID["slot-hood"].position[1] * 12 * 1000) / 1000).toBe(72);
  });

  it("puts the cooktop in the island", () => {
    expect(SLOT_BY_ID["slot-cooktop"].mount).toBe("island");
  });

  it("stands the combination oven and the coffee cabinet each on its own on the back leg", () => {
    const back = RUNS.find((r) => r.id === "back")!;
    const on = ["slot-microwave", "slot-coffee"].filter((slot) => back.segments.some((s) => s.slot === slot));
    expect(on).toEqual(["slot-microwave", "slot-coffee"]);
  });
});

/**
 * Round 69, found in the screenshots before E went live: the install
 * checklist said "3" deeper than the opening; enclosure must be furred out"
 * under E's island hood. A hood hung from the ceiling has no opening, no
 * cabinet face and no enclosure: there is nothing for it to stand proud of.
 */
describe("package E's hood, hung from the ceiling", () => {
  it("is not measured against an opening it does not have", () => {
    const hood = APPLIANCE_BY_ID[E.defaultSelection["slot-hood"] as string];
    expect(fitCheck(SLOT_BY_ID["slot-hood"], hood).depthOverIn).toBeNull();
  });

  it("puts no furring line on the list", () => {
    const selection = Object.fromEntries(
      Object.entries(E.defaultSelection).map(([slot, id]) => [slot, APPLIANCE_BY_ID[id as string]]),
    ) as Record<SlotId, Appliance>;
    const lines = checklistFor(selection, null).findings.filter(
      (f) => f.slot === "slot-hood" && f.ruleId === "deeper-than-opening",
    );
    expect(lines).toEqual([]);
  });
});
