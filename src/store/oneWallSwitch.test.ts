import { describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "../data/catalogue";
import { recordHoodModel } from "../data/hoodMount";
import { DEFAULT_PACKAGE, PACKAGE } from "../data/packages";
import { LAYOUT_PARAMS, RUNS } from "../data/room";
import { resetRoom } from "../data/testRoom";
import { kitchenNow, openSharedLink } from "./openLink";
import { writeLink } from "./shareLink";
import { useAppStore } from "./useAppStore";

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
