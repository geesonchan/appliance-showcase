import { afterAll, describe, expect, it } from "vitest";
import packagesFile from "../../data/packages.json";
import { APPLIANCES, APPLIANCE_BY_ID, looksOf } from "../data/catalogue";
import { recordHoodModel } from "../data/hoodMount";
import { DEFAULT_PACKAGE } from "../data/packages";
import { buildQuote } from "../data/quote";
import { roughInFor } from "../data/roughIn";
import { SLOTS } from "../data/slots";
import { resetRoom } from "../data/testRoom";
import { checklistFor } from "../data/useChecklist";
import { translate } from "../i18n";
import reviewed from "../i18n/reviewed.json";
import type { SlotId } from "../types";
import { kitchenNow, openSharedLink } from "./openLink";
import { writeLink } from "./shareLink";
import { useAppStore } from "./useAppStore";
import { selectionOf } from "./useSelection";

/**
 * Stainless or panel-ready (Leo, 2026-10-28). A built-in column leaves the
 * factory panel-ready and is made stainless with panels bought for it —
 * "原型号 = 可装门板", "原型号 + -SS = 不锈钢外观" — every package opening on
 * the stainless one (his answers 2, 3 and 5).
 *
 * His answers of 2026-10-29: T36BT120NS and T36IT100NP, two real models, are
 * one built-in refrigerator two ways, each named in the other's `pairModel`
 * (2); a panel-ready dishwasher gets the cabinet maker's line too (4); the
 * switch says 「不锈钢 / 可装门板」, and a slot's door panels are said once, in
 * that line (5).
 *
 * And 2026-11-02: a column is two rows of the sheet as well, its own number
 * panel-ready and the number with -SS stainless, a pair like the
 * refrigerators. The switch goes between the two rows; nothing adds -SS.
 */

const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();
const WINE = "thermador-t24iw905sp";
const WINE_SS = `${WINE}-ss`;
const COLUMNS = ["T18IF900SP", "T18IW905SP", "T24IF905SP", "T24IR905SP", "T24IW905SP", "T30IR905SP", "T18IW100SP"];

function packagePage(id: string) {
  recordHoodModel(APPLIANCE_BY_ID[DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState(OPENED, true);
  store().setPackageId(id);
}

afterAll(() => {
  resetRoom();
  useAppStore.setState(OPENED, true);
});

describe("a column, two rows of the sheet (Leo, 2026-11-02)", () => {
  it("is its -SS row stainless and its own number panel-ready, each the other's look, each at its own price", () => {
    const steel = APPLIANCE_BY_ID[WINE_SS];
    const panel = APPLIANCE_BY_ID[WINE];
    const looks = { stainless: WINE_SS, panelReady: WINE };
    expect({
      steel: [steel?.model, steel?.finish, steel?.msrpUSD],
      panel: [panel.model, panel.finish, panel.msrpUSD],
      fromSteel: steel && looksOf(steel),
      fromPanel: looksOf(panel),
    }).toEqual({
      steel: ["T24IW905SP-SS", ["stainless"], 7599],
      panel: ["T24IW905SP", ["panel-ready"], 7599],
      fromSteel: looks,
      fromPanel: looks,
    });
  });

  it("pairs every one of the seven so, and keeps a row for each in the catalogue, none of it made up", () => {
    const pairs = COLUMNS.map((model) => {
      const panel = APPLIANCES.find((row) => row.model === model)!;
      return [model, looksOf(panel)];
    });
    expect({
      pairs,
      rows: APPLIANCES.length,
      keys: Object.keys(APPLIANCE_BY_ID).length,
    }).toEqual({
      pairs: COLUMNS.map((model) => {
        const id = `thermador-${model.toLowerCase()}`;
        return [model, { stainless: `${id}-ss`, panelReady: id }];
      }),
      rows: 44,
      keys: 44,
    });
  });

  it("leaves a row offered one way as it was", () => {
    // C's flush refrigerator: stainless, and nobody's pair.
    const fridge = APPLIANCE_BY_ID["thermador-t36ft820ns"];
    expect([fridge.model, fridge.finish, looksOf(fridge)]).toEqual(["T36FT820NS", ["stainless"], null]);
  });

  it("makes the two refrigerators that name each other one machine's two looks, each its own model at its own price", () => {
    const steel = APPLIANCE_BY_ID["thermador-t36bt120ns"];
    const panel = APPLIANCE_BY_ID["thermador-t36it100np"];
    const looks = { stainless: "thermador-t36bt120ns", panelReady: "thermador-t36it100np" };
    expect({
      fromSteel: looksOf(steel),
      fromPanel: looksOf(panel),
      written: [steel.model, panel.model],
      priced: [steel.msrpUSD, panel.msrpUSD],
    }).toEqual({
      fromSteel: looks,
      fromPanel: looks,
      written: ["T36BT120NS", "T36IT100NP"],
      priced: [13199, 11599],
    });
  });

  it("opens every package and shape on the -SS row: no package names a column's own number", () => {
    const named = JSON.stringify(packagesFile).match(/"thermador-t(18if900sp|18iw905sp|24if905sp|24ir905sp|24iw905sp|30ir905sp|18iw100sp)(-ss)?"/g) ?? [];
    expect({ bare: named.filter((id) => !id.endsWith('-ss"')), stainless: named.length }).toEqual({ bare: [], stainless: 9 });
  });

  it("gives T18IW100SP-SS its pair's rough-in points and the drawing's figures, one machine", () => {
    const steel = APPLIANCE_BY_ID["thermador-t18iw100sp-ss"];
    const panel = APPLIANCE_BY_ID["thermador-t18iw100sp"];
    expect({
      points: roughInFor(steel) !== null && roughInFor(steel) === roughInFor(panel),
      figures: [steel?.widthIn, steel?.heightIn, steel?.depthIn],
    }).toEqual({ points: true, figures: [17.75, 83.875, 24] });
  });
});

describe("the look chosen, in the room", () => {
  it("opens every package stainless, and its link writes the column -SS", () => {
    packagePage("package-d");
    const query = new URLSearchParams(writeLink(kitchenNow()));
    expect({ held: store().selection["slot-wine"], wine: query.get("wine"), v: query.get("v") }).toEqual({
      held: WINE_SS,
      wine: "T24IW905SP-SS",
      v: "3",
    });
  });

  it("holds the panel-ready row when it is picked, and writes the column's own number", () => {
    packagePage("package-d");
    store().selectAppliance("slot-wine", WINE);
    const query = new URLSearchParams(writeLink(kitchenNow()));
    expect({ held: store().selection["slot-wine"], wine: query.get("wine") }).toEqual({ held: WINE, wine: "T24IW905SP" });
  });

  it("opens a v=3 link's bare number panel-ready and its -SS stainless", () => {
    packagePage("package-d");
    store().selectAppliance("slot-wine", WINE);
    const panelLink = `?${writeLink(kitchenNow())}`;
    packagePage("package-d");
    openSharedLink(panelLink);
    const panel = store().selection["slot-wine"];
    openSharedLink(panelLink.replace("wine=T24IW905SP&", "wine=T24IW905SP-SS&"));
    expect({ panel, stainless: store().selection["slot-wine"], notice: store().toast?.notice ?? null }).toEqual({
      panel: WINE,
      stainless: WINE_SS,
      notice: null,
    });
  });

  it("opens a v=1 or v=2 link's bare number on the -SS row, which is what it was when it was written, and says nothing", () => {
    packagePage("package-d");
    store().selectAppliance("slot-wine", WINE);
    const panelLink = `?${writeLink(kitchenNow())}`;
    const opened = ["1", "2"].map((v) => {
      packagePage("package-d");
      store().selectAppliance("slot-wine", WINE);
      openSharedLink(panelLink.replace("v=3", `v=${v}`));
      return [v, store().selection["slot-wine"], store().toast?.notice ?? null];
    });
    expect(opened).toEqual([
      ["1", WINE_SS, null],
      ["2", WINE_SS, null],
    ]);
  });
});

describe("the refrigerator pair, in a link", () => {
  it("opens each of the two as itself in a link of any version, and writes each as itself", () => {
    // A opens on T36BT120NS; the switch takes it to T36IT100NP.
    packagePage("package-a");
    store().selectAppliance("slot-fridge", "thermador-t36it100np");
    const panelLink = `?${writeLink(kitchenNow())}`;
    const written = new URLSearchParams(panelLink).get("fridge");
    const opened = (["1", "2", "3"] as const).flatMap((v) =>
      ["T36IT100NP", "T36BT120NS"].map((model) => {
        packagePage("package-a");
        openSharedLink(panelLink.replace("v=3", `v=${v}`).replace("fridge=T36IT100NP", `fridge=${model}`));
        return `v${v} ${model} → ${store().selection["slot-fridge"]}`;
      }),
    );
    expect({ written, opened }).toEqual({
      written: "T36IT100NP",
      opened: [
        "v1 T36IT100NP → thermador-t36it100np",
        "v1 T36BT120NS → thermador-t36bt120ns",
        "v2 T36IT100NP → thermador-t36it100np",
        "v2 T36BT120NS → thermador-t36bt120ns",
        "v3 T36IT100NP → thermador-t36it100np",
        "v3 T36BT120NS → thermador-t36bt120ns",
      ],
    });
  });
});

describe("the list and the quote, by the look chosen", () => {
  const lines = (id: string) => checklistFor(selectionOf(store().selection), null).findings.filter((f) => f.ruleId === id);

  it("says the cabinet maker makes the doors for a column, built-in refrigerator or dishwasher chosen panel-ready (Leo, 2026-10-28, 6; 2026-10-29, 4)", () => {
    const panelLines = () =>
      checklistFor(selectionOf(store().selection), null)
        .findings.filter((f) => f.ruleId.startsWith("panels-by-cabinet-maker"))
        .map((f) => f.slot);
    packagePage("package-d");
    const opened = lines("panels-by-cabinet-maker:slot-wine").length;
    store().selectAppliance("slot-wine", WINE);
    const chosen = lines("panels-by-cabinet-maker:slot-wine").map((f) => f.messageKey);
    // A opens on SHV78CM3N, panel-ready, beside a stainless refrigerator; B
    // on SHX78CM5N, stainless, which says nothing.
    packagePage("package-a");
    const a = panelLines();
    store().selectAppliance("slot-fridge", "thermador-t36it100np");
    const aFridge = panelLines();
    packagePage("package-b");
    const b = panelLines();
    expect({ opened, chosen, a, aFridge, b }).toEqual({
      opened: 0,
      chosen: ["rule.panelsByCabinetMaker"],
      a: ["slot-dishwasher"],
      aFridge: ["slot-fridge", "slot-dishwasher"],
      b: [],
    });
  });

  it("says a slot's door panels once: where the cabinet maker's line is, the old panel-ready line is not (Leo, 2026-10-29, 5)", () => {
    const panelSlots = () =>
      checklistFor(selectionOf(store().selection), null)
        .findings.filter((f) => f.messageKey === "rule.panelReady" || f.messageKey === "rule.panelsByCabinetMaker")
        .map((f) => [f.slot, f.messageKey]);
    packagePage("package-d");
    store().selectAppliance("slot-wine", WINE);
    const d = panelSlots();
    packagePage("package-a");
    store().selectAppliance("slot-fridge", "thermador-t36it100np");
    expect({ d, a: panelSlots() }).toEqual({
      d: [["slot-wine", "rule.panelsByCabinetMaker"]],
      a: [
        ["slot-fridge", "rule.panelsByCabinetMaker"],
        ["slot-dishwasher", "rule.panelsByCabinetMaker"],
      ],
    });
  });

  it("writes the switch in his words, locked (Leo, 2026-10-29, 5)", () => {
    const words = (["zh", "en"] as const).map((lang) => [translate(lang, "card.look.stainless"), translate(lang, "card.look.panelReady")]);
    const locked = (["zh", "en"] as const).map((lang) =>
      Object.keys(reviewed[lang]).filter((key) => key.startsWith("card.look.")).sort(),
    );
    expect({ words, locked }).toEqual({
      words: [
        ["不锈钢", "可装门板"],
        ["Stainless", "Panel-ready"],
      ],
      locked: [
        ["card.look.panelReady", "card.look.stainless"],
        ["card.look.panelReady", "card.look.stainless"],
      ],
    });
  });

  it("says it in his words in both languages", () => {
    expect([translate("zh", "rule.panelsByCabinetMaker"), translate("en", "rule.panelsByCabinetMaker")]).toEqual([
      "门板由柜子厂按柜门做，不含在本报价内。",
      "Door panels are made by your cabinet maker to match the cabinet doors and are not included in this quote.",
    ]);
  });

  it("keeps the 18\" column's stainless-panel line for its -SS row only", () => {
    // T18IW905SP, whose 17-3/4" x 79-7/8" door the two panels are for.
    packagePage("package-d");
    store().selectAppliance("slot-wine", "thermador-t18iw905sp-ss");
    const stainless = lines("column-door-panel").length;
    store().selectAppliance("slot-wine", "thermador-t18iw905sp");
    // The column is there and panel-ready, so the line goes for that and not
    // because the key found nothing.
    const held = APPLIANCE_BY_ID[store().selection["slot-wine"]!];
    expect({ stainless, panel: lines("column-door-panel").length, held: [held?.model, held?.finish] }).toEqual({
      stainless: 1,
      panel: 0,
      held: ["T18IW905SP", ["panel-ready"]],
    });
  });

  it("writes the quote's model as the sheet does, at the row's own price", () => {
    packagePage("package-d");
    const quoteOf = () =>
      buildQuote({
        packageId: "package-d",
        packageName: "D",
        slots: SLOTS.filter((slot) => (["slot-wine", "slot-hood"] as SlotId[]).includes(slot.id)),
        selection: selectionOf(store().selection),
        blower: null,
        hoodNeedsBlower: false,
        findings: [],
        t: (key, vars) => translate("en", key, vars),
      }).lines.find((line) => line.slot === "slot-wine")!;
    const stainless = quoteOf();
    store().selectAppliance("slot-wine", WINE);
    const panel = quoteOf();
    expect([
      [stainless.model, stainless.msrpUSD],
      [panel.model, panel.msrpUSD],
    ]).toEqual([
      ["T24IW905SP-SS", 7599],
      ["T24IW905SP", 7599],
    ]);
  });
});
