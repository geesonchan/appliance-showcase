import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS, type LayoutParams } from "./layoutTemplate";
import { BUILDABLE_PACKAGES, DEFAULT_PACKAGE } from "./packages";
import { ROOM, RUNS, WINDOWS, ft } from "./room";
import { WINDOW, lowestSillIn } from "./windows";

/**
 * A window is a constraint before it is a mood.
 *
 * Nothing hangs in front of one, the sink goes under it, and the sill clears
 * the worktop. Every one of those is arithmetic somebody can be wrong about,
 * so every one of them is checked here — against every package, over the
 * parameter space, with a window and without. See docs/decisions.md D11
 * rule 13.
 */
const inches = (feet: number) => feet * 12;

/** The rooms worth trying: both legs, both corners, and the two ends. */
const ARRANGEMENTS: Partial<LayoutParams>[] = [
  {},
  { cornerType: "lazy-susan" },
  { fridgeEnd: "back", sinkLeg: "left" },
  { fridgeEnd: "left", sinkLeg: "back" },
  { hasIsland: false },
  { backWallIn: 168 },
  { backWallIn: 192 },
  { leftWallIn: 168 },
  { towerSide: "left" },
  { housingStyle: "sweep" },
  { sinkUnderWindow: false },
  { windows: [] },
];

function activate(id: string): LayoutParams {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage(id);
  expect(result.ok, `${id} will not build`).toBe(true);
  return { ...DEFAULT_PARAMS, ...(result.adjusted ?? {}) };
}

/** Every window, against every bank and every tall unit in the room. */
function expectNothingInFrontOfTheWindows(where: string) {
  for (const window of WINDOWS) {
    const run = RUNS.find((item) => item.id === window.wall)!;
    const overlap = (a: readonly [number, number], b: readonly [number, number]) =>
      Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

    // No wall cabinets over it: the bank breaks at the opening.
    for (const bank of run.uppers) {
      expect(
        inches(overlap(window.along, [bank.from, bank.to])),
        `${where}: ${bank.id} hangs over the ${window.wall} window`,
      ).toBeLessThanOrEqual(1e-6);
    }

    // And nothing floor-to-ceiling in front of it, as a box in the room
    // rather than as a span in the plan.
    const along = run.axis === "x" ? 0 : 2;
    for (const box of CABINETS) {
      if (box.run !== run.id || box.kind === "toe" || box.kind === "counter") continue;
      const top = box.position[1] + box.size[1] / 2;
      const bottom = box.position[1] - box.size[1] / 2;
      if (top <= window.band[0] + 1e-6 || bottom >= window.band[1] - 1e-6) continue;
      const span = [
        box.position[along] - box.size[along] / 2,
        box.position[along] + box.size[along] / 2,
      ] as const;
      expect(
        inches(overlap(window.along, span)),
        `${where}: ${box.id} stands in front of the ${window.wall} window`,
      ).toBeLessThanOrEqual(1e-6);
    }

    // The sill clears the worktop, and the head clears the ceiling.
    expect(window.sillIn, where).toBeGreaterThanOrEqual(lowestSillIn());
    expect(inches(window.band[1]), where).toBeLessThanOrEqual(inches(ROOM.wallHeight) + 1e-6);
  }
}

/**
 * How far the nearest cabinet stands from each side of every window's casing.
 *
 * Measured off the room rather than worked out from the wall's length: what a
 * customer sees is the first cabinet door each side of the opening. A filler
 * is not a cabinet — the scribe against the casing is one, and so is whatever
 * remainder the bank could not put anywhere else.
 */
function casingGaps() {
  return WINDOWS.map((window) => {
    const run = RUNS.find((item) => item.id === window.wall)!;
    const casing = [
      window.along[0] - ft(WINDOW.frameIn),
      window.along[1] + ft(WINDOW.frameIn),
    ] as const;
    let before: number | null = null;
    let after: number | null = null;

    for (const bank of run.uppers) {
      let cursor = bank.from;
      for (const module of bank.modules) {
        const from = cursor;
        const to = cursor + ft(module.widthIn);
        cursor = to;
        if (module.kind === "filler") continue;
        if (to <= casing[0] + 1e-6) {
          const gap = inches(casing[0] - to);
          before = before === null ? gap : Math.min(before, gap);
        } else if (from >= casing[1] - 1e-6) {
          const gap = inches(from - casing[1]);
          after = after === null ? gap : Math.min(after, gap);
        }
      }
    }
    return { wall: window.wall, before, after };
  });
}

/** And the sink under whichever window is on its own leg. */
function expectTheSinkUnderTheWindow(where: string) {
  for (const window of WINDOWS) {
    const run = RUNS.find((item) => item.id === window.wall)!;
    const sink = run.segments.find((segment) => segment.fixture === "fixture-sink");
    if (!sink) continue;
    const off = Math.abs(
      inches((sink.from + sink.to) / 2 - (window.along[0] + window.along[1]) / 2),
    );
    expect(off, `${where}: the sink is ${off}" from the window`).toBeLessThanOrEqual(
      WINDOW.sinkOffsetIn + 1e-6,
    );
  }
}

describe("a window is a hole nothing hangs in front of", () => {
  afterAll(() => {
    setActivePackage(DEFAULT_PACKAGE.id);
    setLayoutParams(DEFAULT_PARAMS);
  });

  it("builds every package in every arrangement, or refuses with a reason", () => {
    let built = 0;
    for (const entry of BUILDABLE_PACKAGES) {
      const base = activate(entry.id);
      for (const over of ARRANGEMENTS) {
        const where = `${entry.id} ${JSON.stringify(over)}`;
        const result = setLayoutParams({ ...base, ...over });
        if (!result.ok) {
          expect(result.reasons.length, `${where}: refused with no reason`).toBeGreaterThan(0);
          for (const reason of result.reasons) expect(reason.key, where).toMatch(/^refusal\./);
          continue;
        }
        built += 1;
        expectNothingInFrontOfTheWindows(where);
        if (over.sinkUnderWindow !== false) expectTheSinkUnderTheWindow(where);
      }
    }
    // A rule that refused everything would pass the loop above without ever
    // having drawn a window.
    expect(built).toBeGreaterThan(ARRANGEMENTS.length);
  });

  it("puts the default window over the sink, on whichever leg the sink is on", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      const base = activate(entry.id);
      for (const sinkLeg of ["left", "back"] as const) {
        const fridgeEnd = sinkLeg === "left" ? "back" : "left";
        const result = setLayoutParams({ ...base, sinkLeg, fridgeEnd });
        if (!result.ok) continue;
        const where = `${entry.id} sink on the ${sinkLeg}`;
        expect(WINDOWS.length, where).toBe(1);
        expect(WINDOWS[0].wall, where).toBe(sinkLeg);
        expectTheSinkUnderTheWindow(where);
      }
    }
  });

  /**
   * The same gap each side of the casing, and never less than three inches.
   *
   * A cabinet hung hard against a window case is a cabinet nobody can trim
   * out, and one side three inches clear with the other five is what a
   * customer sees before they see anything else. Both come out of the bank
   * rather than out of whatever the wall had spare, which is why the window
   * itself slides along the wall until the two sides match. D11 rule 13.
   */
  it("leaves the same gap each side of every window", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      const base = activate(entry.id);
      for (const over of ARRANGEMENTS) {
        const where = `${entry.id} ${JSON.stringify(over)}`;
        if (!setLayoutParams({ ...base, ...over }).ok) continue;
        for (const gaps of casingGaps()) {
          for (const gap of [gaps.before, gaps.after]) {
            if (gap === null) continue;
            expect(gap, `${where}: ${gaps.wall} window`).toBeGreaterThanOrEqual(
              WINDOW.revealIn - 1e-6,
            );
          }
          if (gaps.before === null || gaps.after === null) continue;
          // To the eighth a cabinetmaker works to.
          expect(
            Math.abs(gaps.before - gaps.after),
            `${where}: ${gaps.wall} window, ${gaps.before}" one side and ${gaps.after}" the other`,
          ).toBeLessThanOrEqual(0.125 + 1e-6);
        }
      }
    }
  });

  /**
   * And nothing over the head of one either: the wall carries on to the top
   * line, and no bank is hung in the strip between the window and the ceiling.
   */
  it("leaves the wall above a window bare", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      const base = activate(entry.id);
      expect(setLayoutParams(base).ok).toBe(true);
      for (const window of WINDOWS) {
        const run = RUNS.find((item) => item.id === window.wall)!;
        for (const bank of run.uppers) {
          const over =
            Math.min(window.along[1], bank.to) - Math.max(window.along[0], bank.from);
          expect(inches(over), `${entry.id}: ${bank.id}`).toBeLessThanOrEqual(1e-6);
        }
      }
    }
  });

  it("builds a room with no window at all", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      const base = activate(entry.id);
      const result = setLayoutParams({ ...base, windows: [] });
      expect(result.ok, `${entry.id} with no window`).toBe(true);
      expect(WINDOWS).toEqual([]);
    }
  });

  it("refuses a sill the worktop would run into", () => {
    const base = activate(DEFAULT_PACKAGE.id);
    const low = { ...DEFAULT_PARAMS.windows[0], sillIn: lowestSillIn() - 1 };
    const result = setLayoutParams({ ...base, windows: [low] });
    expect(result.ok).toBe(false);
    expect(result.reasons.map((reason) => reason.key)).toContain("refusal.windowSill");
    // And the way out is the sill it may have.
    const suggestion = result.reasons.find((r) => r.key === "refusal.windowSill")!.suggestion!;
    expect(setLayoutParams({ ...base, ...suggestion.patch }).ok).toBe(true);
  });

  it("refuses a window with a tall unit screwed over it", () => {
    const base = activate("package-b");
    const fridge = RUNS.flatMap((run) => run.segments).find(
      (segment) => segment.slot === "slot-fridge",
    )!;
    const behind = {
      ...DEFAULT_PARAMS.windows[0],
      wall: "back" as const,
      centerIn: inches((fridge.from + fridge.to) / 2),
    };
    const result = setLayoutParams({ ...base, windows: [behind] });
    expect(result.ok).toBe(false);
    expect(result.reasons.map((reason) => reason.key)).toContain("refusal.windowBlocked");
    // And the way out builds.
    const suggestion = result.reasons.find((r) => r.key === "refusal.windowBlocked")!.suggestion!;
    expect(setLayoutParams({ ...base, ...suggestion.patch }).ok).toBe(true);
  });

  /**
   * The sink is slid under a window that named its own place, and refuses when
   * the run will not slide that far — a sink four feet from the window it was
   * supposed to be under is a room nobody asked for.
   */
  it("slides the sink under a window that names a place, or says why not", () => {
    const base = activate(DEFAULT_PACKAGE.id);
    const sinkRun = () => RUNS.find((run) => run.id === "back")!;
    const before = sinkRun().segments.find((segment) => segment.fixture === "fixture-sink")!;
    const wanted = inches((before.from + before.to) / 2) + 9;

    const window = { ...DEFAULT_PARAMS.windows[0], wall: "back" as const, centerIn: wanted };
    const result = setLayoutParams({ ...base, windows: [window] });
    if (result.ok) {
      // Against the window as built rather than as asked for: the opening
      // slides along the wall as well, to keep the gap either side of it even.
      const after = sinkRun().segments.find((segment) => segment.fixture === "fixture-sink")!;
      const glass = inches((WINDOWS[0].along[0] + WINDOWS[0].along[1]) / 2);
      expect(Math.abs(inches((after.from + after.to) / 2) - glass)).toBeLessThanOrEqual(
        WINDOW.sinkOffsetIn,
      );
      // And it did move toward where it was asked for.
      expect(Math.abs(glass - wanted)).toBeLessThanOrEqual(WINDOW.sinkOffsetIn);
    } else {
      expect(result.reasons.map((reason) => reason.key)).toContain("refusal.sinkFromWindow");
    }
  });
});
