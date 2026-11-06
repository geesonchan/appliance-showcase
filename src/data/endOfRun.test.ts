import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { counterOutline } from "./counter";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import { oneWallWantedIn, wallRequirement, type LayoutParams } from "./layoutTemplate";
import { PACKAGE_BY_ID } from "./packages";
import { LAYOUT_PARAMS, REQUESTED_PARAMS, RUNS } from "./room";
import { resetRoom } from "./testRoom";
import { translate } from "../i18n";

/**
 * The end of a run (Leo, 2026-11-05; docs/plans/end-strip-open-end-plan.md
 * and his four answers).
 *
 * A tall unit at a run's end against a wall has its 3" to the wall as one
 * filler floor to top, in the door colour, with no stone over it (his site
 * practice, 甲) — where it was a base filler, a band of stone and a panel
 * over it. The open end is a 3/4" base end panel (BEP) to under the
 * countertop, the stone 1" past it, and a 3/4" wall cabinet end panel (WEP)
 * at the wall cabinets' end (A-9 to A-15): where it was a 3" panel floor to
 * 96" with the stone and the wall cabinets running over it.
 */

afterAll(() => resetRoom());

const lastOf = <T,>(list: T[]): T | undefined => list[list.length - 1];
const inches = (feet: number) => Math.round(feet * 12 * 1000) / 1000;

/** A package's room in the L or on one wall, from its own room, as the page builds it. */
function room(pkg: string, patch: Partial<LayoutParams> = {}, shape: "L" | "one-wall" = "L") {
  resetRoom();
  expect(setActivePackage(pkg).ok).toBe(true);
  const asked: LayoutParams = { ...REQUESTED_PARAMS, ...patch, shape };
  if (shape === "one-wall") asked.backWallIn = Math.max(asked.backWallIn, oneWallWantedIn(asked, PACKAGE_BY_ID[pkg]));
  const result = Object.keys(patch).length === 0 && shape === "L" ? { ok: true, reasons: [] } : setLayoutParamsGrowing(asked);
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
  return { back: LAYOUT_PARAMS.backWallIn, left: LAYOUT_PARAMS.leftWallIn };
}

/** Floor and top of a box, in inches. */
const band = (box: { position: number[]; size: number[] }) => [inches(box.position[1] - box.size[1] / 2), inches(box.position[1] + box.size[1] / 2)];

/** How far along its run a box reaches, in feet, low and high. */
const alongOf = (run: (typeof RUNS)[number], box: { position: number[]; size: number[] }) => {
  const i = run.axis === "x" ? 0 : 2;
  return [box.position[i] - box.size[i] / 2, box.position[i] + box.size[i] / 2] as const;
};

/** How far the stone on a run reaches along it, in feet. */
function stoneAlong(runId: "left" | "back") {
  const run = RUNS.find((r) => r.id === runId)!;
  const i = run.axis === "x" ? 0 : 1;
  const xs = counterOutline(RUNS).pieces.flatMap((piece) => piece.outline.map((point) => point[i]));
  return [Math.min(...xs), Math.max(...xs)];
}

describe("a tall unit at a run's end against a wall: 3 inches of filler floor to top, no stone (甲)", () => {
  // B with its tower right of the range at the back wall's end and its
  // refrigerator's end at a wall; D as it opens. Two towers, two corners'
  // walls, so no two are the same.
  const cases: [string, string, Partial<LayoutParams>, { back: number; left: number }][] = [
    ["B, a blind corner, its refrigerator's end at a wall", "package-b", { cornerType: "blind", towerSide: "right", fridgeEnd: "left", sinkLeg: "back", coffeeLeg: "left", fridgeEndAbuts: "wall" }, { back: 196.5, left: 144 }],
    ["D as it opens", "package-d", {}, { back: 224.25, left: 178.75 }],
  ];
  for (const [name, pkg, patch, walls] of cases) {
    it(`stands the 3 inches beside its tower as one tall filler, with no stone and nothing over it, its walls as they were: ${name}`, () => {
      const built = room(pkg, patch);
      const back = RUNS.find((run) => run.id === "back")!;
      const end = back.segments[back.segments.length - 1];
      const before = back.segments[back.segments.length - 2];
      const boxes = CABINETS.filter((box) => box.id.startsWith(`${end.id}-`));
      const [lo, hi] = [end.from, end.to];
      const stone = stoneAlong("back");
      expect({
        walls: built,
        beside: before.kind,
        end: { kind: end.kind, widthIn: inches(end.to - end.from), modules: end.modules.map((m) => m.code) },
        // Its word on the bill under the back wall's slider, as it was.
        word: lastOf(wallRequirement(LAYOUT_PARAMS, "back").items)?.labelKey,
        boxes: boxes.map((box) => ({ id: box.id.replace(`${end.id}-`, ""), kind: box.kind, band: band(box), strip: box.face === "strip" })),
        stoneOverIt: stone[1] > lo + 1e-6 && stone[0] < hi - 1e-6 && stone[1] > hi - 1e-6,
      }).toEqual({
        walls,
        beside: "tall",
        end: { kind: "tall", widthIn: 3, modules: ["BF3"] },
        word: "requirement.wall-end",
        boxes: [
          { id: "BF3-0", kind: "surround", band: [0, 96], strip: true },
          { id: "BF3-0-stack", kind: "surround", band: [96, 108], strip: true },
        ],
        stoneOverIt: false,
      });
    });
  }
});

describe("the open end: a 3/4-inch end panel to under the top, the stone 1 inch past it, a 3/4-inch wall cabinet end panel (A-9 to A-15)", () => {
  /** The open end of a run: its panel, the box drawn for it, the stone past it and the wall cabinets' last piece. */
  function openEnd(runId: "left" | "back") {
    const run = RUNS.find((r) => r.id === runId)!;
    const panel = run.segments[run.segments.length - 1];
    const boxes = CABINETS.filter((box) => box.id.startsWith(`${panel.id}-`) && box.kind === "surround");
    const lastBank = run.uppers[run.uppers.length - 1];
    const lastUpper = lastBank.modules[lastBank.modules.length - 1];
    const stone = stoneAlong(runId);
    const upperBox = CABINETS.find((box) => box.id === `${lastBank.id}-${lastUpper.code}-${lastBank.modules.length - 1}`);
    return {
      ends: run.ends[1],
      panel: { id: panel.id.replace(`${runId}-`, ""), widthIn: inches(panel.to - panel.from), modules: panel.modules.map((m) => m.code) },
      // Its word and width on the bill under that wall's slider.
      bill: (({ widthIn, labelKey }) => ({ widthIn, labelKey }))(lastOf(wallRequirement(LAYOUT_PARAMS, runId).items)!),
      drawn: boxes.map((box) => ({ band: band(box), strip: box.face === "strip" })),
      stonePastIn: inches(stone[1] - panel.to),
      wallCabinetEnd: { code: lastUpper.code, labelKey: (lastUpper as { labelKey?: string }).labelKey, toRunEnd: Math.abs(lastBank.to - panel.to) < 1e-9, strip: upperBox?.face === "strip", alongIn: upperBox ? inches(alongOf(run, upperBox)[1] - alongOf(run, upperBox)[0]) : null },
    };
  }
  const expected = (runId: string) => ({
    ends: "open",
    panel: { id: `${runId}-end-panel`, widthIn: 0.75, modules: ["BEP0.75"] },
    bill: { widthIn: 0.75, labelKey: "requirement.endPanel" },
    drawn: [{ band: [0, 34.5], strip: true }],
    stonePastIn: 1,
    wallCabinetEnd: { code: "WEP0.75", labelKey: "requirement.wallEndPanel", toRunEnd: true, strip: true, alongIn: 0.75 },
    runId,
  });

  it("finishes A's left leg so, its refrigerator on the back leg, its walls as they were", () => {
    const walls = room("package-a", { fridgeEnd: "back", sinkLeg: "left" });
    expect({ walls, ...openEnd("left"), runId: "left" }).toEqual({ walls: { back: 168, left: 144 }, ...expected("left") });
  });

  it("finishes C's one wall so, the wall it opens at 2-1/4 inches shorter: 230 inches", () => {
    const walls = room("package-c", {}, "one-wall");
    expect({ walls, ...openEnd("back"), runId: "back" }).toEqual({ walls: { back: 230, left: 144 }, ...expected("back") });
  });

  it("opens every package on one wall 2-1/4 inches shorter (Leo's answer 2)", () => {
    const walls = Object.fromEntries(["package-a", "package-b", "package-c", "package-d", "package-e"].map((pkg) => [pkg, room(pkg, {}, "one-wall").back]));
    expect(walls).toEqual({ "package-a": 233.75, "package-b": 239, "package-c": 230, "package-d": 245.75, "package-e": 270.75 });
  });

  it("grows E's left wall 2-1/4 inches less where its open end grew it (Leo's answer 3): 179-1/4 inches, a blind corner", () => {
    const walls = room("package-e", { sinkLeg: "left", fridgeEnd: "back", coffeeLeg: "left", towerSide: "left", cornerType: "blind", fridgeEndAbuts: "cabinet" });
    expect(walls).toEqual({ back: 180, left: 179.25 });
  });
});

describe("the words for the two end panels (Leo's answers 1 and 4)", () => {
  it("names them in his words", () => {
    expect({
      endPanel: [translate("en", "requirement.endPanel"), translate("zh", "requirement.endPanel")],
      wallEndPanel: [translate("en", "requirement.wallEndPanel"), translate("zh", "requirement.wallEndPanel")],
      wallEnd: [translate("en", "requirement.wall-end"), translate("zh", "requirement.wall-end")],
    }).toEqual({
      endPanel: ["end panel", "侧板"],
      wallEndPanel: ["wall cabinet end panel", "吊柜侧板"],
      wallEnd: ["filler against the wall", "靠墙填充板"],
    });
  });
});
