import { afterAll, describe, expect, it } from "vitest";
import * as cabinets from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { sayWith, translate } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import type { Appliance, SlotId } from "../types";

/**
 * Item 12d: under the oven in B's and E's towers, and D's on one wall, D's rule
 * (Leo, 2026-11-17: 「12d：B、E、一字型的 D（都照搬 D 的规矩）」; 「还用 6″ 和 12″ 这两个数，
 * 规矩和 D 写在同一处，不另写一份」; 「安装清单加 12b 那样的一行，句子用 12b 已经审过的那几句」;
 * 「默认的 54″ 必须和现在逐像素相同」; docs/plans/item12d-plan.md).
 *
 * These towers are hung from the microwave handle, 44" to 60" by 1", 54" by
 * default: the opening starts at the handle less 39", at most 18"
 * (`comboSillFor`), and the box under it runs from the 4" toe kick to there.
 * Under 6" a fixed panel, 6" to under 12" one drawer, 12" and over two drawers
 * of equal height — until 12d a box of 6" or less here had no front at all.
 * D's L and U, hung from the oven height (12b), are left as they are.
 *
 * Every figure is written out from the rule and the handle, not read back.
 */

const OPENED = useAppStore.getState();
const store = () => useAppStore.getState();
afterAll(() => {
  resetRoom();
  useAppStore.setState(OPENED, true);
});

const inches = (feet: number) => Math.round(feet * 12 * 1000) / 1000;

/** The towers 12d is about: each package, shape and the slot its oven stands in. */
const TOWERS = [
  ["package-b", "L", "slot-microwave"],
  ["package-b", "U", "slot-microwave"],
  ["package-b", "one-wall", "slot-microwave"],
  ["package-e", "L", "slot-microwave"],
  ["package-e", "U", "slot-microwave"],
  ["package-e", "one-wall", "slot-microwave"],
  ["package-d", "one-wall", "slot-oven"],
] as const;

function open(pkg: string, shape: string) {
  resetRoom();
  useAppStore.setState(OPENED, true);
  store().setPackageId(pkg);
  if (shape !== "L") expect(store().setLayoutShape(shape as never).ok).toBe(true);
}

function setHandle(handleIn: number) {
  store().setLayout({ microwaveHandleIn: handleIn });
  expect(store().layoutIssues).toEqual([]);
}

/** The boxes under the opening, bottom first, in inches, and the front each wears. */
function under(slot: SlotId) {
  return cabinets.CABINETS.filter((box) => box.slot === slot && box.kind === "base" && box.module?.kind === "tall")
    .map((box) => ({
      bottomIn: inches(box.position[1] - box.size[1] / 2),
      topIn: inches(box.position[1] + box.size[1] / 2),
      face: box.face ?? null,
      front: cabinets.underOvenFront(box),
    }))
    .sort((a, b) => a.bottomIn - b.bottomIn);
}

/** The sill a handle asks for: the handle less 39", at most 18" (COMBO_OVEN, MEM301WS's drawing). */
const sillAt = (handleIn: number) => Math.min(18, handleIn - 39);

/** D's rule, written out for one sill: the same figures as 12b's. */
function expectedUnder(sillIn: number) {
  const box = sillIn - 4;
  if (box < 6) return [{ bottomIn: 4, topIn: sillIn, face: "strip", front: "panel" }];
  if (box < 12) return [{ bottomIn: 4, topIn: sillIn, face: null, front: "drawer" }];
  const mid = 4 + box / 2;
  return [
    { bottomIn: 4, topIn: mid, face: null, front: "drawer" },
    { bottomIn: mid, topIn: sillIn, face: null, front: "drawer" },
  ];
}

const HANDLES = Array.from({ length: 17 }, (_, i) => i + 44);

describe("under the oven, every step of the microwave handle", () => {
  describe.each(TOWERS)("%s, %s", (pkg, shape, slot) => {
    it.each(HANDLES)("handle %i\": D's rule", (handleIn) => {
      open(pkg, shape);
      setHandle(handleIn);
      expect(inches(SLOT_BY_ID[slot].position[1])).toBe(sillAt(handleIn));
      expect(under(slot)).toEqual(expectedUnder(sillAt(handleIn)));
    });

    it("at the default 54\": one 11\" drawer, the box it always was", () => {
      open(pkg, shape);
      expect(store().layoutParams).toHaveProperty("microwaveHandleIn", 54);
      const boxes = cabinets.CABINETS.filter((box) => box.slot === slot && box.kind === "base" && box.module?.kind === "tall");
      expect(boxes.map((box) => ({ id: box.id, face: box.face ?? null, heightIn: inches(box.size[1]) }))).toEqual([
        { id: boxes[0].id, face: null, heightIn: 11 },
      ]);
      expect(boxes[0].id).toMatch(/-base$/);
    });
  });
});

/** The install list's lines about the tower's oven, in both languages. */
function ovenLines(slot: SlotId) {
  const selection = Object.fromEntries(
    Object.entries(store().selection).map(([s, id]) => [s, APPLIANCE_BY_ID[id as string]]),
  ) as Record<SlotId, Appliance>;
  return checklistFor(selection, null)
    .findings.filter((f) => f.slot === slot && ["oven-sill", "steam-oven"].includes(f.ruleId))
    .map((f) => ({
      ruleId: f.ruleId,
      zh: sayWith((k, v) => translate("zh", k, v), f.messageKey ?? "", f.params),
      en: sayWith((k, v) => translate("en", k, v), f.messageKey ?? "", f.params),
    }));
}

describe("the install list: 12b's line, in 12b's reviewed words", () => {
  describe.each(TOWERS)("%s, %s", (pkg, shape, slot) => {
    it.each([
      [44, "烤箱切口底离地 5″（规格表允许 4-3/4″–18″，从地面量）；下面是一块固定面板，高 1″", "Oven opening starts 5\" off the floor (the sheet allows 4-3/4\"–18\", from the floor); under it a fixed panel, 1\" tall"],
      [49, "烤箱切口底离地 10″（规格表允许 4-3/4″–18″，从地面量）；下面是一个抽屉，高 6″", "Oven opening starts 10\" off the floor (the sheet allows 4-3/4\"–18\", from the floor); under it one drawer, 6\" tall"],
      [54, "烤箱切口底离地 15″（规格表允许 4-3/4″–18″，从地面量）；下面是一个抽屉，高 11″", "Oven opening starts 15\" off the floor (the sheet allows 4-3/4\"–18\", from the floor); under it one drawer, 11\" tall"],
      [56, "烤箱切口底离地 17″（规格表允许 4-3/4″–18″，从地面量）；下面是两个抽屉，各高 6-1/2″", "Oven opening starts 17\" off the floor (the sheet allows 4-3/4\"–18\", from the floor); under it two drawers, 6-1/2\" each"],
      [60, "烤箱切口底离地 18″（规格表允许 4-3/4″–18″，从地面量）；下面是两个抽屉，各高 7″", "Oven opening starts 18\" off the floor (the sheet allows 4-3/4\"–18\", from the floor); under it two drawers, 7\" each"],
    ])("handle %i\": MEM301WS, the one line", (handleIn, zh, en) => {
      open(pkg, shape);
      setHandle(handleIn);
      expect(ovenLines(slot)).toEqual([{ ruleId: "oven-sill", zh, en }]);
    });
  });

  it("D on one wall with PODS302B: the line, and the old one with the handle and the circuit only", () => {
    open("package-d", "one-wall");
    store().selectAppliance("slot-oven", "thermador-pods302b");
    expect(ovenLines("slot-oven")).toEqual([
      {
        ruleId: "oven-sill",
        zh: "烤箱切口底离地 15″（规格表允许 4-3/4″–18-3/4″，从地面量）；下面是一个抽屉，高 11″",
        en: "Oven opening starts 15\" off the floor (the sheet allows 4-3/4\"–18-3/4\", from the floor); under it one drawer, 11\" tall",
      },
      // The circuit is the opening's, as before 12d: on one wall D's tower is wired
      // for MEM301WS, 50A, and the list said 「240V 50A」 here before (4f4351b's dump),
      // where the rough-in says PODS302B's 40A — registered, not changed (12d).
      {
        ruleId: "steam-oven",
        zh: "蒸烤箱下门把手在 37″；240V 50A 专用回路",
        en: "Steam oven lower door handle at 37\"; 240V 50A dedicated circuit",
      },
    ]);
  });
});

describe("what 12d does not touch", () => {
  // D's L and U: hung from the oven height (12b), not the microwave handle.
  it.each(["L", "U"] as const)("D's %s: the microwave handle moves nothing under the oven, the oven height still does", (shape) => {
    open("package-d", shape);
    const before = JSON.stringify(under("slot-oven"));
    expect(JSON.parse(before)).toEqual(expectedUnder(12));
    for (const handleIn of [44, 60]) {
      setHandle(handleIn);
      expect(JSON.stringify(under("slot-oven"))).toBe(before);
    }
    store().setLayout({ steamSillIn: 5 } as never);
    expect(under("slot-oven")).toEqual(expectedUnder(5));
  });

  // E's coffee tower stands on its wine cooler, with a fixed panel between (D11 rule 14).
  it("E's coffee tower: as it was, a panel over the wine cooler, at either end of the handle", () => {
    for (const handleIn of [44, 54, 60]) {
      open("package-e", "L");
      setHandle(handleIn);
      const coffee = cabinets.CABINETS.filter((box) => box.slot === "slot-coffee" && box.kind === "base");
      expect(coffee.map((box) => ({ face: box.face ?? null, front: cabinets.underOvenFront(box) }))).toEqual([{ face: "strip", front: null }]);
    }
  });

  it.each(["package-a", "package-c"])("%s: no oven tower, no line", (pkg) => {
    open(pkg, "L");
    expect(ovenLines("slot-microwave")).toEqual([]);
    expect(ovenLines("slot-oven")).toEqual([]);
  });
});
