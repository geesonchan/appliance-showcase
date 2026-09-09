import { afterAll, describe, expect, it } from "vitest";
import { applianceBox } from "./applianceBox";
import { cooktopHeight } from "./rangeModel";
import { CABINETS } from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { dimensionsFor } from "./dimensions";
import { checkLayout } from "./layoutRules";
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
        const [w, h, d] = box.size;
        const [x, y, z] = box.position;
        // Anything whose body is inside the band, over the machine.
        const low = y - h / 2;
        const high = y + h / 2;
        const overlapsBand = high > cooktop + 1e-6 && low < under - 1e-6;
        const overlapsRange = x + w / 2 > segment.from + 1e-6 && x - w / 2 < segment.to - 1e-6;
        expect(
          overlapsBand && overlapsRange,
          `${entry.id}: ${box.id} stands between the cooking surface and the hood`,
        ).toBe(false);
        expect(d).toBeGreaterThan(0);
        expect(z).toBeDefined();
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
      expect(Math.abs(towerAt - rangeAt), where).toBe(2);
      expect(towerAt < rangeAt, where).toBe(towerSide === "left");

      const between = run.segments[(towerAt + rangeAt) / 2];
      expect(inches(between.to - between.from), `${where}: spacer`).toBeGreaterThanOrEqual(6);
      expect(inches(between.to - between.from), `${where}: spacer`).toBeLessThanOrEqual(12);

      // The far side of the machine, which is the landing a pan comes off on.
      const away = run.segments[towerAt < rangeAt ? rangeAt + 1 : rangeAt - 1];
      expect(inches(away.to - away.from), `${where}: landing`).toBeGreaterThanOrEqual(15);
    }
  });

  /**
   * No bare wall beside a 96" tower.
   *
   * The stretch each side of it — the spice pull-out on one, whatever finishes
   * the run on the other — is carried from the counter to the top of the
   * tower in finished panel, so the three of them read as one wall of joinery
   * rather than as a tower with a slot of tile down each side.
   */
  it("fills the wall either side of the tower, counter to top", () => {
    activate("package-b");
    const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-microwave"))!;
    const at = run.segments.findIndex((s) => s.slot === "slot-microwave");
    const tower = run.segments[at];
    const towerTop = tower.modules.find((m) => m.kind === "tall")!.heightIn!;

    for (const neighbour of [run.segments[at - 1], run.segments[at + 1]]) {
      if (!neighbour || neighbour.kind !== "counter") continue;
      const covering = CABINETS.filter((box) => {
        const low = inches(box.position[1] - box.size[1] / 2);
        const high = inches(box.position[1] + box.size[1] / 2);
        const centre = box.position[0];
        return (
          centre > neighbour.from - 1e-6 &&
          centre < neighbour.to + 1e-6 &&
          high > inches(ROOM.counterHeight) + 1e-6 &&
          low < towerTop - 1e-6
        );
      });
      expect(
        covering.length,
        `nothing over ${neighbour.id}, beside a ${towerTop}" tower`,
      ).toBeGreaterThan(0);
      // To the top of the tower, not to the underside of a wall cabinet.
      const top = Math.max(
        ...covering.map((box) => inches(box.position[1] + box.size[1] / 2)),
      );
      expect(top, neighbour.id).toBeCloseTo(towerTop, 6);
    }
  });

  it("hangs the tower's opening at the sill the package asks for", () => {
    activate("package-b");
    const spec = slotsOf(PACKAGE_BY_ID["package-b"])["slot-microwave"];
    expect(spec.sillIn).toBe(18);

    const tower = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-microwave")!;
    const module = tower.modules.find((m) => m.kind === "tall")!;
    expect(module.sillIn).toBe(spec.sillIn);
    // And the machine stands on it rather than on the floor.
    expect(inches(SLOT_BY_ID["slot-microwave"].position[1])).toBeCloseTo(spec.sillIn, 6);
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
