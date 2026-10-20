import { afterAll, describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates";
import { APPLIANCE_BY_ID, migrateSelection, suitsPackageSlot } from "./catalogue";
import { fitCheck } from "./fit";
import { setActivePackage } from "./layoutState";
import { BUILDABLE_PACKAGES, PACKAGE_BY_ID, slotsOf } from "./packages";
import { SLOT_BY_ID } from "./slots";
import { appliance } from "./testFixtures";
import { resetRoom } from "./testRoom";
import type { Slot, SlotId } from "../types";

/**
 * Round 86, Leo: a machine that cannot physically go into an opening is not
 * offered as fitting it. From his use of package A — a wine column, 84" tall,
 * picked for the 34" opening under the island's top and drawn through it.
 *
 * Two refusals, each with its reason:
 * - an opening with something fixed above it — the countertop, or the coffee
 *   machine a tower stands over it — takes nothing taller than itself;
 * - a tall unit built for one kind of machine does not take another kind the
 *   maker has not confirmed for a tall cabinet (B's and E's combination-oven
 *   tower offered a microwave drawer and an over-the-range microwave).
 *
 * Everything else is unchanged: a tall unit is built to its machine, so a
 * machine taller or shorter than it is still offered (D20, round 46), and an
 * opening with nothing over it — a range's, a hood's — only mentions height.
 */
afterAll(() => resetRoom());

/** The real catalogue, every package built as the page builds it. */
function eachPackage(visit: (code: string, slotId: SlotId) => void) {
  for (const entry of BUILDABLE_PACKAGES) {
    resetRoom();
    if (!setActivePackage(entry.id).ok) throw new Error(`${entry.code}: room refused`);
    for (const slotId of Object.keys(slotsOf(entry)) as SlotId[]) visit(entry.code, slotId);
  }
}

const short = (id: string) => id.replace(/^[a-z]+-/, "");

describe("what is above an opening (round 86)", () => {
  it("is recorded for every opening of every package: the countertop, the coffee machine, or nothing", () => {
    const above: Record<string, string> = {};
    eachPackage((code, slotId) => {
      above[`${code} ${slotId}`] = String(SLOT_BY_ID[slotId].above);
    });
    expect(above).toEqual({
      "A slot-fridge": "null",
      "A slot-range": "null",
      "A slot-hood": "null",
      "A slot-dishwasher": "countertop",
      "A slot-microwave": "countertop",
      "A slot-wine": "countertop",
      "B slot-fridge": "null",
      "B slot-range": "null",
      "B slot-hood": "null",
      "B slot-dishwasher": "countertop",
      "B slot-microwave": "null",
      "B slot-wine": "null",
      "C slot-fridge": "null",
      "C slot-range": "null",
      "C slot-hood": "null",
      "C slot-dishwasher": "countertop",
      "C slot-microwave": "countertop",
      "C slot-wine": "countertop",
      "D slot-freezer": "null",
      "D slot-fridge": "null",
      "D slot-wine": "null",
      "D slot-range": "null",
      "D slot-hood": "null",
      "D slot-oven": "null",
      "D slot-coffee": "null",
      "D slot-dishwasher": "countertop",
      "D slot-dishwasher-2": "coffee",
      "D slot-microwave": "countertop",
      "E slot-freezer": "null",
      "E slot-fridge": "null",
      "E slot-microwave": "null",
      "E slot-coffee": "null",
      "E slot-wine-2": "coffee",
      "E slot-dishwasher": "countertop",
      "E slot-cooktop": "null",
      "E slot-hood": "null",
    });
  });
});

describe("a machine taller than an opening with something above it (round 86)", () => {
  it("is refused as too tall in exactly these openings, with what is above", () => {
    const refused: string[] = [];
    let offered = 0;
    eachPackage((code, slotId) => {
      for (const { appliance: model, fit } of candidatesFor(slotId, PACKAGE_BY_ID[`package-${code.toLowerCase()}`])) {
        offered += 1;
        if (fit.tooTallIn !== null) {
          refused.push(`${code} ${slotId} ${short(model.id)} +${Math.round(fit.tooTallIn * 1000) / 1000} ${fit.above}`);
        }
      }
    });
    expect({ offered, refused: refused.sort() }).toEqual({
      // Round 90: 137 — HMCB36WS joined the catalogue and is offered for A's,
      // B's, C's and D's hood openings (refused on width in C's 30"; E's
      // island takes no wall hood). Nothing it adds is too tall.
      // Round 92c: PO302W is 16" too tall, not 18-3/16": its cutout height is
      // its own sheet's standard one now, 50" (po302w-spec.pdf p. 1, the short
      // end), where the row carried the flush 52-3/16". Still refused.
      // Round 97: 136 — the over-the-range microwave JVM3160RFSS left the five
      // microwave openings (A's, C's and D's drawer, B's and E's tower) for
      // A's, B's, C's and D's hood openings: its own category, `otr`, which
      // only the hood slot takes. Nothing it adds is too tall.
      // Round 98b: 146 — the third import of round 98 added two columns, each
      // offered in every opening of its category it is narrow enough for (D20,
      // round 46; Leo accepted it in round 98b): the 24" T24IR905SP in the
      // five refrigerator openings, the 18" T18IW905SP in the five wine
      // openings (A's, B's, C's and D's slot-wine, E's slot-wine-2). Three of
      // the ten are an 84" column under a counter or a coffee machine, refused
      // by 50" as the T18IW100SP and T24IW905SP beside them are.
      offered: 146,
      refused: [
        "A slot-microwave mem301ws +14.5 countertop",
        "A slot-microwave po302w +16 countertop",
        "A slot-microwave pods302b +13.375 countertop",
        "A slot-wine t18iw100sp +50 countertop",
        "A slot-wine t18iw905sp +50 countertop",
        "A slot-wine t24iw905sp +50 countertop",
        "C slot-microwave mem301ws +14.5 countertop",
        "C slot-microwave po302w +16 countertop",
        "C slot-microwave pods302b +13.375 countertop",
        "C slot-wine t18iw100sp +50 countertop",
        "C slot-wine t18iw905sp +50 countertop",
        "C slot-wine t24iw905sp +50 countertop",
        "D slot-microwave mem301ws +14.5 countertop",
        "D slot-microwave po302w +16 countertop",
        "D slot-microwave pods302b +13.375 countertop",
        "E slot-wine-2 t18iw100sp +50 coffee",
        "E slot-wine-2 t18iw905sp +50 coffee",
        "E slot-wine-2 t24iw905sp +50 coffee",
      ],
    });
  });

  it("takes a wine column out of what fits package A's island wine opening", () => {
    resetRoom();
    setActivePackage("package-a");
    const fitting = candidatesFor("slot-wine", PACKAGE_BY_ID["package-a"])
      .filter(({ fit }) => fit.fits)
      .map(({ appliance: model }) => short(model.id));
    expect(fitting).toEqual(["prw24c01cg"]);
  });

  // Lopsided on purpose (D22): an eighth over, against exactly level, against
  // the same machine in an opening with nothing above it.
  const capped: Slot = {
    ...SLOT_BY_ID["slot-dishwasher"],
    cutout: { w: 24, h: 34, d: 24 },
    above: "countertop",
    tallUnitFor: null,
  };
  const cooler = (h: number) => appliance({ id: "test-cooler", category: "wine", widthIn: 24, cutoutWidthIn: 24, heightIn: h, cutoutHeightIn: h });

  it("refuses an eighth of an inch over", () => {
    const fit = fitCheck(capped, cooler(34.125));
    expect({ fits: fit.fits, tooTallIn: fit.tooTallIn }).toEqual({ fits: false, tooTallIn: 0.125 });
  });

  it("takes a machine exactly as tall as the opening", () => {
    expect(fitCheck(capped, cooler(34)).fits).toBe(true);
  });

  it("only mentions the eighth where nothing is above the opening", () => {
    const fit = fitCheck({ ...capped, above: null }, cooler(34.125));
    expect({ fits: fit.fits, tooTallIn: fit.tooTallIn, heightOverIn: fit.heightOverIn }).toEqual({
      fits: true,
      tooTallIn: null,
      heightOverIn: 0.125,
    });
  });

  it("says nothing of width when only the height refuses", () => {
    const fit = fitCheck(capped, cooler(84));
    expect({ fits: fit.fits, widthFits: fit.widthFits }).toEqual({ fits: false, widthFits: true });
  });

  // No package switch carries one across today — a column's install type keeps
  // it out of every capped slot but one, E's slot-wine-2, which no other
  // package has. So the case is the real model against E's real slot, asked
  // directly, which the old code passed.
  it("is not carried into such an opening by a package switch", () => {
    const e = PACKAGE_BY_ID["package-e"];
    const slot = slotsOf(e)["slot-wine-2"];
    expect(suitsPackageSlot(APPLIANCE_BY_ID["thermador-t18iw100sp"], slot, e)).toBe(false);
  });

  it("still lets a package switch carry the wine cooler that fits there", () => {
    const e = PACKAGE_BY_ID["package-e"];
    const slot = slotsOf(e)["slot-wine-2"];
    expect(suitsPackageSlot(APPLIANCE_BY_ID["zephyr-prw24c01cg"], slot, e)).toBe(true);
  });

  it("leaves every package's own selection fitting", () => {
    const refused: string[] = [];
    let checked = 0;
    for (const entry of BUILDABLE_PACKAGES) {
      resetRoom();
      setActivePackage(entry.id);
      for (const [slotId, id] of Object.entries(migrateSelection(entry)) as [SlotId, string][]) {
        checked += 1;
        if (!fitCheck(SLOT_BY_ID[slotId], APPLIANCE_BY_ID[id]).fits) refused.push(`${entry.code} ${slotId} ${id}`);
      }
    }
    expect({ checked, refused }).toEqual({ checked: 36, refused: [] });
  });
});

describe("another kind of machine in a tall unit (round 86)", () => {
  it("is refused in exactly B's and E's combination-oven tower, the maker not having confirmed it", () => {
    const refused: string[] = [];
    eachPackage((code, slotId) => {
      for (const { appliance: model, fit } of candidatesFor(slotId, PACKAGE_BY_ID[`package-${code.toLowerCase()}`])) {
        if (fit.notForTallUnit) refused.push(`${code} ${slotId} ${short(model.id)}`);
      }
    });
    // Round 97: JVM3160RFSS is no longer offered here at all — an
    // over-the-range microwave is the hood slot's (`otr`), and its manual
    // mounts it "only above countertop level" (p. 6), so the tower never had
    // a case for it. MD24BS still waits for a manual (Open items).
    expect(refused.sort()).toEqual([
      "B slot-microwave md24bs",
      "E slot-microwave md24bs",
    ]);
  });

  it("is what the tall unit is recorded as built for, and nothing else", () => {
    const tower: Slot = { ...SLOT_BY_ID["slot-dishwasher"], cutout: { w: 30, h: 48.5, d: 24 }, above: null, tallUnitFor: "wall-oven" };
    const oven = appliance({ id: "test-oven", category: "wall-oven", widthIn: 30, cutoutWidthIn: 30, heightIn: 52, cutoutHeightIn: 52 });
    const drawer = appliance({ id: "test-drawer", category: "microwave", widthIn: 24, cutoutWidthIn: 24, heightIn: 16, cutoutHeightIn: 16 });
    expect({
      tallerOven: fitCheck(tower, oven).fits,
      shorterDrawer: fitCheck(tower, drawer).fits,
    }).toEqual({ tallerOven: true, shorterDrawer: false });
  });
});

describe("every other model (round 86)", () => {
  it("fits or is refused exactly as its width says, as before", () => {
    const changed: string[] = [];
    let compared = 0;
    eachPackage((code, slotId) => {
      for (const { appliance: model, fit } of candidatesFor(slotId, PACKAGE_BY_ID[`package-${code.toLowerCase()}`])) {
        // Round 89: a counter-depth refrigerator in a bank of columns is
        // refused too, and held in fridgeSwap.test.ts — T36FT820NS in B's, D's
        // and E's refrigerator openings, three set aside here (in D's and E's
        // 30" it is too wide as well). So 111 compared, where round 86 had 114;
        // and 115 since round 90, with HMCB36WS offered in four hood openings;
        // 116 since round 97, JVM3160RFSS compared in A's, B's, C's and D's
        // hood openings where it had been in A's, C's and D's drawer openings.
        // 123 since round 98b: the two columns of round 98's third import,
        // offered on width (D20, round 46) — T24IR905SP in the five
        // refrigerator openings, T18IW905SP in B's and D's wine columns; its
        // other three openings refuse it as too tall, above.
        if (fit.tooTallIn !== null || fit.notForTallUnit || fit.notInColumnBank) continue;
        compared += 1;
        if (fit.fits !== fit.widthOverIn <= 1e-6) changed.push(`${code} ${slotId} ${short(model.id)}`);
      }
    });
    expect({ compared, changed }).toEqual({ compared: 123, changed: [] });
  });
});
