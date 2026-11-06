import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "../data/catalogue";
import { candidatesFor } from "../data/candidates";
import { dropsIntoCounter } from "../data/cookingSurface";
import { recordHoodModel } from "../data/hoodMount";
import { DEFAULT_PARAMS, PARAM_LIMITS, feasibleRange, paramLimitsFor, wallRequirement } from "../data/layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE } from "../data/packages";
import { RUNS } from "../data/room";
import * as room from "../data/room";
import { resetRoom } from "../data/testRoom";
import { kitchenNow, openSharedLink } from "./openLink";
import { writeLink } from "./shareLink";
import { useAppStore } from "./useAppStore";

/**
 * D11 rule 12's counter between an oven tower and the cooking surface: at
 * least 9" in every room the page builds itself, and 6" only where a wall
 * slider is dragged there (Leo, 2026-11-05, 乙; the plan,
 * docs/plans/rule12-9in-plan.md, its four questions answered as suggested).
 *
 * Opening a package, switching the layout, or a model that rebuilds the room
 * keeps 9" and grows the wall where it is short (D18). A wall slider can still
 * take it to 6", with the note under the slider. Any change after that is the
 * page building the room again, and it grows back to 9". A link opens the
 * room it was written from. The L's back wall goes to 246".
 */

const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();

afterAll(() => {
  store().setPackageId(DEFAULT_PACKAGE.id);
  store().setLayout({ ...DEFAULT_PARAMS });
  store().dismissToast();
  resetRoom();
});

/** A package's own room, from A's default, as a customer opens it. */
function openPackage(id: string) {
  recordHoodModel(APPLIANCE_BY_ID[DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState(OPENED, true);
  store().setPackageId(DEFAULT_PACKAGE.id);
  store().setLayout({ ...DEFAULT_PARAMS });
  store().setPackageId(id);
  store().dismissToast();
  expect(store().layoutIssues, id).toEqual([]);
  return store().layoutParams;
}

/** Rule 12's counter on the room standing: its width and what it is built of, or null. */
function besideTheTower() {
  for (const run of RUNS) {
    const segment = run.segments.find((s) => /tower-clearance/.test(s.id));
    if (segment) return { widthIn: Math.round((segment.to - segment.from) * 12 * 8) / 8, code: segment.modules.map((m) => m.code).join("+") };
  }
  return null;
}

const walls = () => ({ back: store().layoutParams.backWallIn, left: store().layoutParams.leftWallIn });

describe("rooms the page builds itself keep 9 inches beside the oven tower (乙)", () => {
  it("grows B's back wall for a lazy susan with its refrigerator's end at a wall, to 199-1/4 inches where 6 inches stood at 196-1/2", () => {
    openPackage("package-b");
    store().setLayout({ cornerType: "lazy-susan", fridgeEndAbuts: "wall" });
    expect({ issues: store().layoutIssues, walls: walls(), beside: besideTheTower(), toast: store().toast?.key }).toEqual({
      issues: [],
      walls: { back: 199.25, left: 144 },
      beside: { widthIn: 9, code: "B9" },
      toast: "toast.wallGrew",
    });
  });

  it("grows D's back wall to 241-1/2 inches for a lazy susan with its coffee cabinet on the back leg, past the old 240", () => {
    openPackage("package-d");
    store().setLayout({ cornerType: "lazy-susan", coffeeLeg: "back" });
    expect({ issues: store().layoutIssues, walls: walls(), beside: besideTheTower() }).toEqual({
      issues: [],
      walls: { back: 241.5, left: 178.75 },
      beside: { widthIn: 9, code: "B9" },
    });
  });

  it("builds at 246 inches the D room that 240 refused: a lazy susan, its refrigerator and coffee cabinet both on the back leg", () => {
    openPackage("package-d");
    store().setLayout({ cornerType: "lazy-susan", fridgeEnd: "back", coffeeLeg: "back" });
    expect({ issues: store().layoutIssues, walls: walls(), beside: besideTheTower() }).toEqual({
      issues: [],
      walls: { back: 246, left: 178.75 },
      beside: { widthIn: 9, code: "B9" },
    });
  });

  it("still refuses D's blind corner with the tower left and both on the back leg, naming the 246 inches it needs", () => {
    openPackage("package-d");
    store().setLayout({ towerSide: "left", fridgeEnd: "back", coffeeLeg: "back" });
    const short = store().layoutIssues.find((reason) => reason.key === "refusal.wallShort");
    expect({ minimumIn: short?.vars.minimumIn, maximumIn: short?.vars.maximumIn }).toEqual({ minimumIn: 246, maximumIn: 240 });
  });

  it("leaves every package's own room as it was, in the L and on one wall", () => {
    const own = ["package-a", "package-b", "package-c", "package-d", "package-e"].map((id) => {
      openPackage(id);
      const l = { ...walls(), beside: besideTheTower()?.widthIn ?? null };
      store().setLayoutShape("one-wall");
      const one = { back: store().layoutParams.backWallIn, beside: besideTheTower()?.widthIn ?? null };
      return [id, { l, one }];
    });
    expect(Object.fromEntries(own)).toEqual({
      "package-a": { l: { back: 168, left: 144, beside: null }, one: { back: 236, beside: null } },
      "package-b": { l: { back: 196.5, left: 144, beside: 18 }, one: { back: 241.25, beside: 18 } },
      "package-c": { l: { back: 168, left: 144, beside: null }, one: { back: 232.25, beside: null } },
      "package-d": { l: { back: 224.25, left: 178.75, beside: 18 }, one: { back: 248, beside: 18 } },
      // E's combination oven stands on its own in the L, not beside the
      // cooktop, so it has no rule-12 counter there (round 74); on one wall it
      // stands beside it.
      "package-e": { l: { back: 180, left: 168, beside: null }, one: { back: 273, beside: 18 } },
    });
  });

  it("takes the L's back wall to 246 inches, and leaves its left wall and one wall's back wall where they were", () => {
    expect({ back: PARAM_LIMITS.backWallIn.max, left: PARAM_LIMITS.leftWallIn.max, oneWall: paramLimitsFor("one-wall").backWallIn.max }).toEqual({
      back: 246,
      left: 240,
      oneWall: 276,
    });
  });
});

describe("a wall slider can still take it to 6 inches, and says so (乙)", () => {
  /** B, a lazy susan, its refrigerator's end at a wall, the back wall dragged to the shortest it takes. */
  function draggedTo6() {
    openPackage("package-b");
    store().setLayout({ cornerType: "lazy-susan", fridgeEndAbuts: "wall" });
    store().dismissToast();
    store().setLayout({ backWallIn: 196.5 });
  }

  it("builds 6 inches where the slider is dragged, with the band and the minimum it always had", () => {
    draggedTo6();
    expect({
      issues: store().layoutIssues,
      walls: walls(),
      beside: besideTheTower(),
      grew: store().toast?.key ?? null,
      band: feasibleRange(store().layoutParams, "backWallIn")?.minIn,
      minimum: wallRequirement(store().layoutParams, "back").minimumIn,
      rule12: wallRequirement(store().layoutParams, "back").items.find((item) => item.rule === "d11-12")?.widthIn,
    }).toEqual({
      issues: [],
      walls: { back: 196.5, left: 144 },
      beside: { widthIn: 6, code: "BF6" },
      grew: null,
      // The slider's band and the minimum under it, as they were before the
      // 9" floor: the band to the whole inch the room builds at, the minimum
      // the leg's bill adds up to.
      band: 197,
      minimum: 196.25,
      rule12: 6,
    });
  });

  it("puts the note under the wall whose counter it is, and nowhere once it is 9 inches again", () => {
    const narrow = (room as unknown as { narrowCounterLeg?: () => string | null }).narrowCounterLeg;
    draggedTo6();
    const read = () => (narrow ? narrow() : "no narrowCounterLeg");
    const dragged = read();
    store().setLayout({ hasIsland: false });
    expect({ dragged, after: read() }).toEqual({ dragged: "back", after: null });
  });

  it("grows back to 9 inches, and says so, when anything else is changed after the drag (question 1)", () => {
    draggedTo6();
    store().setLayout({ hasIsland: false });
    expect({ walls: walls(), beside: besideTheTower(), toast: store().toast?.key, lines: store().toast?.lines?.map((line) => [line.vars?.fromIn, line.vars?.toIn]) }).toEqual({
      walls: { back: 199.25, left: 144 },
      beside: { widthIn: 9, code: "B9" },
      toast: "toast.wallGrew",
      lines: [["196½″", "199¼″"]],
    });
  });

  it("grows back to 9 inches, and says so, when a range of the other kind rebuilds the room after the drag (question 1)", () => {
    draggedTo6();
    const standing = APPLIANCE_BY_ID[store().selection["slot-range"]];
    const other = candidatesFor("slot-range", PACKAGE).find(
      (candidate) => candidate.fit.fits && dropsIntoCounter(candidate.appliance) !== dropsIntoCounter(standing),
    )!;
    expect(other, "a range of the other kind B's opening takes").toBeTruthy();
    store().selectAppliance("slot-range", other.appliance.id);
    expect({
      issues: store().layoutIssues,
      chosen: store().selection["slot-range"],
      back: store().layoutParams.backWallIn,
      beside: besideTheTower()?.widthIn,
      toast: store().toast?.key,
    }).toEqual({
      issues: [],
      chosen: other.appliance.id,
      back: store().layoutParams.backWallIn,
      beside: 9,
      toast: "toast.modelGrew",
    });
    expect(store().layoutParams.backWallIn).toBeGreaterThan(196.5);
  });

  it("opens a link written from the 6-inch room as it was, 6 inches and all (question 2)", () => {
    draggedTo6();
    const link = `?${writeLink(kitchenNow())}`;
    openPackage("package-a");
    openSharedLink(link);
    expect({ walls: walls(), beside: besideTheTower() }).toEqual({
      walls: { back: 196.5, left: 144 },
      beside: { widthIn: 6, code: "BF6" },
    });
  });
});
