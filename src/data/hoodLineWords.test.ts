/**
 * Item 12, 10: the words beside the line from the cooking surface to the hood, in A to D as on E's
 * one wall — what the chosen hood's own manual says (Leo, 2026-11-08: 「读到什么写什么」; the shop's
 * figure and a manual's written apart). Leo, 2026-11-14:
 *  - 「A 到 D 和 E 一字型一样，按选中那台的说明书写。」
 *  - the ones whose manual calls its maximum recommended or suggested (AK7136BS-BF, AK7300AS,
 *    VCIN36GWS, and PH36HWS by his second word that day: 「PH36HWS 带"建议"：用「最小 30，建议最大
 *    40」」) say 「最小 {min}，建议最大 {max}」 / "min {min}, recommended max {max}";
 *  - the three with no maximum, the words that are there, 「最小 {min}，燃气与电磁相同」, each checked
 *    to give the same minimum over gas and over electric or induction, its pages in the data;
 *  - the over-the-range microwave 「店里做法」, no figure (「微波炉式的叫法统一成：店里做法，不带 24″」);
 *  - 「油烟机挂的高度不动」: the line's figure is not this test's (the dumps hold it).
 */
import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { candidatesFor } from "./candidates";
import { dimensionsFor } from "./dimensions";
import { HOOD_MANUALS } from "./hood";
import { setActivePackage, setHoodModel } from "./layoutState";
import { PACKAGE, PACKAGE_BY_ID } from "./packages";
import { resetRoom } from "./testRoom";
import { translate } from "../i18n";
import type { Appliance, SlotId } from "../types";

afterAll(() => resetRoom());

const WORDS: Record<string, { zh: string; en: string }> = {
  PH36HWS: { zh: "最小 30″，建议最大 40″", en: "min 30″, recommended max 40″" },
  VCIN36GWS: { zh: "最小 30″，建议最大 40″", en: "min 30″, recommended max 40″" },
  "AK7136BS-BF": { zh: "最小 24″，建议最大 32″", en: "min 24″, recommended max 32″" },
  AK7300AS: { zh: "最小 24″，建议最大 34″", en: "min 24″, recommended max 34″" },
  HMCB30WS: { zh: "最小 30″，燃气与电磁相同", en: "min 30″, gas or induction" },
  HMCB36WS: { zh: "最小 30″，燃气与电磁相同", en: "min 30″, gas or induction" },
  HMWB361WS: { zh: "最小 30″，燃气与电磁相同", en: "min 30″, gas or induction" },
  JVM3160RFSS: { zh: "店里做法", en: "shop practice" },
};

/** The line's words in each package's own L, with each hood its opening takes. */
function linesOf(pkgId: string): { model: string; zh: string; en: string }[] {
  resetRoom();
  if (!setActivePackage(pkgId).ok) throw new Error(`${pkgId} will not build`);
  const fitting = candidatesFor("slot-hood", PACKAGE).filter((c) => c.fit.fits).map((c) => c.appliance);
  return fitting.map((hood) => {
    resetRoom();
    setActivePackage(pkgId);
    setHoodModel(hood);
    const selection = Object.fromEntries(
      Object.entries(PACKAGE.defaultSelection).map(([slot, id]) => [slot, APPLIANCE_BY_ID[id as string]]),
    ) as Record<SlotId, Appliance>;
    selection["slot-hood"] = hood;
    const line = dimensionsFor(selection).find((d) => d.id === "cooktop-to-canopy")!;
    return {
      model: hood.model,
      zh: translate("zh", line.noteKey!, line.noteVars),
      en: translate("en", line.noteKey!, line.noteVars),
    };
  });
}

describe("A to D: the line beside each hood says what that hood's manual says", () => {
  it.each([
    ["package-a", ["PH36HWS", "JVM3160RFSS", "AK7136BS-BF", "AK7300AS", "VCIN36GWS", "HMWB361WS", "HMCB30WS", "HMCB36WS"]],
    ["package-b", ["VCIN36GWS", "JVM3160RFSS", "AK7136BS-BF", "AK7300AS", "HMWB361WS", "PH36HWS", "HMCB30WS", "HMCB36WS"]],
    // C's opening is 30": its 36" hoods do not fit.
    ["package-c", ["HMCB30WS", "JVM3160RFSS", "AK7300AS"]],
    ["package-d", ["VCIN36GWS", "JVM3160RFSS", "AK7136BS-BF", "AK7300AS", "HMWB361WS", "PH36HWS", "HMCB30WS", "HMCB36WS"]],
  ])("%s", (pkgId, models) => {
    const lines = linesOf(pkgId);
    expect(lines.map((l) => l.model).sort()).toEqual([...models].sort());
    for (const line of lines) expect({ model: line.model, zh: line.zh, en: line.en }).toEqual({ model: line.model, ...WORDS[line.model] });
  });

  it("each package's own room: C's says no maximum, A's, B's and D's say recommended", () => {
    const own = Object.fromEntries(
      ["package-a", "package-b", "package-c", "package-d"].map((id) => {
        const model = APPLIANCE_BY_ID[PACKAGE_BY_ID[id].defaultSelection["slot-hood"] as string].model;
        return [id, linesOf(id).find((l) => l.model === model)!.zh];
      }),
    );
    expect(own).toEqual({
      "package-a": "最小 30″，建议最大 40″",
      "package-b": "最小 30″，建议最大 40″",
      "package-c": "最小 30″，燃气与电磁相同",
      "package-d": "最小 30″，建议最大 40″",
    });
  });

  it("no longer says \"gas min\" over any of them", () => {
    for (const id of ["package-a", "package-b", "package-c", "package-d"]) {
      for (const line of linesOf(id)) expect(`${line.zh} ${line.en}`).not.toMatch(/燃气最小|gas min|店内做法/);
    }
  });
});

describe("the manuals, as written down (checked 2026-11-14)", () => {
  it("marks the four whose manual calls its maximum recommended or suggested, and no other", () => {
    const recommended = Object.entries(HOOD_MANUALS)
      .filter(([, m]) => m.maxRecommended)
      .map(([model]) => model)
      .sort();
    expect(recommended).toEqual(["AK7136BS-BF", "AK7300AS", "PH36HWS", "VCIN36GWS"]);
  });

  // Leo, 2026-11-14: 「印刷页码和文件页码不一样的，两种都写」. Of the nine, only PH36HWS's guide prints
  // other numbers than its file's (printed 6 is file 10, printed 11 file 15; read with pdftotext).
  it("cites PH36HWS's guide by its printed page and its file page", () => {
    expect(HOOD_MANUALS.PH36HWS.read).toContain("printed p. 6 (file p. 10)");
    expect(HOOD_MANUALS.PH36HWS.read).toContain("printed p. 11 (file p. 15)");
    expect(HOOD_MANUALS.PH36HWS.read).toContain("suggested maximum");
  });

  it("gives, for each hood with no maximum, where its manual sets gas and induction the same", () => {
    const noMax = Object.entries(HOOD_MANUALS).filter(([, m]) => m.minIn !== null && m.maxIn === null);
    expect(noMax.map(([model]) => model).sort()).toEqual(["HMCB30WS", "HMCB36WS", "HMIB42WS", "HMWB361WS"]);
    for (const [model, m] of noMax) {
      expect(m.sameOverGasAndInduction, model).toMatch(/p\. 9/);
    }
    expect(HOOD_MANUALS.HMWB361WS.sameOverGasAndInduction).toMatch(/hmwb361ws-install\.pdf/);
    expect(HOOD_MANUALS.HMCB36WS.sameOverGasAndInduction).toMatch(/hmcb36ws-install\.pdf/);
  });
});
