import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { fitCheck } from "./fit";
import { chimneyOf, hoodSideFillers } from "./hood";
import { setActivePackage, setHoodModel } from "./layoutState";
import { SLOT_BY_ID } from "./slots";
import { defaultSelectionOf, resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import type { Appliance, SlotId } from "../types";

/**
 * The 36" chimney hood, HMCB36WS. Round 90 (Leo, round 87: until it came, a
 * 36" opening with a chimney hood had only the 30" HMCB30WS, which left 3" each
 * side and raised "the hood is narrower than the cooking surface").
 *
 * Its figures are its own sheet's (`docs/reference/hmcb36ws-spec.pdf`), not the
 * 30"'s: the canopy in PUBLISHED_SPECS, the chimney cover in `CHIMNEYS`. In A's,
 * B's and D's 36" openings it fills the opening, so the card says no filler and
 * the checklist raises no line about its width — where HMCB30WS, the lopsided
 * case beside it, still does both. One assertion per test.
 */
const HMCB36WS = APPLIANCE_BY_ID["thermador-hmcb36ws"];
const HMCB30WS = APPLIANCE_BY_ID["thermador-hmcb30ws"];
const OPENINGS = ["package-a", "package-b", "package-d"];

afterAll(() => {
  resetRoom();
  setHoodModel(APPLIANCE_BY_ID["thermador-ph36hws"]);
});

/** The package built with this hood chosen, and its selection. */
function withHood(id: string, hood: Appliance) {
  resetRoom();
  if (!setActivePackage(id).ok) throw new Error(`${id} will not build`);
  setHoodModel(hood);
  return { ...defaultSelectionOf(id), "slot-hood": hood } as Record<SlotId, Appliance>;
}

const narrowLines = (selection: Record<SlotId, Appliance>) =>
  checklistFor(selection, null).findings.filter((f) => f.ruleId === "hood-narrower-than-cooking").length;

/** What the card and the list print beside the hood: filler each side, over a scribe (the 0.05" FitNotes reads). */
const fillerNote = (hood: Appliance) => {
  const each = fitCheck(SLOT_BY_ID["slot-hood"], hood).fillerEachSideIn;
  return each !== null && each > 0.05 ? each : null;
};

describe("HMCB36WS in A's, B's and D's 36-inch hood openings (round 90)", () => {
  it("is in the catalogue as a chimney wall hood, 35-15/16 inches wide, from its own sheet", () => {
    expect({
      installType: HMCB36WS.installType,
      widthIn: HMCB36WS.widthIn,
      heightIn: HMCB36WS.heightIn,
      depthIn: HMCB36WS.depthIn,
      cfm: HMCB36WS.requires.cfm,
    }).toEqual({ installType: ["wall-mount", "chimney"], widthIn: 35.9375, heightIn: 8.5625, depthIn: 23.1875, cfm: 600 });
  });

  it("fits each opening with no filler to print", () => {
    const notes = OPENINGS.map((id) => {
      withHood(id, HMCB36WS);
      return fillerNote(HMCB36WS);
    });
    expect(notes).toEqual([null, null, null]);
  });

  it("where HMCB30WS still prints 3 inches each side", () => {
    const notes = OPENINGS.map((id) => {
      withHood(id, HMCB30WS);
      return fillerNote(HMCB30WS);
    });
    expect(notes).toEqual([3, 3, 3]);
  });

  // These two say which model they asked about: on a catalogue without it
  // the hood is undefined, and "no strips" and "no line" would hold of nothing.
  // (No strips is round 87's rule for every chimney hood; the 30" left its gap
  // each side open, and the 36" leaves none.)
  it("draws no strips beside it", () => {
    const strips = OPENINGS.map((id) => {
      withHood(id, HMCB36WS);
      return hoodSideFillers(SLOT_BY_ID["slot-hood"], HMCB36WS);
    });
    expect({ model: HMCB36WS?.model, strips }).toEqual({ model: "HMCB36WS", strips: [null, null, null] });
  });

  it("raises no line that the hood is narrower than the cooking surface", () => {
    const lines = OPENINGS.map((id) => narrowLines(withHood(id, HMCB36WS)));
    expect({ model: HMCB36WS?.model, lines }).toEqual({ model: "HMCB36WS", lines: [0, 0, 0] });
  });

  it("where HMCB30WS raises it in each", () => {
    expect(OPENINGS.map((id) => narrowLines(withHood(id, HMCB30WS)))).toEqual([1, 1, 1]);
  });

  it("is refused on width in C's 30-inch opening", () => {
    withHood("package-c", HMCB30WS);
    expect(fitCheck(SLOT_BY_ID["slot-hood"], HMCB36WS).widthFits).toBe(false);
  });
});

describe("a chimney hood's cover is its own sheet's (round 90)", () => {
  it("draws HMCB36WS's cover from its own sheet", () => {
    const cover = chimneyOf(HMCB36WS);
    expect({
      source: cover.source,
      widthIn: cover.widthIn,
      depthIn: cover.depthIn,
      reachIn: cover.reachIn,
      sectionIn: cover.sectionIn,
      extension: cover.extension,
    }).toEqual({
      source: "docs/reference/hmcb36ws-spec.pdf",
      widthIn: 13.1875,
      depthIn: 10.75,
      reachIn: [30, 42],
      // 30" less the 8-9/16" canopy, as the 30"'s.
      sectionIn: 21.4375,
      extension: "CHXTHMCB",
    });
  });

  it("refuses a chimney hood with no figures of its own rather than lending it another's", () => {
    const unknown = { ...HMCB36WS, id: "test-chimney", model: "HMCB99WS" } as Appliance;
    expect(() => chimneyOf(unknown)).toThrow(/no chimney figures/);
  });
});
