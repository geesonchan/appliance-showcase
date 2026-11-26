import { afterAll, describe, expect, it } from "vitest";
import * as cabinets from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { dimensionsFor } from "./dimensions";
import * as towerOven from "./towerOven";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { sayWith, translate } from "../i18n";
import { kitchenNow, openSharedLink } from "../store/openLink";
import { writeLink } from "../store/shareLink";
import { useAppStore } from "../store/useAppStore";
import type { Appliance, SlotId } from "../types";

/**
 * Item 12b: package D's oven height, set in Layout (Leo, 2026-11-16, his answers
 * to the plan's first and second drafts, docs/plans/item12b-plan.md).
 *
 * - The slider sets the opening's bottom off the floor, 5" to 18" by 1", 12" by
 *   default (「1，按原型；2，按原型」; F: 「还按切口底离地，最低 5″」).
 * - Under the opening, the box from the 4" toe kick to the sill: under 6" a fixed
 *   panel, 6" to under 12" one drawer, 12" and over two drawers of equal height
 *   (「A. 抽屉箱不到（6″ ）就做固定面板」, 「B. 抽屉箱到（12″ ）起分两个，分法（一样高 ）」).
 * - The range follows the model chosen (C, 乙): PO302W to 14" (its sheet's
 *   4-3/4"-14-7/8", po302w-spec.pdf p. 2), held there with a line saying so as
 *   B's microwave reach does; ME301YP still to 18" though its sheet allows 38".
 * - The install list: a line with the opening's height for all four models, and
 *   the line that was there keeps the handle and the circuit; 「蒸烤箱」 only for a
 *   steam oven (D).
 * - An install-mode dimension from the floor to the opening's bottom (E).
 * - B's and E's sliders and towers unchanged; D on one wall unchanged.
 *
 * Every figure here is written out from its source — the sheets and Leo's
 * answers — not read back from the code.
 */

const OPENED = useAppStore.getState();
const store = () => useAppStore.getState();
afterAll(() => {
  resetRoom();
  useAppStore.setState(OPENED, true);
});

const PODS302B = "thermador-pods302b";
const PO302W = "thermador-po302w";
const ME301YP = "thermador-me301yp";
const MEM301WS = "thermador-mem301ws";
const MODELS = [PODS302B, PO302W, ME301YP, MEM301WS] as const;

/** Each model's opening, from its sheet (p. 1 or 2) as the tower opens to it (towerOven.ts). */
const OPENING_IN: Record<string, number> = { [PODS302B]: 47.375, [PO302W]: 50, [ME301YP]: 47.375, [MEM301WS]: 48.5 };
/** What each sheet's wall-mount drawing allows under the opening, p. 2 of each (printed 2). */
const SHEET: Record<string, { low: string; high: string; sliderMax: number }> = {
  [PODS302B]: { low: "4-3/4", high: "18-3/4", sliderMax: 18 },
  [PO302W]: { low: "4-3/4", high: "14-7/8", sliderMax: 14 },
  [ME301YP]: { low: "4-3/4", high: "38", sliderMax: 18 },
  [MEM301WS]: { low: "4-3/4", high: "18", sliderMax: 18 },
};

const inches = (feet: number) => Math.round(feet * 12 * 1000) / 1000;

function openD(shape: "L" | "U", model: string = PODS302B) {
  resetRoom();
  useAppStore.setState(OPENED, true);
  store().setPackageId("package-d");
  if (shape === "U") expect(store().setLayoutShape("U").ok).toBe(true);
  if (model !== PODS302B) store().selectAppliance("slot-oven", model);
  expect(store().selection["slot-oven"]).toBe(model);
}

function setSill(sillIn: number) {
  store().setLayout({ steamSillIn: sillIn } as never);
  expect(store().layoutIssues).toEqual([]);
}

/** The boxes under the opening, bottom first, in inches. */
function under() {
  return cabinets.CABINETS.filter((box) => box.slot === "slot-oven" && box.kind === "base")
    .map((box) => ({
      bottomIn: inches(box.position[1] - box.size[1] / 2),
      topIn: inches(box.position[1] + box.size[1] / 2),
      face: box.face ?? null,
      front: (cabinets as unknown as { underOvenFront?: (b: typeof box) => string | null }).underOvenFront?.(box) ?? "missing",
    }))
    .sort((a, b) => a.bottomIn - b.bottomIn);
}

/** Leo's A and B, written out for one sill. */
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

const sillNow = () => inches(SLOT_BY_ID["slot-oven"].position[1]);
const bridge = () => cabinets.CABINETS.find((box) => box.slot === "slot-oven" && box.id.endsWith("-bridge"))!;

describe("D's oven height, every inch from 5 to 18", () => {
  describe.each(["L", "U"] as const)("in D's %s", (shape) => {
    it.each(Array.from({ length: 14 }, (_, i) => i + 5))("at %i\": the opening, what is under it, the door over it", (sillIn) => {
      openD(shape);
      setSill(sillIn);
      expect(sillNow()).toBe(sillIn);
      expect(under()).toEqual(expectedUnder(sillIn));
      const over = bridge();
      expect(inches(over.position[1] - over.size[1] / 2)).toBe(sillIn + 47.375);
      expect(inches(over.position[1] + over.size[1] / 2)).toBe(96);
    });
  });

  it("opens at 12\" by default, one 8\" drawer under it, as before 12b", () => {
    openD("L");
    expect(store().layoutParams).toHaveProperty("steamSillIn", 12);
    expect(sillNow()).toBe(12);
    expect(under()).toEqual([{ bottomIn: 4, topIn: 12, face: null, front: "drawer" }]);
  });
});

describe("D's four ovens: the slider's range follows the model", () => {
  it.each(MODELS)("%s: the slider's ends", (model) => {
    const limits = (towerOven as unknown as { ovenSillLimits?: (a: Appliance) => unknown }).ovenSillLimits;
    expect(typeof limits).toBe("function");
    expect(limits!(APPLIANCE_BY_ID[model])).toEqual({ min: 5, max: SHEET[model].sliderMax, step: 1 });
  });

  describe.each(["L", "U"] as const)("in D's %s", (shape) => {
    it.each(MODELS)("%s at 16\" asked: built where its sheet allows, the door over its own opening", (model) => {
      openD(shape, model);
      setSill(16);
      const built = Math.min(16, SHEET[model].sliderMax);
      expect(sillNow()).toBe(built);
      expect(under()).toEqual(expectedUnder(built));
      const over = bridge();
      expect(inches(over.position[1] - over.size[1] / 2)).toBe(built + OPENING_IN[model]);
      // The slider keeps what was asked, as B's microwave handle does: back to a
      // model that allows it, the opening goes back to 16".
      expect(store().layoutParams).toHaveProperty("steamSillIn", 16);
    });
  });

  it("PO302W chosen over a sill above 14\": held at 14\", and back at 16\" for PODS302B", () => {
    openD("L");
    setSill(16);
    store().selectAppliance("slot-oven", PO302W);
    expect(sillNow()).toBe(14);
    store().selectAppliance("slot-oven", PODS302B);
    expect(sillNow()).toBe(16);
  });
});

/** The install list's lines about the oven, each in both languages. */
function ovenLines() {
  const selection = Object.fromEntries(
    Object.entries(store().selection).map(([slot, id]) => [slot, APPLIANCE_BY_ID[id as string]]),
  ) as Record<SlotId, Appliance>;
  return checklistFor(selection, null)
    .findings.filter((f) => f.slot === "slot-oven")
    .map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      zh: sayWith((k, v) => translate("zh", k, v), f.messageKey ?? "", f.params),
      en: sayWith((k, v) => translate("en", k, v), f.messageKey ?? "", f.params),
    }));
}

describe("the install list", () => {
  describe.each(["L", "U"] as const)("in D's %s", (shape) => {
    it.each([
      [PODS302B, 5, "下面是一块固定面板，高 1″", "under it a fixed panel, 1″ tall"],
      [PODS302B, 12, "下面是一个抽屉，高 8″", "under it one drawer, 8″ tall"],
      [PODS302B, 18, "下面是两个抽屉，各高 7″", "under it two drawers, 7″ each"],
      [PO302W, 9, "下面是一块固定面板，高 5″", "under it a fixed panel, 5″ tall"],
      [ME301YP, 16, "下面是两个抽屉，各高 6″", "under it two drawers, 6″ each"],
      [MEM301WS, 13, "下面是一个抽屉，高 9″", "under it one drawer, 9″ tall"],
    ] as const)("%s at %i\": the opening's line, its sheet's range, what is under it", (model, sillIn, zhUnder, enUnder) => {
      openD(shape, model);
      setSill(sillIn);
      const line = ovenLines().find((l) => l.ruleId === "oven-sill");
      const { low, high } = SHEET[model];
      expect(line?.zh).toBe(`烤箱切口底离地 ${sillIn}″（规格表允许 ${low}″–${high}″，从地面量）；${zhUnder}`);
      expect(line?.en).toBe(`Oven opening starts ${sillIn}″ off the floor (the sheet allows ${low}″–${high}″, from the floor); ${enUnder}`);
    });

    it("PODS302B: the line that was there keeps the handle and the circuit, as a steam oven", () => {
      openD(shape);
      setSill(15);
      const line = ovenLines().find((l) => l.ruleId === "steam-oven");
      expect(line?.zh).toBe("蒸烤箱下门把手在 37″；240V 40A 专用回路");
      expect(line?.en).toBe("Steam oven lower door handle at 37″; 240V 40A dedicated circuit");
    });

    it("PO302W: the same line calls it an oven, not a steam oven", () => {
      openD(shape, PO302W);
      setSill(10);
      const line = ovenLines().find((l) => l.ruleId === "steam-oven");
      expect(line?.zh).toBe("烤箱下门把手在 32″；240V 40A 专用回路");
      expect(line?.en).toBe("Oven lower door handle at 32″; 240V 40A dedicated circuit");
    });

    it.each([PO302W, ME301YP, MEM301WS])("%s: nothing on the list calls it a steam oven", (model) => {
      openD(shape, model);
      setSill(16);
      const lines = ovenLines();
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.filter((l) => /蒸/.test(l.zh) || /steam/i.test(l.en))).toEqual([]);
    });

    it("PO302W held at 14\": a warning, as B's microwave reach says it", () => {
      openD(shape, PO302W);
      setSill(16);
      const warning = ovenLines().find((l) => l.ruleId === "oven-sill-held");
      expect(warning?.severity).toBe("warning");
      expect(warning?.zh).toBe("烤箱切口底实际离地 14″，非所要的 16″：PO302W 的规格表只允许 4-3/4″–14-7/8″");
      expect(warning?.en).toBe("The oven opening starts 14″ off the floor, not the 16″ asked for: the PO302W sheet allows only 4-3/4″–14-7/8″");
      setSill(14);
      expect(ovenLines().find((l) => l.ruleId === "oven-sill-held")).toBeUndefined();
    });
  });
});

describe("install mode: the opening's height off the floor", () => {
  describe.each(["L", "U"] as const)("in D's %s", (shape) => {
    it.each([5, 12, 18])("at %i\", from the floor to the opening, about the oven", (sillIn) => {
      openD(shape);
      setSill(sillIn);
      const selection = Object.fromEntries(
        Object.entries(store().selection).map(([slot, id]) => [slot, APPLIANCE_BY_ID[id as string]]),
      );
      const line = dimensionsFor(selection).find((d) => d.id === "oven-sill");
      expect(line).toBeDefined();
      expect(line!.valueIn).toBe(sillIn);
      expect(inches(line!.from[1])).toBe(0);
      expect(inches(line!.to[1])).toBe(sillIn);
      expect(line!.slots).toEqual(["slot-oven"]);
      // And with the oven looked at, it stays: it is the oven's figure.
      expect(dimensionsFor(selection, "slot-oven").some((d) => d.id === "oven-sill")).toBe(true);
    });
  });
});

describe("what 12b does not touch", () => {
  /** B's and E's towers: the microwave's sill, and every box of the tower. */
  function tower() {
    const slot = "slot-microwave";
    return JSON.parse(
      JSON.stringify({
        sill: inches(SLOT_BY_ID[slot].position[1]),
        boxes: cabinets.CABINETS.filter((box) => box.slot === slot),
        lines: dimensionsFor(
          Object.fromEntries(Object.entries(store().selection).map(([s, id]) => [s, APPLIANCE_BY_ID[id as string]])),
        ).map((d) => d.id),
      }),
    ) as { sill: number; boxes: unknown[]; lines: string[] };
  }

  describe.each([
    ["package-b", "L"],
    ["package-b", "U"],
    ["package-b", "one-wall"],
    ["package-e", "L"],
    ["package-e", "U"],
    ["package-e", "one-wall"],
  ] as const)("%s, %s", (pkg, shape) => {
    it("the oven height changes nothing in the tower, and the microwave handle still sets it", () => {
      resetRoom();
      useAppStore.setState(OPENED, true);
      store().setPackageId(pkg);
      if (shape !== "L") expect(store().setLayoutShape(shape).ok).toBe(true);
      const before = tower();
      // The microwave handle's 54" by default: the sill 15" (comboSillFor).
      expect(before.sill).toBe(15);
      expect(before.lines).not.toContain("oven-sill");
      for (const sillIn of [5, 18]) {
        store().setLayout({ steamSillIn: sillIn } as never);
        expect(tower()).toEqual(before);
      }
      store().setLayout({ microwaveHandleIn: 50 });
      expect(tower().sill).toBe(11);
    });
  });

  it("D on one wall: MEM301WS hung from the microwave handle, the oven height changes nothing", () => {
    resetRoom();
    useAppStore.setState(OPENED, true);
    store().setPackageId("package-d");
    expect(store().setLayoutShape("one-wall").ok).toBe(true);
    const before = JSON.stringify({ sill: sillNow(), boxes: cabinets.CABINETS });
    expect(sillNow()).toBe(15);
    store().setLayout({ steamSillIn: 5 } as never);
    expect(JSON.stringify({ sill: sillNow(), boxes: cabinets.CABINETS })).toBe(before);
  });
});

describe("the share link", () => {
  it("carries the oven height, and opens where it was", () => {
    openD("U");
    setSill(7);
    const link = writeLink(kitchenNow());
    const query = new URLSearchParams(link);
    expect(query.get("v")).toBe("4");
    expect(query.get("steamSill")).toBe("7");
    const room = JSON.stringify(cabinets.CABINETS);
    resetRoom();
    useAppStore.setState(OPENED, true);
    openSharedLink(`?${link}`);
    expect(store().layoutParams).toHaveProperty("steamSillIn", 7);
    expect(sillNow()).toBe(7);
    expect(JSON.stringify(cabinets.CABINETS)).toBe(room);
    expect(store().toast).toBeNull();
  });

  // What the link writes is the height asked for, not the one built (Leo, 2026-11-16,
  // on the report: 「分享链接里写的是我要的高度还是实际建成的高度，写明并说明理由」).
  // The built one follows from the asked one and the model, both in the link, so
  // nothing is lost by leaving it out; written the other way, a link made while
  // PO302W holds the opening at 14" would forget the 16" asked, and the one who
  // opens it, switching back to PODS302B, would get 14" where the sender got 16".
  // So the link opens as the room was: held at 14" with its warning, 16" kept.
  it("written while PO302W holds the opening at 14\", it carries the 16\" asked and opens the same way", () => {
    openD("L", PO302W);
    setSill(16);
    expect(sillNow()).toBe(14);
    const link = writeLink(kitchenNow());
    expect(new URLSearchParams(link).get("steamSill")).toBe("16");
    const room = JSON.stringify(cabinets.CABINETS);
    resetRoom();
    useAppStore.setState(OPENED, true);
    openSharedLink(`?${link}`);
    expect(store().selection["slot-oven"]).toBe(PO302W);
    expect(store().layoutParams).toHaveProperty("steamSillIn", 16);
    expect(sillNow()).toBe(14);
    expect(JSON.stringify(cabinets.CABINETS)).toBe(room);
    expect(ovenLines().find((l) => l.ruleId === "oven-sill-held")?.zh).toBe(
      "烤箱切口底实际离地 14″，非所要的 16″：PO302W 的规格表只允许 4-3/4″–14-7/8″",
    );
    store().selectAppliance("slot-oven", PODS302B);
    expect(sillNow()).toBe(16);
  });

  it.each(["1", "2", "3"])("an old link (v=%s), written before it, opens at 12\" and says nothing about it", (v) => {
    openD("L");
    setSill(17);
    const query = new URLSearchParams(writeLink(kitchenNow()));
    query.set("v", v);
    query.delete("steamSill");
    if (v === "1") query.delete("shape");
    resetRoom();
    useAppStore.setState(OPENED, true);
    openSharedLink(`?${query.toString()}`);
    expect(store().packageId).toBe("package-d");
    expect(store().layoutParams).toHaveProperty("steamSillIn", 12);
    expect(sillNow()).toBe(12);
    expect(store().toast).toBeNull();
  });
});
