import { afterAll, describe, expect, it } from "vitest";
import { applianceBox } from "./applianceBox";
import { CABINETS } from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams } from "./layoutState";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  type LayoutParams,
  type Refusal,
} from "./layoutTemplate";
import { BUILDABLE_PACKAGES, DEFAULT_PACKAGE, PACKAGE_BY_ID, slotsOf } from "./packages";
import { RUNS, ft } from "./room";
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
        out.push({ cornerType, hasIsland, fridgeEnd, sinkLeg });
        // ...and against the ends of both walls, where the room is tightest.
        for (const backWallIn of [PARAM_LIMITS.backWallIn.min, 144, PARAM_LIMITS.backWallIn.max]) {
          for (const leftWallIn of [PARAM_LIMITS.leftWallIn.min, 144, PARAM_LIMITS.leftWallIn.max]) {
            out.push({ cornerType, hasIsland, fridgeEnd, sinkLeg, backWallIn, leftWallIn });
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
describe("a freestanding refrigerator stands on its own", () => {
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

  it("builds nothing at all round a freestanding one", () => {
    activate("package-c");
    for (const over of COMBINATIONS) {
      if (!setLayoutParams(params(over)).ok) continue;
      expect(fridgeBoxes(), `package-c ${JSON.stringify(over)}`).toEqual([]);
    }
  });

  it("fills no leftover round it, because there is no opening to fill", () => {
    activate("package-c");
    const slot = SLOT_BY_ID["slot-fridge"];
    const appliance = APPLIANCE_BY_ID[PACKAGE_BY_ID["package-c"].defaultSelection["slot-fridge"]!];

    // 84" of space and a 72" refrigerator: the twelve inches above it are the
    // room, not a panel the cabinetmaker makes.
    expect(slot.cutout.h).toBeGreaterThan(appliance.heightIn!);
    const box = applianceBox(slot, appliance);
    expect(box.filler).toEqual({ below: 0, above: 0, eachSide: 0 });
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
