import { afterAll, describe, expect, it } from "vitest";
import { applianceBox } from "./applianceBox";
import {
  COMBO_OVEN,
  WINE_COLUMN,
  comboHandleAt,
  comboOvenParts,
  comboSillFor,
  wineColumnParts,
} from "./columnModel";
import { cooktopHeight } from "./rangeModel";
import { CABINETS } from "./cabinets";
import { hoodCabinetParts } from "./insertHood";
import { APPLIANCE_BY_ID } from "./catalogue";
import { dimensionsFor } from "./dimensions";
import { counterOutline } from "./counter";
import { checkLayout } from "./layoutRules";
import { finishSurface } from "../three/materials";
import { setActivePackage, setLayoutParams } from "./layoutState";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  feasibleRange,
  type LayoutParams,
  type Refusal,
} from "./layoutTemplate";
import { BUILDABLE_PACKAGES, DEFAULT_PACKAGE, PACKAGE_BY_ID, slotsOf } from "./packages";
import { LAYOUT, LAYOUT_LIMITS, ROOM, RUNS, ft, hingeAwayFrom } from "./room";
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

  // Which way the island is turned, and which side of the cooking surface the
  // oven tower stands: both change the room rather than resize it, and both
  // have to hold over the rest of the space.
  for (const islandOrientation of ["parallel", "perpendicular"] as const) {
    out.push({ islandOrientation });
    for (const islandLengthIn of values(PARAM_LIMITS.islandLengthIn)) {
      out.push({ islandOrientation, islandLengthIn });
    }
    for (const islandDepthIn of values(PARAM_LIMITS.islandDepthIn)) {
      out.push({ islandOrientation, islandDepthIn });
    }
    for (const aisleIn of values(PARAM_LIMITS.aisleIn)) out.push({ islandOrientation, aisleIn });
  }
  // Which shape the hood housing is built in. It changes the geometry over the
  // range rather than the run under it, but the run is what has to survive it.
  for (const housingStyle of ["box", "sweep"] as const) {
    out.push({ housingStyle });
    out.push({ housingStyle, towerSide: "left" });
  }
  for (const towerSide of ["left", "right"] as const) {
    out.push({ towerSide });
    for (const islandOrientation of ["parallel", "perpendicular"] as const) {
      out.push({ towerSide, islandOrientation });
    }
    for (const backWallIn of [PARAM_LIMITS.backWallIn.min, 168, PARAM_LIMITS.backWallIn.max]) {
      out.push({ towerSide, backWallIn });
    }
  }

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
function activate(id: string): LayoutParams {
  // Away first, so this is a real switch even when the package is already on.
  // A switch that is already made returns without building, and the room it
  // leaves behind is the default room — which for a package that needs a
  // longer wall is a room it was refused.
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage(id);
  expect(result.ok, `${id} will not build the default room`).toBe(true);
  // The room the package landed in, which is not always the one it was offered:
  // three tall units in a run need a longer wall than one, and choosing the
  // package grows the room to the shortest wall that takes it.
  return { ...DEFAULT_PARAMS, ...(result.adjusted ?? {}) };
}

/** How many of the combinations a package builds, checking each one it does. */
function sweep(id: string): number {
  const base = activate(id);

  let built = 0;
  for (const over of COMBINATIONS) {
    const where = `${id} ${JSON.stringify(over)}`;
    const result = setLayoutParams({ ...base, ...over });
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
    expectStoneOverEveryCabinet(id, where);
  }
  return built;
}

/** Point in polygon, to ask whether a piece of stone reaches somewhere. */
function inside([x, z]: readonly [number, number], outline: readonly (readonly [number, number])[]) {
  let within = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i];
    const [xj, zj] = outline[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) within = !within;
  }
  return within;
}

/**
 * Stone over every stretch of cabinet that is not a tall unit.
 *
 * The countertop used to stop at the first tall unit on a leg, which was
 * right while the only tall units were the ones that finished a run. An oven
 * tower beside the cooking surface stands in the middle of one, and the sink
 * and the dishwasher past it were left standing under nothing.
 *
 * What is allowed to have no stone over it is a tall unit, and a range that
 * stands on the floor rather than dropping into the top. Everything else on
 * the perimeter carries a worktop, sink cutout and all — a hole in a slab is
 * still that slab.
 */
function expectStoneOverEveryCabinet(id: string, where: string) {
  const range = APPLIANCE_BY_ID[PACKAGE_BY_ID[id].defaultSelection["slot-range"]!];
  const standsOnTheFloor = range.installType.some((type) => /freestanding/i.test(type));
  const { pieces } = counterOutline(RUNS, range);

  for (const run of RUNS) {
    for (const segment of run.segments) {
      if (segment.kind === "tall") continue;
      if (standsOnTheFloor && segment.slot === "slot-range") continue;
      // Both ends and the middle: a slab that reaches one end of a stretch and
      // stops halfway along it is not a worktop over that stretch.
      const nudge = ft(0.25);
      for (const at of [
        segment.from + nudge,
        (segment.from + segment.to) / 2,
        segment.to - nudge,
      ]) {
        const point =
          run.axis === "x" ? ([at, run.centre] as const) : ([run.centre, at] as const);
        const covered = pieces.some((piece) => inside(point, piece.outline));
        expect(covered, `${where}: no worktop over ${segment.id} at ${inches(at)}"`).toBe(true);
      }
    }
  }
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
 * The wall between a cooking surface and the hood over it.
 *
 * Backsplash and nothing else. The clearance over a cooking surface is the
 * whole point of the figure — 36" to an unprotected cabinet on the rangetop's
 * own sheet — so a cabinet hung in it is the one cabinet that may not be
 * there. The app drew one for a while: the leftover height of the range slot's
 * opening was being filled with a panel in the door finish, 27" of it, which
 * is a green box standing on the counter behind the burners.
 */
describe("what is over the cooking surface", () => {
  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  it("is the wall, in every package", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      activate(entry.id);
      const slot = SLOT_BY_ID["slot-range"];
      const range = APPLIANCE_BY_ID[entry.defaultSelection["slot-range"]!];
      const hood = SLOT_BY_ID["slot-hood"];

      // The band: from the cooking surface to the underside of the hood. The
      // cooking surface is the machine's own — a rangetop's deck at 36-7/16",
      // a backguard range's 36" cooktop, a pro range's top — not the top of
      // whatever it is sold as.
      const cooktop =
        slot.position[1] + cooktopHeight(range, applianceBox(slot, range));
      const under = hood.position[1];
      expect(under, entry.id).toBeGreaterThan(cooktop);

      const segment = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-range")!;
      for (const box of CABINETS) {
        const [w, h] = box.size;
        const [x, y] = box.position;
        // Anything whose body is inside the band, over the machine.
        const low = y - h / 2;
        const high = y + h / 2;
        const overlapsBand = high > cooktop + 1e-6 && low < under - 1e-6;
        const overlapsRange = x + w / 2 > segment.from + 1e-6 && x - w / 2 < segment.to - 1e-6;
        expect(
          overlapsBand && overlapsRange,
          `${entry.id}: ${box.id} stands between the cooking surface and the hood`,
        ).toBe(false);
      }
    }
  });

  it("draws no panel of its own above the machine either", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      activate(entry.id);
      const slot = SLOT_BY_ID["slot-range"];
      const range = APPLIANCE_BY_ID[entry.defaultSelection["slot-range"]!];
      // A freestanding range fills its opening; a rangetop's opening is a hole
      // in the stone and the cabinetry above it is nothing at all.
      if (!range.installType.includes("rangetop")) continue;
      const box = applianceBox(slot, range);
      expect(box.filler.above, entry.id).toBe(0);
      expect(box.filler.below, entry.id).toBe(0);
    }
  });
});

/**
 * The tall units, where D11 rule 12 puts them after round 21.
 *
 * Two of them finish a run — the refrigerator outermost with the wine column
 * beside it and the manufacturer's 5/8" kit between, 36 + 5/8 + 18 = 54-5/8"
 * of machine with a panel each end. The oven tower is not one of them: it
 * stands beside the cooking surface, which is the exception to rule 1, with a
 * cabinet between the two of them because the rangetop's own sheet asks for 5"
 * to anything combustible.
 */
describe("a bank of tall units", () => {
  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  const bankOf = (id: string) => {
    activate(id);
    const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-fridge"))!;
    const first = run.segments.findIndex(
      (segment, i) =>
        segment.kind === "tall" && run.segments.slice(i).every((later) => later.kind === "tall"),
    );
    return run.segments.slice(first);
  };

  it("stands them in one block at the end of the run, in order", () => {
    const bank = bankOf("package-b");
    expect(bank.map((segment) => segment.slot)).toEqual([
      undefined,
      "slot-wine",
      undefined,
      "slot-fridge",
      undefined,
    ]);
    // Nothing but tall units after the first of them, which is what rule 12
    // amends rule 1 to allow.
    for (const segment of bank) expect(segment.kind, segment.id).toBe("tall");
    expect(checkLayout()).toEqual([]);
  });

  it("puts the manufacturer's kit between the two refrigeration columns", () => {
    const bank = bankOf("package-b");
    const modules = bank.flatMap((segment) => segment.modules);
    const spacer = modules.find((module) => module.kind === "spacer");
    expect(spacer, "no spacer between the columns").toBeTruthy();
    expect(spacer!.code).toBe("COMBIKIT10");
    expect(spacer!.widthIn).toBeCloseTo(0.625, 6);

    // Between the wine column and the refrigerator, not anywhere else: an oven
    // tower is joinery and has its own sides inside its 30".
    const order = modules.map((module) => module.slot ?? module.kind);
    expect(order.indexOf("spacer")).toBe(order.indexOf("slot-wine") + 1);
    expect(order.indexOf("slot-fridge")).toBe(order.indexOf("spacer") + 1);
  });

  /**
   * The wine column's door opens away from the refrigerator.
   *
   * Two doors hinged on the same side is two doors that foul each other: the
   * column's is hung on the side away from the machine beside it, whichever
   * leg the bank stands on. `hingeAwayFrom` reads the run rather than assuming
   * a side, because a run along z is drawn a quarter turn round.
   */
  it("hangs the column's door away from the refrigerator, on either leg", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      const sinkLeg = fridgeEnd === "left" ? ("back" as const) : ("left" as const);
      const base = activate("package-b");
      const where = `fridge ${fridgeEnd}`;
      // The wall the bank stands on, at whatever length takes it — measured
      // from the room the package landed in, since the other wall has to be
      // long enough for the cooking run and the tower on it.
      const key = fridgeEnd === "left" ? ("leftWallIn" as const) : ("backWallIn" as const);
      const at = { ...base, fridgeEnd, sinkLeg };
      const room = feasibleRange(at, key)!;
      expect(room, where).toBeTruthy();
      expect(setLayoutParams({ ...at, [key]: room.minIn }).ok, where).toBe(true);

      const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-fridge"))!;
      const wine = run.segments.find((s) => s.slot === "slot-wine")!;
      const fridge = run.segments.find((s) => s.slot === "slot-fridge")!;
      const hinge = hingeAwayFrom("slot-wine", "slot-fridge");

      // The refrigerator is further along the run than the wine column in this
      // template, so which side that is on the drawing depends on the leg.
      expect(fridge.from, where).toBeGreaterThan(wine.from);
      expect(hinge, where).toBe(run.axis === "x" ? -1 : 1);
    }
  });

  it("comes to 54-5/8 inches of machine, panels aside", () => {
    const bank = bankOf("package-b");
    const machines = bank
      .flatMap((segment) => segment.modules)
      .filter((module) => module.slot || module.kind === "spacer")
      .reduce((sum, module) => sum + module.widthIn, 0);
    expect(machines).toBeCloseTo(54.625, 6);
  });

  /**
   * The oven tower, beside the cooking surface: D11 rule 12 as round 21
   * amends it.
   *
   * Six inches of cabinet between them at least, because PCG366W wants five to
   * a combustible surface, and twelve at most before it stops being a cabinet
   * and starts being a gap. The far side of the machine keeps the wide
   * landing. And the tower's opening starts 18" off the floor with a drawer
   * base under it, which is the top of the 4-3/4"-18" the oven's own drawing
   * allows and puts its handles where a person reaches.
   */
  it("stands the oven tower beside the cooking surface, on either side", () => {
    for (const towerSide of ["left", "right"] as const) {
      activate("package-b");
      const where = `tower ${towerSide}`;
      const at = params({ towerSide });
      const room = feasibleRange(at, "backWallIn")!;
      expect(room, where).toBeTruthy();
      expect(setLayoutParams({ ...at, backWallIn: room.minIn }).ok, where).toBe(true);
      expect(checkLayout(), where).toEqual([]);

      const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
      const rangeAt = run.segments.findIndex((s) => s.slot === "slot-range");
      const towerAt = run.segments.findIndex((s) => s.slot === "slot-microwave");
      expect(towerAt < rangeAt, where).toBe(towerSide === "left");

      // Between them: the tower's own side panel, and open counter.
      const [from, to] =
        towerAt < rangeAt ? [towerAt + 1, rangeAt] : [rangeAt + 1, towerAt];
      const between = run.segments.slice(from, to);
      const side = between.find((segment) => segment.kind === "tall")!;
      expect(side, `${where}: no side panel`).toBeTruthy();
      expect(inches(side.to - side.from), `${where}: side panel`).toBeCloseTo(0.75, 6);
      expect(side.modules.every((module) => module.kind === "panel"), where).toBe(true);

      const counter = between
        .filter((segment) => segment.kind === "counter")
        .reduce((sum, segment) => sum + inches(segment.to - segment.from), 0);
      expect(counter, `${where}: clearance`).toBeGreaterThanOrEqual(5);

      // The far side of the machine, which is the landing a pan comes off on.
      const away = run.segments[towerAt < rangeAt ? rangeAt + 1 : rangeAt - 1];
      expect(inches(away.to - away.from), `${where}: landing`).toBeGreaterThanOrEqual(15);
    }
  });

  /**
   * No bare wall on the far side of a 96" tower — and counter on the near one.
   *
   * What finishes the run beside the tower is carried up to its top, so there
   * is no strip of tile down that side. Between the tower and the cooking
   * surface is the other case entirely: that stretch is the clearance the
   * rangetop's sheet asks for, and it stays worktop.
   */
  it("fills the far side of the tower and leaves the near side counter", () => {
    activate("package-b");
    const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-microwave"))!;
    const at = run.segments.findIndex((s) => s.slot === "slot-microwave");
    const rangeAt = run.segments.findIndex((s) => s.slot === "slot-range");
    const tower = run.segments[at];
    const towerTop = tower.modules.find((m) => m.kind === "tall")!.heightIn!;

    // What stands *on* the counter over a stretch — joinery rising off the
    // worktop rather than a wall cabinet hung eighteen inches above it.
    const standingOn = (segment: (typeof run.segments)[number]) =>
      CABINETS.filter((box) => {
        const low = inches(box.position[1] - box.size[1] / 2);
        const high = inches(box.position[1] + box.size[1] / 2);
        const centre = box.position[0];
        const counter = inches(ROOM.counterHeight);
        return (
          centre > segment.from - 1e-6 &&
          centre < segment.to + 1e-6 &&
          low <= counter + 1e-6 &&
          high > counter + 1e-6
        );
      });

    for (const side of [at - 1, at + 1]) {
      const neighbour = run.segments[side];
      if (!neighbour || neighbour.kind !== "counter") continue;
      const toward = Math.sign(rangeAt - at) === Math.sign(side - at);
      const covering = standingOn(neighbour);

      if (toward) {
        // The clearance: nothing standing on that counter at all.
        expect(
          covering.map((box) => box.id),
          `${neighbour.id} is the machine's clearance`,
        ).toEqual([]);
      } else {
        expect(covering.length, `nothing over ${neighbour.id}`).toBeGreaterThan(0);
        const top = Math.max(
          ...covering.map((box) => inches(box.position[1] + box.size[1] / 2)),
        );
        expect(top, neighbour.id).toBeCloseTo(towerTop, 6);
      }
    }
  });

  /**
   * A stainless column wears its own front, not the kitchen's.
   *
   * The machine's finish decides it, and the sheet says stainless — so what is
   * seen is the manufacturer's door panel and the glass in it. There is no
   * cabinetry inside the column's own width to paint green: the bank has its
   * panels at the two ends and the columns butt each other, which is what a
   * bank of columns is.
   */
  it("draws no cabinetry inside a column's own width", () => {
    activate("package-b");
    const wine = APPLIANCE_BY_ID[PACKAGE_BY_ID["package-b"].defaultSelection["slot-wine"]!];
    expect(wine.finish).toContain("stainless");
    expect(wine.finish).not.toContain("panel-ready");

    const column = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-wine")!;
    const module = column.modules.find((m) => m.kind === "tall")!;
    expect(module.insetIn, "a column in a bank frames itself in cabinetry").toBe(0);

    // Nothing inside its extent but the cabinet over the opening: no panel
    // standing across the machine's own face.
    const inside = CABINETS.filter(
      (box) =>
        box.position[0] > column.from + 1e-6 &&
        box.position[0] < column.to - 1e-6 &&
        box.kind === "surround",
    );
    expect(inside.map((box) => box.id), "panels inside the column").toEqual([]);
  });

  /**
   * Both shapes of housing, under the wall cabinets' top line.
   *
   * The housing is part of the wall rather than a chimney parked against it,
   * so whichever shape it is built in it stops where the cabinets do. Two
   * banks level with each other and a housing half a foot nearer the eye still
   * read as a step in an isometric view, which is why the shape that gathers
   * in is held to the cabinets' depth at the top as well.
   *
   * And the liner shows under it: a housing hung level with the tray swallows
   * it whole and reads as a box with nothing in it.
   */
  it.each(["box", "sweep"] as const)("keeps a %s housing under the cabinets' top line", (
    housingStyle,
  ) => {
    const base = activate("package-b");
    const where = `${housingStyle} housing`;
    expect(setLayoutParams({ ...base, housingStyle }).ok, where).toBe(true);

    const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
    const banks = run.uppers.filter(
      (bank) => !bank.modules.some((module) => module.kind === "hood-cabinet"),
    );
    const top = Math.max(...banks.map((bank) => (bank.band ?? [0, ROOM.wallHeight])[1]));

    const housing = CABINETS.find((box) => box.module?.kind === "hood-cabinet")!;
    expect(housing.module?.housing, where).toBe(housingStyle);
    const parts = hoodCabinetParts(
      { w: housing.size[0], h: housing.size[1], d: housing.size[2] },
      housingStyle,
    );
    const floor = housing.position[1] - housing.size[1] / 2;

    // Every section of it, the band along the bottom included.
    for (const [name, part] of [
      ["band", parts.band],
      ["base", parts.base],
      ["crown", parts.crown],
    ] as const) {
      expect(inches(floor + part.y + part.h / 2), `${where}: ${name}`).toBeLessThanOrEqual(
        inches(top) + 1e-6,
      );
    }
    // And the three sections add up to the housing exactly: nothing of it is
    // above the line and nothing of it is missing below.
    expect(inches(floor + parts.base.h + parts.cove.h + parts.crown.h), where).toBeCloseTo(
      inches(top),
      6,
    );
    // The tray it is built round: where its underside is, and its top.
    const hood = APPLIANCE_BY_ID[PACKAGE_BY_ID["package-b"].defaultSelection["slot-hood"]!];
    const liner = applianceBox(SLOT_BY_ID["slot-hood"], hood);
    const trayFloor = SLOT_BY_ID["slot-hood"].position[1] + liner.y;
    const trayTop = trayFloor + liner.h;

    // Where it gathers in, it gathers in to the cabinets' own depth, or the
    // line along the top steps forward in the drawing even though it is level.
    if (parts.cove.h > 0) {
      expect(inches(parts.top.d), where).toBeLessThanOrEqual(inches(ROOM.upperDepth) + 1e-6);
      expect(parts.cove.rings.length, `${where}: the curve`).toBeGreaterThanOrEqual(8);
      // A cove leaves the band standing straight up and turns in hardest just
      // under the flue. A taper does the same amount at every height, and this
      // is the difference between the two.
      const rings = parts.cove.rings;
      const step = (i: number) => rings[i].w - rings[i + 1].w;
      expect(step(0), `${where}: the curve is a taper`).toBeLessThan(
        step(rings.length - 2),
      );

      // And the tray stays inside it. The straight part of a swept housing is
      // only the band, so what keeps the liner in is that the curve has barely
      // left the vertical by the height the liner ends at.
      const at = trayTop - (housing.position[1] - housing.size[1] / 2) - parts.cove.y;
      const ring = rings.reduce((worst, r) =>
        Math.abs(r.y - at) < Math.abs(worst.y - at) ? r : worst,
      );
      expect(inches(ring.w), `${where}: the curve cuts the liner`).toBeGreaterThanOrEqual(
        inches(liner.w),
      );
      expect(inches(ring.d), `${where}: the curve cuts the liner`).toBeGreaterThanOrEqual(
        inches(liner.d),
      );
    }

    // The liner shows below it, and by less than the tray is tall.
    expect(inches(floor - trayFloor), `${where}: the liner under it`).toBeGreaterThan(0);
    expect(inches(floor - trayFloor), `${where}: the liner under it`).toBeLessThan(
      inches(liner.h),
    );

    // And its flanks meet what is beside them, with nothing between.
    const bank = run.uppers.find((b) =>
      b.modules.some((module) => module.kind === "hood-cabinet"),
    )!;
    const edges = [
      ...banks.flatMap((b) => [b.from, b.to]),
      ...run.segments.filter((segment) => segment.kind === "tall").flatMap((x) => [x.from, x.to]),
    ];
    for (const flank of [bank.from, bank.to]) {
      expect(
        edges.some((edge) => Math.abs(edge - flank) < 1e-6),
        `${where}: nothing meets the housing at ${inches(flank)}"`,
      ).toBe(true);
    }
  });

  /**
   * The wine column's door, to the panel drawing.
   *
   * A window in the middle of a solid door: 10-1/8" of panel at the top and
   * the bottom, and 3-3/4" down each side — variable to 2-1/2", which is the
   * range a panel is cut to. What is left is the glass, about 10-1/4" wide,
   * and the door itself starts 4" off the floor on its toe kick.
   */
  it("cuts the column's window where the panel drawing puts it", () => {
    activate("package-b");
    const wine = APPLIANCE_BY_ID[PACKAGE_BY_ID["package-b"].defaultSelection["slot-wine"]!];
    const box = applianceBox(SLOT_BY_ID["slot-wine"], wine);
    const parts = wineColumnParts(box);

    expect(inches(parts.door.w)).toBeCloseTo(17.75, 6);
    expect(inches(parts.door.h)).toBeCloseTo(79.875, 6);
    expect(inches(parts.door.y)).toBeCloseTo(4, 6);

    // The window: between 2-1/2" and 3-3/4" of solid each side.
    const { min, max } = WINE_COLUMN.glassInsetRangeIn;
    expect(inches(parts.glass.w)).toBeGreaterThanOrEqual(17.75 - max * 2 - 1e-6);
    expect(inches(parts.glass.w)).toBeLessThanOrEqual(17.75 - min * 2 + 1e-6);
    expect(inches(parts.glass.w)).toBeCloseTo(10.25, 6);

    // And 10-1/8" of solid top and bottom, which leaves 59-5/8" of glass. The
    // grille under the door is the machine's own and is not part of it.
    const [, bottom, glassBand, top] = parts.parts;
    expect(inches(bottom.band[1] - bottom.band[0])).toBeCloseTo(10.125, 6);
    expect(inches(top.band[1] - top.band[0])).toBeCloseTo(10.125, 6);
    expect(inches(glassBand.band[1] - glassBand.band[0])).toBeCloseTo(59.625, 6);
    expect(glassBand.kind).toBe("glass");
  });

  /**
   * The column stands on its own grille, not on the joiner's plinth.
   *
   * A built-in refrigerator is one piece of steel from the floor to the top of
   * its doors, and the four inches at the bottom are a grille with air getting
   * through them rather than a dark recess. A wine column beside it is the same
   * machine in a narrower box and gets the same four inches — otherwise two
   * doors hung in one run stand on two different things.
   */
  it("stands the column on its own grille rather than a painted kick", () => {
    activate("package-b");
    const wine = APPLIANCE_BY_ID[PACKAGE_BY_ID["package-b"].defaultSelection["slot-wine"]!];
    const parts = wineColumnParts(applianceBox(SLOT_BY_ID["slot-wine"], wine));

    // The bottom band is the grille, it starts on the floor, and it is the
    // toe kick's own four inches.
    const [grille] = parts.parts;
    expect(grille.kind).toBe("grille");
    expect(inches(grille.band[0])).toBeCloseTo(0, 6);
    expect(inches(grille.band[1])).toBeCloseTo(WINE_COLUMN.toeIn, 6);
    expect(grille.vents?.count ?? 0, "no air through it").toBeGreaterThan(0);

    // The front is continuous from the floor to the top of the door: no band
    // is left for somebody else to fill.
    let at = 0;
    for (const part of parts.parts) {
      expect(inches(part.band[0]), part.kind).toBeCloseTo(inches(at), 6);
      at = part.band[1];
    }
    expect(inches(at)).toBeCloseTo(inches(parts.door.y + parts.door.h), 6);

    // And every band of it is the machine's own: its steel, or the window in
    // it. The steel is the refrigerator's steel — one token, not two greys.
    for (const part of parts.parts) {
      expect(["grille", "panel", "glass"], `${part.kind}`).toContain(part.kind);
    }
    const fridge = APPLIANCE_BY_ID[PACKAGE_BY_ID["package-b"].defaultSelection["slot-fridge"]!];
    expect(wine.finish[0]).toBe("stainless");
    expect(finishSurface("realistic", wine.finish[0])).toEqual(
      finishSurface("realistic", fridge.finish[0]),
    );
  });

  /**
   * The housing and the wall cabinets beside it are one wall.
   *
   * Same top, sides touching, and one crown along the whole of it. A chimney
   * breast whose moulding stops at its own sides is a piece of furniture
   * parked against the cabinets; what a customer sees along that wall should
   * be a single line that steps forward where the breast does.
   */
  it("tops the housing level with the banks beside it, with one crown across", () => {
    activate("package-b");
    const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
    const housing = run.uppers.find((bank) =>
      bank.modules.some((module) => module.kind === "hood-cabinet"),
    )!;
    const beside = run.uppers.filter((bank) => bank !== housing);
    expect(beside.length, "no banks beside the housing").toBeGreaterThan(0);

    // Same top: the ceiling, for all of them.
    const top = (bank: (typeof run.uppers)[number]) =>
      (bank.band ?? [0, ROOM.wallHeight])[1];
    expect(inches(top(housing))).toBeCloseTo(inches(ROOM.wallHeight), 6);
    for (const bank of beside) {
      expect(inches(top(bank)), bank.id).toBeCloseTo(inches(top(housing)), 6);
      // And the same height of box: one module height along the wall.
      const band = bank.band ?? [0, ROOM.wallHeight];
      expect(inches(band[1] - band[0]), bank.id).toBeCloseTo(42, 6);
    }

    // Sides touching: no gap where a bank meets the housing.
    for (const bank of beside) {
      const gap = Math.min(
        Math.abs(bank.to - housing.from),
        Math.abs(housing.to - bank.from),
      );
      if (gap > ft(24)) continue; // a bank at the other end of the run
      expect(inches(gap), `${bank.id} to the housing`).toBeCloseTo(0, 6);
    }

    // And one crown: every bank that reaches the ceiling carries the same
    // moulding at the same height, and together they cover the whole of that
    // wall except the breast itself, which carries its own round its top
    // section because that one steps forward with it.
    const crowns = CABINETS.filter(
      (box) => /-crown-\d+$/.test(box.id) && box.id.startsWith(`upper-${run.id}`),
    );
    expect(crowns.length, "no crown along the banks").toBeGreaterThan(0);
    const ceiling = inches(ROOM.wallHeight);
    for (const crown of crowns) {
      expect(inches(crown.position[1] + crown.size[1] / 2), crown.id).toBeCloseTo(ceiling, 6);
    }
    const along = (box: (typeof crowns)[number]) => box.size[0];
    const covered = crowns.reduce((sum, crown) => sum + along(crown), 0);
    const wall = run.uppers.reduce((sum, bank) => sum + (bank.to - bank.from), 0);
    const breast = ft(
      housing.modules.find((module) => module.kind === "hood-cabinet")!.widthIn,
    );
    expect(inches(covered), "crown does not cover the banks").toBeCloseTo(
      inches(wall - breast),
      6,
    );
  });

  /**
   * Nothing hung on its own beside the breast or the tower.
   *
   * A 42" housing over a 36" rangetop overhangs the machine by three inches
   * each side, so six inches of clearance counter beside it leaves three
   * inches of wall between the housing and the oven tower's end panel. Three
   * inches is not a wall cabinet, and hung as one between two things that are
   * 24" deep it read from the room as a narrow board standing by itself,
   * twelve inches behind both of them.
   *
   * So the housing takes that stretch, in its own depth, and its flank meets
   * the tower. What is left of the rule is stated twice over: every bank on
   * that wall is wide enough to be a bank, and anything narrow in front of
   * that stretch belongs to the volume beside it rather than standing alone —
   * the tower's own three-quarter-inch end panel included, which is the side
   * of the tower and is drawn as part of it.
   */
  it("hangs no board on its own between the housing and the tower", () => {
    for (const towerSide of ["left", "right"] as const) {
      const base = activate("package-b");
      const where = `tower ${towerSide}`;
      expect(setLayoutParams({ ...base, towerSide }).ok, where).toBe(true);

      const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
      const along = run.axis === "x" ? 0 : 2;
      const across = run.axis === "x" ? 2 : 0;

      // Every bank is a bank: no narrower than the narrowest wall cabinet
      // anybody stocks.
      for (const bank of run.uppers) {
        expect(inches(bank.to - bank.from), `${where}: ${bank.id}`).toBeGreaterThanOrEqual(
          12 - 1e-6,
        );
      }

      // Both flanks of the housing meet something: a bank, or a tall unit.
      const housing = run.uppers.find((bank) =>
        bank.modules.some((module) => module.kind === "hood-cabinet"),
      )!;
      const edges = [
        ...run.uppers.filter((bank) => bank !== housing).flatMap((bank) => [bank.from, bank.to]),
        ...run.segments.filter((s) => s.kind === "tall").flatMap((s) => [s.from, s.to]),
      ];
      for (const flank of [housing.from, housing.to]) {
        const meets = edges.some((edge) => Math.abs(edge - flank) < 1e-6);
        expect(meets, `${where}: nothing meets the housing at ${inches(flank)}"`).toBe(true);
      }

      // And nothing narrow standing by itself along that stretch of wall.
      const tower = run.segments.find((s) => s.kind === "tall" && s.slot === "slot-microwave")!;
      const zone = [
        Math.min(housing.from, tower.from),
        Math.max(housing.to, tower.to),
      ] as const;
      const volumes = new Set(
        run.segments.filter((segment) => segment.kind === "tall").map((segment) => segment.id),
      );
      for (const box of CABINETS) {
        if (box.run !== run.id || box.kind === "toe") continue;
        const centre = box.position[along];
        if (centre < zone[0] || centre > zone[1]) continue;
        if (box.size[along] >= ft(2)) continue;
        expect(
          box.outline !== undefined && volumes.has(box.outline),
          `${where}: ${box.id} is ${inches(box.size[along])}" wide and stands on its own`,
        ).toBe(true);
      }

      // The end panel is the tower's side: same depth, same face.
      const side = CABINETS.find(
        (box) => box.run === run.id && box.module?.kind === "panel" && box.outline === tower.id,
      )!;
      expect(side, `${where}: no end panel on the tower`).toBeDefined();
      expect(inches(side.size[along]), `${where}: the end panel`).toBeCloseTo(0.75, 6);
      const body = CABINETS.find(
        (box) => box.outline === tower.id && box.module?.kind === "tall",
      )!;
      expect(inches(side.size[across]), `${where}: the panel's depth`).toBeCloseTo(
        inches(body.size[across]),
        6,
      );
      expect(inches(side.position[across]), `${where}: the panel's face`).toBeCloseTo(
        inches(body.position[across]),
        6,
      );
    }
  });

  /**
   * A package may say how its kitchen is arranged.
   *
   * Which leg carries the sink is usually the customer's decision, and it
   * stays theirs. It is not B's: that package's cooking wall carries an oven
   * tower as well as the cooking surface, and a leg with the sink on it too
   * has nothing left for the landings each side of the burners. So B is drawn
   * with the sink on the other leg — which puts the refrigerator on the
   * cooking wall, because one leg will not carry both.
   */
  it("arranges package B around the wall its tower stands on", () => {
    const base = activate("package-b");
    expect(base.sinkLeg).toBe("left");
    expect(base.fridgeEnd).toBe("back");

    // And the sink is actually there, not just asked for.
    const sink = RUNS.find((run) => run.segments.some((s) => s.fixture))!;
    expect(sink.id).toBe("left");
    const range = RUNS.find((run) => run.segments.some((s) => s.slot === "slot-range"))!;
    expect(range.id).toBe("back");
  });

  /**
   * Eighteen inches of counter each side of the burners.
   *
   * That is what a landing is built at: wide enough to put a pan down on, and
   * enough open counter that the tower beside the cooking surface does not
   * crowd it. Both sides ask for it, the wall's spare inches go there before
   * anywhere else, and the room a package is put into is sized for it — which
   * is the whole reason B moves the sink to the other leg.
   *
   * A wall that cannot pay comes down in three-inch steps and takes both sides
   * down together, never under six on the tower side and never under rule 4's
   * own minimum on the other.
   */
  it("puts eighteen inches of counter each side of the cooking surface", () => {
    const base = activate("package-b");
    const { counterIn, wantIn } = LAYOUT_LIMITS.towerSpacer;

    /** The two stretches beside the machine, in inches. */
    const landings = () => {
      const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
      const at = run.segments.findIndex((segment) => segment.slot === "slot-range");
      const width = (segment: (typeof run.segments)[number] | undefined) =>
        segment && segment.kind === "counter" ? inches(segment.to - segment.from) : 0;
      return [width(run.segments[at - 1]), width(run.segments[at + 1])];
    };

    // The room the package landed in: both sides at what they asked for.
    for (const side of landings()) expect(side).toBe(wantIn);

    // A shorter wall builds rather than refusing, in whole cabinet steps,
    // both sides coming down together and neither under its own floor.
    for (const less of [6, 12]) {
      const backWallIn = base.backWallIn - less;
      const where = `${backWallIn}" of back wall`;
      expect(setLayoutParams({ ...base, backWallIn }).ok, where).toBe(true);
      const [near, far] = landings();
      expect(near + far, where).toBe(wantIn * 2 - less);
      for (const side of [near, far]) {
        expect(side, where).toBeGreaterThan(counterIn);
        expect(side % 3, where).toBeCloseTo(0, 6);
        expect(side, where).toBeLessThanOrEqual(wantIn);
      }
    }
  });

  /**
   * Five inches of counter each side of the cooking surface.
   *
   * PCG366W's own figure — E on the drawing, 5" to a combustible surface —
   * and what it forbids is a tower, a tall filler or a panel standing on the
   * stone within five inches of the burners. The wide landing covers one side
   * on its own; the other is the six inches between the machine and the tower.
   */
  it("leaves five inches of clear counter each side of the rangetop", () => {
    for (const towerSide of ["left", "right"] as const) {
      const base = activate("package-b");
      const where = `tower ${towerSide}`;
      expect(setLayoutParams({ ...base, towerSide }).ok, where).toBe(true);

      const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
      const range = run.segments.find((s) => s.slot === "slot-range")!;
      const clear = ft(5);

      for (const box of CABINETS) {
        const [w, h] = box.size;
        const [x, y] = box.position;
        const low = y - h / 2;
        const high = y + h / 2;
        // Anything standing on the counter: a tower, a tall filler, a panel.
        // A wall cabinet hung 18" above it is not what the clearance is about,
        // and the hood over the machine is the clearance itself.
        if (low > ROOM.counterHeight + 1e-6 || high <= ROOM.counterHeight + 1e-6) continue;
        if (box.slot === "slot-hood" || box.kind === "counter") continue;
        const left = x - w / 2;
        const right = x + w / 2;
        const inTheZone = right > range.from - clear + 1e-6 && left < range.to + clear - 1e-6;
        expect(inTheZone, `${where}: ${box.id} stands within 5" of the burners`).toBe(false);
      }
    }
  });

  /**
   * The tower is built round the microwave's handle.
   *
   * A person reaches to a height; the joiner cuts the hole that puts the
   * handle there. 54" is the chest of somebody six foot, the handle is 39" up
   * the machine's own front, and the sill is the difference — 15", inside the
   * 4-3/4" to 18" the drawing allows. An 18" sill, which is what this was
   * built to before, put the handle at 57" and the microwave's door at 66".
   */
  it("cuts the opening to land the microwave's handle where a hand is", () => {
    const base = activate("package-b");
    expect(base.microwaveHandleIn).toBe(54);

    const sill = comboSillFor(base.microwaveHandleIn);
    expect(sill.sillIn).toBe(15);
    expect(sill.clamped).toBe(false);

    const tower = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-microwave")!;
    const module = tower.modules.find((m) => m.kind === "tall")!;
    expect(module.sillIn).toBe(sill.sillIn);
    // And the machine stands on it rather than on the floor.
    expect(inches(SLOT_BY_ID["slot-microwave"].position[1])).toBeCloseTo(sill.sillIn, 6);

    // Which is the whole point: the handle lands at chest height.
    const oven = APPLIANCE_BY_ID[PACKAGE_BY_ID["package-b"].defaultSelection["slot-microwave"]!];
    const box = applianceBox(SLOT_BY_ID["slot-microwave"], oven);
    const microwave = comboOvenParts({ w: box.w, h: box.h }).doors.find(
      (door) => door.kind === "microwave",
    )!;
    const handleIn = inches(SLOT_BY_ID["slot-microwave"].position[1] + microwave.handleAt!);
    expect(handleIn).toBeGreaterThanOrEqual(50);
    expect(handleIn).toBeLessThanOrEqual(56);
  });

  it("clamps to what the drawing allows, and follows the parameter between", () => {
    const base = activate("package-b");
    for (const [asked, expected] of [
      // Below the reachable band, inside it, and above it: 43-3/4" to 57" is
      // what a 4-3/4"-18" sill can put the handle at.
      [43, COMBO_OVEN.sillIn.min + COMBO_OVEN.microwaveHandleIn],
      [44, 44],
      [50, 50],
      [54, 54],
      [57, 57],
      [60, COMBO_OVEN.sillIn.max + COMBO_OVEN.microwaveHandleIn],
    ] as const) {
      const { sillIn, clamped } = comboSillFor(asked);
      expect(comboHandleAt(sillIn), `${asked}"`).toBeCloseTo(expected, 6);
      expect(clamped, `${asked}"`).toBe(Math.abs(expected - asked) > 1e-6);
      expect(sillIn).toBeGreaterThanOrEqual(COMBO_OVEN.sillIn.min);
      expect(sillIn).toBeLessThanOrEqual(COMBO_OVEN.sillIn.max);

      // And the room still builds at every one the slider can reach.
      if (asked < PARAM_LIMITS.microwaveHandleIn.min) continue;
      expect(setLayoutParams({ ...base, microwaveHandleIn: asked }).ok, `${asked}"`).toBe(true);
      expect(checkLayout(), `${asked}"`).toEqual([]);
    }
  });

  it("keeps every one of them 96 inches tall", () => {
    const bank = bankOf("package-b");
    for (const segment of bank) {
      for (const module of segment.modules) {
        if (!module.slot) continue;
        expect(module.heightIn, `${segment.id} is not a full-height unit`).toBe(96);
      }
    }
  });
});

/**
 * The island's two machines, when there is no island.
 *
 * They belong on the refrigerator's leg, and no leg D13 allows is long enough
 * to carry them, so every no-island room is built without them. That is not a
 * refusal: they are the two things a kitchen can do without, and what is left
 * out is a line on the install list and two fewer on the appliance count.
 */
describe("no island, in every package", () => {
  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  it("builds without them rather than refusing, and passes every rule doing it", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      const id = entry.id;
      const base = activate(id);
      // A package whose two island machines are an 84" column and a tall oven
      // has nothing to leave out: they stand in the run whether or not there
      // is an island, and the island is a prep island. Only the packages that
      // put a machine *on* the island can lose one.
      const byId = slotsOf(entry);
      const island = (["slot-microwave", "slot-wine"] as const).filter(
        (slotId) => !byId[slotId].tallUnit,
      );
      for (const cornerType of ["blind", "lazy-susan"] as const) {
        for (const fridgeEnd of ["left", "back"] as const) {
          const sinkLeg = fridgeEnd === "left" ? ("back" as const) : ("left" as const);
          const where = `${id} / ${cornerType} / fridge ${fridgeEnd}`;
          const result = setLayoutParams({
            ...base,
            hasIsland: false,
            cornerType,
            fridgeEnd,
            sinkLeg,
          });
          // Never a refusal over these two. A no-island room that will not
          // build is one whose walls are wrong, and that is a different
          // sentence with a different way out.
          if (!result.ok) {
            for (const reason of result.reasons) expectPrintable(reason, where);
            for (const reason of result.reasons) {
              expect(["refusal.wallShort", "refusal.wallLong"], where).toContain(reason.key);
            }
            continue;
          }
          expect(checkLayout(), where).toEqual([]);

          expect([...LAYOUT.omitted], where).toEqual(island);
          // Left out of the room, not stranded in it — and what was never the
          // island's is still standing in the run.
          const slots = RUNS.flatMap((run) => run.segments).map((s) => s.slot);
          for (const slotId of ["slot-microwave", "slot-wine"] as const) {
            if (island.includes(slotId)) expect(slots, where).not.toContain(slotId);
            else expect(slots, where).toContain(slotId);
          }
          // And the kitchen is still a kitchen.
          for (const slot of ["slot-range", "slot-fridge", "slot-dishwasher"] as const) {
            expect(slots, where).toContain(slot);
          }
        }
      }
    }
  });
});
