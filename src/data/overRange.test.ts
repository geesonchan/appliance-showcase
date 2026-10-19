import { afterAll, describe, expect, it } from "vitest";
import * as hood from "./hood";
import * as room from "./room";
import { candidatesFor } from "./candidates";
import { APPLIANCE_BY_ID } from "./catalogue";
import { CABINETS } from "./cabinets";
import { checklistFor } from "./useChecklist";
import { buildQuote } from "./quote";
import { deriveUtilities } from "./utilities";
import { recordHoodModel } from "./hoodMount";
import { setActivePackage, setHoodModel, setLayoutParams } from "./layoutState";
import { PACKAGE_BY_ID } from "./packages";
import { SLOTS, SLOT_BY_ID } from "./slots";
import { defaultSelectionOf, resetRoom } from "./testRoom";
import type { Appliance, SlotId } from "../types";

/**
 * Round 97, Leo, from his shop: an over-the-range microwave in the hood's
 * place, GE's JVM3160RFSS, with the figures of its own documents —
 * docs/reference/jvm3160rfss-install.pdf, jvm3160rfss-spec.pdf and
 * jvm3160rfss-top-cabinet-template.pdf — and his shop practice:
 *
 * 1. With an OTR the island's microwave drawer is not needed: it leaves the
 *    room, the quote and the install list, and its opening is cabinets by the
 *    rules there are; a hood chosen again brings it back as it was.
 * 2. Vented outside, up through the cabinet over it; the duct rectangular, its
 *    size the manual's.
 * 3. Its underside 24" over the cooking surface.
 * 4. In every 30" hood opening; in the 36" ones too, as a narrower hood.
 *
 * Package C is the case: its 30" opening, its 36" cooking surface, its
 * microwave drawer on the island. Each case is written so that on round 96's
 * code it is red for what it says, not for a crash: what is new is reached
 * through the module rather than imported by name, and an OTR the old code
 * cannot hang is caught and said.
 */
afterAll(() => resetRoom());

const OTR_ID = "ge-jvm3160rfss";
const CHIMNEY_ID = "thermador-hmcb30ws";
const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000;
const ids = (list: readonly { appliance: Appliance }[]) => list.map(({ appliance }) => appliance.id);

/** Package C as it opens, with or without its island. */
function packageC(hasIsland = true) {
  resetRoom();
  // C's own hood, whatever a test before chose (resetRoom does this since
  // round 97; said here too, so that on older code a case starts clean).
  recordHoodModel(undefined, "package-c");
  if (!setActivePackage("package-c").ok) throw new Error("C: room refused");
  if (!hasIsland && !setLayoutParams({ ...room.REQUESTED_PARAMS, hasIsland: false }).ok) {
    throw new Error("C without an island: room refused");
  }
}

/** Pick a hood the way the model card does; what went wrong, said, rather than thrown. */
function pickHood(id: string): string {
  try {
    const result = setHoodModel(APPLIANCE_BY_ID[id], "package-c");
    return result.ok ? "ok" : `refused: ${result.reasons.map((r) => r.key).join(", ")}`;
  } catch (error) {
    // Put C's own hood back, so that what the test reads next is the room as
    // it stands rather than the same throw again.
    recordHoodModel(undefined, "package-c");
    return `threw: ${(error as Error).message}`;
  }
}

/** Package C's selection with this hood in it. */
const selectionWith = (hoodId: string): Record<SlotId, Appliance> => ({
  ...defaultSelectionOf("package-c"),
  "slot-hood": APPLIANCE_BY_ID[hoodId],
});

/** The cabinet boxes over the hood: their bottoms and tops, in inches. */
function overTheHood(): string[] {
  return CABINETS.filter((box) => box.id.startsWith("upper-back-hood"))
    .map((box) => {
      const kind = box.id.endsWith("-stack") ? "stack" : box.id.includes("-crown-") ? "crown" : "cabinet";
      return `${kind} ${inches(box.position[1] - box.size[1] / 2)}-${inches(box.position[1] + box.size[1] / 2)}`;
    })
    .sort();
}

/** Everything that describes the room, for a before-and-after comparison. */
function roomNow() {
  return JSON.stringify({
    runs: room.RUNS,
    island: room.ISLAND,
    omitted: room.OMITTED_SLOTS,
    slots: Object.values(SLOT_BY_ID).map((slot) => [slot.id, slot.position, slot.rotationY, slot.utilities]),
    cabinets: CABINETS.map((box) => [box.id, box.position, box.size]),
  });
}

describe("where it is offered (round 97)", () => {
  it("is offered in package C's hood opening, and fits it", () => {
    packageC();
    const offered = candidatesFor("slot-hood", PACKAGE_BY_ID["package-c"]);
    expect(offered.find(({ appliance }) => appliance.id === OTR_ID)?.fit.fits).toBe(true);
  });

  it("is offered in A's, B's and D's 36\" hood openings as a narrower hood, and fits them (Leo)", () => {
    const fits = ["a", "b", "d"].map(
      (code) =>
        candidatesFor("slot-hood", PACKAGE_BY_ID[`package-${code}`]).find(({ appliance }) => appliance.id === OTR_ID)?.fit
          .fits ?? null,
    );
    expect(fits).toEqual([true, true, true]);
  });

  it("is not offered over E's island, which its manual rules out", () => {
    expect(ids(candidatesFor("slot-hood", PACKAGE_BY_ID["package-e"]))).not.toContain(OTR_ID);
  });

  it("is in no package's microwave opening", () => {
    const where = ["a", "b", "c", "d", "e"].filter((code) =>
      ids(candidatesFor("slot-microwave", PACKAGE_BY_ID[`package-${code}`])).includes(OTR_ID),
    );
    expect(where).toEqual([]);
  });

  it("installs over the range, by its manual: its install type is otr", () => {
    expect(APPLIANCE_BY_ID[OTR_ID].installType).toEqual(["otr"]);
  });
});

describe("package C with the OTR (round 97)", () => {
  it("hangs it, where the old code could not", () => {
    packageC();
    expect(pickHood(OTR_ID)).toBe("ok");
  });

  it("hangs its underside 24\" over the 36\" cooking surface, at 60\"", () => {
    packageC();
    pickHood(OTR_ID);
    expect(inches(SLOT_BY_ID["slot-hood"].position[1])).toBe(60);
  });

  it("puts its top at 76-1/2\", its own 16-1/2\" over that", () => {
    packageC();
    pickHood(OTR_ID);
    expect(inches(hood.hoodTopFt())).toBe(76.5);
  });

  it("hangs a 19-1/2\" cabinet over it, 76-1/2\" to 96\", with the 12\" box stacked on it to 108\" and the crown over that", () => {
    packageC();
    pickHood(OTR_ID);
    expect(overTheHood()).toEqual(["cabinet 76.5-96", "crown 107-108.5", "stack 96-108"]);
  });

  it("sends its duct up through that cabinet", () => {
    packageC();
    pickHood(OTR_ID);
    expect(SLOT_BY_ID["slot-hood"].utilities.duct?.route).toBe("up-through-cabinet");
  });

  it("builds the room without the microwave drawer", () => {
    packageC();
    pickHood(OTR_ID);
    expect(room.OMITTED_SLOTS).toEqual(["slot-microwave"]);
  });

  it("gives the drawer's place on the island back to cabinets: no opening for it", () => {
    packageC();
    pickHood(OTR_ID);
    const [from, to] = room.ISLAND.microwave;
    expect(inches(to - from)).toBe(0);
  });

  it("says nothing about the drawer: the wall was not short of it", () => {
    packageC();
    pickHood(OTR_ID);
    const notices = checklistFor(selectionWith(OTR_ID), null).findings.filter((f) => f.ruleId === "no-island-omitted");
    expect(notices).toEqual([]);
  });
});

describe("package C's lists with the OTR (round 97)", () => {
  const findings = () => {
    packageC();
    pickHood(OTR_ID);
    return checklistFor(selectionWith(OTR_ID), null).findings;
  };

  it("has no line for the microwave drawer on the install list", () => {
    expect(findings().filter((f) => f.slot === "slot-microwave").map((f) => f.ruleId)).toEqual([]);
  });

  it("blocks on the range's 69,000 BTU, over the manual's 63,000", () => {
    const line = findings().find((f) => f.ruleId === "otr-gas-btu");
    expect({ severity: line?.severity, params: line?.params }).toEqual({
      severity: "blocker",
      params: { model: "JVM3160RFSS", range: "Maytag MFGS4030RS", btu: "69,000" },
    });
  });

  it("has the cabinet over it cut 12-1/2\" x 4-1/2\", the template's E", () => {
    expect(findings().find((f) => f.ruleId === "hood-cabinet-cutout")?.params).toEqual({ size: '12-1/2" × 4-1/2"' });
  });

  it("drills that cabinet for its cord and its screws", () => {
    expect(findings().map((f) => f.ruleId)).toContain("otr-cabinet-holes");
  });

  it("gives its duct as its own, not the airflow band's", () => {
    expect(findings().filter((f) => f.ruleId.startsWith("duct-size")).map((f) => f.ruleId)).toEqual(["duct-size-otr"]);
  });

  it("raises no makeup air at its 300 CFM", () => {
    expect(findings().map((f) => f.ruleId)).not.toContain("makeup-air");
  });

  it("puts its outlet in the cabinet above", () => {
    const outlet = findings().find((f) => f.slot === "slot-hood" && f.ruleId.startsWith("rough-in:slot-hood:power"));
    expect(outlet?.params.whereKey).toBe("roughIn.where.cabinetAbove");
  });

  it("quotes the OTR in the hood's line and no microwave drawer: five lines, $9,695 (from six, $14,644)", () => {
    packageC();
    pickHood(OTR_ID);
    const selection = selectionWith(OTR_ID);
    const quote = buildQuote({
      packageId: "package-c",
      packageName: "C",
      slots: SLOTS,
      selection,
      blower: null,
      hoodNeedsBlower: false,
      findings: [],
      t: (key) => key,
    });
    expect({ lines: quote.lines.map((line) => `${line.slot} ${line.model} ${line.msrpUSD}`), total: quote.totals.subtotalUSD }).toEqual({
      lines: [
        "slot-fridge T36FT820NS 5299",
        "slot-range MFGS4030RS 799",
        "slot-hood JVM3160RFSS 249",
        "slot-dishwasher SHX78CM5N 1549",
        "slot-wine PRW24C01CG 1799",
      ],
      total: 9695,
    });
  });

  it("quotes exactly these: the drawer is not one of them", () => {
    packageC();
    pickHood(OTR_ID);
    expect(SLOTS.map((slot) => slot.id)).not.toContain("slot-microwave");
  });
});

describe("the OTR's own figures, from its template (round 97)", () => {
  it("leaves its 3-1/4\" x 10\" duct from the middle of the cut, 2-1/4\" off the wall", () => {
    packageC();
    pickHood(OTR_ID);
    const slot = SLOT_BY_ID["slot-hood"];
    const outlet = hood.hoodOutlet(slot, APPLIANCE_BY_ID[OTR_ID]);
    const wallZ = slot.position[2] - slot.cutout.d / 24;
    expect({ w: outlet.widthIn, d: outlet.depthIn, fromWall: inches(outlet.position[2] - wallZ) }).toEqual({
      w: 10,
      d: 3.25,
      fromWall: 2.25,
    });
  });

  it("cuts the cabinet's floor 12-1/2\" x 4-1/2\"", () => {
    packageC();
    pickHood(OTR_ID);
    const outlet = hood.hoodOutlet(SLOT_BY_ID["slot-hood"], APPLIANCE_BY_ID[OTR_ID]) as { cutoutWidthFt?: number; cutoutDepthFt?: number };
    expect([inches(outlet.cutoutWidthFt ?? 0), inches(outlet.cutoutDepthFt ?? 0)]).toEqual([12.5, 4.5]);
  });

  it("drills the cord's 2\" hole 6-1/4\" right of the centre line and 4-1/4\" off the wall", () => {
    packageC();
    pickHood(OTR_ID);
    const slot = SLOT_BY_ID["slot-hood"];
    const cordHole = (hood as unknown as Record<string, unknown>).cordHole as
      | ((s: typeof slot, a: Appliance) => { position: [number, number, number]; diameterFt: number } | null)
      | undefined;
    const hole = cordHole?.(slot, APPLIANCE_BY_ID[OTR_ID]) ?? null;
    const wallZ = slot.position[2] - slot.cutout.d / 24;
    expect(
      hole && {
        right: inches(hole.position[0] - slot.position[0]),
        fromWall: inches(hole.position[2] - wallZ),
        diameter: inches(hole.diameterFt),
      },
    ).toEqual({ right: 6.25, fromWall: 4.25, diameter: 2 });
  });

  it("draws the cord's hole in D21's dashed tier: its place across is measured on the template, not printed (Leo)", () => {
    packageC();
    pickHood(OTR_ID);
    const cordHole = (hood as unknown as Record<string, unknown>).cordHole as
      | ((s: unknown, a: Appliance) => { provenance?: string } | null)
      | undefined;
    expect(cordHole?.(SLOT_BY_ID["slot-hood"], APPLIANCE_BY_ID[OTR_ID])?.provenance ?? null).toBe("uncertain");
  });

  it("gives its duct on the spec card and the quote as 3-1/4\" x 10\"", () => {
    packageC();
    pickHood(OTR_ID);
    const duct = deriveUtilities(SLOT_BY_ID["slot-hood"], APPLIANCE_BY_ID[OTR_ID]).duct as { rectangleIn?: number[] } | null;
    expect(duct?.rectangleIn).toEqual([3.25, 10]);
  });
});

describe("back to the hood, the room as it was (round 97)", () => {
  it("is the same room after OTR and back, island and all", () => {
    packageC();
    const before = roomNow();
    const there = pickHood(OTR_ID);
    const back = pickHood(CHIMNEY_ID);
    expect({ there, back, same: roomNow() === before }).toEqual({ there: "ok", back: "ok", same: true });
  });

  it("is the same room after OTR and back without an island", () => {
    packageC(false);
    const before = roomNow();
    const there = pickHood(OTR_ID);
    const back = pickHood(CHIMNEY_ID);
    expect({ there, back, same: roomNow() === before }).toEqual({ there: "ok", back: "ok", same: true });
  });

  it("brings the drawer's install lines back as they were", () => {
    packageC();
    const before = JSON.stringify(checklistFor(selectionWith(CHIMNEY_ID), null).findings);
    pickHood(OTR_ID);
    pickHood(CHIMNEY_ID);
    expect(JSON.stringify(checklistFor(selectionWith(CHIMNEY_ID), null).findings)).toBe(before);
  });
});

describe("a room with no island (D18, round 97)", () => {
  const forWall = () => (room as unknown as { OMITTED_FOR_WALL?: readonly SlotId[] }).OMITTED_FOR_WALL ?? null;

  it("C with the OTR: the drawer is left out, and not as a shortage of wall", () => {
    packageC(false);
    pickHood(OTR_ID);
    expect({ omitted: room.OMITTED_SLOTS, forWall: forWall() }).toEqual({ omitted: ["slot-microwave"], forWall: [] });
  });

  it("C with the OTR: no line about it on the install list", () => {
    packageC(false);
    pickHood(OTR_ID);
    const lines = checklistFor(selectionWith(OTR_ID), null).findings.filter((f) => f.ruleId.startsWith("no-island"));
    expect(lines).toEqual([]);
  });

  it("D, its drawer left out for want of wall: no outlet or bracket listed for it", () => {
    resetRoom();
    setActivePackage("package-d");
    setLayoutParams({ ...room.REQUESTED_PARAMS, hasIsland: false });
    const lines = checklistFor(defaultSelectionOf("package-d"), null)
      .findings.filter((f) => f.slot === "slot-microwave")
      .map((f) => f.ruleId);
    expect({ omitted: room.OMITTED_SLOTS, lines }).toEqual({ omitted: ["slot-microwave"], lines: ["no-island-omitted"] });
  });

  it("D, its drawer left out: the line names the drawer alone, D's wine column standing in the room", () => {
    resetRoom();
    setActivePackage("package-d");
    setLayoutParams({ ...room.REQUESTED_PARAMS, hasIsland: false });
    const line = checklistFor(defaultSelectionOf("package-d"), null).findings.find((f) => f.ruleId === "no-island-omitted");
    expect(line?.messageKey).toBe("rule.noIslandOmittedMicrowave");
  });

  it("C without the OTR, both left out: the line names both, as before", () => {
    packageC(false);
    const line = checklistFor(defaultSelectionOf("package-c"), null).findings.find((f) => f.ruleId === "no-island-omitted");
    expect({ omitted: room.OMITTED_SLOTS, key: line?.messageKey }).toEqual({
      omitted: ["slot-microwave", "slot-wine"],
      key: "rule.noIslandOmitted",
    });
  });
});
