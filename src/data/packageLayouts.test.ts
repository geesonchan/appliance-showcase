import { afterAll, describe, expect, it } from "vitest";
import { applianceBox } from "./applianceBox";
import { CABINETS } from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { dimensionsFor } from "./dimensions";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams } from "./layoutState";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  type LayoutParams,
  type Refusal,
} from "./layoutTemplate";
import { BUILDABLE_PACKAGES, DEFAULT_PACKAGE, PACKAGE_BY_ID, slotsOf } from "./packages";
import { LAYOUT_LIMITS, ROOM, RUNS, ft } from "./room";
import { SLOT_BY_ID } from "./slots";

/**
 * Every package, over the whole parameter space.
 *
 * `layoutCombinations.test.ts` sweeps the parameters against one package and
 * checks each rule in detail. This sweeps the same space against *every*
 * package and asks the one question that has to hold for all of them: a set of
 * parameters either produces a room that passes every rule in `checkLayout`, or
 * it is refused with a sentence saying why. A generator that reads its widths
 * from a data file can be right for the file it was written against and wrong
 * for the next one, and that is exactly what this is for.
 */
const inches = (feet: number) => feet * 12;
const params = (over: Partial<LayoutParams> = {}): LayoutParams => ({ ...DEFAULT_PARAMS, ...over });
const values = (limit: { min: number; max: number; step: number }) => {
  const all: number[] = [];
  for (let v = limit.min; v <= limit.max; v += limit.step) all.push(v);
  return all;
};

/**
 * Every combination worth trying, built the way the other sweep builds them:
 * each parameter's whole range against the defaults, then the pairs that
 * actually interact.
 */
function combinations(): Partial<LayoutParams>[] {
  const out: Partial<LayoutParams>[] = [{}];

  for (const backWallIn of values(PARAM_LIMITS.backWallIn)) out.push({ backWallIn });
  for (const leftWallIn of values(PARAM_LIMITS.leftWallIn)) out.push({ leftWallIn });
  for (const islandLengthIn of values(PARAM_LIMITS.islandLengthIn)) out.push({ islandLengthIn });
  for (const islandDepthIn of values(PARAM_LIMITS.islandDepthIn)) out.push({ islandDepthIn });
  for (const aisleIn of values(PARAM_LIMITS.aisleIn)) out.push({ aisleIn });

  // The four that change the kitchen rather than resize it, in full. The
  // refrigerator cannot share a leg with the sink, which is why they pair.
  for (const cornerType of ["lazy-susan", "blind"] as const) {
    for (const hasIsland of [true, false]) {
      for (const [fridgeEnd, sinkLeg] of [
        ["left", "back"],
        ["back", "left"],
      ] as const) {
        // A return wall past the refrigerator costs three and a half inches of
        // the leg, so it belongs in the sweep rather than beside it.
        for (const fridgeEndAbuts of ["cabinet", "wall"] as const) {
          out.push({ cornerType, hasIsland, fridgeEnd, sinkLeg, fridgeEndAbuts });
          // ...and against the ends of both walls, where the room is tightest.
          for (const backWallIn of [PARAM_LIMITS.backWallIn.min, 144, PARAM_LIMITS.backWallIn.max]) {
            for (const leftWallIn of [
              PARAM_LIMITS.leftWallIn.min,
              144,
              PARAM_LIMITS.leftWallIn.max,
            ]) {
              out.push({
                cornerType,
                hasIsland,
                fridgeEnd,
                sinkLeg,
                fridgeEndAbuts,
                backWallIn,
                leftWallIn,
              });
            }
          }
        }
      }
    }
  }
  return out;
}

const COMBINATIONS = combinations();

afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

/**
 * Switch to a package, from the default room.
 *
 * The order matters: a package is judged against the parameters as they stand,
 * and a set that was refused a moment ago will refuse the switch too — which
 * is the right behaviour in the app and a trap in a test that has just finished
 * sweeping to the end of a slider.
 */
function activate(id: string) {
  setLayoutParams(DEFAULT_PARAMS);
  expect(setActivePackage(id).ok, `${id} will not build the default room`).toBe(true);
}

/** How many of the combinations a package builds, checking each one it does. */
function sweep(id: string): number {
  activate(id);

  let built = 0;
  for (const over of COMBINATIONS) {
    const where = `${id} ${JSON.stringify(over)}`;
    const result = setLayoutParams(params(over));
    if (!result.ok) {
      expect(result.reasons.length, `${where}: refused with no reason`).toBeGreaterThan(0);
      for (const reason of result.reasons) expectPrintable(reason, where);
      continue;
    }
    built++;
    expect(
      checkLayout().map((problem) => `${problem.code}: ${problem.message}`),
      where,
    ).toEqual([]);
  }
  return built;
}

describe("every package over the whole parameter space", () => {
  it("either builds a room that passes every rule, or refuses with a reason", () => {
    const built: Record<string, number> = {};
    for (const entry of BUILDABLE_PACKAGES) built[entry.id] = sweep(entry.id);

    // A package that refused everything would pass the assertion above without
    // ever having built anything.
    for (const [id, count] of Object.entries(built)) {
      expect(count, `${id} built nothing`).toBeGreaterThan(20);
    }

    // And a package of narrower appliances asks less of a wall, so it builds
    // in at least every room the wider one does. This is the arithmetic the
    // whole change is for: if C ever needed *more* wall than A, the widths are
    // not coming from the data file.
    expect(built["package-c"], "C needs more room than A").toBeGreaterThanOrEqual(
      built["package-a"],
    );
  });
});

/** A refusal has to be something the interface can print: a key and figures. */
function expectPrintable(reason: Refusal, where: string) {
  expect(reason.key, where).toMatch(/^refusal\./);
  for (const [name, value] of Object.entries(reason.vars ?? {})) {
    expect(value, `${where}: ${reason.key}.${name} is empty`).not.toBe(undefined);
  }
}

/**
 * What a package changes about the room it builds.
 *
 * These are the branches the flags feed, asserted against the carcass rather
 * than against the flag that set them — the point of `enclosure: false` is that
 * there is no panel standing next to the refrigerator, not that a boolean is
 * false somewhere.
 */
describe("a freestanding refrigerator is surrounded differently", () => {
  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  const fridgeBoxes = () =>
    CABINETS.filter((box) => box.slot === "slot-fridge" && box.kind !== "toe");

  it("builds panels and a bridge round an enclosed one", () => {
    activate("package-a");
    const kinds = fridgeBoxes().map((box) => box.kind).sort();
    expect(kinds).toEqual(["surround", "surround", "upper"]);
  });

  /**
   * D11 rule 11. A freestanding machine is surrounded too — by different parts.
   * A panel each side that is only counter deep, so the doors and their handles
   * stand proud of it rather than being buried in it, and a cabinet over the
   * machine starting an inch above its top. No bridge: a bridge spans an
   * opening between two towers from the head of that opening, which is a
   * different box in a different place.
   */
  it("builds counter-deep panels and a cabinet over it, never a bridge", () => {
    activate("package-c");
    for (const over of COMBINATIONS) {
      if (!setLayoutParams(params(over)).ok) continue;
      const where = `package-c ${JSON.stringify(over)}`;
      const boxes = fridgeBoxes();

      // A board each side either way: a finished panel where cabinetry
      // continues, and the door clearance closed floor to ceiling in the same
      // finish where a wall is there.
      expect(boxes.map((box) => box.kind).sort(), where).toEqual([
        "surround",
        "surround",
        "upper",
      ]);

      // The panels are counter deep, not enclosure deep. A box's size is in
      // room axes, so which of x and z is the depth follows the run.
      const depthAxis = RUNS.find((run) => run.segments.some((s) => s.slot === "slot-fridge"))!
        .axis === "x" ? 2 : 0;
      for (const panel of boxes.filter((box) => box.kind === "surround")) {
        expect(panel.size[depthAxis], `${where}: panel is not counter deep`).toBeCloseTo(
          ROOM.counterDepth,
          9,
        );
      }

      // The cabinet over it starts an inch above the machine, not at the head
      // of an opening, and runs to the ceiling.
      const over_ = boxes.find((box) => box.kind === "upper")!;
      const floor = over_.position[1] - over_.size[1] / 2;
      const top = over_.position[1] + over_.size[1] / 2;
      expect(inches(floor), `${where}: cabinet over the refrigerator`).toBeCloseTo(
        SLOT_BY_ID["slot-fridge"].cutout.h + LAYOUT_LIMITS.fridge.aboveIn,
        6,
      );
      expect(top, where).toBeCloseTo(ROOM.wallHeight, 6);
      expect(over_.id.endsWith("-bridge"), `${where}: that is a bridge`).toBe(false);
    }
  });

  /**
   * D11 rule 11, revised. The clearance is not left open: leaving three and a
   * half inches of nothing at the end of a run reads as a cabinet somebody
   * forgot, and it is dust nobody can reach. It is closed with a board in the
   * door finish, floor to the top of the surround, flush with the panel on the
   * other side.
   */
  it("closes the clearance with a board the full height of the surround", () => {
    activate("package-c");
    expect(setLayoutParams(params({ fridgeEndAbuts: "wall" })).ok).toBe(true);

    const boards = fridgeBoxes().filter((box) => box.kind === "surround");
    expect(boards).toHaveLength(2);

    const upper = fridgeBoxes().find((box) => box.kind === "upper")!;
    const surroundTop = upper.position[1] + upper.size[1] / 2;
    for (const board of boards) {
      expect(board.position[1] - board.size[1] / 2, "starts at the floor").toBeCloseTo(0, 9);
      expect(board.position[1] + board.size[1] / 2, "runs to the top").toBeCloseTo(
        surroundTop,
        9,
      );
    }

    // And the one against the wall is the width the door needs.
    const filler = RUNS.flatMap((run) => run.segments)
      .find((s) => s.slot === "slot-fridge")!
      .modules.find((module) => module.kind === "filler")!;
    expect(filler.widthIn).toBeCloseTo(LAYOUT_LIMITS.fridge.fromWallIn, 6);
    // Sizes are in room axes, so which of x and z runs along the leg follows
    // the run.
    const along = RUNS.find((run) => run.segments.some((s) => s.slot === "slot-fridge"))!
      .axis === "x" ? 0 : 2;
    const board = boards.find(
      (box) => Math.abs(box.size[along] * 12 - filler.widthIn) < 1e-6,
    );
    expect(board, "no board the width of the clearance").toBeTruthy();

    setLayoutParams(DEFAULT_PARAMS);
  });

  it("keeps a return wall three and a half inches off the machine", () => {
    activate("package-c");
    for (const abuts of ["cabinet", "wall"] as const) {
      expect(setLayoutParams(params({ fridgeEndAbuts: abuts })).ok, abuts).toBe(true);
      const segment = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-fridge")!;
      const outer = segment.modules[segment.modules.length - 1];
      if (abuts === "wall") {
        expect(outer.kind).toBe("filler");
        expect(outer.widthIn).toBeCloseTo(LAYOUT_LIMITS.fridge.fromWallIn, 6);
      } else {
        expect(outer.kind).toBe("panel");
      }
    }
    setLayoutParams(DEFAULT_PARAMS);
  });

  it("fills no leftover with appliance panels: what is round it is cabinetry", () => {
    activate("package-c");
    const slot = SLOT_BY_ID["slot-fridge"];
    const appliance = APPLIANCE_BY_ID[PACKAGE_BY_ID["package-c"].defaultSelection["slot-fridge"]!];

    // The joiner builds a 72" opening and the machine is 72": nothing is left
    // over, and anything above or beside it is a cabinet from the run rather
    // than a panel ApplianceModel invents.
    expect(slot.cutout.h).toBe(appliance.heightIn);
    expect(applianceBox(slot, appliance).filler).toEqual({ below: 0, above: 0, eachSide: 0 });
  });

  it("stops the wall cabinets at it and carries the toe kick past it, either way", () => {
    for (const id of ["package-a", "package-c"] as const) {
      activate(id);

      const fridge = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-fridge")!;
      expect(fridge, id).toBeTruthy();

      // No wall cabinet reaches over it: a tower is 96" and the ceiling is 96".
      // On its own run only — `from` and `to` are distances along a run, and
      // the two runs measure along different axes.
      const onRun = RUNS.find((run) => run.segments.includes(fridge))!;
      {
        for (const bank of onRun.uppers) {
          if (bank.modules.some((module) => module.slot === "slot-fridge")) continue;
          const overlaps = bank.from < fridge.to - 1e-6 && bank.to > fridge.from + 1e-6;
          expect(overlaps, `${id}: ${bank.id} runs over the refrigerator`).toBe(false);
        }
      }

      // And the recessed board stops at it rather than running on behind it.
      const toes = CABINETS.filter((box) => box.kind === "toe" && box.run === onRun.id);
      for (const toe of toes) {
        const [x, , z] = toe.position;
        const along = Math.abs(toe.size[0]) > Math.abs(toe.size[2]) ? x : z;
        const half = Math.max(Math.abs(toe.size[0]), Math.abs(toe.size[2])) / 2;
        const inside = along - half > fridge.from + 1e-6 && along + half < fridge.to - 1e-6;
        expect(inside, `${id}: a toe kick sits under the refrigerator`).toBe(false);
      }
    }
  });
});

describe("a chimney hood keeps the wall above it clear", () => {
  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  const hoodBank = () =>
    RUNS.flatMap((run) => run.uppers).find((bank) =>
      bank.modules.some((module) => module.slot === "slot-hood"),
    );

  it("bridges over an under-cabinet hood, because the duct runs up inside it", () => {
    activate("package-a");
    expect(slotsOf(PACKAGE_BY_ID["package-a"])["slot-hood"].installType).toBe("under-cabinet");
    expect(hoodBank(), "no bridge over an under-cabinet hood").toBeTruthy();
  });

  it("puts nothing over a chimney hood, whatever the room is", () => {
    activate("package-c");
    for (const over of COMBINATIONS) {
      if (!setLayoutParams(params(over)).ok) continue;
      expect(hoodBank(), `package-c ${JSON.stringify(over)}`).toBeUndefined();
    }
  });

  /**
   * D13's addendum still holds: the banks each side sit hard against the
   * canopy. Losing the bridge must not reopen the gap that rule closed.
   */
  it("keeps a wall cabinet flush to each flank of the canopy, in every package", () => {
    for (const id of ["package-a", "package-c"] as const) {
      activate(id);
      for (const over of COMBINATIONS) {
        if (!setLayoutParams(params(over)).ok) continue;
        const where = `${id} ${JSON.stringify(over)}`;

        const hood = SLOT_BY_ID["slot-hood"];
        const halfW = ft(hood.cutout.w) / 2;
        const flanks = [hood.position[0] - halfW, hood.position[0] + halfW];

        const uppers = CABINETS.filter(
          (box) => box.kind === "upper" && box.slot !== "slot-hood" && box.run === "back",
        );
        for (const [side, flank] of flanks.entries()) {
          const touching = uppers.some((box) => {
            const half = box.size[0] / 2;
            const edge = side === 0 ? box.position[0] + half : box.position[0] - half;
            return Math.abs(edge - flank) < 1e-6;
          });
          expect(touching, `${where}: nothing flush to flank ${side} of the canopy`).toBe(true);
        }
      }
    }
  });
});

/**
 * The line the install list has to carry when a return wall is there.
 *
 * Three and a half inches of empty wall looks like a mistake until somebody
 * says what it is for, so the clearance is both a figure on the drawing and a
 * sentence on the list. See docs/decisions.md D11 rule 11.
 */
describe("the door clearance is said out loud", () => {
  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  const clearance = () =>
    dimensionsFor(
      Object.fromEntries(
        BUILDABLE_PACKAGES[0].slots.map((slot) => [slot.slotId, undefined]),
      ) as never,
    ).find((d) => d.id === "fridge-door-clearance");

  it("prints the figure whatever the render mode, and only against a wall", () => {
    activate("package-c");

    expect(setLayoutParams(params({ fridgeEndAbuts: "cabinet" })).ok).toBe(true);
    expect(clearance(), "a cabinet needs no clearance dimension").toBeUndefined();

    expect(setLayoutParams(params({ fridgeEndAbuts: "wall" })).ok).toBe(true);
    const dimension = clearance();
    expect(dimension, "no clearance dimension against a wall").toBeTruthy();
    expect(dimension!.valueIn).toBeCloseTo(LAYOUT_LIMITS.fridge.fromWallIn, 6);
    // Not hidden behind the dimension layer: it is the reason the gap is there.
    expect(dimension!.always).toBe(true);
    expect(dimension!.noteKey).toBeTruthy();
  });
});

/**
 * The island's two machines, when there is no island.
 *
 * They are split rather than stacked: 48" of opening in one place is what made
 * a blind corner refuse a room that is otherwise fine. And where they went is a
 * line on the install list, because it is not obvious from looking.
 */
describe("no island, in both packages", () => {
  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  it("splits them across the legs, and passes every rule doing it", () => {
    for (const id of BUILDABLE_PACKAGES.map((entry) => entry.id)) {
      activate(id);
      for (const cornerType of ["blind", "lazy-susan"] as const) {
        const where = `${id} / ${cornerType}`;
        const result = setLayoutParams(params({ hasIsland: false, cornerType }));
        if (!result.ok) {
          // A lazy susan reaches 36" into the back run where a blind corner
          // reaches 12, and the back leg is carrying the microwave as well.
          // Refusing with a reason is the right answer; refusing by deleting
          // the cabinet after the dishwasher is what this round stopped.
          expect(cornerType, where).toBe("lazy-susan");
          for (const reason of result.reasons) expectPrintable(reason, where);
          continue;
        }
        expect(checkLayout(), where).toEqual([]);

        // The drawer is beside the range, under the landing; the wine cabinet
        // finishes the refrigerator's leg, before the tower.
        const back = RUNS.find((run) => run.segments.some((s) => s.slot === "slot-range"))!;
        const rangeAt = back.segments.findIndex((s) => s.slot === "slot-range");
        expect(back.segments[rangeAt - 1].slot, where).toBe("slot-microwave");

        const fridgeRun = RUNS.find((run) =>
          run.segments.some((s) => s.slot === "slot-fridge"),
        )!;
        const order = fridgeRun.segments.map((s) => s.slot);
        expect(order.indexOf("slot-wine"), where).toBeLessThan(order.indexOf("slot-fridge"));
        expect(fridgeRun.segments[fridgeRun.segments.length - 1].slot, where).toBe("slot-fridge");
      }
    }
  });
});
