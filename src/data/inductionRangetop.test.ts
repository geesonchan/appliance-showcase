import { afterAll, describe, expect, it } from "vitest";
import { applianceBox, flushOffset } from "./applianceBox";
import { APPLIANCE_BY_ID, suitsPackageSlot } from "./catalogue";
import { candidatesFor } from "./candidates";
import { cabinetUnderCooking, cookingSurfaceKind } from "./cookingSurface";
import { counterOutline } from "./counter";
import { dimensionsFor } from "./dimensions";
import { setActivePackage, setLayoutParamsGrowing, setRangeModel } from "./layoutState";
import { oneWallWantedIn, type LayoutParams } from "./layoutTemplate";
import { slotLabelKey } from "./machineLabel";
import { PACKAGE, PACKAGE_BY_ID, slotsOf } from "./packages";
import { buildQuote, formatQuote } from "./quote";
import { REQUESTED_PARAMS, ROOM, RUNS } from "./room";
import { resolveRoughIn, roughInWords } from "./roughIn";
import { canopyClearance } from "./rules";
import { SLOT_BY_ID, SLOTS } from "./slots";
import { defaultSelectionOf, resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { deriveUtilities } from "./utilities";
import { sayWith, translate } from "../i18n";
import { kitchenNow, openSharedLink } from "../store/openLink";
import { writeLink } from "../store/shareLink";
import { useAppStore } from "../store/useAppStore";
import type { Appliance, Package, SlotId } from "../types";

/**
 * An induction cooktop in B's and D's rangetop choice (Leo, 2026-11-07 and
 * 2026-11-08; docs/plans/induction-plan.md).
 *
 * "记住cooktop和cabinet layout配置一起整体改动": the cabinet under it, the counter's
 * cutout, the machine's place and the utilities change together, never half
 * of them. PCG366W and CIT367YG both stand on a `B36` now, so the cabinet no
 * longer tells a swap from no swap, and the rest must still follow.
 *
 * Every figure is written out from its source, not read back from the code:
 * CIT367YG's cutout 34-3/4" x 19-7/8" and 3-3/4" hole (its guide, and E on one
 * wall), PCG366W's 35-1/8" x 22-13/16" and 7-11/16" hole (its sheet).
 */

afterAll(() => {
  resetRoom();
  useAppStore.setState(OPENED, true);
});

const OPENED = useAppStore.getState();
const CIT367YG = APPLIANCE_BY_ID["thermador-cit367yg"];
const PCG366W = APPLIANCE_BY_ID["thermador-pcg366w"];
const HIS8055U = APPLIANCE_BY_ID["bosch-his8055u"];
const inches = (feet: number) => feet * 12;

type Point = readonly [number, number];
function inside(point: Point, polygon: readonly Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > point[1] !== zj > point[1] && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function theL(entry: Package) {
  resetRoom();
  expect(setActivePackage(entry.id).ok).toBe(true);
}

function oneWall(entry: Package) {
  theL(entry);
  const asked: LayoutParams = { ...REQUESTED_PARAMS, shape: "one-wall" };
  asked.backWallIn = Math.max(asked.backWallIn, oneWallWantedIn(asked, entry));
  expect(setLayoutParamsGrowing(asked).ok).toBe(true);
}

/** The whole of what has to change together, read from the room standing. */
function standing(machine: Appliance) {
  const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
  const segment = run.segments.find((s) => s.slot === "slot-range")!;
  const mid = (segment.from + segment.to) / 2;
  const centre: Point = run.axis === "x" ? [mid, run.centre] : [run.centre, mid];
  const { pieces } = counterOutline(RUNS, machine);
  const hole = pieces.flatMap((piece) => piece.holes).find((h) => inside(centre, h as unknown as Point[]))!;
  const along = hole.map((p) => p[run.axis === "x" ? 0 : 1]);
  const across = hole.map((p) => p[run.axis === "x" ? 1 : 0]);
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  const slot = SLOT_BY_ID["slot-range"];
  const box = applianceBox(slot, machine);
  const utilities = deriveUtilities(slot, machine);
  return {
    under: segment.modules.map((m) => `${m.code} ${m.kind}`),
    holeWidthIn: round(inches(Math.max(...along) - Math.min(...along))),
    holeDepthIn: round(inches(Math.max(...across) - Math.min(...across))),
    holeOffCentreToRoomIn: round(inches(((Math.max(...across) + Math.min(...across)) / 2 - run.centre) * run.facing.sign)),
    machineFloorIn: round(inches(box.y)),
    machineForwardIn: round(inches(flushOffset(slot, box.d, box.rearSpacerIn, machine))),
    points: resolveRoughIn("slot-range", machine).map((r) => r.point.type),
    gas: utilities.gas?.pipeSize ?? null,
    power: `${utilities.power.voltage}V ${utilities.power.amps}A`,
  };
}

const CIT_STANDS = {
  under: ["B36 base"],
  holeWidthIn: 34.75,
  holeDepthIn: 19.875,
  holeOffCentreToRoomIn: 0,
  machineFloorIn: 36 - 3.75,
  machineForwardIn: 0,
  points: ["power"],
  gas: null,
  power: "240V 50A",
};

const PCG_STANDS = (forwardIn: number, offIn: number) => ({
  under: ["B36 base"],
  holeWidthIn: 35.125,
  holeDepthIn: 22.8125,
  holeOffCentreToRoomIn: offIn,
  machineFloorIn: 36 - 7.6875,
  machineForwardIn: forwardIn,
  points: ["gas", "power"],
  gas: '3/4"',
  power: "120V 15A",
});

/** PCG366W's own figures, as the room has them before anything was swapped. */
function pcgNow() {
  const was = standing(PCG366W);
  return PCG_STANDS(was.machineForwardIn, was.holeOffCentreToRoomIn);
}

const SHAPES: [string, (entry: Package) => void][] = [
  ["L", theL],
  ["one wall", oneWall],
];
const B_AND_D = ["package-b", "package-d"] as const;

describe("one rule for what stands under a cooking surface", () => {
  const kind = (appliance: Appliance) => cookingSurfaceKind(appliance);
  it("is a swing-door base as wide as the opening under anything set into the stone", () => {
    expect(cabinetUnderCooking(36, PCG366W)).toEqual({ code: "B36", kind: "base" });
    expect(cabinetUnderCooking(36, CIT367YG)).toEqual({ code: "B36", kind: "base" });
    expect(cabinetUnderCooking(30, CIT367YG)).toEqual({ code: "B30", kind: "base" });
  });
  it("is nothing under a slide-in, a freestanding range, or no machine", () => {
    expect(cabinetUnderCooking(36, HIS8055U)).toBeNull();
    expect(cabinetUnderCooking(36, APPLIANCE_BY_ID["thermador-prg366wh"])).toBeNull();
    expect(cabinetUnderCooking(36, undefined)).toBeNull();
  });
  it("tells the three kinds apart, which is what a swap rebuilds on", () => {
    expect([kind(PCG366W), kind(CIT367YG), kind(HIS8055U)]).toEqual(["rangetop", "cooktop", "floor"]);
    expect(cookingSurfaceKind(undefined)).toBe("floor");
  });
});

describe("what the list offers, measured by the cabinet's opening", () => {
  it.each(B_AND_D)("offers CIT367YG in %s, L and one wall, and says it goes in", (id) => {
    for (const [, shape] of SHAPES) {
      shape(PACKAGE_BY_ID[id]);
      const offered = candidatesFor("slot-range", PACKAGE).find((c) => c.appliance.model === "CIT367YG");
      expect(offered, "not in the list").toBeDefined();
      // Its catalogue width is the glass's, 37", an inch wider than the 36"
      // cabinet. The cutout is what goes in the opening: 34-3/4". A check
      // moved to the glass makes this red.
      expect(CIT367YG.widthIn).toBe(37);
      expect(offered!.fit.fits).toBe(true);
      expect(offered!.fit.widthFits).toBe(true);
      expect(offered!.fit.widthOverIn).toBeCloseTo(34.75 - 36, 6);
      expect(offered!.fit.fillerEachSideIn).toBeNull();
      expect(offered!.fit.depthOverIn).toBeNull();
    }
  });
  it("offers it nowhere else: not in A, whose opening is a freestanding range's, nor C's 30 inches", () => {
    for (const id of ["package-a", "package-c"]) {
      for (const [, shape] of SHAPES) {
        shape(PACKAGE_BY_ID[id]);
        expect(candidatesFor("slot-range", PACKAGE).map((c) => c.appliance.model), id).not.toContain("CIT367YG");
      }
    }
  });
  it("is carried across a package switch from B to D and not to A", () => {
    const take = (id: string) =>
      suitsPackageSlot(CIT367YG, slotsOf(PACKAGE_BY_ID[id])["slot-range"], PACKAGE_BY_ID[id]);
    expect(B_AND_D.map(take)).toEqual([true, true]);
    expect(["package-a", "package-c"].map(take)).toEqual([false, false]);
  });
});

describe.each(B_AND_D)("%s: never half of it", (id) => {
  describe.each(SHAPES)("%s", (_name, shape) => {
    it("changes the cabinet, the cutout, the machine's place and the utilities together, there and back", () => {
      shape(PACKAGE_BY_ID[id]);
      const pcg = pcgNow();
      expect(standing(PCG366W)).toEqual(pcg);

      const there = setRangeModel(CIT367YG, id);
      expect(there.ok).toBe(true);
      // The room is generated again though the cabinet is the same one: the
      // scene is rebuilt on this, and a cutout left behind is the half state.
      expect(there.rebuilt).toBe(true);
      expect(standing(CIT367YG)).toEqual(CIT_STANDS);

      const back = setRangeModel(PCG366W, id);
      expect(back.ok).toBe(true);
      expect(back.rebuilt).toBe(true);
      expect(standing(PCG366W)).toEqual(pcg);
    });

    it("leaves no gas anywhere on the checklist or the quote, in either language", () => {
      shape(PACKAGE_BY_ID[id]);
      setRangeModel(CIT367YG, id);
      const selection = { ...defaultSelectionOf(id), "slot-range": CIT367YG } as Record<SlotId, Appliance>;
      const { findings } = checklistFor(selection, null);
      const onIt = findings;
      for (const lang of ["zh", "en"] as const) {
        const say = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
        const written = onIt.map((f) => sayWith(say, f.messageKey, f.params)).join("\n");
        expect(written, lang).not.toMatch(/燃气|煤气|\bgas\b/i);
      }
      const quote = buildQuote({
        packageId: id,
        packageName: id,
        slots: SLOTS,
        selection,
        blower: null,
        hoodNeedsBlower: false,
        findings,
        t: (key: string, vars?: Record<string, string | number>) => translate("en", key, vars),
      });
      const line = quote.lines.find((l) => l.slot === "slot-range")!;
      expect(line.utilities.gas).toBeNull();
      expect([line.utilities.power.voltage, line.utilities.power.amps]).toEqual([240, 50]);
    });
  });
});

describe("a swap inside a kind still leaves the room where it stands", () => {
  it("does not rebuild for a floor-standing range of the same gap", () => {
    theL(PACKAGE_BY_ID["package-a"]);
    const a = setRangeModel(APPLIANCE_BY_ID["thermador-prg366wh"], "package-a");
    expect(a.rebuilt).toBe(false);
  });
});

describe("reopened from a share link", () => {
  const store = () => useAppStore.getState();
  const roomNow = () => JSON.parse(JSON.stringify({ runs: RUNS, built: standing(APPLIANCE_BY_ID[store().selection["slot-range"]]) }));
  const open = (id: string, shape: "L" | "one-wall", models: string[]) => {
    resetRoom();
    useAppStore.setState(OPENED, true);
    store().setPackageId(id);
    if (shape === "one-wall") expect(store().setLayoutShape("one-wall").ok).toBe(true);
    for (const model of models) store().selectAppliance("slot-range", model);
    return { link: writeLink(kitchenNow()), room: roomNow(), selection: { ...store().selection } };
  };

  describe.each(B_AND_D)("%s", (id) => {
    it.each([
      ["L", "to the cooktop", ["thermador-cit367yg"]],
      ["L", "and back", ["thermador-cit367yg", "thermador-pcg366w"]],
      ["one-wall", "to the cooktop", ["thermador-cit367yg"]],
      ["one-wall", "and back", ["thermador-cit367yg", "thermador-pcg366w"]],
    ] as const)("%s, %s, comes back the same, and with nothing to say about it", (shape, _how, models) => {
      const shared = open(id, shape, [...models]);
      resetRoom();
      useAppStore.setState(OPENED, true);
      openSharedLink(`?${shared.link}`);
      expect(store().selection["slot-range"]).toBe(models[models.length - 1]);
      expect(roomNow()).toEqual(shared.room);
      const said = store().toast as { lines?: { field: string }[] } | null;
      expect((said?.lines ?? []).filter((line) => line.field === "range")).toEqual([]);
    });
  });
});

describe("the hood over it", () => {
  const narrow = (hood: Appliance) => {
    theL(PACKAGE_BY_ID["package-b"]);
    setRangeModel(CIT367YG, "package-b");
    const selection = { ...defaultSelectionOf("package-b"), "slot-range": CIT367YG, "slot-hood": hood } as Record<SlotId, Appliance>;
    return checklistFor(selection, null).findings.filter((f) => f.ruleId === "hood-narrower-than-cooking");
  };
  it("stays B's own VCIN36GWS, with nothing to say about its width", () => {
    expect(PACKAGE_BY_ID["package-b"].defaultSelection["slot-hood"]).toBe("thermador-vcin36gws");
    expect(narrow(APPLIANCE_BY_ID["thermador-vcin36gws"])).toEqual([]);
  });
  it("is held to the 36-inch opening, not the 37-inch glass", () => {
    const lines = narrow(APPLIANCE_BY_ID["thermador-hmcb30ws"]);
    expect(lines.map((f) => [f.params.hood, f.params.cooking])).toEqual([["29-15/16", "36"]]);
  });
});

describe("the height it cooks at", () => {
  it("is the glass on the install view's chain, and the line over it says nothing of gas", () => {
    theL(PACKAGE_BY_ID["package-b"]);
    setRangeModel(CIT367YG, "package-b");
    const selection = { ...defaultSelectionOf("package-b"), "slot-range": CIT367YG } as Record<SlotId, Appliance>;
    const chain = dimensionsFor(selection);
    const hoodIn = inches(SLOT_BY_ID["slot-hood"].position[1]);
    expect(chain.find((d) => d.id === "floor-to-cooktop")!.valueIn).toBeCloseTo(36.25, 3);
    const over = chain.find((d) => d.id === "cooktop-to-canopy")!;
    expect(over.valueIn).toBeCloseTo(hoodIn - 36.25, 3);
    for (const lang of ["zh", "en"] as const) {
      expect(translate(lang, over.noteKey!, over.noteVars), lang).not.toMatch(/燃气|煤气|gas/i);
    }
    expect([translate("zh", over.noteKey!, over.noteVars), translate("en", over.noteKey!, over.noteVars)]).toEqual([
      "最小 30，最大 40",
      "min 30, max 40",
    ]);
  });

  it("is the glass, 1/4 inch proud of the stone, for how far the hood hangs over it", () => {
    theL(PACKAGE_BY_ID["package-b"]);
    setRangeModel(CIT367YG, "package-b");
    const hoodIn = inches(SLOT_BY_ID["slot-hood"].position[1]);
    expect(canopyClearance(CIT367YG)).toBeCloseTo(hoodIn - 36.25, 3);
    expect(canopyClearance(PCG366W)).toBeCloseTo(hoodIn - 36.4375, 3);
  });
});

describe("what it is called, and where its junction box is written", () => {
  const word = (key: string, lang: "zh" | "en") => translate(lang, key);
  it("is the naming table's for both machines", () => {
    expect((["zh", "en"] as const).map((l) => word(slotLabelKey("slot-range", CIT367YG), l))).toEqual(["Drop in 炉灶片", "Cooktop"]);
    expect((["zh", "en"] as const).map((l) => word(slotLabelKey("slot-range", HIS8055U), l))).toEqual(["炉头", "Range"]);
  });

  it("copies E's own words for the junction box, and E's do not change", () => {
    const say = (lang: "zh" | "en") => (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    const line = (slotId: SlotId, lang: "zh" | "en") => {
      const words = roughInWords(resolveRoughIn(slotId, CIT367YG)[0]);
      return `${say(lang)(words.whereKey)} · ${say(lang)(words.atKey, { x: words.x ?? "", y: words.y ?? "" })}`;
    };
    theL(PACKAGE_BY_ID["package-b"]);
    setRangeModel(CIT367YG, "package-b");
    expect(line("slot-range", "zh")).toBe('开口后壁 · 距顶 12"');
    expect(line("slot-range", "en")).toBe('rear wall of the opening · 12" below the top');
    theL(PACKAGE_BY_ID["package-e"]);
    expect(line("slot-cooktop", "zh")).toBe('开口后壁 · 距顶 12"');
    expect(line("slot-cooktop", "en")).toBe('rear wall of the opening · 12" below the top');
  });

  it("no longer says a drawer for PCG366W's gas", () => {
    theL(PACKAGE_BY_ID["package-b"]);
    const gas = resolveRoughIn("slot-range", PCG366W).find((r) => r.point.type === "gas")!;
    const where = roughInWords(gas).whereKey;
    expect([translate("zh", where), translate("en", where)]).toEqual([
      "灶下柜后壁",
      "back wall of the cabinet under the cooktop",
    ]);
  });
});

describe("the line about the cabinet, on the checklist and the quote", () => {
  const line = (id: string, slotId: SlotId, machine: Appliance) => {
    const selection = { ...defaultSelectionOf(id), [slotId]: machine } as Record<SlotId, Appliance>;
    const found = checklistFor(selection, null).findings.filter((f) => f.ruleId === "cabinet-under-cooking");
    return found.map((f) => {
      const zh = sayWith((k, v) => translate("zh", k, v), f.messageKey, f.params);
      const en = sayWith((k, v) => translate("en", k, v), f.messageKey, f.params);
      return { slot: f.slot, severity: f.severity, zh, en };
    });
  };
  const PAIR_ZH = "左右对开两扇平开门";
  it("says a pair of doors starting below the control panel, for a rangetop", () => {
    theL(PACKAGE_BY_ID["package-b"]);
    expect(line("package-b", "slot-range", PCG366W)).toEqual([
      {
        slot: "slot-range",
        severity: "info",
        zh: `灶下柜 B36：${PAIR_ZH}，门从控制面板下沿（柜子正面最上面 7-5/8" 以下）开始`,
        en: 'Cabinet under it: B36, a pair of swing doors opening left and right, starting below the control panel (the top 7-5/8" of the cabinet front)',
      },
    ]);
  });
  it("says a pair of doors for the induction cooktop, in B and on E", () => {
    const cooktop = {
      severity: "info",
      zh: `灶下柜 B36：${PAIR_ZH}`,
      en: "Cabinet under it: B36, a pair of swing doors opening left and right",
    };
    theL(PACKAGE_BY_ID["package-b"]);
    setRangeModel(CIT367YG, "package-b");
    expect(line("package-b", "slot-range", CIT367YG)).toEqual([{ slot: "slot-range", ...cooktop }]);
    theL(PACKAGE_BY_ID["package-e"]);
    expect(line("package-e", "slot-cooktop", CIT367YG)).toEqual([{ slot: "slot-cooktop", ...cooktop }]);
  });
  it("says nothing for a machine standing on the floor", () => {
    theL(PACKAGE_BY_ID["package-a"]);
    expect(line("package-a", "slot-range", APPLIANCE_BY_ID["thermador-prg366wh"])).toEqual([]);
    expect(line("package-a", "slot-range", HIS8055U)).toEqual([]);
  });
  it("is read by the quote's copied summary under the machine's own line", () => {
    theL(PACKAGE_BY_ID["package-b"]);
    setRangeModel(CIT367YG, "package-b");
    const selection = { ...defaultSelectionOf("package-b"), "slot-range": CIT367YG } as Record<SlotId, Appliance>;
    const t = (key: string, vars?: Record<string, string | number>) => translate("zh", key, vars);
    const { findings } = checklistFor(selection, null);
    const quote = buildQuote({ packageId: "package-b", packageName: "B", slots: SLOTS, selection, blower: null, hoodNeedsBlower: false, findings, t });
    const text = formatQuote(quote, t);
    expect(text).toContain("Drop in 炉灶片");
    expect(text).toContain("Thermador CIT367YG");
    expect(ROOM.counterHeight).toBe(3);
  });
});
