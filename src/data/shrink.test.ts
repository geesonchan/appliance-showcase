import { afterAll, describe, expect, it } from "vitest";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams } from "./layoutState";
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  feasibleRange,
  wallRequirement,
  type LayoutParams,
} from "./layoutTemplate";
import { LAYOUT_POLICY } from "./layoutPolicy";
import { BUILDABLE_PACKAGES, DEFAULT_PACKAGE } from "./packages";
import { RUN_BY_ID, RUNS } from "./room";

const params = (over: Partial<LayoutParams> = {}): LayoutParams => ({ ...DEFAULT_PARAMS, ...over });
const inches = (feet: number) => feet * 12;

afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

/**
 * The elements on a run, by name.
 *
 * An element is a thing the plan asks for — the range, the sink, the landing
 * between them, the filler that finishes the run — not the boxes a stretch
 * happens to divide into. A 60" landing is two cabinets and a 30" one is one
 * cabinet, and that is the stretch doing its job rather than an element going
 * missing. Segment ids carry the element name with a piece index after it.
 */
const elements = (runId: "back" | "left") =>
  new Set(
    RUN_BY_ID[runId].segments.map((segment) =>
      segment.id.replace(new RegExp(`^${runId}-`), "").replace(/-\d+$/, ""),
    ),
  );

/**
 * A short wall shrinks its elements; it does not delete them.
 *
 * This is the bug, stated as a test. The back wall's minimum used to be reached
 * by dropping the cabinet after the dishwasher, which left the dishwasher hard
 * against the right wall with nothing for its door to swing past — while the
 * refrigerator on the other leg kept a filler for exactly that. One rule,
 * applied to one machine and not the other.
 */
describe("a wall at its minimum still has everything on it", () => {
  it("carries every element it carries at its maximum, plus the terminal filler", () => {
    for (const entry of BUILDABLE_PACKAGES) {
      setLayoutParams(DEFAULT_PARAMS);
      const switched = setActivePackage(entry.id);
      expect(switched.ok, entry.id).toBe(true);
      // The room the package landed in: a package with three tall units in one
      // run grows the wall it stands on, and sweeping from the default room
      // would be sweeping a room this package was never in.
      const base = params(switched.adjusted ?? {});

      for (const [key, runId] of [
        ["backWallIn", "back"],
        ["leftWallIn", "left"],
      ] as const) {
        const range = feasibleRange(base, key);
        expect(range, `${entry.id} ${key}`).toBeTruthy();

        expect(setLayoutParams({ ...base, [key]: range!.maxIn }).ok).toBe(true);
        const atMax = elements(runId);

        expect(setLayoutParams({ ...base, [key]: range!.minIn }).ok).toBe(true);
        const atMin = elements(runId);

        for (const element of atMax) {
          expect(
            atMin.has(element),
            `${entry.id} ${runId}: ${element} is missing at the minimum`,
          ).toBe(true);
        }
        expect(checkLayout(), `${entry.id} ${runId} at minimum`).toEqual([]);
      }
    }
  });

  it("finishes the run the refrigerator does not with a filler, at every length", () => {
    setLayoutParams(DEFAULT_PARAMS);
    setActivePackage(DEFAULT_PACKAGE.id);
    const range = feasibleRange(params(), "backWallIn")!;

    for (let value = range.minIn; value <= range.maxIn; value += PARAM_LIMITS.backWallIn.step) {
      expect(setLayoutParams(params({ backWallIn: value })).ok, `${value}"`).toBe(true);
      const back = RUN_BY_ID.back.segments;
      const last = back[back.length - 1];
      const module = last.modules[last.modules.length - 1];
      // Never the appliance itself, and never nothing.
      expect(module.kind, `${value}": run finishes on ${last.id}`).toBe("filler");
      expect(module.widthIn, `${value}"`).toBeGreaterThanOrEqual(LAYOUT_POLICY.terminalIn.atWall);
    }
  });

  it("never lets an appliance be the last thing on a run", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      const sinkLeg = fridgeEnd === "left" ? "back" : "left";
      expect(setLayoutParams(params({ fridgeEnd, sinkLeg })).ok).toBe(true);
      for (const run of RUNS) {
        const last = run.segments[run.segments.length - 1];
        const module = last.modules[last.modules.length - 1];
        expect(["opening", "tall-open"], `${run.id} finishes on ${last.id}`).not.toContain(
          module.kind,
        );
      }
    }
  });
});

/**
 * The order a wall gives ground in, from `layout.shrinkOrder`.
 *
 * Surplus is handed out in the reverse of it, so a stretch that gives up its
 * slack first never carries more of it than one that gives up last.
 */
describe("which stretch gives up its slack first", () => {
  it("never leaves the stretch that gives first with more slack than the one that gives last", () => {
    setLayoutParams(DEFAULT_PARAMS);
    setActivePackage(DEFAULT_PACKAGE.id);
    const range = feasibleRange(params(), "backWallIn")!;

    for (let value = range.minIn; value <= range.maxIn; value += PARAM_LIMITS.backWallIn.step) {
      expect(setLayoutParams(params({ backWallIn: value })).ok, `${value}"`).toBe(true);
      const back = RUN_BY_ID.back.segments;
      // Summed, not found: a stretch wider than a cabinet is cut into two or
      // three boxes, and measuring only the first of them reads a 39" landing
      // as a 21" one.
      const widthOf = (id: string) =>
        back
          .filter((segment) => segment.id.startsWith(id))
          .reduce((sum, segment) => sum + inches(segment.to - segment.from), 0);

      const toSink = widthOf("back-range-landing-right");
      const cornerSide = widthOf("back-range-landing-left");
      if (toSink === 0 || cornerSide === 0) continue;

      const slack = (widthIn: number, minIn: number) => widthIn - minIn;
      // Leo's order: the corner side gives first, so it is the one that is
      // never carrying slack the range-to-sink stretch has gone without. The
      // three inches are the module grid — a stretch is cut to whole cabinets
      // and cannot hand over the last inch of a box.
      expect(LAYOUT_POLICY.shrinkOrder.indexOf("corner-to-range")).toBeLessThan(
        LAYOUT_POLICY.shrinkOrder.indexOf("range-to-sink"),
      );
      expect(
        slack(cornerSide, LAYOUT_POLICY.rangeLandingIn.narrowIn),
        `${value}": the corner side is fatter than the stretch toward the sink`,
      ).toBeLessThanOrEqual(slack(toSink, LAYOUT_POLICY.rangeLandingIn.wideIn) + 3);
    }
  });

  it("puts the wall's minimum at the sum of its elements, never below", () => {
    setLayoutParams(DEFAULT_PARAMS);
    for (const leg of ["back", "left"] as const) {
      const requirement = wallRequirement(params(), leg);
      const summed = requirement.items.reduce((sum, item) => sum + item.widthIn, 0);
      const across = leg === "back" ? summed - requirement.minimumIn : 0;
      expect(requirement.minimumIn, leg).toBe(summed - across);
      // And nothing in the bill is a zero: every element is there at its own
      // minimum rather than dropped to make the sum work.
      for (const item of requirement.items) {
        expect(item.widthIn, `${leg}: ${item.labelKey}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
