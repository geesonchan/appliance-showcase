/**
 * Item 10 (Leo's order, decisions.md "Amended 2026-11-12"; the plan,
 * docs/plans/item10-notice-plan.md; his answers of 2026-11-13): a package
 * switch in the L and on one wall says what a switch in a U says, and the
 * Layout tab's sliders show the room that was built.
 *
 * His answers: 1, the first line 「已切换为套餐 B，墙长已调整：」 / "Switched to
 * Package B; the walls were adjusted:"; 3, the figures in fractions (224¼″);
 * 4, the U's three switches whose sliders were off mended with the rest;
 * 5, toast.roomGrew retired; 6, one wall's C to A, which lengthened its wall
 * and said nothing, says so. And one case he added: 「换套餐后点"退回"，滑杆的数
 * 和实际建成的房间都回到换之前，三种形状都查。」
 *
 * Each switch starts from the page as it opens, the package switched to, the
 * shape chosen, and the toast cleared — the plan's probes' rooms (section 1).
 */
import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "../data/catalogue";
import { recordHoodModel } from "../data/hoodMount";
// The page's own inches, as the notice prints them.
import { inchesSpoken as inchesOf } from "../data/inches";
import * as packages from "../data/packages";
import * as room from "../data/room";
import { resetRoom } from "../data/testRoom";
import type { LayoutParams } from "../data/layoutTemplate";
import { sayWith, translate } from "../i18n";
import { wallsOf } from "./shapeSwitch";
import { useAppStore } from "./useAppStore";

const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();
const CODES = ["A", "B", "C", "D", "E"] as const;
const SHAPES = ["L", "one-wall", "U"] as const;
type Shape = (typeof SHAPES)[number];
const SWITCHES = SHAPES.flatMap((shape) =>
  CODES.flatMap((from) => CODES.filter((to) => to !== from).map((to) => ({ shape, from, to, name: `${shape} ${from}→${to}` }))),
);

function freshPage(lang: "zh" | "en" = "en") {
  recordHoodModel(APPLIANCE_BY_ID[packages.DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], packages.DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState({ ...OPENED, lang }, true);
}

/** The room the switch starts from: `from`'s, in `shape`, nothing on screen. */
function standIn(shape: Shape, from: string, lang: "zh" | "en" = "en") {
  freshPage(lang);
  store().setPackageId(`package-${from.toLowerCase()}`);
  if (shape !== "L") store().setLayoutShape(shape);
  useAppStore.setState({ toast: null });
  return { asked: { ...store().layoutParams }, built: { ...room.LAYOUT_PARAMS } };
}

const wallsIn = (shape: Shape, params: LayoutParams) => Object.fromEntries(wallsOf(shape).map((key) => [key, params[key]]));

/** What the toast says, line by line, and its button. */
function said(lang: "zh" | "en") {
  const toast = store().toast;
  if (!toast) return null;
  const say = (key: string, vars?: Record<string, string | number>) => sayWith((k, v) => translate(lang, k, v), key, vars);
  return {
    lines: toast.lines ? toast.lines.map((line) => say(line.key, line.vars)) : [say(toast.key, toast.vars)],
    undo: toast.undo ? say(toast.undoLabel?.key ?? "toast.undo", toast.undoLabel?.vars) : null,
  };
}

/**
 * The plan's section 4, word for word: the twenty L and one-wall switches that
 * change a wall, as noticeWords.ts printed them with the page's own translation
 * and inches, the first line Leo's 甲. The other twenty change no wall and say
 * nothing.
 */
const zhHead = (code: string) => `已切换为套餐 ${code}，墙长已调整：`;
const enHead = (code: string) => `Switched to Package ${code}; the walls were adjusted:`;
const SAID: Record<string, { zh: string[]; en: string[] }> = {
  "L A→B": { zh: ["后墙从 168″ 改为 196½″"], en: ["Back wall: 168″ → 196½″"] },
  "L A→D": { zh: ["后墙从 168″ 改为 224¼″", "左墙从 144″ 改为 178¾″"], en: ["Back wall: 168″ → 224¼″", "Left wall: 144″ → 178¾″"] },
  "L A→E": { zh: ["后墙从 168″ 改为 180″", "左墙从 144″ 改为 168″"], en: ["Back wall: 168″ → 180″", "Left wall: 144″ → 168″"] },
  "L B→D": { zh: ["后墙从 196½″ 改为 224¼″", "左墙从 144″ 改为 178¾″"], en: ["Back wall: 196½″ → 224¼″", "Left wall: 144″ → 178¾″"] },
  "L B→E": { zh: ["左墙从 144″ 改为 168″"], en: ["Left wall: 144″ → 168″"] },
  "L C→B": { zh: ["后墙从 168″ 改为 196½″"], en: ["Back wall: 168″ → 196½″"] },
  "L C→D": { zh: ["后墙从 168″ 改为 224¼″", "左墙从 144″ 改为 178¾″"], en: ["Back wall: 168″ → 224¼″", "Left wall: 144″ → 178¾″"] },
  "L C→E": { zh: ["后墙从 168″ 改为 180″", "左墙从 144″ 改为 168″"], en: ["Back wall: 168″ → 180″", "Left wall: 144″ → 168″"] },
  "L E→B": { zh: ["后墙从 180″ 改为 196½″"], en: ["Back wall: 180″ → 196½″"] },
  "L E→D": { zh: ["后墙从 180″ 改为 224¼″", "左墙从 168″ 改为 178¾″"], en: ["Back wall: 180″ → 224¼″", "Left wall: 168″ → 178¾″"] },
  "one-wall A→B": { zh: ["后墙从 233¾″ 改为 239″"], en: ["Back wall: 233¾″ → 239″"] },
  "one-wall A→D": { zh: ["后墙从 233¾″ 改为 245¾″"], en: ["Back wall: 233¾″ → 245¾″"] },
  "one-wall A→E": { zh: ["后墙从 233¾″ 改为 270¾″"], en: ["Back wall: 233¾″ → 270¾″"] },
  "one-wall B→D": { zh: ["后墙从 239″ 改为 245¾″"], en: ["Back wall: 239″ → 245¾″"] },
  "one-wall B→E": { zh: ["后墙从 239″ 改为 270¾″"], en: ["Back wall: 239″ → 270¾″"] },
  "one-wall C→A": { zh: ["后墙从 230″ 改为 233¾″"], en: ["Back wall: 230″ → 233¾″"] },
  "one-wall C→B": { zh: ["后墙从 230″ 改为 239″"], en: ["Back wall: 230″ → 239″"] },
  "one-wall C→D": { zh: ["后墙从 230″ 改为 245¾″"], en: ["Back wall: 230″ → 245¾″"] },
  "one-wall C→E": { zh: ["后墙从 230″ 改为 270¾″"], en: ["Back wall: 230″ → 270¾″"] },
  "one-wall D→E": { zh: ["后墙从 245¾″ 改为 270¾″"], en: ["Back wall: 245¾″ → 270¾″"] },
};

describe("item 10: after a package switch the sliders show the room built (plan 1.2; Leo's answer 4)", () => {
  it.each(SWITCHES)("$name: the store's walls are the built room's", ({ shape, from, to }) => {
    const start = standIn(shape, from);
    // The room it starts from is on the sliders too, or the case below proves nothing.
    expect(wallsIn(shape, start.asked)).toEqual(wallsIn(shape, start.built));
    store().setPackageId(`package-${to.toLowerCase()}`);
    expect([store().packageId, wallsIn(shape, store().layoutParams)]).toEqual([`package-${to.toLowerCase()}`, wallsIn(shape, room.LAYOUT_PARAMS)]);
  });

  // The plan's 1.2, 后果: the next change on the panel built from the sliders'
  // old figure, and one wall's 239″ went back to 233¾″ without a word.
  it.each(SWITCHES)("$name: a change on the panel after it leaves the walls where the switch built them", ({ shape, from, to }) => {
    standIn(shape, from);
    store().setPackageId(`package-${to.toLowerCase()}`);
    const switched = wallsIn(shape, room.LAYOUT_PARAMS);
    store().setLayout({ housingStyle: store().layoutParams.housingStyle === "box" ? "sweep" : "box" });
    expect([store().layoutIssues, wallsIn(shape, room.LAYOUT_PARAMS), wallsIn(shape, store().layoutParams)]).toEqual([[], switched, switched]);
  });
});

describe("item 10: what a package switch says (plan section 4; Leo's answers 1, 3, 5 and 6)", () => {
  const LONE = SWITCHES.filter((s) => s.shape !== "U");

  it.each(LONE)("$name: in Chinese, the walls that changed and only those, 退回 the package it left", ({ shape, from, to, name }) => {
    standIn(shape, from, "zh");
    store().setPackageId(`package-${to.toLowerCase()}`);
    const want = SAID[name];
    expect(said("zh")).toEqual(want ? { lines: [zhHead(to), ...want.zh], undo: `退回套餐 ${from}` } : null);
  });

  it.each(LONE)("$name: in English, the same", ({ shape, from, to, name }) => {
    standIn(shape, from, "en");
    store().setPackageId(`package-${to.toLowerCase()}`);
    const want = SAID[name];
    expect(said("en")).toEqual(want ? { lines: [enHead(to), ...want.en], undo: `Back to Package ${from}` } : null);
  });

  // The U's own switch (U-2), unchanged in its rule: what it says is its walls
  // before and as built.
  it.each(SWITCHES.filter((s) => s.shape === "U"))("$name: in a U, the walls that changed from the room before to the room built", ({ from, to }) => {
    const start = standIn("U", from, "zh");
    store().setPackageId(`package-${to.toLowerCase()}`);
    const built = room.LAYOUT_PARAMS;
    const say = (key: string, vars?: Record<string, string | number>) => sayWith((k, v) => translate("zh", k, v), key, vars);
    const lines = wallsOf("U")
      .filter((key) => Math.abs(built[key] - start.built[key]) > 1e-9)
      .map((key) => `${say(key === "backWallIn" ? "toast.wall.back" : "toast.wall.sides")}从 ${inchesOf(start.built[key])} 改为 ${inchesOf(built[key])}`);
    expect(said("zh")).toEqual(lines.length > 0 ? { lines: [zhHead(to), ...lines], undo: `退回套餐 ${from}` } : null);
  });

  it("no longer has toast.roomGrew in either language (answer 5)", () => {
    expect([translate("zh", "toast.roomGrew"), translate("en", "toast.roomGrew")]).toEqual(["toast.roomGrew", "toast.roomGrew"]);
  });
});

describe("item 10: Undo after a package switch puts back the sliders and the room (Leo, 2026-11-13)", () => {
  it.each(SWITCHES)("$name: Undo where a wall changed, and everything as it was", ({ shape, from, to }) => {
    const start = standIn(shape, from);
    store().setPackageId(`package-${to.toLowerCase()}`);
    const changed = wallsOf(shape).some((key) => Math.abs(room.LAYOUT_PARAMS[key] - start.built[key]) > 1e-9);
    // No wall changed: no notice and nothing to undo (U-2's rule, point 1).
    if (!changed) {
      expect(store().toast).toBeNull();
      return;
    }
    expect(store().toast?.undo?.packageId).toBe(`package-${from.toLowerCase()}`);
    store().undo();
    expect({
      packageId: store().packageId,
      sliders: store().layoutParams,
      built: wallsIn(shape, room.LAYOUT_PARAMS),
      issues: store().layoutIssues,
      toast: store().toast,
    }).toEqual({ packageId: `package-${from.toLowerCase()}`, sliders: start.asked, built: wallsIn(shape, start.built), issues: [], toast: null });
  });
});
