import { afterAll, describe, expect, it } from "vitest";
import { applianceBox, doorOverhang } from "./applianceBox";
import { CABINETS } from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { STEAM_OVEN, WINE_COLUMN, steamOvenSillIn, wineColumnParts } from "./columnModel";
import { doorSplitOf, fridgeParts } from "./fridgeModel";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams } from "./layoutState";
import {
  DEFAULT_PARAMS,
  columnsAlongRun,
  generateLayout,
  type LayoutParams,
} from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE, PACKAGE_BY_ID, SLOT_ORDER } from "./packages";
import {
  LAYOUT_LIMITS,
  RUNS,
  fridgeReturnWall,
  fridgeWallClearance,
  trimKitsBeside,
  type CabinetRun,
  type RunSegment,
} from "./room";
import { CABINET_STANDARDS, ROOM } from "./roomShell";
import { resolveRoughIn } from "./roughIn";
import { SLOT_BY_ID } from "./slots";
import { deriveUtilities } from "./utilities";
import type { SlotId } from "../types";

/**
 * Package D, as Leo specified it in round 30.
 *
 * Three refrigeration columns standing together at the end of one leg, a steam
 * oven beside the rangetop, and a coffee cabinet with a second dishwasher in the
 * bottom of it. The sweep over every parameter is in `packageLayouts.test.ts`
 * and covers D with the rest; these are the facts about D that sweep does not
 * look at.
 */
const inches = (feet: number) => feet * 12;
const D = PACKAGE_BY_ID["package-d"];
const model = (slotId: SlotId) => APPLIANCE_BY_ID[D.defaultSelection[slotId]!];
const COLUMNS = ["slot-freezer", "slot-fridge", "slot-wine"] as const;

afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

/** Package D, chosen from the default room, and the room it landed in. */
function activateD(): LayoutParams {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage("package-d");
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
  return { ...DEFAULT_PARAMS, ...D.defaultLayout, ...(result.adjusted ?? {}) };
}

const runOf = (slotId: SlotId) => RUNS.find((run) => run.segments.some((s) => s.slot === slotId))!;
const segmentOf = (slotId: SlotId) => runOf(slotId).segments.find((s) => s.slot === slotId)!;
const mid = (segment: RunSegment) => (segment.from + segment.to) / 2;
const widthIn = (segment: RunSegment) => inches(segment.to - segment.from);

/**
 * How far to the right a segment is, for somebody facing its wall.
 *
 * The back wall is faced looking toward -z, with +x on the right; the left
 * wall is faced looking toward -x, with -z on the right.
 */
const rightward = (run: CabinetRun, segment: RunSegment) =>
  run.axis === "x" ? mid(segment) : -mid(segment);

/** Whether a box stands over a stretch of its run, along the run. */
const overlapsAlong = (
  run: CabinetRun,
  box: (typeof CABINETS)[number],
  span: readonly [number, number],
) => {
  const along = run.axis === "x" ? 0 : 2;
  const low = box.position[along] - box.size[along] / 2;
  const high = box.position[along] + box.size[along] / 2;
  return Math.min(high, span[1]) - Math.max(low, span[0]) > 1e-6;
};

describe("package D · the column group", () => {
  it("stands freezer, refrigerator, wine left to right as you face them, on either wall", () => {
    // The order along the run, from the corner outward, for each wall.
    expect(columnsAlongRun(D, "back")).toEqual(["slot-freezer", "slot-fridge", "slot-wine"]);
    expect(columnsAlongRun(D, "left")).toEqual(["slot-wine", "slot-fridge", "slot-freezer"]);

    // And in the room itself, measured the way somebody standing there sees it.
    activateD();
    const run = runOf("slot-fridge");
    expect(run.id).toBe("left");
    const byEye = [...COLUMNS].sort(
      (a, b) => rightward(run, segmentOf(a)) - rightward(run, segmentOf(b)),
    );
    expect(byEye).toEqual([...COLUMNS]);
  });

  it("lists them in the same order on the back wall, where the room is refused for length", () => {
    // Columns, rangetop and steam oven on one wall is more than a leg can
    // carry: the bill says so, and reads freezer, refrigerator, wine.
    const base = activateD();
    const result = generateLayout(
      { ...base, fridgeEnd: "back", sinkLeg: "left", backWallIn: 204 },
      D,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const short = result.reasons.find(
      (reason) => reason.key === "refusal.wallShort" && reason.vars.paramKey === "param.backWallIn",
    )!;
    expect(short, JSON.stringify(result.reasons)).toBeTruthy();
    const order = short.occupancy!
      .map((item) => item.labelKey)
      .filter((key) => ["requirement.freezer", "requirement.fridge", "requirement.wine"].includes(key));
    expect(order).toEqual(["requirement.freezer", "requirement.fridge", "requirement.wine"]);
  });

  it("keeps them together with nothing but the kits between, 80-3/4 inches overall", () => {
    activateD();
    const run = runOf("slot-fridge");
    const first = run.segments.findIndex(
      (segment, i) =>
        segment.kind === "tall" && run.segments.slice(i).every((later) => later.kind === "tall"),
    );
    const group = run.segments.slice(first);

    // Board, column, kit, column, kit, column, board — in one tall unit.
    expect(group.map((segment) => segment.slot ?? segment.modules[0].kind)).toEqual([
      "panel",
      "slot-wine",
      "spacer",
      "slot-fridge",
      "spacer",
      "slot-freezer",
      "panel",
    ]);
    for (const segment of group) expect(segment.kind, segment.id).toBe("tall");
    for (const board of [group[0], group[group.length - 1]]) {
      expect(widthIn(board), board.id).toBeCloseTo(0.75, 9);
    }
    for (const kit of [group[2], group[4]]) {
      expect(kit.modules[0].code).toBe("COMBIKIT10");
      expect(widthIn(kit)).toBeCloseTo(0.625, 9);
    }
    expect(inches(group[group.length - 1].to - group[0].from)).toBeCloseTo(80.75, 9);

    // Every cutout 84" high and 25" deep.
    for (const slotId of COLUMNS) {
      expect(SLOT_BY_ID[slotId].cutout.h, slotId).toBe(84);
      expect(SLOT_BY_ID[slotId].cutout.d, slotId).toBe(25);
    }
    expect(checkLayout()).toEqual([]);
  });

  it("hides both kits behind the doors, with an eighth of an inch between each pair of fronts", () => {
    activateD();
    const run = runOf("slot-fridge");
    const kits = CABINETS.filter((box) => box.module?.kind === "spacer");
    expect(kits.length).toBe(2);

    for (const kit of kits) {
      expect(kit.installOnly, `${kit.id} is drawn in the finished room`).toBe(true);
      const span = [
        kit.position[2] - kit.size[2] / 2,
        kit.position[2] + kit.size[2] / 2,
      ] as const;
      // No joinery in the gap between two machines, whatever the render mode.
      const standing = CABINETS.filter(
        (box) =>
          box !== kit &&
          box.run === run.id &&
          !box.installOnly &&
          box.kind !== "toe" &&
          box.kind !== "counter" &&
          overlapsAlong(run, box, span),
      );
      expect(standing.map((box) => box.id), "cabinetry between the columns").toEqual([]);
    }

    // The middle column is joined on both sides and its door covers both kits.
    expect(trimKitsBeside("slot-fridge").length).toBe(2);
    expect(trimKitsBeside("slot-freezer").length).toBe(1);
    expect(trimKitsBeside("slot-wine").length).toBe(1);

    /** How far a machine's door reaches past its own opening toward a kit. */
    const reach = (slotId: SlotId, side: -1 | 1) => {
      const slot = SLOT_BY_ID[slotId];
      const machine = applianceBox(slot, model(slotId));
      const kit = trimKitsBeside(slotId).find((k) => k.side === side)!;
      expect(kit, `${slotId} has no kit on side ${side}`).toBeTruthy();
      return doorOverhang(slot, machine.w, kit)!.overIn - (slot.cutout.w - inches(machine.w)) / 2;
    };
    for (const [a, b] of [
      ["slot-wine", "slot-fridge"],
      ["slot-fridge", "slot-freezer"],
    ] as const) {
      const kitIn = 0.625;
      // The kit on the side facing the other machine, in the machine's own
      // frame: further along a run on x is its right, and on z its left.
      const sideOf = (slotId: SlotId, toward: SlotId) => {
        const further = mid(segmentOf(toward)) > mid(segmentOf(slotId));
        const side = further === (run.axis === "x") ? 1 : -1;
        expect(trimKitsBeside(slotId).some((k) => k.side === side), `${slotId} → ${toward}`).toBe(
          true,
        );
        return side;
      };
      const gap = kitIn - reach(a, sideOf(a, b)) - reach(b, sideOf(b, a));
      expect(gap, `${a} / ${b}`).toBeLessThanOrEqual(0.125 + 1e-6);
      expect(gap, `${a} / ${b}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("puts all three doors' bottoms on one line, each on its own drawing's grille", () => {
    activateD();
    const bottoms: number[] = [];
    for (const slotId of ["slot-freezer", "slot-fridge"] as const) {
      const appliance = model(slotId);
      const box = applianceBox(SLOT_BY_ID[slotId], appliance);
      const panels = fridgeParts(appliance, { w: box.w, h: box.h });
      const grille = panels.find((panel) => panel.id === "grille")!;
      // The grille is the drawing's figure, unscaled.
      expect(inches(doorSplitOf(appliance, box.h).toe), slotId).toBeCloseTo(WINE_COLUMN.toeIn, 9);
      expect(inches(grille.h), slotId).toBeCloseTo(WINE_COLUMN.toeIn, 9);
      const door = panels.filter((panel) => panel.id !== "grille");
      expect(door.length, `${slotId} is one door`).toBe(1);
      bottoms.push(inches(SLOT_BY_ID[slotId].position[1] + box.y + door[0].y - door[0].h / 2));
      expect(inches(door[0].y + door[0].h / 2), `${slotId} door top`).toBeCloseTo(
        WINE_COLUMN.toeIn + WINE_COLUMN.doorHeightIn,
        9,
      );
      expect(appliance.finish[0], slotId).toBe("stainless");
    }
    const wine = model("slot-wine");
    const wineBox = applianceBox(SLOT_BY_ID["slot-wine"], wine);
    const parts = wineColumnParts(wineBox);
    expect(inches(parts.parts[0].band[1])).toBeCloseTo(WINE_COLUMN.toeIn, 9);
    bottoms.push(inches(SLOT_BY_ID["slot-wine"].position[1] + wineBox.y + parts.door.y));
    expect(wine.finish[0]).toBe("stainless");
    // A 24" column's door is a 24" door, less its eighth each side: none of the
    // case beside it shows.
    expect(inches(wineBox.w)).toBe(24);
    expect(inches(parts.door.w)).toBeCloseTo(24 - WINE_COLUMN.revealIn * 2, 9);

    for (const bottom of bottoms) expect(bottom).toBeCloseTo(bottoms[0], 9);
  });
});

describe("package D · the steam oven tower", () => {
  it("stands beside the rangetop under rule 12, with 18 inches of counter between them", () => {
    activateD();
    const run = runOf("slot-oven");
    const rangeAt = run.segments.findIndex((s) => s.slot === "slot-range");
    const towerAt = run.segments.findIndex((s) => s.slot === "slot-oven");
    expect(run.id).toBe(runOf("slot-range").id);

    const [from, to] = towerAt < rangeAt ? [towerAt + 1, rangeAt] : [rangeAt + 1, towerAt];
    const between = run.segments.slice(from, to);
    const board = between.find((segment) => segment.kind === "tall")!;
    expect(widthIn(board)).toBeCloseTo(0.75, 9);
    const counter = between
      .filter((segment) => segment.kind === "counter")
      .reduce((sum, segment) => sum + widthIn(segment), 0);
    expect(counter).toBeGreaterThanOrEqual(5);
    expect(counter).toBe(18);
    expect(checkLayout()).toEqual([]);
  });

  it("opens at 12 inches, on the 3-inch step, whatever the microwave reach", () => {
    const base = activateD();
    const sillIn = steamOvenSillIn();
    expect(sillIn).toBe(12);
    expect(sillIn % CABINET_STANDARDS.widthIn.step).toBe(0);
    expect(STEAM_OVEN.drawerFrontIn).toBeGreaterThanOrEqual(8);
    expect(STEAM_OVEN.drawerFrontIn).toBeLessThanOrEqual(MAX_DRAWER_IN);
    expect(inches(SLOT_BY_ID["slot-oven"].position[1])).toBeCloseTo(sillIn, 9);
    // The lower door's handle follows the sill rather than setting it.
    expect(sillIn + STEAM_OVEN.lowerHandleIn).toBe(34);

    // The microwave reach is a combination oven's parameter, and this is not one.
    expect(setLayoutParams({ ...base, microwaveHandleIn: 44 }).ok).toBe(true);
    expect(inches(SLOT_BY_ID["slot-oven"].position[1])).toBeCloseTo(sillIn, 9);
    setLayoutParams(base);

    const power = deriveUtilities(SLOT_BY_ID["slot-oven"], model("slot-oven")).power;
    expect(power.voltage).toBe(240);
  });

  it("stands on the toe kick and one drawer, with a door from the opening to the top", () => {
    activateD();
    const tower = segmentOf("slot-oven");
    const along = runOf("slot-oven").axis === "x" ? 0 : 2;
    const sillIn = steamOvenSillIn();

    const fronts = CABINETS.filter((box) => box.slot === "slot-oven" && box.kind === "base").map(
      (box) => ({
        bottomIn: inches(box.position[1] - box.size[1] / 2),
        topIn: inches(box.position[1] + box.size[1] / 2),
      }),
    );
    expect(drawerProblems(fronts, sillIn)).toEqual([]);

    // The kick under it is the run's own, carried on under the tower.
    const toe = CABINETS.find(
      (box) =>
        box.kind === "toe" &&
        box.position[along] - box.size[along] / 2 <= tower.from + 1e-9 &&
        box.position[along] + box.size[along] / 2 >= tower.to - 1e-9,
    );
    expect(toe).toBeTruthy();
    expect(inches(toe!.size[1])).toBeCloseTo(inches(ROOM.toeKick), 9);

    // Over the opening, a door to the top of the 96" tower.
    const bridge = CABINETS.find((box) => box.id === `${tower.id}-bridge`)!;
    const headIn = sillIn + SLOT_BY_ID["slot-oven"].cutout.h;
    expect(inches(bridge.position[1] - bridge.size[1] / 2)).toBeCloseTo(headIn, 9);
    expect(inches(bridge.position[1] + bridge.size[1] / 2)).toBeCloseTo(96, 9);
    expect(96 - headIn).toBeCloseTo(36.625, 9);
  });

  it("fails a tower that carries its front to the floor, a second drawer, or a door", () => {
    const sillIn = steamOvenSillIn();
    const toeIn = inches(ROOM.toeKick);
    // What round 30 built: one front from the floor to an 18" sill.
    expect(drawerProblems([{ bottomIn: 0, topIn: 18 }], 18)).not.toEqual([]);
    // Two drawers stacked under the opening.
    expect(
      drawerProblems(
        [
          { bottomIn: toeIn, topIn: toeIn + 7 },
          { bottomIn: toeIn + 7, topIn: toeIn + 14 },
        ],
        toeIn + 14,
      ),
    ).not.toEqual([]);
    // One front too tall to be a drawer.
    expect(drawerProblems([{ bottomIn: toeIn, topIn: toeIn + 14 }], toeIn + 14)).not.toEqual([]);
    // Nothing under the opening at all.
    expect(drawerProblems([], sillIn)).not.toEqual([]);
  });
});

describe("package D · the column group against a return wall", () => {
  /**
   * D11 rule 11, round 32. The group is one tall unit: the wall stands past
   * its outer 3/4" board with the 3-1/2" clearance filler between them, and
   * nothing inside the group is a wall or a filler — whichever column is the
   * refrigerator.
   */
  it("stands the wall past the group's outer board, on either leg", () => {
    const base = activateD();
    const built: string[] = [];
    const refused: string[] = [];
    for (const fridgeEnd of ["left", "back"] as const) {
      // The clearance costs the leg 3-1/2", so a wall that was exactly long
      // enough for the group is grown to the minimum the refusal names, where
      // the slider reaches it.
      const { result, short } = withWall(base, fridgeEnd);
      if (!result.ok) {
        // Refused with its arithmetic rather than built wrong: more wall than
        // the slider has.
        expect(short, `${fridgeEnd}: ${JSON.stringify(result.reasons)}`).toBeTruthy();
        expect(Number(short!.vars!.minimumIn), fridgeEnd).toBeGreaterThan(
          Number(short!.vars!.maximumIn),
        );
        refused.push(fridgeEnd);
        continue;
      }
      built.push(fridgeEnd);
      expect(checkLayout(), fridgeEnd).toEqual([]);

      const run = runOf("slot-fridge");
      expect(run.id, fridgeEnd).toBe(fridgeEnd);
      const span = columnGroup(run);

      // The outer board is kept, and the clearance is outside it and ends the run.
      expect(widthIn(span.outer), fridgeEnd).toBeCloseTo(0.75, 9);
      expect(span.outer.modules.map((m) => m.kind), fridgeEnd).toEqual(["panel"]);
      expect(span.after.length, fridgeEnd).toBe(1);
      expect(span.after[0].modules.map((m) => m.kind), fridgeEnd).toEqual(["filler"]);
      expect(widthIn(span.after[0]), fridgeEnd).toBeCloseTo(LAYOUT_LIMITS.fridge.fromWallIn, 9);

      expect(wallProblems(run, span, fridgeReturnWall()!), fridgeEnd).toEqual([]);
      // And the clearance figure is drawn across that filler, not somewhere in the group.
      const clearance = fridgeWallClearance()!;
      expect(clearance.from, fridgeEnd).toBeCloseTo(span.to, 9);
      expect(clearance.widthIn, fridgeEnd).toBeCloseTo(LAYOUT_LIMITS.fridge.fromWallIn, 9);
    }
    // The left leg is where D's columns stand by default; it has to build.
    expect(built).toContain("left");
    setLayoutParams(base);
  });

  it("fails a wall beside the refrigerator column, or a filler between two columns", () => {
    const base = activateD();
    expect(withWall(base, "left").result.ok).toBe(true);
    const run = runOf("slot-fridge");
    const span = columnGroup(run);
    const wall = fridgeReturnWall()!;
    const along = run.axis === "x" ? 0 : 2;

    // Where it stood before round 32: on the refrigerator column's far side.
    const beside = { ...wall, position: [...wall.position] as [number, number, number] };
    beside.position[along] = segmentOf("slot-fridge").to + wall.size[along] / 2;
    expect(wallProblems(run, span, beside)).not.toEqual([]);

    // A filler where a kit between two columns belongs.
    const kit = run.segments.find((s) => s.modules.some((m) => m.kind === "spacer"))!;
    const withFiller: CabinetRun = {
      ...run,
      segments: run.segments.map((s) =>
        s === kit ? { ...s, modules: s.modules.map((m) => ({ ...m, kind: "filler" as const })) } : s,
      ),
    };
    expect(wallProblems(withFiller, span, wall)).not.toEqual([]);
    setLayoutParams(base);
  });

  it("leaves A, B and C with the wall at the end of their refrigerator's run, as before", () => {
    for (const id of ["package-a", "package-b", "package-c"]) {
      setActivePackage(DEFAULT_PACKAGE.id);
      setLayoutParams(DEFAULT_PARAMS);
      const chosen = setActivePackage(id);
      expect(chosen.ok, id).toBe(true);
      const room = { ...DEFAULT_PARAMS, ...PACKAGE_BY_ID[id].defaultLayout, ...(chosen.adjusted ?? {}) };
      const result = setLayoutParams({ ...room, fridgeEndAbuts: "wall" });
      expect(result.ok, `${id}: ${JSON.stringify(result.reasons)}`).toBe(true);
      expect(checkLayout(), id).toEqual([]);

      const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-fridge"))!;
      const along = run.axis === "x" ? 0 : 2;
      const wall = fridgeReturnWall()!;
      const face = wall.position[along] - wall.size[along] / 2;
      const last = run.segments[run.segments.length - 1];
      expect(face, id).toBeCloseTo(last.to, 9);
      // Nothing stands past the refrigerator but the filler that closes the
      // clearance, where there is one.
      const fridgeAt = run.segments.findIndex((s) => s.slot === "slot-fridge");
      const past = run.segments.slice(fridgeAt + 1);
      expect(
        past.every((s) => s.modules.every((m) => m.kind === "filler")),
        `${id}: ${past.map((s) => s.id).join(", ")}`,
      ).toBe(true);
      // A single refrigerator ends its own run, and the wall is where it always
      // was: a built-in against its tower with no filler, a freestanding one
      // past the filler in its surround. B's bank closes with a filler segment
      // of its own, and its wall now stands past that rather than over it.
      if (id !== "package-b") {
        expect(face, id).toBeCloseTo(run.segments[fridgeAt].to, 9);
      }
    }
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });
});

describe("package D · rules 1 and 6 read the group, not the machine", () => {
  const codes = (runs: CabinetRun[]) => checkLayout(runs).map((problem) => problem.code);
  const copy = () => structuredClone(RUNS) as CabinetRun[];
  const fridgeRunIn = (runs: CabinetRun[]) =>
    runs.find((run) => run.segments.some((segment) => segment.slot === "slot-fridge"))!;

  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  it("measures the refrigerator's landing before the whole group, and fails when it is gone", () => {
    activateD();
    const runs = copy();
    const run = fridgeRunIn(runs);
    const at = run.segments.findIndex((segment) => segment.slot === "slot-fridge");
    // The refrigerator's own neighbours are the kits to the other columns:
    // there is no worktop beside the machine itself, only before the group.
    expect([run.segments[at - 1].kind, run.segments[at + 1].kind]).toEqual(["tall", "tall"]);
    expect(codes(runs)).not.toContain("d11-6");

    const group = columnGroup(run);
    const inner = run.segments.findIndex((segment) => Math.abs(segment.from - group.from) < 1e-9);
    for (let i = inner - 1; i >= 0 && run.segments[i].kind === "counter"; i -= 1) {
      run.segments[i].kind = "appliance";
    }
    expect(codes(runs)).toContain("d11-6");
  });

  it("does not measure a refrigerator's landing in front of a tall unit it is not part of", () => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
    expect(setActivePackage("package-c").ok).toBe(true);
    const runs = copy();
    const run = fridgeRunIn(runs);
    const at = run.segments.findIndex((segment) => segment.slot === "slot-fridge");
    // A freestanding refrigerator is an appliance standing in the run, with
    // counter before it.
    run.segments[at].kind = "appliance";
    expect(codes(runs)).not.toContain("d11-6");
    // Stand a board past it. The board is the run's last tall stretch, and the
    // refrigerator is not in it: its landing is still the counter before it.
    const last = run.segments[run.segments.length - 1];
    run.segments.push({
      id: `${run.id}-board`,
      kind: "tall",
      from: last.to,
      to: last.to + 0.75 / 12,
      modules: [{ code: "PNL0.75", kind: "panel", widthIn: 0.75 }],
    });
    expect(codes(runs)).not.toContain("d11-6");
  });

  it("treats the group as one tall unit for rule 1, and fails counter inside it", () => {
    activateD();
    const runs = copy();
    const run = fridgeRunIn(runs);
    expect(codes(runs)).not.toContain("d11-1");
    const kit = run.segments.find((segment) => segment.modules.some((m) => m.kind === "spacer"))!;
    kit.kind = "counter";
    kit.modules = [{ code: "B0.625", kind: "base", widthIn: 0.625 }];
    expect(codes(runs)).toContain("d11-1");
  });
});

/**
 * D against a return wall on one leg: the room as it stands, or the wall grown
 * to the minimum a refusal names when the clearance does not fit and the slider
 * can reach it, or the refusal itself.
 */
function withWall(base: LayoutParams, fridgeEnd: "left" | "back") {
  const asked: LayoutParams = {
    ...base,
    fridgeEndAbuts: "wall",
    fridgeEnd,
    sinkLeg: fridgeEnd === "left" ? "back" : "left",
  };
  let result = setLayoutParams(asked);
  const short = result.reasons.find((reason) => reason.key === "refusal.wallShort");
  const key =
    short?.vars?.paramKey === "param.leftWallIn"
      ? "leftWallIn"
      : short?.vars?.paramKey === "param.backWallIn"
        ? "backWallIn"
        : null;
  if (!result.ok && short && key && Number(short.vars!.minimumIn) <= Number(short.vars!.maximumIn)) {
    result = setLayoutParams({ ...asked, [key]: Number(short.vars!.minimumIn) });
  }
  return { result, short };
}

/**
 * Package D's column group along its run: the board before the first column,
 * the board after the last, and whatever finishes the run past that.
 */
function columnGroup(run: CabinetRun) {
  const at = run.segments
    .map((segment, index) => (COLUMNS.some((slot) => carries(segment, slot)) ? index : -1))
    .filter((index) => index >= 0);
  const inner = run.segments[at[0] - 1];
  const outer = run.segments[at[at.length - 1] + 1];
  return {
    from: Math.min(inner.from, outer.from),
    to: Math.max(inner.to, outer.to),
    outer,
    after: run.segments.slice(at[at.length - 1] + 2),
  };
}

const carries = (segment: RunSegment, slot: SlotId) => segment.slot === slot;

/** What is wrong with a return wall, measured against the group it is past. */
function wallProblems(
  run: CabinetRun,
  span: { from: number; to: number },
  wall: { position: [number, number, number]; size: [number, number, number] },
): string[] {
  const along = run.axis === "x" ? 0 : 2;
  const problems: string[] = [];
  const near = wall.position[along] - wall.size[along] / 2;
  const far = wall.position[along] + wall.size[along] / 2;
  if (far > span.from + 1e-9 && near < span.to - 1e-9) {
    problems.push(`wall ${inches(near)}"-${inches(far)}" is inside the group ${inches(span.from)}"-${inches(span.to)}"`);
  }
  const gapIn = inches(near - span.to);
  if (Math.abs(gapIn - LAYOUT_LIMITS.fridge.fromWallIn) > 1e-6) {
    problems.push(`wall stands ${gapIn}" past the group, wants ${LAYOUT_LIMITS.fridge.fromWallIn}"`);
  }
  const inside = (lo: number, hi: number) => hi > span.from + 1e-9 && lo < span.to - 1e-9;
  for (const segment of run.segments) {
    if (inside(segment.from, segment.to) && segment.modules.some((m) => m.kind === "filler")) {
      problems.push(`a filler in ${segment.id}, inside the group`);
    }
  }
  for (const box of CABINETS) {
    if (box.run !== run.id || box.module?.kind !== "filler") continue;
    const lo = box.position[along] - box.size[along] / 2;
    const hi = box.position[along] + box.size[along] / 2;
    if (inside(lo, hi)) problems.push(`filler box ${box.id} inside the group`);
  }
  return problems;
}

/** Leo's band for the drawer under a steam oven, round 31: 8" to 10". */
const MAX_DRAWER_IN = 10;

/**
 * What is wrong with the fronts under a tower's opening, in inches off the
 * floor: there should be exactly one, a drawer, from the top of the toe kick to
 * the sill.
 */
function drawerProblems(fronts: { bottomIn: number; topIn: number }[], sillIn: number): string[] {
  const toeIn = inches(ROOM.toeKick);
  if (fronts.length !== 1) return [`${fronts.length} fronts under the opening, wants one drawer`];
  const [{ bottomIn, topIn }] = fronts;
  const problems: string[] = [];
  if (Math.abs(bottomIn - toeIn) > 1e-6) problems.push(`front starts at ${bottomIn}", wants the ${toeIn}" kick`);
  if (Math.abs(topIn - sillIn) > 1e-6) problems.push(`front stops at ${topIn}", the sill is ${sillIn}"`);
  if (topIn - bottomIn > MAX_DRAWER_IN + 1e-6) {
    problems.push(`a ${topIn - bottomIn}" front is more than one drawer`);
  }
  return problems;
}

describe("package D · the coffee cabinet", () => {
  it("hangs the coffee machine 42 inches up by default, with the dishwasher on the floor under it", () => {
    activateD();
    expect(inches(SLOT_BY_ID["slot-coffee"].position[1])).toBeCloseTo(42, 9);
    expect(SLOT_BY_ID["slot-dishwasher-2"].position[1]).toBe(0);

    // Both in the same 24" tower, centred on it.
    const tower = segmentOf("slot-coffee");
    expect(widthIn(tower)).toBe(24);
    const along = runOf("slot-coffee").axis === "x" ? 0 : 2;
    expect(SLOT_BY_ID["slot-dishwasher-2"].position[along]).toBeCloseTo(mid(tower), 9);
    expect(SLOT_BY_ID["slot-coffee"].position[along]).toBeCloseTo(mid(tower), 9);
  });

  it("follows the height parameter, and fills between the two machines with a drawer", () => {
    const base = activateD();
    for (const coffeeSillIn of [36, 48, 60]) {
      const where = `${coffeeSillIn}"`;
      expect(setLayoutParams({ ...base, coffeeSillIn }).ok, where).toBe(true);
      expect(checkLayout(), where).toEqual([]);
      expect(inches(SLOT_BY_ID["slot-coffee"].position[1]), where).toBeCloseTo(coffeeSillIn, 9);

      const drawer = CABINETS.find((box) => box.id === `${segmentOf("slot-coffee").id}-base`)!;
      expect(drawer, where).toBeTruthy();
      expect(inches(drawer.position[1] - drawer.size[1] / 2), where).toBeCloseTo(
        SLOT_BY_ID["slot-dishwasher-2"].cutout.h,
        9,
      );
      expect(inches(drawer.position[1] + drawer.size[1] / 2), where).toBeCloseTo(coffeeSillIn, 9);
    }
    const low = setLayoutParams({ ...base, coffeeSillIn: 30 });
    expect(low.ok).toBe(false);
    expect(low.reasons.map((reason) => reason.key)).toContain("refusal.outOfRange");
    setLayoutParams(base);
  });

  it("stands in the run with its own boards, counter past them, and no wall cabinet across it", () => {
    activateD();
    const run = runOf("slot-coffee");
    const at = run.segments.indexOf(segmentOf("slot-coffee"));
    for (const step of [-1, 1]) {
      const board = run.segments[at + step];
      expect(board.kind).toBe("tall");
      expect(widthIn(board)).toBeCloseTo(0.75, 9);
      expect(run.segments[at + step * 2].kind).toBe("counter");
    }
    const span = [run.segments[at - 1].from, run.segments[at + 1].to] as const;
    for (const bank of run.uppers) {
      const overlap = Math.min(bank.to, span[1]) - Math.max(bank.from, span[0]);
      expect(overlap, `${bank.id} hangs across the coffee cabinet`).toBeLessThanOrEqual(1e-6);
    }
  });

  it("refuses the other leg with the bill, and offers this leg back", () => {
    const base = activateD();
    const result = generateLayout({ ...base, coffeeLeg: "back", backWallIn: 204 }, D);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const short = result.reasons.find((reason) => reason.key === "refusal.wallShort")!;
    expect(short).toBeTruthy();
    expect(Number(short.vars.minimumIn)).toBeGreaterThan(Number(short.vars.maximumIn));
    expect(short.occupancy!.map((item) => item.labelKey)).toContain("requirement.coffee");
    const total = short.occupancy!.reduce((sum, item) => sum + item.widthIn, 0);
    expect(total).toBeCloseTo(Number(short.vars.minimumIn), 9);
    expect(short.suggestion?.patch.coffeeLeg).toBe("left");
  });
});

describe("package D · two dishwashers", () => {
  it("specifies the same model twice, and gives each its own power, water and drain", () => {
    activateD();
    expect(D.defaultSelection["slot-dishwasher"]).toBe(D.defaultSelection["slot-dishwasher-2"]);
    for (const slotId of ["slot-dishwasher", "slot-dishwasher-2"] as const) {
      const utilities = deriveUtilities(SLOT_BY_ID[slotId], model(slotId));
      expect(utilities.power, slotId).toBeTruthy();
      expect(utilities.water?.supply, slotId).toBe(true);
      expect(utilities.water?.drain, slotId).toBe(true);
    }
  });

  it("holds the sink's dishwasher to rule 5 and lets the coffee cabinet's off it, under rule 14", () => {
    activateD();
    expect(checkLayout()).toEqual([]);

    // Beside the sink, hard against it.
    const sinkRun = RUNS.find((run) => run.segments.some((s) => s.fixture === "fixture-sink"))!;
    const sinkAt = sinkRun.segments.findIndex((s) => s.fixture === "fixture-sink");
    const dishwasherAt = sinkRun.segments.findIndex((s) => s.slot === "slot-dishwasher");
    expect(Math.abs(sinkAt - dishwasherAt)).toBe(1);

    // And the other one nowhere near it: a different wall.
    expect(runOf("slot-coffee").id).not.toBe(sinkRun.id);

    // Take the services away and rule 14 says so.
    const slot = SLOT_BY_ID["slot-dishwasher-2"];
    const saved = slot.utilities;
    slot.utilities = { ...saved, water: null };
    try {
      expect(checkLayout().map((problem) => problem.code)).toContain("d11-14");
    } finally {
      slot.utilities = saved;
    }

    // And a tower with no dishwasher in it is not the arrangement rule 14 allows.
    const hollow = RUNS.map((run) => ({
      ...run,
      segments: run.segments.map((segment) => ({
        ...segment,
        modules: segment.modules.map(({ lowerSlot: _lowerSlot, ...module }) => module),
      })),
    }));
    expect(checkLayout(hollow).map((problem) => problem.code)).toContain("d11-14");
  });

  it("brings the coffee cabinet dishwasher's connections to its own cabinet, not the sink base", () => {
    activateD();
    // The model with a read drawing: its connections are all "under the sink".
    const drawn = APPLIANCE_BY_ID["bosch-shv78cm3n"];
    const sink = RUNS.flatMap((run) => run.segments).find((s) => s.fixture === "fixture-sink")!;

    const beside = resolveRoughIn("slot-dishwasher", drawn).filter(
      (point) => point.point.location === "under-sink",
    );
    expect(beside.length).toBeGreaterThan(0);
    for (const point of beside) expect(point.host.id).toBe(sink.id);

    const coffeeRun = runOf("slot-coffee");
    const own = resolveRoughIn("slot-dishwasher-2", drawn).filter(
      (point) => point.point.location === "under-sink",
    );
    expect(own.length).toBe(beside.length);
    for (const point of own) {
      expect(point.host.id).not.toBe(sink.id);
      expect(coffeeRun.segments.find((s) => s.id === point.host.id)?.kind).toBe("counter");
    }
  });
});

describe("package D · switching packages", () => {
  it("builds each package's own slots and passes every rule, A to D to B to D to C to D to A", () => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
    for (const id of [
      "package-d",
      "package-b",
      "package-d",
      "package-c",
      "package-d",
      "package-a",
    ]) {
      const result = setActivePackage(id);
      expect(result.ok, `${id}: ${JSON.stringify(result.reasons)}`).toBe(true);
      expect(PACKAGE.id).toBe(id);
      const named = PACKAGE.slots.map((slot) => slot.slotId);
      expect(SLOT_ORDER, id).toEqual(named);
      expect(Object.keys(SLOT_BY_ID).sort(), id).toEqual([...named].sort());
      expect(checkLayout(), id).toEqual([]);
    }
    expect(SLOT_ORDER.length).toBe(6);
    expect(SLOT_BY_ID["slot-coffee"]).toBeUndefined();
  });
});
