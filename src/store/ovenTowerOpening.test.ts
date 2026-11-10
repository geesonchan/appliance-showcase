import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "../data/cabinets";
import { candidatesFor } from "../data/candidates";
import { APPLIANCE_BY_ID } from "../data/catalogue";
import { recordHoodModel } from "../data/hoodMount";
import { standardInstall } from "../data/ovenTrim";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "../data/packages";
import { SLOT_BY_ID } from "../data/slots";
import { resetRoom } from "../data/testRoom";
import type { SlotId } from "../types";
import { kitchenNow, openSharedLink } from "./openLink";
import { writeLink } from "./shareLink";
import { useAppStore } from "./useAppStore";

/**
 * An oven tower's opening grows to the oven chosen, where that oven's
 * standard cutout is taller than the tower was built for (Leo, 2026-11-09, 甲:
 * 「PO302W 在 B 里照甲：选这台时开口长到 50"，上面的柜门短 1-1/2"。测试守着：换过去、换回来、
 * 分享链接重开，开口和柜门都跟着变。」). It never shrinks: a smaller oven keeps
 * the tower's hole and the panel over it.
 *
 * And every oven's control panel stands where it can be seen: ME301YP and
 * PO302W now carry their sheets' trim (page 1: top 3/8"-2", sides 9/16",
 * bottom 0; handle 2-5/8" on page 2), so their front is on the doors' plane
 * rather than 2" back in the hole.
 */
const store = () => useAppStore.getState();
const OPENED = useAppStore.getState();
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

const TOWERS: [string, SlotId][] = [["package-b", "slot-microwave"], ["package-d", "slot-oven"], ["package-e", "slot-microwave"]];
const r = (n: number) => Math.round(n * 1000) / 1000;
const opening = (slot: SlotId) => SLOT_BY_ID[slot].cutout.h;
/** The cabinet over the tower's opening, its bottom in inches off the floor. */
const doorOverIn = (slot: SlotId) => {
  const box = CABINETS.find((b) => b.id.endsWith("-bridge") && b.slot === slot)!;
  return r((box.position[1] - box.size[1] / 2) * 12);
};
const room = (slot: SlotId) => ({ opening: opening(slot), doorOver: doorOverIn(slot) });

describe("B's oven tower round PO302W (甲)", () => {
  it("opens to 50\" with PO302W and the door over it is 1-1/2\" shorter; MEM301WS back puts both back", () => {
    packagePage("package-b");
    const before = room("slot-microwave");
    store().selectAppliance("slot-microwave", "thermador-po302w");
    const po = room("slot-microwave");
    store().selectAppliance("slot-microwave", "thermador-mem301ws");
    const back = room("slot-microwave");
    expect({ before, po, back }).toEqual({
      before: { opening: 48.5, doorOver: 63.5 },
      po: { opening: 50, doorOver: 65 },
      back: { opening: 48.5, doorOver: 63.5 },
    });
    expect(store().layoutIssues).toEqual([]);
  });

  it("opens to 50\" again from a share link", () => {
    packagePage("package-b");
    store().selectAppliance("slot-microwave", "thermador-po302w");
    const link = `?${writeLink(kitchenNow())}`;
    packagePage("package-b");
    expect(room("slot-microwave")).toEqual({ opening: 48.5, doorOver: 63.5 });
    openSharedLink(link);
    expect({ held: store().selection["slot-microwave"], ...room("slot-microwave") }).toEqual({
      held: "thermador-po302w",
      opening: 50,
      doorOver: 65,
    });
  });

  it("keeps the tower's hole for a smaller oven: ME301YP in B stands in 48-1/2\"", () => {
    packagePage("package-b");
    store().selectAppliance("slot-microwave", "thermador-me301yp");
    expect(room("slot-microwave")).toEqual({ opening: 48.5, doorOver: 63.5 });
  });

  it("grows another package's tower by the same rule: MEM301WS opens D's to its own 48-1/2\"", () => {
    packagePage("package-d");
    const fits = candidatesFor("slot-oven", PACKAGE_BY_ID["package-d"]).find((c) => c.appliance.id === "thermador-mem301ws");
    if (!fits?.fit.fits) return expect(fits?.fit.fits ?? "not offered").toBe("offered in D");
    store().selectAppliance("slot-oven", "thermador-mem301ws");
    expect(opening("slot-oven")).toBe(48.5);
  });
});

describe("every tower oven's panel where it can be seen", () => {
  it.each(TOWERS)("%s %s: each oven offered stands its front on the doors' plane, its top lapping the opening by no more than 2-1/16\"", (pkg, slot) => {
    const out: string[] = [];
    packagePage(pkg);
    const offered = candidatesFor(slot, PACKAGE_BY_ID[pkg]).filter((c) => c.fit.fits).map((c) => c.appliance.id);
    for (const id of ["thermador-me301yp", "thermador-mem301ws", "thermador-po302w", "thermador-pods302b"]) {
      if (!offered.includes(id)) continue;
      store().selectAppliance(slot, id);
      const install = standardInstall(SLOT_BY_ID[slot], APPLIANCE_BY_ID[id]);
      if (!install) {
        out.push(`${id}: no trim, back in the hole`);
        continue;
      }
      if (!(install.faceIn > install.doorFrontIn)) out.push(`${id}: face behind the doors`);
      if (install.overlapIn.top < 0 || install.overlapIn.top > 2.0625 + 1e-9) out.push(`${id}: top lap ${install.overlapIn.top}`);
    }
    expect(out).toEqual([]);
  });

  it("ME301YP in B laps the top of its own 27\" cutout by 2\", PO302W the grown 50\" by 2-1/16\"", () => {
    packagePage("package-b");
    const lap = (id: string) => {
      store().selectAppliance("slot-microwave", id);
      return standardInstall(SLOT_BY_ID["slot-microwave"], APPLIANCE_BY_ID[id])?.overlapIn.top ?? null;
    };
    expect({ me: lap("thermador-me301yp"), po: lap("thermador-po302w") }).toEqual({ me: 2, po: 2.0625 });
  });
});
