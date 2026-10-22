import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "../data/catalogue";
import { recordHoodModel } from "../data/hoodMount";
import { DEFAULT_PACKAGE, PACKAGE, PACKAGE_BY_ID, packageInShape, shapeNoteKey, slotsKeptPerShape } from "../data/packages";
import { billLabelKey } from "../data/machineLabel";
import { DEFAULT_PARAMS, feasibleRange, wallRequirement } from "../data/layoutTemplate";
import { LAYOUT_PARAMS, RUNS } from "../data/room";
import { resetRoom } from "../data/testRoom";
import { kitchenNow, openSharedLink } from "./openLink";
import { writeLink } from "./shareLink";
import { useAppStore } from "./useAppStore";
import { sayWith, translate } from "../i18n";

/**
 * The shape switch, as the store does it. Round 98b, Leo:
 * - "五个套餐打开时都是 L 型";
 * - "一字型切回 L 型：恢复客户原来在 L 型里的选择";
 * - "切形状算 D18 的开关：墙不够自动加长 … 切回 L 型时墙回到切换前的长度，房间和
 *   切换前一模一样".
 *
 * No control calls it yet (98b-2 adds the switch); a share link does, and
 * these cases are that path and the action itself.
 */

const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();

function freshPage() {
  recordHoodModel(APPLIANCE_BY_ID[DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState(OPENED, true);
}

/** Package D, with the customer's own choices made in the L before the switch. */
function dWithChoices() {
  freshPage();
  store().setPackageId("package-d");
  // Not the package's defaults, so putting them back is not the same as
  // starting again: another dishwasher, and the refrigeration's door
  // clearance against a return wall, which grows the back wall.
  store().selectAppliance("slot-dishwasher", "bosch-shv78cm3n");
  store().setLayout({ fridgeEndAbuts: "wall" });
}

describe("switching the shape (round 98b)", () => {
  it("opens every package as an L", () => {
    freshPage();
    const shapes = ["package-a", "package-b", "package-c", "package-d", "package-e"].map((id) => {
      store().setPackageId(id);
      return store().layoutParams.shape;
    });
    expect(shapes).toEqual(["L", "L", "L", "L", "L"]);
  });

  it("grows the back wall to what the package needs on one wall, and says by how much", () => {
    dWithChoices();
    const before = store().layoutParams.backWallIn;
    const result = store().setLayoutShape("one-wall");
    expect({ ok: result.ok, grown: result.grown }).toEqual({ ok: true, grown: { fromIn: before, toIn: 249.25 } });
  });

  it("carries a model the customer chose across where it still fits", () => {
    dWithChoices();
    store().setLayoutShape("one-wall");
    expect(store().selection["slot-dishwasher"]).toBe("bosch-shv78cm3n");
  });

  it("opens D's one-wall openings with the one-wall models", () => {
    dWithChoices();
    store().setLayoutShape("one-wall");
    const { selection } = store();
    expect([selection["slot-freezer"], selection["slot-fridge"], selection["slot-wine"], selection["slot-oven"]]).toEqual([
      "thermador-t18if900sp",
      "thermador-t24ir905sp",
      "thermador-t18iw905sp",
      "thermador-mem301ws",
    ]);
  });

  it("puts the customer's L back exactly on the way back: the room and every choice", () => {
    dWithChoices();
    const before = { params: store().layoutParams, selection: store().selection, blower: store().blowerId };
    store().setLayoutShape("one-wall");
    store().setLayoutShape("L");
    expect({ params: store().layoutParams, selection: store().selection, blower: store().blowerId }).toEqual(before);
  });

  it("builds the L's package again on the way back, not the one-wall one", () => {
    dWithChoices();
    store().setLayoutShape("one-wall");
    store().setLayoutShape("L");
    expect(PACKAGE.slots.map((slot) => slot.slotId)).toContain("slot-coffee");
  });

  it("forgets the L when the package changes on one wall: the L kept is the package left's", () => {
    dWithChoices();
    store().setLayoutShape("one-wall");
    store().setPackageId("package-e");
    expect({ shape: LAYOUT_PARAMS.shape, kept: store().lRoom }).toEqual({ shape: "one-wall", kept: null });
  });
});

describe("which model each opening keeps between the shapes (round 98b-2)", () => {
  // Leo: "开口不同的位置各记各的；开口一样的位置共用一个选择，在哪个形状里换都算数".

  it("keeps a dishwasher changed on one wall when the room goes back to the L", () => {
    dWithChoices();
    store().setLayoutShape("one-wall");
    store().selectAppliance("slot-dishwasher", "bosch-shx78cm5n");
    store().setLayoutShape("L");
    expect(store().selection["slot-dishwasher"]).toBe("bosch-shx78cm5n");
  });

  it("leaves the L's own hood in the L when the hood was changed on one wall", () => {
    freshPage();
    store().setPackageId("package-e");
    store().setLayoutShape("one-wall");
    store().selectAppliance("slot-hood", "thermador-vcin36gws");
    store().setLayoutShape("L");
    expect(store().selection["slot-hood"]).toBe("thermador-hmib42ws");
  });

  it("opens one wall with its own wine column after the L's was changed, and gives the L's back on the way back", () => {
    // T18IW100SP fits both D's 24" wine opening and one wall's 18", so a rule
    // that carried what fits would take it onto one wall; Leo's keeps it in
    // the L, where it was chosen.
    freshPage();
    store().setPackageId("package-d");
    store().selectAppliance("slot-wine", "thermador-t18iw100sp");
    const inTheL = store().selection["slot-wine"];
    store().setLayoutShape("one-wall");
    const onOneWall = store().selection["slot-wine"];
    store().setLayoutShape("L");
    expect({ inTheL, onOneWall, back: store().selection["slot-wine"] }).toEqual({
      inTheL: "thermador-t18iw100sp",
      onOneWall: "thermador-t18iw905sp",
      back: "thermador-t18iw100sp",
    });
  });

  it("remembers the model chosen on one wall for an opening one wall has its own of", () => {
    freshPage();
    store().setPackageId("package-e");
    store().setLayoutShape("one-wall");
    store().selectAppliance("slot-hood", "thermador-vcin36gws");
    store().setLayoutShape("L");
    store().setLayoutShape("one-wall");
    expect(store().selection["slot-hood"]).toBe("thermador-vcin36gws");
  });

  it("shares E's cooktop: the same 36-inch drop-in opening on the wall as in the island", () => {
    expect(slotsKeptPerShape(PACKAGE_BY_ID["package-e"], "one-wall")).toEqual(["slot-hood"]);
  });

  it("keeps D's three narrower columns, its oven and the three one wall leaves out apart", () => {
    expect([...slotsKeptPerShape(PACKAGE_BY_ID["package-d"], "one-wall")].sort()).toEqual(
      ["slot-coffee", "slot-dishwasher-2", "slot-freezer", "slot-fridge", "slot-microwave", "slot-oven", "slot-wine"],
    );
  });
});

describe("what the switch says, and what Undo puts back (round 98b-2)", () => {
  it("says the room grew, as a package switch does, with an Undo that goes back to the L", () => {
    dWithChoices();
    const before = { shape: store().layoutParams.shape, params: store().layoutParams, selection: store().selection };
    store().setLayoutShape("one-wall");
    const toast = store().toast;
    store().undo();
    expect({
      key: toast?.key,
      label: toast?.undoLabel,
      back: { shape: store().layoutParams.shape, params: store().layoutParams, selection: store().selection },
      kept: store().lRoom,
    }).toEqual({
      key: "toast.shapeGrew",
      label: { key: "toast.undo.shape" },
      back: before,
      kept: null,
    });
  });

  it("names the package a package switch's Undo goes back to", () => {
    freshPage();
    store().setPackageId("package-b");
    expect(store().toast?.undoLabel).toEqual({ key: "toast.undo.package", vars: { package: "Package A" } });
  });

  it("names a switch in the Layout tab's Undo as going back to the room before it", () => {
    // Package A at its shortest back wall, then a lazy susan, which takes 12"
    // more of it: the room grows, says so and offers Undo.
    freshPage();
    store().setLayout({ backWallIn: feasibleRange(store().layoutParams, "backWallIn")!.minIn });
    store().setLayout({ cornerType: "lazy-susan" });
    expect({ key: store().toast?.key, label: store().toast?.undoLabel }).toEqual({
      key: "toast.wallGrew",
      label: { key: "toast.undo.layout" },
    });
  });

  // What each Undo button says, in both languages: where it goes back to
  // (Leo's words, round 98b-2, locked in reviewed.json).
  const button = (lang: "en" | "zh") => {
    const label = store().toast?.undoLabel;
    return label ? sayWith((key, vars) => translate(lang, key, vars), label.key, label.vars) : null;
  };

  it("says 'Back to' the package a package switch came from, in English", () => {
    freshPage();
    store().setPackageId("package-b");
    expect(button("en")).toBe("Back to Package A");
  });

  it("says 退回 the package a package switch came from, in Chinese", () => {
    freshPage();
    store().setLang("zh");
    store().setPackageId("package-b");
    expect(button("zh")).toBe("退回 套餐 A");
  });

  it("says 'Back to L' / 退回 L 型 when one wall grew the wall", () => {
    dWithChoices();
    store().setLayoutShape("one-wall");
    expect([button("en"), button("zh")]).toEqual(["Back to L", "退回 L 型"]);
  });

  it("says 'Undo this change' / 撤销这次改动 when a switch in the Layout tab grew the wall", () => {
    freshPage();
    store().setLayout({ backWallIn: feasibleRange(store().layoutParams, "backWallIn")!.minIn });
    store().setLayout({ cornerType: "lazy-susan" });
    expect([button("en"), button("zh")]).toEqual(["Undo this change", "撤销这次改动"]);
  });

  it("says one wall grew only its back wall, in its own words", () => {
    dWithChoices();
    store().setLayoutShape("one-wall");
    const toast = store().toast!;
    expect(sayWith((key, vars) => translate("zh", key, vars), toast.key, toast.vars)).toBe("一字型厨房需要更长的墙，已把后墙加到 249.3″。");
  });

  it("says D's and E's one-wall lines, and none for A, B and C", () => {
    expect(["A", "B", "C", "D", "E"].map((code) => shapeNoteKey(PACKAGE_BY_ID[`package-${code.toLowerCase()}`], "one-wall"))).toEqual([
      null,
      null,
      null,
      "shape.note.one-wall.D",
      "shape.note.one-wall.E",
    ]);
  });

  it("calls D's one-wall oven a combination oven tower on the wall's bill, and the L's still a steam oven tower", () => {
    const label = (shape: "L" | "one-wall") => {
      const shaped = packageInShape(PACKAGE_BY_ID["package-d"], shape);
      const standing = Object.fromEntries(shaped.slots.map((slot) => [slot.slotId, APPLIANCE_BY_ID[shaped.defaultSelection[slot.slotId]!]]));
      const tower = wallRequirement({ ...DEFAULT_PARAMS, ...PACKAGE_BY_ID["package-d"].defaultLayout, shape, backWallIn: shape === "L" ? 224.25 : 276 }, "back", PACKAGE_BY_ID["package-d"]).items.find(
        (item) => item.slot === "slot-oven",
      );
      return tower && billLabelKey(tower, standing);
    };
    expect({ oneWall: label("one-wall"), l: label("L") }).toEqual({ oneWall: "requirement.comboOven", l: "requirement.oven" });
  });
});

describe("a link to a one-wall kitchen (round 98b)", () => {
  /** E on one wall, written as a link, and the room it stands as. */
  function written() {
    freshPage();
    store().setPackageId("package-e");
    store().setLayoutShape("one-wall");
    const link = writeLink(kitchenNow());
    const room = JSON.stringify({ params: LAYOUT_PARAMS, runs: RUNS, selection: store().selection });
    return { link, room };
  }

  it("carries the shape", () => {
    expect(new URLSearchParams(written().link).get("shape")).toBe("one-wall");
  });

  it("opens on a fresh page as the room it was written from, saying nothing", () => {
    const { link, room } = written();
    freshPage();
    openSharedLink(`?${link}`);
    const opened = JSON.stringify({ params: LAYOUT_PARAMS, runs: RUNS, selection: store().selection });
    expect({ same: opened === room, toast: store().toast }).toEqual({ same: true, toast: null });
  });
});
