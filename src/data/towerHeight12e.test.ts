import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import * as slots from "./slots";
import * as towerOven from "./towerOven";
import { resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { sayWith, translate } from "../i18n";
import { kitchenNow, openSharedLink } from "../store/openLink";
import { writeLink } from "../store/shareLink";
import { useAppStore } from "../store/useAppStore";
import zh from "../i18n/zh.json";
import en from "../i18n/en.json";
import type { Appliance, SlotId } from "../types";

/**
 * Item 12e: one rule for every oven tower (Leo, 2026-11-18, his answers to the plan's
 * second draft, docs/plans/item12e-plan.md): 「烤箱有微波门就调微波把手，没有微波门就调切口底」 —
 * MEM301WS hangs from its microwave handle, PO302W, ME301YP and PODS302B from the oven
 * height, held to their own sheets with 12b's reviewed sentence, in every package (4:
 * D's L and U with MEM301WS too). The height is handed over, not kept apart (1: 「高度接过去……
 * 换型号时烤箱留在原来的高度；只有超出所选烤箱的规格表才压住并提示。换回去也回到同一个高度。我要的高度记着」),
 * starting where the oven stands (2: B, E and D on one wall 15"), old links opening where
 * the oven was (3), and one wall's D's MEM301WS saying when its handle cannot be reached,
 * as B's and E's do (二).
 *
 * Every figure written out from the sheets and the handle, not read back from the code.
 */

const OPENED = useAppStore.getState();
const store = () => useAppStore.getState();
afterAll(() => {
  resetRoom();
  useAppStore.setState(OPENED, true);
});

const MEM301WS = "thermador-mem301ws";
const PO302W = "thermador-po302w";
const ME301YP = "thermador-me301yp";
const PODS302B = "thermador-pods302b";
const OVENS = [MEM301WS, PO302W, ME301YP, PODS302B] as const;
const name = (id: string) => APPLIANCE_BY_ID[id].model;

/** Every oven tower: package, shape, its slot, its default oven, and the opening it opens at. */
const TOWERS = [
  ["package-b", "L", "slot-microwave", MEM301WS, 15],
  ["package-b", "U", "slot-microwave", MEM301WS, 15],
  ["package-b", "one-wall", "slot-microwave", MEM301WS, 15],
  ["package-e", "L", "slot-microwave", MEM301WS, 15],
  ["package-e", "U", "slot-microwave", MEM301WS, 15],
  ["package-e", "one-wall", "slot-microwave", MEM301WS, 15],
  ["package-d", "one-wall", "slot-oven", MEM301WS, 15],
  ["package-d", "L", "slot-oven", PODS302B, 12],
  ["package-d", "U", "slot-oven", PODS302B, 12],
] as const;

function open(pkg: string, shape: string) {
  resetRoom();
  useAppStore.setState(OPENED, true);
  store().setPackageId(pkg);
  if (shape !== "L") expect(store().setLayoutShape(shape as never).ok).toBe(true);
}

const sillOf = (slot: string) => Math.round(slots.SLOT_BY_ID[slot as SlotId].position[1] * 12 * 1000) / 1000;

/** The rule, written out: which slider, where the opening starts, whether held, for an asked opening. */
function expected(oven: string, askedIn: number) {
  if (oven === MEM301WS) {
    const sillIn = Math.min(18, Math.max(4.75, askedIn));
    return { hang: "handle", sillIn, held: sillIn !== askedIn };
  }
  const top = { [PO302W]: 14, [ME301YP]: 18, [PODS302B]: 18 }[oven]!;
  const sillIn = Math.min(top, Math.max(5, askedIn));
  return { hang: "height", sillIn, held: sillIn !== askedIn };
}

/** The tower as the page has it: the opening built, and the rule's answer for the slider (12e's one place). */
function tower(pkg: string, slot: string) {
  const spec = (towerOven as unknown as { towerSillFor?: (t: string, p: unknown, o: Appliance | undefined) => { hang: string; sillIn: number; held: boolean } }).towerSillFor;
  const installType = pkg === "package-d" && store().layoutParams.shape !== "one-wall" ? "double" : "combo";
  const said = spec ? spec(installType, store().layoutParams, APPLIANCE_BY_ID[store().selection[slot as SlotId] as string]) : null;
  return { built: sillOf(slot), hang: said?.hang ?? "missing", sillIn: said?.sillIn ?? "missing", held: said?.held ?? "missing" };
}

/** The install list's lines that say the tower could not go where asked, in Chinese. */
function heldLines(slot: string) {
  const selection = Object.fromEntries(
    Object.entries(store().selection).map(([s, id]) => [s, APPLIANCE_BY_ID[id as string]]),
  ) as Record<SlotId, Appliance>;
  return checklistFor(selection, null)
    .findings.filter((f) => f.slot === slot && ["oven-sill-held", "microwave-reach"].includes(f.ruleId))
    .map((f) => `${f.ruleId}: ${sayWith((k, v) => translate("zh", k, v), f.messageKey ?? "", f.params)}`);
}

const heldWords = (oven: string, sillIn: number, askedIn: number) =>
  `oven-sill-held: 烤箱切口底实际离地 ${sillIn}″，非所要的 ${askedIn}″：${name(oven)} 的规格表只允许 4-3/4″–14-7/8″`;
const reachWords = (askedHandle: number) =>
  `microwave-reach: 微波把手实际在 57″，非所要的 ${askedHandle}″：切口底只能在 4-3/4″–18″ 之间，把手因此落在 43-3/4″ 至 57″`;

describe("every oven tower opens where it did", () => {
  it.each(TOWERS)("%s, %s: %s with %s at %i\"", (pkg, shape, slot, oven, sillIn) => {
    open(pkg, shape);
    expect(store().selection[slot as SlotId]).toBe(oven);
    expect(tower(pkg, slot)).toEqual({ built: sillIn, ...expected(oven, sillIn) });
    expect(heldLines(slot)).toEqual([]);
  });
});

describe("the four ovens swapped, each into each: the height handed over", () => {
  const pairs = OVENS.flatMap((a) => OVENS.filter((b) => b !== a).map((b) => [a, b] as const));
  describe.each(TOWERS)("%s, %s", (pkg, shape, slot, _own, startIn) => {
    it.each(pairs)("%s, then %s, then back", (from, to) => {
      open(pkg, shape);
      store().selectAppliance(slot as SlotId, from);
      const first = expected(from, startIn);
      expect(tower(pkg, slot)).toEqual({ built: first.sillIn, ...first });
      store().selectAppliance(slot as SlotId, to);
      const then = expected(to, startIn);
      expect(tower(pkg, slot)).toEqual({ built: then.sillIn, ...then });
      // Held only where the oven's own sheet stops it, with 12b's reviewed sentence.
      expect(heldLines(slot)).toEqual(then.held ? [heldWords(to, then.sillIn, startIn)] : []);
      store().selectAppliance(slot as SlotId, from);
      expect(tower(pkg, slot)).toEqual({ built: first.sillIn, ...first });
    });
  });
});

describe("the height asked is kept, as 12b keeps it", () => {
  it.each([
    ["package-b", "L", "slot-microwave"],
    ["package-e", "U", "slot-microwave"],
    ["package-d", "one-wall", "slot-oven"],
  ] as const)("%s, %s: 16\" asked, PO302W holds it at 14\", PODS302B and MEM301WS give it back", (pkg, shape, slot) => {
    open(pkg, shape);
    store().setLayout({ microwaveHandleIn: 55 });
    store().selectAppliance(slot, PO302W);
    expect(tower(pkg, slot)).toEqual({ built: 14, hang: "height", sillIn: 14, held: true });
    expect(heldLines(slot)).toEqual([heldWords(PO302W, 14, 16)]);
    store().selectAppliance(slot, PODS302B);
    expect(tower(pkg, slot)).toEqual({ built: 16, hang: "height", sillIn: 16, held: false });
    store().selectAppliance(slot, MEM301WS);
    expect(tower(pkg, slot)).toEqual({ built: 16, hang: "handle", sillIn: 16, held: false });
    expect(store().layoutParams).toHaveProperty("microwaveHandleIn", 55);
  });

  it.each(["L", "U"] as const)("D's %s: MEM301WS on its microwave handle, 60\" asked held at 18\", then PODS302B held at 18\" too", (shape) => {
    open("package-d", shape);
    store().selectAppliance("slot-oven", MEM301WS);
    expect(tower("package-d", "slot-oven")).toEqual({ built: 12, hang: "handle", sillIn: 12, held: false });
    // The handle slider writes D's own figure, the oven height: 60" less 39".
    store().setLayout({ steamSillIn: 21 } as never);
    expect(store().layoutIssues).toEqual([]);
    expect(tower("package-d", "slot-oven")).toEqual({ built: 18, hang: "handle", sillIn: 18, held: true });
    expect(heldLines("slot-oven")).toEqual([reachWords(60)]);
    store().selectAppliance("slot-oven", PODS302B);
    expect(tower("package-d", "slot-oven")).toEqual({ built: 18, hang: "height", sillIn: 18, held: true });
  });
});

describe("no microwave, no microwave sentence; one wall's D says it as B and E do", () => {
  it.each([
    ["package-b", "L", "slot-microwave"],
    ["package-e", "one-wall", "slot-microwave"],
    ["package-d", "one-wall", "slot-oven"],
  ] as const)("%s, %s: MEM301WS at 58\"-60\" says the handle is out of reach; PO302W there does not", (pkg, shape, slot) => {
    for (const handleIn of [58, 59, 60]) {
      open(pkg, shape);
      store().setLayout({ microwaveHandleIn: handleIn });
      expect(heldLines(slot)).toEqual([reachWords(handleIn)]);
      store().selectAppliance(slot, PO302W);
      expect(heldLines(slot)).toEqual([heldWords(PO302W, 14, handleIn - 39)]);
    }
  });
});

describe("old links: the oven where it was when the link was written, held to its sheet", () => {
  /** A link written now, then as an older page wrote it. */
  function linkAs(version: string, drop: string[]) {
    const query = new URLSearchParams(writeLink(kitchenNow()));
    query.set("v", version);
    for (const field of drop) query.delete(field);
    if (version === "1") query.delete("shape");
    return `?${query.toString()}`;
  }

  it.each(["1", "2", "3", "4"])("B's L with PO302W, v=%s: its handle's 15\", held at 14\" with the sentence", (v) => {
    open("package-b", "L");
    store().selectAppliance("slot-microwave", PO302W);
    store().setLayout({ microwaveHandleIn: 54 });
    const link = linkAs(v, v === "4" ? [] : ["steamSill"]);
    resetRoom();
    useAppStore.setState(OPENED, true);
    openSharedLink(link);
    expect(store().selection["slot-microwave"]).toBe(PO302W);
    expect(tower("package-b", "slot-microwave")).toEqual({ built: 14, hang: "height", sillIn: 14, held: true });
    expect(heldLines("slot-microwave")).toEqual([heldWords(PO302W, 14, 15)]);
  });

  it.each(["1", "2", "3", "4"])("D's L with MEM301WS, v=%s: where it was (12\" before v=4, the link's own after)", (v) => {
    open("package-d", "L");
    store().selectAppliance("slot-oven", MEM301WS);
    store().setLayout({ steamSillIn: 16 } as never);
    const link = linkAs(v, v === "4" ? [] : ["steamSill"]);
    resetRoom();
    useAppStore.setState(OPENED, true);
    openSharedLink(link);
    expect(store().selection["slot-oven"]).toBe(MEM301WS);
    const at = v === "4" ? 16 : 12;
    expect(tower("package-d", "slot-oven")).toEqual({ built: at, hang: "handle", sillIn: at, held: false });
  });
});

describe("kept to 21\" inside, never built past the chosen oven's sheet", () => {
  // Leo, 2026-11-19 (一.1): 「D 的烤箱高度内部存到 21″：保留，和 B 一条规矩。条件是建出来的切口底永远不超过所选烤箱的
  // 规格表，有测试守着；分享链接里写超了的值也照样压住并提示。」 Every tower, every oven, every height it can keep
  // (B's, E's and one wall's handle 44"-60", D's L's and U's oven height 5"-21"), built from the room
  // and held to each sheet's p. 2, written out here: MEM301WS 4-3/4"-18", PO302W 4-3/4"-14-7/8",
  // ME301YP 4-3/4"-38", PODS302B 4-3/4"-18-3/4".
  //
  // And what the list says when one is held (Leo, 2026-11-19: 「被规格表挡住用 12b 那句，被滑杆上限挡住用这句；
  // 四台烤箱、每座塔都查一遍，不能再出现"停在的高度"和"允许的范围"对不上的句子」): MEM301WS its microwave
  // line; PO302W at 14" and PODS302B at 18", the sheet's whole inches, 12b's sentence; ME301YP at 18",
  // the slider's top with its sheet to 38", the slider's sentence.
  const SHEET: Record<string, [number, number]> = {
    [MEM301WS]: [4.75, 18],
    [PO302W]: [4.75, 14.875],
    [ME301YP]: [4.75, 38],
    [PODS302B]: [4.75, 18.75],
  };
  const keeps = (pkg: string, shape: string, askedIn: number) =>
    pkg === "package-d" && shape !== "one-wall" ? { steamSillIn: askedIn } : { microwaveHandleIn: askedIn + 39 };
  const said = (oven: string, askedIn: number): string[] => {
    if (oven === MEM301WS) return askedIn > 18 ? [reachWords(askedIn + 39)] : [];
    if (oven === PO302W) return askedIn > 14 ? [heldWords(PO302W, 14, askedIn)] : [];
    if (oven === PODS302B)
      return askedIn > 18 ? [`oven-sill-held: 烤箱切口底实际离地 18″，非所要的 ${askedIn}″：PODS302B 的规格表只允许 4-3/4″–18-3/4″`] : [];
    return askedIn > 18 ? [`oven-sill-held: 烤箱切口底实际离地 18″，非所要的 ${askedIn}″：这里最高调到 18″`] : [];
  };
  /** Where a line says the oven stopped, and the top of what it says allowed it: the two must agree. */
  const agrees = (line: string) => {
    const stopped = Number(/实际离地 ([\d.]+)″/.exec(line)?.[1]);
    const sheetTop = /只允许 [^–]+–(\d+)(?:-(\d+)\/(\d+))?″/.exec(line);
    const sliderTop = /最高调到 ([\d.]+)″/.exec(line);
    if (sheetTop) return Math.floor(Number(sheetTop[1]) + (sheetTop[2] ? Number(sheetTop[2]) / Number(sheetTop[3]) : 0)) === stopped;
    if (sliderTop) return Number(sliderTop[1]) === stopped;
    return line.startsWith("microwave-reach: ");
  };

  describe.each(TOWERS)("%s, %s", (pkg, shape, slot) => {
    it.each(OVENS)("%s, asked 5\" to 21\": within its sheet, held when short of what was asked, and said as it is", (oven) => {
      open(pkg, shape);
      store().selectAppliance(slot as SlotId, oven);
      const seen: string[] = [];
      for (let askedIn = 5; askedIn <= 21; askedIn += 1) {
        store().setLayout(keeps(pkg, shape, askedIn) as never);
        expect(store().layoutIssues).toEqual([]);
        const built = sillOf(slot);
        const [low, high] = SHEET[oven];
        const held = built !== askedIn;
        const lines = heldLines(slot);
        seen.push(
          [
            askedIn,
            built >= low && built <= high ? "within" : `PAST ${built}`,
            tower(pkg, slot).held === held ? "" : "held wrong",
            JSON.stringify(lines) === JSON.stringify(said(oven, askedIn)) ? "" : `said ${JSON.stringify(lines)}`,
            lines.every(agrees) ? "" : "stop and range disagree",
          ].join(":"),
        );
      }
      expect(seen).toEqual(Array.from({ length: 17 }, (_, i) => `${i + 5}:within:::`));
    });

    it.each(OVENS)("%s in a link at the top of what it keeps: opened held to its sheet, and said", (oven) => {
      open(pkg, shape);
      store().selectAppliance(slot as SlotId, oven);
      store().setLayout(keeps(pkg, shape, 21) as never);
      const query = new URLSearchParams(writeLink(kitchenNow()));
      resetRoom();
      useAppStore.setState(OPENED, true);
      openSharedLink(`?${query.toString()}`);
      expect(store().selection[slot as SlotId]).toBe(oven);
      const built = sillOf(slot);
      const [low, high] = SHEET[oven];
      expect(built >= low && built <= high).toBe(true);
      expect(tower(pkg, slot).held).toBe(true);
      expect(heldLines(slot)).toEqual(said(oven, 21));
    });
  });

  it("the slider's sentence in English too, its top read from the slider", () => {
    open("package-b", "L");
    store().setLayout({ microwaveHandleIn: 60 });
    store().selectAppliance("slot-microwave", ME301YP);
    const selection = Object.fromEntries(
      Object.entries(store().selection).map(([s, id]) => [s, APPLIANCE_BY_ID[id as string]]),
    ) as Record<SlotId, Appliance>;
    const line = checklistFor(selection, null).findings.find((f) => f.slot === "slot-microwave" && f.ruleId === "oven-sill-held")!;
    expect(sayWith((k, v) => translate("en", k, v), line.messageKey ?? "", line.params)).toBe(
      "The oven opening starts 18″ off the floor, not the 21″ asked for: it goes no higher than 18″ here",
    );
    expect(line.params).toEqual({ sillIn: "18", askedIn: "21", maxIn: String(towerOven.STEAM_SILL_LIMITS.max) });
    // No 18 of its own in the words: the top is the slider's, a placeholder in both languages.
    for (const words of [zh["rule.ovenSillHeldBySlider"], en["rule.ovenSillHeldBySlider"]]) {
      expect(words).toContain("{maxIn}″");
      expect(words).not.toMatch(/\d/);
    }
  });
});
