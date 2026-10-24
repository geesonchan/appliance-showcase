import { afterAll, describe, expect, it } from "vitest";
import { BLOWERS } from "../data/catalogue";
import { candidatesFor } from "../data/candidates";
import { PACKAGE } from "../data/packages";
import { resetRoom } from "../data/testRoom";
import type { SlotId } from "../types";
import { ACCENT_COLORS, CABINET_COLORS, useAppStore } from "../store/useAppStore";
import { createJudge, watchScene, type Second } from "./qualityRule";

/**
 * Round 100, Leo: the quality guard judged the second or two after a package
 * switch as if the room were too heavy to draw, and a page that draws at sixty
 * the rest of the time dropped to the low tier for good. His answer, option A
 * of `docs/plans/round-100-plan.md`: the two seconds after a rebuild are not
 * judged (N = 2). What counts as a rebuild: whatever rebuilds the room
 * (`layoutVersion`), a model or blower swapped, the render mode, day or night,
 * a finish that changes a texture, and a side rail folded, which resizes the
 * canvas; not the camera's moves, and not the toggles and messages that
 * redraw nothing. Round 100, Leo, after the first build: the language and a
 * tab opened count too — a tab's controls are worked out when it mounts (the
 * Layout tab's figures for E's one wall are the longest), and on a 4x slowed
 * desktop a tap on 中 dropped one page of twenty. On a phone a tab opens in
 * the Configure sheet (`mobilePanel`), so the sheet opened or closed counts.
 */

/** A clock the test moves by hand. */
function clock() {
  let at = 0;
  return { now: () => at, set: (ms: number) => (at = ms) };
}
const shown = (fps: number, startedAt: number): Second => ({ fps, startedAt, visible: true });

describe("the guard's rule, second by second (round 100)", () => {
  it("drops a room slow for two seconds in a row, with nothing changed", () => {
    const t = clock();
    const judge = createJudge(t.now);
    expect([judge.second(shown(40, 0)), judge.second(shown(40, 1000))]).toEqual([false, true]);
  });

  it("does not judge the two seconds after a rebuild, slow as they are", () => {
    const t = clock();
    const judge = createJudge(t.now);
    judge.second(shown(60, 3000));
    t.set(4300);
    judge.changed();
    // The second the switch fell in, and the two after it.
    expect([4000, 5000, 6000].map((at) => judge.second(shown(40, at)))).toEqual([false, false, false]);
  });

  it("drops a room still slow once the two seconds are over", () => {
    const t = clock();
    const judge = createJudge(t.now);
    t.set(4300);
    judge.changed();
    // 6300 is where the grace ends: the second from 6400 is the first judged.
    expect([5400, 6400, 7400].map((at) => judge.second(shown(40, at)))).toEqual([false, false, true]);
  });

  it("starts the count again at a rebuild: a slow second before it does not add to one after", () => {
    const t = clock();
    const judge = createJudge(t.now);
    expect(judge.second(shown(40, 2000))).toBe(false);
    t.set(3500);
    judge.changed();
    expect([3000, 4000, 5000, 6000].map((at) => judge.second(shown(40, at)))).toEqual([false, false, false, false]);
    expect(judge.second(shown(40, 7000))).toBe(true);
  });

  it("does not count a hidden tab's seconds, and starts again after one", () => {
    const t = clock();
    const judge = createJudge(t.now);
    expect([
      judge.second(shown(40, 0)),
      judge.second({ fps: 1, startedAt: 1000, visible: false }),
      judge.second(shown(40, 2000)),
      judge.second(shown(40, 3000)),
    ]).toEqual([false, false, false, true]);
  });
});

const store = useAppStore.getState;

/** Whether doing this, from the room as it stands, starts the two seconds again. */
function restarts(action: () => void): boolean {
  let changed = false;
  const stop = watchScene(useAppStore, () => (changed = true));
  action();
  stop();
  return changed;
}

/** A model the opening takes that is not the one standing in it. */
function another(slot: SlotId): string {
  const now = store().selection[slot];
  const other = candidatesFor(slot, PACKAGE).find((c) => c.fit.fits && c.appliance.id !== now);
  if (!other) throw new Error(`${slot} offers nothing else in ${PACKAGE.id}`);
  return other.appliance.id;
}

const OAK = CABINET_COLORS.find((paint) => paint.token === "wood-oak")!.value;
const painted = (except: string) => CABINET_COLORS.find((paint) => paint.token === "painted" && paint.value !== except)!.value;

afterAll(() => {
  if (store().layoutParams.shape !== "L") store().setLayoutShape("L");
  store().setPackageId("package-a");
  store().setRenderMode("realistic");
  store().setLighting("day");
  resetRoom();
});

describe("what starts the two seconds again (round 100, Leo's list)", () => {
  // Each from the room as the one before left it, and each a real change.
  const cases: [string, () => void][] = [
    ["a package tapped", () => store().setPackageId(store().packageId === "package-b" ? "package-a" : "package-b")],
    ["a layout choice", () => store().setLayout({ backWallIn: store().layoutParams.backWallIn + 12 })],
    ["a wall slider moved a step", () => store().setLayout({ backWallIn: store().layoutParams.backWallIn + 1 })],
    ["the hood swapped", () => store().selectAppliance("slot-hood", another("slot-hood"))],
    ["the range swapped", () => store().selectAppliance("slot-range", another("slot-range"))],
    ["the dishwasher swapped", () => store().selectAppliance("slot-dishwasher", another("slot-dishwasher"))],
    ["the blower swapped", () => store().selectBlower(BLOWERS.find((b) => b.id !== store().blowerId)!.id)],
    ["the render mode", () => store().setRenderMode(store().renderMode === "white" ? "install" : "white")],
    ["back to the realistic mode", () => store().setRenderMode("realistic")],
    ["day or night", () => store().setLighting(store().lighting === "day" ? "night" : "day")],
    ["the doors painted to oak", () => store().setFinish({ cabinet: OAK })],
    ["the doors oak to painted", () => store().setFinish({ cabinet: CABINET_COLORS[0].value })],
    ["the countertop", () => store().setFinish({ counter: store().finishes.counter === "marble-veined" ? "wood-oak" : "marble-veined" })],
    ["the floor oak to tile", () => store().setFinish({ floor: "floor-tile" })],
    ["a tile floor's size", () => store().setFinish({ tileSize: store().finishes.tileSize === "32x32" ? "48x48" : "32x32" })],
    ["an oak accent put on a run", () => store().setFinish({ accent: ACCENT_COLORS[0].value, accentRun: "back" })],
    ["the left rail folded", () => store().toggleLeft()],
    ["the right rail folded", () => store().toggleRight()],
    ["the rails opened again", () => (store().toggleLeft(), store().toggleRight())],
    ["the shape switched", () => store().setLayoutShape(store().layoutParams.shape === "L" ? "one-wall" : "L")],
    ["Undo on the switch's message", () => store().undo()],
    ["the language", () => store().setLang(store().lang === "zh" ? "en" : "zh")],
    ["a tab", () => store().setRightTab(store().rightTab === "layout" ? "look" : "layout")],
    ["the phone's sheet opened on a tab", () => store().setMobilePanel("config")],
    ["the phone's sheet opened on the list", () => store().setMobilePanel("list")],
    ["the phone's sheet closed", () => store().setMobilePanel("none")],
  ];

  it("restarts at each of them", () => {
    const missed = cases.filter(([, action]) => !restarts(action)).map(([name]) => name);
    expect(missed).toEqual([]);
  });

  it("is not set off by the camera, the toggles or a message", () => {
    const quiet: [string, () => void][] = [
      ["the view reset", () => store().resetView()],
      ["zoom", () => store().requestZoom(1)],
      ["a pin chosen", () => store().selectSlot("slot-range")],
      ["the spec card", () => (store().openSpec("slot-range"), store().closeSpec())],
      ["cabinets shown or hidden", () => store().toggleCabinets()],
      ["labels shown or hidden", () => store().toggleLabels()],
      ["dimensions shown or hidden", () => store().toggleDimensions()],
      ["a service shown or hidden", () => store().toggleUtility("gas")],
      ["help", () => store().setHelpOpen(!store().helpOpen)],
      ["the quote", () => store().setQuoteOpen(!store().quoteOpen)],
      ["a message", () => store().showToast("toast.undo.layout")],
      ["a message closed", () => store().dismissToast()],
      ["the frame rate reported", () => store().reportFps(store().fps + 1)],
      ["the doors repainted, paint to paint", () => store().setFinish({ cabinet: painted(store().finishes.cabinet) })],
      ["the walls repainted", () => store().setFinish({ wall: store().finishes.wall === "white" ? "taupe" : "white" })],
      ["a painted accent put on another run", () => store().setFinish({ accent: ACCENT_COLORS[1].value, accentRun: "left" })],
      ["a tile size chosen with an oak floor", () => store().setFinish({ floor: "floor-oak", tileSize: "24x48" })],
    ];
    // The oak floor itself is a change: lay it first.
    restarts(() => store().setFinish({ floor: "floor-oak", accentRun: "none" }));
    const restarted = quiet.filter(([, action]) => restarts(action)).map(([name]) => name);
    expect(restarted).toEqual([]);
  });
});
