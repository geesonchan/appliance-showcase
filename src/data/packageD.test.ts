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
import { RUNS, trimKitsBeside, type CabinetRun, type RunSegment } from "./room";
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

  it("opens at 18 inches, which puts the lower door's handle at 40, whatever the microwave reach", () => {
    const base = activateD();
    expect(steamOvenSillIn()).toBe(18);
    expect(18 + STEAM_OVEN.lowerHandleIn).toBe(STEAM_OVEN.handleReferenceIn);
    expect(STEAM_OVEN.handleReferenceIn).toBe(40);
    expect(inches(SLOT_BY_ID["slot-oven"].position[1])).toBeCloseTo(18, 9);

    // The microwave reach is a combination oven's parameter, and this is not one.
    expect(setLayoutParams({ ...base, microwaveHandleIn: 44 }).ok).toBe(true);
    expect(inches(SLOT_BY_ID["slot-oven"].position[1])).toBeCloseTo(18, 9);

    const power = deriveUtilities(SLOT_BY_ID["slot-oven"], model("slot-oven")).power;
    expect(power.voltage).toBe(240);
  });
});

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
