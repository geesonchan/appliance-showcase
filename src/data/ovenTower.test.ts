import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { CABINETS, type CabinetBox } from "./cabinets";
import { candidatesFor } from "./candidates";
import { setActivePackage, setLayoutParams, setLayoutParamsGrowing } from "./layoutState";
import { DEFAULT_PARAMS, type LayoutParams } from "./layoutTemplate";
import { standardInstall } from "./ovenTrim";
import { PACKAGES, PACKAGE_BY_ID, PACKAGE_SLOTS, slotsOf } from "./packages";
import { REQUESTED_PARAMS, ROOM, RUNS, type CabinetRun, type RunSegment } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import { towerVents } from "./towerVent";
import type { SlotId } from "../types";

/**
 * Round 92c, Leo.
 *
 * Every oven tower is a standard install, his site practice in his words:
 * "如果是 standard 安装，整个 tower 的总宽度连侧板就是 30"" — the tower 30"
 * overall, its two 3/4" sides inside it, the oven's standard 28-1/2" cutout
 * between them (MEM301WS, PODS302B, ME301YP and PO302W, each its own sheet's
 * pp. 1-3). Asked of one place, `ovenTower.ts`; until round 92c the importer's
 * note, `standardInstall` and the run each said their own (D17's table).
 *
 * And what stands beside the tower on the side away from the cooking surface:
 * a strip narrower than the narrowest cabinet is finished panel to the top;
 * 9" or more is counter with the bank's wall cabinets over it, 12" deep from
 * 54" (`filledBesideTower`). The figures below are written out by hand.
 */

afterAll(() => resetRoom());

const inch = (feet: number) => Math.round(feet * 12 * 16) / 16;
const alongOf = (run: CabinetRun, box: CabinetBox) => {
  const a = run.axis === "x" ? 0 : 2;
  return [inch(box.position[a] - box.size[a] / 2), inch(box.position[a] + box.size[a] / 2)] as const;
};
const span = (box: CabinetBox) => [inch(box.position[1] - box.size[1] / 2), inch(box.position[1] + box.size[1] / 2)];

type Arrangement = Partial<Pick<LayoutParams, "sinkLeg" | "fridgeEnd" | "coffeeLeg" | "towerSide" | "cornerType">>;
const ARRANGEMENTS: [string, Arrangement][] = [["as it opens", {}]];
for (const towerSide of ["left", "right"] as const)
  for (const sinkLeg of ["back", "left"] as const)
    for (const fridgeEnd of ["left", "back"] as const)
      for (const coffeeLeg of ["left", "back"] as const)
        for (const cornerType of ["blind", "lazy-susan"] as const)
          ARRANGEMENTS.push([
            `tower ${towerSide}, sink ${sinkLeg}, refrigerator ${fridgeEnd}, coffee ${coffeeLeg}, ${cornerType}`,
            { towerSide, sinkLeg, fridgeEnd, coffeeLeg, cornerType },
          ]);

function build(id: string, arrangement: Arrangement): boolean {
  resetRoom();
  if (!setActivePackage(id).ok) return false;
  if (Object.keys(arrangement).length === 0) return true;
  return setLayoutParamsGrowing({ ...REQUESTED_PARAMS, ...arrangement }).ok;
}

/** Every oven tower in the room as built: its run, its segment, its slot. */
function ovenTowers() {
  return RUNS.flatMap((run) =>
    run.segments
      .filter((segment) => segment.kind === "tall" && segment.slot && PACKAGE_SLOTS[segment.slot]?.category === "wall-oven")
      .map((segment) => ({ run, segment, slot: segment.slot as SlotId })),
  );
}

const TOWER_PACKAGES = ["package-b", "package-d", "package-e"];

describe("an oven tower is a standard install, every package and arrangement", () => {
  it.each(TOWER_PACKAGES)("is 30\" overall with its 3/4\" sides inside, round a 28-1/2\" opening (%s)", (id) => {
    let towers = 0;
    const wrong = new Set<string>();
    for (const [name, arrangement] of ARRANGEMENTS) {
      if (!build(id, arrangement)) continue;
      for (const { segment, slot } of ovenTowers()) {
        towers += 1;
        const module = segment.modules.find((m) => m.kind === "tall")!;
        const got = [inch(segment.to - segment.from), module.insetIn, SLOT_BY_ID[slot].cutout.w];
        if (JSON.stringify(got) !== JSON.stringify([30, 0.75, 28.5])) wrong.add(`${name}: ${JSON.stringify(got)}`);
      }
    }
    expect({ towers: towers > 0, wrong: [...wrong] }).toEqual({ towers: true, wrong: [] });
  });

  it.each(TOWER_PACKAGES)("stands no board of the run against it, either side (%s)", (id) => {
    let towers = 0;
    const wrong = new Set<string>();
    for (const [name, arrangement] of ARRANGEMENTS) {
      if (!build(id, arrangement)) continue;
      for (const { run, segment } of ovenTowers()) {
        towers += 1;
        const at = run.segments.indexOf(segment);
        for (const step of [-1, 1]) {
          const neighbour = run.segments[at + step];
          const board = neighbour?.kind === "tall" && neighbour.modules.every((m) => m.kind === "panel");
          // A board whose other side is another tower is that tower's own end —
          // E's coffee tower stands hard against its oven tower, and keeps its
          // 3/4" board each end (Leo, round 92c: the coffee towers unchanged).
          const beyond = run.segments[at + step * 2];
          const anothers = beyond?.kind === "tall" && !!beyond.slot;
          if (board && !anothers) wrong.add(`${name}: ${neighbour!.id}`);
        }
      }
    }
    expect({ towers: towers > 0, wrong: [...wrong] }).toEqual({ towers: true, wrong: [] });
  });

  it.each(TOWER_PACKAGES)("draws the same side each side of it, 3/4\" on the toe kick to 96\" (%s)", (id) => {
    build(id, {});
    const sides = ovenTowers().map(({ run, segment }) =>
      CABINETS.filter((box) => box.id === `${segment.id}-panel-a` || box.id === `${segment.id}-panel-b`).map((box) => {
        const [from, to] = alongOf(run, box);
        return [to - from, ...span(box)];
      }),
    );
    expect(sides).toEqual([[[0.75, 4, 96], [0.75, 4, 96]]]);
  });

  it("gives the oven's trim the same side the tower is built with", () => {
    build("package-b", {});
    const install = standardInstall(SLOT_BY_ID["slot-microwave"], APPLIANCE_BY_ID["thermador-mem301ws"])!;
    expect([install.cutoutWidthIn, install.sideIn]).toEqual([28.5, 0.75]);
  });

  it("cuts the vent in the top of a hung oven's opening 27\" x 3\", 3/4\" in from each side (round 32's rule)", () => {
    const widths: Record<string, number[]> = {};
    for (const id of TOWER_PACKAGES) {
      build(id, {});
      const pkg = PACKAGE_BY_ID[id];
      const selection = Object.fromEntries(
        Object.entries(pkg.defaultSelection).map(([slot, model]) => [slot, APPLIANCE_BY_ID[model!]]),
      );
      widths[id] = towerVents(selection)
        .filter((vent) => PACKAGE_SLOTS[vent.slot]?.category === "wall-oven")
        .map((vent) => vent.widthIn);
    }
    expect(widths).toEqual({ "package-b": [27], "package-d": [27], "package-e": [27] });
  });

  it("leaves the coffee towers as they were: a 3/4\" board outside each end", () => {
    const ends: string[] = [];
    for (const id of ["package-d", "package-e"]) {
      build(id, {});
      for (const run of RUNS) {
        const at = run.segments.findIndex((segment) => segment.slot === "slot-coffee");
        if (at < 0) continue;
        const coffee = run.segments[at];
        ends.push(
          `${id} ${inch(coffee.to - coffee.from)} ${[run.segments[at - 1], run.segments[at + 1]].map((s) => inch(s.to - s.from)).join(" ")}`,
        );
      }
    }
    expect(ends).toEqual(["package-d 24 0.75 0.75", "package-e 24 0.75 0.75"]);
  });

  it("takes every oven the towers offer on width: each one's standard cutout is 28-1/2\"", () => {
    const cutouts: Record<string, number | null> = {};
    const tooWide: string[] = [];
    let offered = 0;
    for (const id of TOWER_PACKAGES) {
      build(id, {});
      const pkg = PACKAGE_BY_ID[id];
      const slotId = Object.values(slotsOf(pkg)).find((slot) => slot.category === "wall-oven")!.slotId;
      for (const { appliance, fit } of candidatesFor(slotId, pkg)) {
        if (appliance.category !== "wall-oven") continue;
        offered += 1;
        cutouts[appliance.model] = appliance.cutoutWidthIn;
        if (!fit.widthFits) tooWide.push(`${id} ${appliance.model} +${fit.widthOverIn}`);
      }
    }
    expect({ offered: offered > 0, cutouts, tooWide }).toEqual({
      offered: true,
      cutouts: { ME301YP: 28.5, MEM301WS: 28.5, PO302W: 28.5, PODS302B: 28.5 },
      tooWide: [],
    });
  });

  it("refuses loudly an oven tower that does not say how it is installed", async () => {
    // Imported here, so the rest of the file runs on code that has no such module.
    const { ovenTowerOf } = await import("./ovenTower");
    const slot = { ...slotsOf(PACKAGE_BY_ID["package-b"])["slot-microwave"], towerInstall: null };
    expect(() => ovenTowerOf(PACKAGE_BY_ID["package-b"], slot)).toThrow(/how it is installed/);
  });

  it("asks one place: the run builds no separate board beside the tower, and the trim works out no side of its own", () => {
    const template = readFileSync(new URL("./layoutTemplate.ts", import.meta.url), "utf8");
    const trim = readFileSync(new URL("./ovenTrim.ts", import.meta.url), "utf8");
    expect({
      towerPanel: template.includes('fixed("tower-panel"'),
      trimSide: trim.includes("slot.cutout.w - cutoutWidthIn"),
    }).toEqual({ towerPanel: false, trimSide: false });
  });
});

/** Whether anything stands on the counter over a stretch, rather than hanging from 54". */
const standingOn = (run: CabinetRun, segment: RunSegment) =>
  CABINETS.filter((box) => {
    if (box.run !== run.id || box.kind === "counter" || box.kind === "toe") return false;
    const [from, to] = alongOf(run, box);
    const [low, high] = span(box);
    const counter = inch(ROOM.counterHeight);
    return from < inch(segment.to) - 1e-6 && to > inch(segment.from) + 1e-6 && low <= counter && high > counter;
  });

describe("what stands beside an oven tower on the side away from the cooking surface", () => {
  it.each(["package-b", "package-d"])("is counter with wall cabinets over it at 9\" and more, a board to the top under (%s)", (id) => {
    const stretches = { counter: 0, board: 0 };
    const wrong = new Set<string>();
    for (const [name, arrangement] of ARRANGEMENTS) {
      if (!build(id, arrangement)) continue;
      for (const { run, segment } of ovenTowers()) {
        const at = run.segments.indexOf(segment);
        const rangeAt = run.segments.findIndex((s) => s.slot === "slot-range");
        const far = run.segments[rangeAt < at ? at + 1 : at - 1];
        if (!far || far.kind !== "counter") continue;
        const widthIn = inch(far.to - far.from);
        const standing = standingOn(run, far);
        if (widthIn >= 9) {
          stretches.counter += 1;
          if (standing.length > 0) wrong.add(`${name}: ${far.id} ${widthIn}" has ${standing.map((b) => b.id).join(", ")} on it`);
          const over = CABINETS.filter((box) => {
            if (box.run !== run.id || box.kind !== "upper" || box.id.endsWith("-stack") || /-crown-/.test(box.id)) return false;
            const [from, to] = alongOf(run, box);
            return from < inch(far.to) - 1e-6 && to > inch(far.from) + 1e-6;
          });
          const walls = over.map((box) => {
            const extents = run.axis === "x" ? box.size[2] : box.size[0];
            return `${inch(extents)} deep from ${span(box)[0]}`;
          });
          if (walls.length === 0 || walls.some((w) => w !== "12 deep from 54")) wrong.add(`${name}: over ${far.id}: ${walls.join("; ") || "nothing"}`);
        } else {
          stretches.board += 1;
          const tops = standing.map((box) => span(box)[1]);
          if (!tops.includes(96)) wrong.add(`${name}: ${far.id} ${widthIn}" is not a board to the top`);
        }
      }
    }
    expect({ counted: stretches.counter > 0, wrong: [...wrong] }).toEqual({ counted: true, wrong: [] });
  });

  it("still finishes D's 3\" filler past the tower as a board to the top", () => {
    build("package-d", {});
    const back = RUNS.find((run) => run.id === "back")!;
    const end = back.segments.find((segment) => segment.id === "back-back-end")!;
    expect([inch(end.to - end.from), standingOn(back, end).map((box) => span(box)[1])]).toEqual([3, [96]]);
  });

  it("is judged in one place", () => {
    const cabinets = readFileSync(new URL("./cabinets.ts", import.meta.url), "utf8");
    const template = readFileSync(new URL("./layoutTemplate.ts", import.meta.url), "utf8");
    expect({
      inCabinets: (cabinets.match(/Math\.sign\(rangeAt/g) ?? []).length,
      inTemplate: (template.match(/Math\.sign\(rangeAt/g) ?? []).length,
    }).toEqual({ inCabinets: 0, inTemplate: 1 });
  });
});

describe("after these, the default room", () => {
  it("puts the room back", () => {
    resetRoom();
    expect(setLayoutParams(DEFAULT_PARAMS).ok).toBe(true);
    expect(PACKAGES.length).toBeGreaterThan(0);
  });
});
