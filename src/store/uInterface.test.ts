/**
 * U-2, the U on the page (Leo, 2026-11-11: 「照计划第 10 节动手」; docs/plans/u2-plan.md).
 * His answers to the plan's section 9: one slider for both side walls, 「左右墙长度 /
 * Side walls」; the U seen from straight in front by default; section 8's words as
 * written, D's line in E's pattern; the right leg's wall cabinets and hood drawn as
 * they are, for him to look at.
 *
 * The new functions are reached through their modules rather than imported by
 * name, so on the code before them each case fails on its own, for its own reason.
 */
import { describe, expect, it } from "vitest";
import * as layoutShape from "../data/layoutShape";
import * as shapeControls from "../ui/shapeControls";
import * as room from "../data/room";
import * as serviceRoute from "../data/serviceRoute";
import * as packages from "../data/packages";
import * as finishes from "./finishes";
import { APPLIANCE_BY_ID } from "../data/catalogue";
import { recordHoodModel } from "../data/hoodMount";
import { checklistFor } from "../data/useChecklist";
import { SLOT_BY_ID } from "../data/slots";
import { ROOM, ft } from "../data/roomShell";
import { wallBehind } from "../data/roomWalls";
import { defaultSelectionOf, resetRoom } from "../data/testRoom";
import { kitchenNow, openSharedLink } from "./openLink";
import { writeLink } from "./shareLink";
import { useAppStore } from "./useAppStore";
import { sayWith, translate } from "../i18n";
import * as layoutTemplate from "../data/layoutTemplate";
import * as inches from "../data/inches";
import { readFileSync } from "node:fs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const any = (module: unknown) => module as Record<string, any>;
const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();

function freshPage() {
  recordHoodModel(APPLIANCE_BY_ID[packages.DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], packages.DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState(OPENED, true);
}

/** The walls each package's U is built at, shortest (U-1's plan, section 2). */
const SIDE: Record<string, number> = { A: 155.25, B: 157.5, C: 159.75, D: 207, E: 177 };
const uLink = (code: string) => `?v=2&pkg=${code}&shape=U&back=132&left=${SIDE[code]}&corner=blind`;

// --- 1 -----------------------------------------------------------------------
describe("U-2 (1): the shape switch offers the U", () => {
  it("lists the L, one wall and the U, in that order", () => {
    expect(layoutShape.LAYOUT_SHAPES).toEqual(["L", "one-wall", "U"]);
  });
});

// --- 2 -----------------------------------------------------------------------
describe("U-2 (2): what the Layout tab shows in a U", () => {
  // The plan's section 2: the shape, the back wall, the side walls, the corner,
  // and the three that one wall shows on its conditions; the rest the U decides.
  const SHOWN = ["backWallIn", "leftWallIn", "cornerType", "housingStyle", "microwaveHandleIn", "coffeeSillIn"];
  const HIDDEN = ["fridgeEnd", "fridgeEndAbuts", "sinkLeg", "towerSide", "coffeeLeg", "hasIsland", "islandOrientation", "islandLengthIn", "islandDepthIn", "aisleIn"];

  it("shows the walls, the corner and the conditional three, and hides what the U decides", () => {
    const shows = (control: string) => shapeControls.showsControl("U", control as never);
    expect({ shown: SHOWN.filter(shows), hidden: HIDDEN.filter(shows) }).toEqual({ shown: SHOWN, hidden: [] });
  });

  it("calls the one slider for both side walls 左右墙长度 / Side walls, the L's still Left wall", () => {
    const key = any(shapeControls).sideWallLabelKey;
    expect([key("U"), key("L"), translate("zh", "panel.room.sideWalls"), translate("en", "panel.room.sideWalls")]).toEqual([
      "panel.room.sideWalls",
      "panel.room.leftWall",
      "左右墙长度",
      "Side walls",
    ]);
  });

  it("stops the side walls' slider at D13's 216\" in a U", () => {
    expect(any(shapeControls).sideWallLimits("U").max).toBe(216);
  });
});

// --- 3 -----------------------------------------------------------------------
describe("U-2 (3): switching to the U grows the walls, says so, and Undo goes back", () => {
  // Since the plan's second draft (Leo, 2026-11-11, 4 and 5): one notice for
  // every shape switch, a line for each wall that changed, in place of
  // toast.shapeGrew.U.
  // Package A since the U's new order (2026-11-12): D's U opens at 177" (the
  // oven tower on the cooking leg), shorter than its L's 178-3/4" left wall, so
  // D's switch changes no wall and says nothing (乙). A's U still asks for more
  // than its L has: 144" to 155-1/4".
  it("grows A's side walls to its U's, says the wall from and to, with Undo back to the L", () => {
    freshPage();
    const before = store().layoutParams;
    store().setLayoutShape("U");
    const toast = store().toast;
    expect([store().layoutParams.shape, store().layoutParams.leftWallIn, toast?.key, toast?.lines, toast?.undoLabel]).toEqual([
      "U",
      155.25,
      "toast.shapeSwitched",
      [
        { key: "toast.shapeSwitched", vars: { shapeKey: "panel.layout.shape.U" } },
        { key: "toast.shapeWall", vars: { wallKey: "toast.wall.sides", fromIn: "144″", toIn: "155¼″" } },
      ],
      { key: "toast.undo.toShape", vars: { shapeKey: "topbar.shape.L" } },
    ]);
    store().setLayoutShape("L");
    expect(store().layoutParams).toEqual(before);
  });

  // Changed 2026-11-12 (Leo, on U-2's seven points, 7: 「在 U 里换套餐的提示：只列真正变了的墙，
  // 没变的不提，句式和切换形状的提示统一」): it was toast.roomGrew.U, which named the back
  // wall at 132″ though it had not moved. Group 16 has the notice in full.
  it("says the side walls when a package switch in a U grows them", () => {
    freshPage();
    openSharedLink(uLink("A"));
    store().setPackageId("package-d");
    // D's U, 177" since the new order (2026-11-12; it was 207").
    expect([store().toast?.key, store().layoutParams.leftWallIn]).toEqual(["toast.packageSwitched", 177]);
  });

  it("names the side walls 左右墙 / Side walls when a model grows them in a U", () => {
    const key = any(shapeControls).wallToastKey;
    expect([key("leftWallIn", "U"), key("leftWallIn", "L"), key("backWallIn", "U"), translate("zh", "toast.wall.sides")]).toEqual([
      "toast.wall.sides",
      "toast.wall.left",
      "toast.wall.back",
      "左右墙",
    ]);
  });
});

// --- 4 -----------------------------------------------------------------------
describe("U-2 (4): the right wall is a line on the floor", () => {
  it("draws none in an L", () => {
    freshPage();
    expect(any(room).floorLineWalls()).toEqual([]);
  });

  it("draws the right wall's line in a U, from the back wall to 1\" past the right leg's open end", () => {
    freshPage();
    openSharedLink(uLink("C"));
    const right = room.RUN_BY_ID.right!;
    const wall = wallBehind(right.facing);
    const [line] = any(room).floorLineWalls();
    const end = right.segments[right.segments.length - 1].to;
    expect({ at: line?.at, from: line?.from, to: line?.to, width: line?.widthIn }).toEqual({
      at: wall.at,
      from: -ROOM.halfZ,
      to: end + ft(1),
      width: 1,
    });
  });
});

// --- 5 -----------------------------------------------------------------------
describe("U-2 (5): the default view", () => {
  // Leo, 2026-11-12, after the table of 48 ways: 「U 的默认视角定：正前方，往下 50°」, his rule
  // that every label shows in the default view; it was 45° to the left and 25° down that
  // night (most labels hidden), straight in front at 45° down before (2026-11-11).
  it("looks at a U from straight in front, 50° down; at the L and one wall as it always has", async () => {
    const { defaultView } = any(await import("../data/defaultView"));
    expect([defaultView("U"), defaultView("L"), defaultView("one-wall")]).toEqual([
      { azimuthDeg: 0, pitchDeg: 50 },
      { azimuthDeg: 45, pitchDeg: 35 },
      { azimuthDeg: 45, pitchDeg: 35 },
    ]);
  });
});

// --- 6 -----------------------------------------------------------------------
describe("U-2 (6): the services come in on the right wall, 48\" from its open end", () => {
  it("enters on the U's right wall at the cooking leg's open end less 48\"", () => {
    freshPage();
    openSharedLink(uLink("C"));
    const right = room.RUN_BY_ID.right!;
    const wall = wallBehind(right.facing);
    const at = any(serviceRoute).serviceEntryPoint(0.25);
    expect([at.x, at.z]).toEqual([wall.at + right.facing.sign * 0.25, room.serviceEntry().along]);
  });

  it("runs to the sink round the right-back corner, and to the refrigerator round both", () => {
    freshPage();
    openSharedLink(uLink("C"));
    const turns = (slot: string) => any(serviceRoute).trunkPath(SLOT_BY_ID[slot as never], 0.25).length - 2;
    expect([turns("slot-range"), turns("slot-dishwasher"), turns("slot-fridge")]).toEqual([0, 1, 2]);
  });

  // Leo, 2026-11-11: 「L 型线上画的是 4 英寸……保持登记，等 U 型做完单独修一轮，这一轮不动」.
  it("leaves the L's where it is drawn today: the back wall, 4\" from its far end (registered)", () => {
    freshPage();
    const back = wallBehind(room.RUN_BY_ID.back.facing);
    const at = any(serviceRoute).serviceEntryPoint(0.25);
    expect([at.x, at.z]).toEqual([ROOM.halfX - ft(4), back.at + room.RUN_BY_ID.back.facing.sign * 0.25]);
  });
});

// --- 7 -----------------------------------------------------------------------
describe("U-2 (7): the U's own lines, in the words Leo passed", () => {
  // toast.roomGrew.U is gone (Leo, 2026-11-12, 7): a package switch in a U says its
  // walls as the shape switch does, toast.packageSwitched (group 16).
  const WORDS: Record<string, [string, string]> = {
    "toast.wall.sides": ["左右墙", "Side walls"],
    "rule.uSpares": [
      "U 型：小酒柜和微波抽屉都在左段台面下，在转角台面和冰箱台面之间。",
      "U-shaped: the wine cooler and the microwave drawer sit under the counter on the left leg, between the corner's counter and the refrigerator's.",
    ],
    "shape.note.U.E": [
      "U 型：不配岛台；电磁灶改到右段墙上，油烟机为 36\" 墙挂烟囱式 HMCB36WS。",
      "U-shaped: no island; the induction cooktop moves to the right leg's wall, with the 36\" chimney wall hood HMCB36WS.",
    ],
    "shape.note.U.D": ["U 型：不配岛台；微波抽屉改到右段台面下。", "U-shaped: no island; the microwave drawer moves under the counter on the right leg."],
  };
  for (const [key, [zh, en]] of Object.entries(WORDS)) {
    it(`has ${key} in both languages`, () => {
      expect([translate("zh", key), translate("en", key)]).toEqual([zh, en]);
    });
  }

  it("says where A's and C's two machines are in a U with the U's line, not the L's", () => {
    const keys = ["A", "C"].map((code) => {
      freshPage();
      openSharedLink(uLink(code));
      const pkg = packages.PACKAGES.find((entry) => entry.code === code)!;
      return checklistFor(defaultSelectionOf(pkg.id), null)
        .findings.map((finding) => finding.messageKey)
        .filter((key) => key === "rule.uSpares" || key === "rule.noIslandFallback");
    });
    expect(keys).toEqual([["rule.uSpares"], ["rule.uSpares"]]);
  });

  it("gives D and E their line in the left panel in a U, and none to A, B, C", () => {
    const notes = ["A", "B", "C", "D", "E"].map((code) =>
      packages.shapeNoteKey(packages.PACKAGES.find((entry) => entry.code === code)!, "U"),
    );
    expect(notes).toEqual([null, null, null, "shape.note.U.D", "shape.note.U.E"]);
  });
});

// --- 8 -----------------------------------------------------------------------
describe("U-2 (8): the accent colour can go on the right leg", () => {
  it("is a run a colour goes on, and the U offers the three legs and no island", () => {
    const runsFor = any(shapeControls).accentRunsFor;
    expect([finishes.ACCENT_RUNS.includes("right" as never), runsFor("U"), runsFor("L"), runsFor("one-wall")]).toEqual([
      true,
      ["none", "left", "back", "right"],
      ["none", "left", "back", "island"],
      ["none", "back"],
    ]);
  });
});

// --- 9 -----------------------------------------------------------------------
describe("U-2 (9): a link to a U opens the room it was written from (D23)", () => {
  for (const id of ["package-a", "package-b", "package-c", "package-d", "package-e"]) {
    it(`round-trips ${id}'s U`, () => {
      freshPage();
      store().setPackageId(id);
      store().setLayoutShape("U");
      const link = writeLink(kitchenNow());
      const room1 = JSON.stringify({ params: room.LAYOUT_PARAMS, runs: room.RUNS, selection: store().selection });
      freshPage();
      openSharedLink(`?${link}`);
      const room2 = JSON.stringify({ params: room.LAYOUT_PARAMS, runs: room.RUNS, selection: store().selection });
      expect([new URLSearchParams(link).get("shape"), room2 === room1, store().toast]).toEqual(["U", true, null]);
    });
  }
});

// --- 10 ----------------------------------------------------------------------
// Leo's answers to the plan's second draft, 2026-11-11 (decisions.md): 3. 乙 —
// a wall the new shape cannot stand everything on is lengthened to what it
// wants, one past the new shape's top is cut to it, any other stays; 「A、C 切到
// U 时不要省掉微波抽屉和小酒柜，改成把墙加长」; every switch says each wall that
// changed, from and to, and its Undo goes back to the shape and walls before.
describe("U-2 (10): every switch succeeds, the walls by 乙, said wall by wall, and undone", () => {
  const SHAPES = ["L", "one-wall", "U"] as const;
  const PKGS = ["package-a", "package-b", "package-c", "package-d", "package-e"];
  const TOP = { "one-wall": { backWallIn: 276 }, U: { backWallIn: 264, leftWallIn: 216 } } as const;
  const wallsOf = (shape: string) => (shape === "one-wall" ? (["backWallIn"] as const) : (["backWallIn", "leftWallIn"] as const));

  for (const pkg of PKGS) {
    for (const from of SHAPES) {
      for (const to of SHAPES) {
        if (from === to) continue;
        for (const walls of ["opened", "shortest", "longest"] as const) {
          it(`${pkg.slice(-1).toUpperCase()} ${from} → ${to}, walls ${walls}`, () => {
            freshPage();
            store().setPackageId(pkg);
            if (from !== "L") store().setLayoutShape(from);
            if (walls !== "opened") {
              for (const key of wallsOf(from)) {
                const range = any(layoutTemplate).feasibleRange(store().layoutParams, key);
                store().setLayout({ [key]: walls === "shortest" ? range.minIn : range.maxIn });
              }
            }
            const lRoom = store().lRoom;
            const before = { ...store().layoutParams };
            const beforeSelection = store().selection;
            const toastBefore = store().toast?.id;
            const result = store().setLayoutShape(to);
            const after = { ...store().layoutParams };

            // What 乙 makes of each wall.
            const wanted =
              to === "one-wall"
                ? { backWallIn: any(layoutTemplate).oneWallWantedIn(before, packages.PACKAGE_BY_ID[pkg]) }
                : to === "U"
                  ? any(layoutTemplate).uWantedIn({ ...before, shape: "U" }, packages.PACKAGE_BY_ID[pkg])
                  : null;
            const expected =
              to === "L"
                ? { backWallIn: lRoom!.layoutParams.backWallIn, leftWallIn: lRoom!.layoutParams.leftWallIn }
                : Object.fromEntries(
                    wallsOf(to).map((key) => [key, Math.min(Math.max(before[key], wanted[key]), (TOP[to] as Record<string, number>)[key])]),
                  );
            const changed = wallsOf(to).filter((key) => Math.abs(after[key] - before[key]) > 1e-9);
            const toast = store().toast && store().toast!.id !== toastBefore ? store().toast : null;

            expect({
              ok: result.ok,
              shape: after.shape,
              walls: Object.fromEntries(wallsOf(to).map((key) => [key, after[key]])),
              // Nothing left out for want of wall: the walls were grown instead.
              omitted: to === "L" ? [] : [...room.OMITTED_FOR_WALL],
              lines: toast?.lines?.filter((line) => line.key === "toast.shapeWall").map((line) => line.vars) ?? [],
              undoLabel: toast ? toast.undoLabel : null,
            }).toEqual({
              ok: true,
              shape: to,
              walls: expected,
              omitted: [],
              lines: changed.map((key) => ({
                wallKey: any(shapeControls).wallToastKey(key, to),
                fromIn: inches.inchesSpoken(before[key]),
                toIn: inches.inchesSpoken(after[key]),
              })),
              undoLabel: changed.length > 0 ? { key: "toast.undo.toShape", vars: { shapeKey: `topbar.shape.${from}` } } : null,
            });

            // Undo goes back to the shape, the walls and the models before.
            if (toast?.undo) {
              store().undo();
              expect({ params: store().layoutParams, selection: store().selection }).toEqual({ params: before, selection: beforeSelection });
            }
          });
        }
      }
    }
  }

  it("keeps the L it left through an Undo of the switch back to it", () => {
    freshPage();
    store().setPackageId("package-d");
    const l = { ...store().layoutParams };
    store().setLayoutShape("U");
    store().setLayoutShape("L");
    store().undo();
    store().setLayoutShape("L");
    expect(store().layoutParams).toEqual(l);
  });

  it("names what even the walls' top leaves out, one line each", async () => {
    const shapeSwitch = await import("./shapeSwitch");
    const lines = any(shapeSwitch).shapeSwitchLines(
      { backWallIn: 270, leftWallIn: 200 },
      { shape: "U", backWallIn: 264, leftWallIn: 216 },
      ["slot-microwave", "slot-wine"],
    );
    expect(lines).toEqual([
      { key: "toast.shapeSwitched", vars: { shapeKey: "panel.layout.shape.U" } },
      { key: "toast.shapeWall", vars: { wallKey: "toast.wall.back", fromIn: "270″", toIn: "264″" } },
      { key: "toast.shapeWall", vars: { wallKey: "toast.wall.sides", fromIn: "200″", toIn: "216″" } },
      { key: "toast.shapeOmitted", vars: { itemKey: "slot.microwave" } },
      { key: "toast.shapeOmitted", vars: { itemKey: "slot.wine" } },
    ]);
  });

  it("says nothing where no wall changed", async () => {
    const shapeSwitch = await import("./shapeSwitch");
    expect(any(shapeSwitch).shapeSwitchLines({ backWallIn: 200, leftWallIn: 180 }, { shape: "U", backWallIn: 200, leftWallIn: 180 }, [])).toBe(null);
  });
});

// --- 11 ----------------------------------------------------------------------
// D1's fourth reason (Leo, 2026-11-11: 「切到 U 时镜头自动转到正前方」); to an L or
// one wall, nothing moves, as before.
describe("U-2 (11): a switch into a U turns the camera to the U's view", () => {
  it("asks for the default view on the way into a U, and not on the way to an L or one wall", () => {
    freshPage();
    const tokens: number[] = [store().resetToken];
    for (const shape of ["U", "one-wall", "U", "L", "one-wall", "L"] as const) {
      store().setLayoutShape(shape);
      tokens.push(store().resetToken);
    }
    const t0 = tokens[0];
    expect(tokens.map((token) => token - t0)).toEqual([0, 1, 1, 2, 2, 2, 2]);
  });

  // Package A since the new order (2026-11-12): an Undo needs a switch that
  // changed a wall, and D's into the U changes none now (its U 177", its L
  // 178-3/4"). A's L is A's own as the page opens.
  it("asks for it when an Undo puts a U back, and not when it puts an L back", () => {
    freshPage();
    store().setLayoutShape("U");
    const inU = store().resetToken;
    store().setLayoutShape("L");
    store().undo();
    const backInU = store().resetToken;
    store().setLayoutShape("L");
    store().setLayoutShape("one-wall");
    store().undo();
    expect([backInU - inU, store().resetToken - backInU, store().layoutParams.shape]).toEqual([1, 0, "L"]);
  });
});

// --- 12 ----------------------------------------------------------------------
// A (Leo, 2026-11-11): the shapes as a row of buttons on the main screen, as the
// packages are; 1: the Layout tab's switch taken away.
describe("U-2 (12): the shape buttons in the top bar, and none in the Layout tab", () => {
  it("offers L, one wall and U by their short names, the long name on the button's title", () => {
    expect(any(shapeControls).shapeButtons()).toEqual([
      { value: "L", labelKey: "topbar.shape.L", titleKey: "panel.layout.shape.L" },
      { value: "one-wall", labelKey: "topbar.shape.one-wall", titleKey: "panel.layout.shape.one-wall" },
      { value: "U", labelKey: "topbar.shape.U", titleKey: "panel.layout.shape.U" },
    ]);
  });

  it("puts them in the top bar and takes them out of the Layout tab", () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
    expect({ topBar: read("../ui/TopBar.tsx").includes("shapeButtons("), layoutTab: read("../ui/LayoutControls.tsx").includes("setLayoutShape") }).toEqual({
      topBar: true,
      layoutTab: false,
    });
  });
});

// --- 13 ----------------------------------------------------------------------
describe("U-2 (13): the words of the switch, as Leo agreed them (9.3)", () => {
  const WORDS: Record<string, [string, string]> = {
    "topbar.shape.L": ["L 型", "L-shape"],
    "topbar.shape.one-wall": ["一字型", "Single wall"],
    "topbar.shape.U": ["U 型", "U-shape"],
    "toast.shapeSwitched": ["已切换为{shape}，墙长已调整：", "Switched to {shape}; the walls were adjusted:"],
    "toast.shapeWall": ["{wall}从 {fromIn} 改为 {toIn}", "{wall}: {fromIn} → {toIn}"],
    // 「退回{shape}」 since 2026-11-12 (Leo, 3: 「后面是英文字母时留空格（退回 L 型、退回 U 型），
    // 后面是中文时不留（退回一字型）」): the space is the seam's, put in by `translate`
    // where a letter follows (cjkSpacing.test.ts). It was 「退回 {shape}」, 「退回 一字型」.
    "toast.undo.toShape": ["退回{shape}", "Back to {shape}"],
    // A draft, for Leo's look in the preview (no package reaches it today).
    "toast.shapeOmitted": ["墙已到最长，放不下{item}，已省略。", "The walls are at their longest: {item} left out."],
  };
  for (const [key, [zh, en]] of Object.entries(WORDS)) {
    it(`has ${key} in both languages`, () => {
      expect([translate("zh", key), translate("en", key)]).toEqual([zh, en]);
    });
  }

  it("no longer has the one-wall and U lines the notice replaces, nor the fixed 退回 L 型", () => {
    const keys = ["toast.shapeGrew", "toast.shapeGrew.U", "toast.undo.shape"];
    expect(keys.map((key) => [translate("zh", key), translate("en", key)])).toEqual(keys.map((key) => [key, key]));
  });

  it("reads A's switch from its L to the U in full, in Chinese", () => {
    freshPage();
    store().setLayoutShape("U");
    const toast = store().toast!;
    const say = (key: string, vars?: Record<string, string | number>) => sayWith((k, v) => translate("zh", k, v), key, vars);
    // 「已切换为 U 型厨房」 since 2026-11-12 (Leo: 「"为"和"U"之间加一个空格」); it was
    // 「已切换为U 型厨房」.
    expect([toast.lines!.map((line) => say(line.key, line.vars)), say(toast.undoLabel!.key, toast.undoLabel!.vars)]).toEqual([
      ["已切换为 U 型厨房，墙长已调整：", "左右墙从 144″ 改为 155¼″"],
      "退回 L 型",
    ]);
  });
});

// --- 16 ----------------------------------------------------------------------
// Leo, 2026-11-12, on U-2's seven points: 「1. 墙没变时不弹提示，不给退回。」 and 「7. 在 U 里换套餐的
// 提示：只列真正变了的墙，没变的不提，句式和切换形状的提示统一。」
describe("U-2 (16): a package switch in a U says the walls that changed, as a shape switch does", () => {
  const say = (key: string, vars?: Record<string, string | number>) => sayWith((k, v) => translate("zh", k, v), key, vars);

  it("names only the side walls when only they grow: A's U to D's, the back wall at 132″ unsaid", () => {
    freshPage();
    openSharedLink(uLink("A"));
    useAppStore.setState({ toast: null });
    store().setPackageId("package-d");
    const toast = store().toast;
    expect([store().layoutParams.backWallIn, toast?.key, toast?.lines, toast?.stacked, toast?.undoLabel, !!toast?.undo]).toEqual([
      132,
      "toast.packageSwitched",
      [
        { key: "toast.packageSwitched", vars: { package: "Package D" } },
        { key: "toast.shapeWall", vars: { wallKey: "toast.wall.sides", fromIn: "155¼″", toIn: "177″" } },
      ],
      true,
      { key: "toast.undo.package", vars: { package: "Package A" } },
      true,
    ]);
  });

  it("reads it in full in Chinese: 已切换为套餐 D, the wall from and to, 退回套餐 A", () => {
    freshPage();
    useAppStore.setState({ lang: "zh" });
    openSharedLink(`${uLink("A")}&lang=zh`);
    useAppStore.setState({ toast: null, lang: "zh" });
    store().setPackageId("package-d");
    const toast = store().toast!;
    expect([toast.lines!.map((line) => say(line.key, line.vars)), say(toast.undoLabel!.key, toast.undoLabel!.vars)]).toEqual([
      ["已切换为套餐 D，墙长已调整：", "左右墙从 155¼″ 改为 177″"],
      "退回套餐 A",
    ]);
    useAppStore.setState({ lang: "en" });
  });

  it("says nothing and offers no Undo when no wall changes: D's U to A's", () => {
    freshPage();
    openSharedLink(uLink("D"));
    useAppStore.setState({ toast: null });
    const walls = [store().layoutParams.backWallIn, store().layoutParams.leftWallIn];
    store().setPackageId("package-a");
    expect([[store().layoutParams.backWallIn, store().layoutParams.leftWallIn], store().toast]).toEqual([walls, null]);
  });

  it("says nothing and offers no Undo when a shape switch changes no wall (point 1, as U-2 built it)", () => {
    freshPage();
    store().setPackageId("package-d");
    useAppStore.setState({ toast: null });
    const left = store().layoutParams.leftWallIn;
    store().setLayoutShape("U");
    expect([store().layoutParams.shape, store().layoutParams.leftWallIn, store().toast]).toEqual(["U", left, null]);
  });

  it("has the line in both languages, in the shape switch's pattern", () => {
    expect([translate("zh", "toast.packageSwitched"), translate("en", "toast.packageSwitched")]).toEqual([
      "已切换为{package}，墙长已调整：",
      "Switched to {package}; the walls were adjusted:",
    ]);
  });

  it("no longer has toast.roomGrew.U", () => {
    expect([translate("zh", "toast.roomGrew.U"), translate("en", "toast.roomGrew.U")]).toEqual(["toast.roomGrew.U", "toast.roomGrew.U"]);
  });
});

// --- 14 ----------------------------------------------------------------------
// Leo, 2026-11-11, 6: 「右边面板平面小图里 U 的右墙画成实线：这一轮一起改」.
describe("U-2 (14): the plan thumbnail draws the U's right wall solid", () => {
  it("adds nothing to the left and back walls in an L, and the right wall in a U, along the floor line", async () => {
    const { planWalls } = any(await import("../ui/planWalls"));
    freshPage();
    const inL = planWalls();
    openSharedLink(uLink("C"));
    const inU = planWalls();
    const [line] = any(room).floorLineWalls();
    expect({ l: inL.length, u: inU.length, right: inU[0] }).toEqual({
      l: 0,
      u: 1,
      right: [
        [line.at, line.from],
        [line.at, line.to],
      ],
    });
  });
});

// --- 15 ----------------------------------------------------------------------
// Found building B (Leo, 2026-11-11: 「切换形状永远成功」): a package changed on one
// wall or in a U keeps no L, and the L the switch back built from the other
// shape's walls — the last package's L's — refused in 14 ways from one wall
// (on bdeedb5 too). Now 乙: those walls where they do, the package's own L's
// where they will not; said wall by wall, with Undo.
describe("U-2 (15): back to an L after a package changed in another shape", () => {
  const PKGS = ["package-a", "package-b", "package-c", "package-d", "package-e"];
  for (const shape of ["one-wall", "U"] as const) {
    for (const a of PKGS) {
      for (const b of PKGS) {
        if (a === b) continue;
        it(`${a.slice(-1).toUpperCase()} ${shape}, then ${b.slice(-1).toUpperCase()}, then the L`, () => {
          freshPage();
          store().setPackageId(a);
          store().setLayoutShape(shape);
          store().setPackageId(b);
          const before = { ...store().layoutParams };
          const toastBefore = store().toast?.id;
          const result = store().setLayoutShape("L");
          const after = store().layoutParams;
          const changed = after.backWallIn !== before.backWallIn || after.leftWallIn !== before.leftWallIn;
          const toast = store().toast && store().toast!.id !== toastBefore ? store().toast : null;
          expect({ ok: result.ok, shape: after.shape, omitted: [...room.OMITTED_FOR_WALL], said: !!toast?.undo }).toEqual({
            ok: true,
            shape: "L",
            omitted: [],
            said: changed,
          });
        });
      }
    }
  }
});
