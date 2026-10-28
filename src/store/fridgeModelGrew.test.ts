import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "../data/catalogue";
import { recordHoodModel } from "../data/hoodMount";
import { DEFAULT_PACKAGE } from "../data/packages";
import { resetRoom } from "../data/testRoom";
import { sayWith, translate } from "../i18n";
import { useAppStore } from "./useAppStore";

/**
 * A refrigerator chosen on the model card that needs a longer wall gets it,
 * and the room says so with an Undo. Leo, 2026-10-24, 5 (D18), and
 * 2026-10-27, 6 (the words) and the plan's section 6, question 1 (one wall
 * too, rather than leaving the microwave drawer and the wine cooler out).
 */
const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();

function freshPage() {
  recordHoodModel(APPLIANCE_BY_ID[DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState(OPENED, true);
}

/** The toast's lines as a customer reads them. */
const said = (lang: "en" | "zh") =>
  (store().toast?.lines ?? []).map((line) => sayWith((key, vars) => translate(lang, key, vars), line.key, line.vars));

describe("choosing a refrigerator that needs more wall", () => {
  it("grows A's back wall in an L, says so in Leo's words, and Undo puts the wall and the model back", () => {
    freshPage();
    store().setPackageId("package-a");
    store().setLayout({ sinkLeg: "left", fridgeEnd: "back", cornerType: "blind", hasIsland: false });
    store().setLayout({ backWallIn: 124.5 });
    store().dismissToast();
    expect(store().layoutIssues).toEqual([]);

    store().selectAppliance("slot-fridge", "thermador-t36ft820ns");
    const grown = {
      issues: store().layoutIssues,
      wallIn: store().layoutParams.backWallIn,
      selected: store().selection["slot-fridge"],
      key: store().toast?.key,
      en: said("en"),
      zh: said("zh"),
    };
    store().undo();
    expect({
      grown,
      undone: { wallIn: store().layoutParams.backWallIn, selected: store().selection["slot-fridge"], toast: store().toast },
    }).toEqual({
      grown: {
        issues: [],
        wallIn: 129,
        selected: "thermador-t36ft820ns",
        key: "toast.modelGrew",
        en: ["The new model needs more room: Back wall is now 129″."],
        zh: ["换了型号，后墙不够长，已加长到 129″。"],
      },
      undone: { wallIn: 124.5, selected: "thermador-t36bt120ns", toast: null },
    });
  });

  it("grows A's one wall to 238-1/4\", and Undo puts back 236\"", () => {
    freshPage();
    store().setPackageId("package-a");
    store().setLayoutShape("one-wall");
    store().dismissToast();
    const before = store().layoutParams.backWallIn;

    store().selectAppliance("slot-fridge", "thermador-t36ft820ns");
    const grown = { wallIn: store().layoutParams.backWallIn, key: store().toast?.key, zh: said("zh") };
    store().undo();
    expect({ before, grown, undone: store().layoutParams.backWallIn }).toEqual({
      before: 236,
      grown: { wallIn: 238.25, key: "toast.modelGrew", zh: ["换了型号，后墙不够长，已加长到 238¼″。"] },
      undone: 236,
    });
  });

  it("says nothing when the wall already takes it", () => {
    freshPage();
    store().setPackageId("package-a");
    store().dismissToast();
    store().selectAppliance("slot-fridge", "thermador-t36ft820ns");
    expect({ wallIn: store().layoutParams.backWallIn, toast: store().toast }).toEqual({ wallIn: 168, toast: null });
  });
});
