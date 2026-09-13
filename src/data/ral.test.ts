import { describe, expect, it } from "vitest";
import { cabinetPaint, cabinetToken } from "../store/useAppStore";
import { finish } from "../three/materials";
import { RAL, lookupRal, ralForHex } from "./ral";

/**
 * RAL numbers typed into the finish picker. Round 33, Leo: the five swatches
 * stay as the quick picks, and any RAL number in the table paints the doors.
 */
describe("the RAL table", () => {
  it("is forty-odd codes with a source, each a distinct colour", () => {
    expect(RAL.colours.length).toBeGreaterThanOrEqual(30);
    expect(RAL.colours.length).toBeLessThanOrEqual(40);
    expect(RAL._meta.provenance).toMatch(/wikipedia\.org\/wiki\/List_of_RAL_colours/);
    expect(new Set(RAL.colours.map((c) => c.code)).size).toBe(RAL.colours.length);
    expect(new Set(RAL.colours.map((c) => c.hex)).size).toBe(RAL.colours.length);
  });

  it("carries the values on its source's detail table", () => {
    // Spot checks against the page, so a mis-parse shows up as a named code.
    expect(lookupRal("RAL 9010")).toMatchObject({ ok: true, colour: { hex: "#F7F9EF" } });
    expect(lookupRal("RAL 6005")).toMatchObject({ ok: true, colour: { hex: "#0F4336" } });
    expect(lookupRal("RAL 7016")).toMatchObject({ ok: true, colour: { hex: "#373F43" } });
  });
});

describe("reading a typed RAL number", () => {
  it("takes the ways people write one", () => {
    for (const typed of ["RAL 6005", "ral6005", "RAL-6005", " 6005 ", "Ral 6005"]) {
      expect(lookupRal(typed), typed).toMatchObject({ ok: true, colour: { code: "RAL 6005" } });
    }
  });

  it("says a well-formed number is not in the table, rather than guessing", () => {
    expect(lookupRal("RAL 1234")).toEqual({ ok: false, reason: "unknown", code: "RAL 1234" });
    // A real RAL colour this table does not carry: traffic red.
    expect(lookupRal("RAL 3020")).toEqual({ ok: false, reason: "unknown", code: "RAL 3020" });
  });

  it("refuses what is not a RAL number at all", () => {
    for (const typed of ["", "RAL", "RAL 60", "RAL 60055", "green", "#0F4336", "RAL 6O05"]) {
      expect(lookupRal(typed), typed).toEqual({ ok: false, reason: "format" });
    }
  });
});

describe("a RAL colour on the doors", () => {
  const base = { cabinet: "#2E5C45", accent: "#23282B", accentRun: "none" as const };

  it("paints the door material exactly the table's value, primary and accent", () => {
    for (const colour of RAL.colours) {
      expect(cabinetToken(colour.hex), colour.code).toBe("painted");
      const primary = cabinetPaint({ ...base, cabinet: colour.hex }, "left");
      expect(finish("realistic", primary.token, primary.colour).color, colour.code).toBe(colour.hex);
      const accent = cabinetPaint({ ...base, accent: colour.hex, accentRun: "island" }, "island");
      expect(finish("realistic", accent.token, accent.colour).color, colour.code).toBe(colour.hex);
      expect(ralForHex(colour.hex)?.code).toBe(colour.code);
    }
  });

  it("leaves the door colour alone for input it cannot read", () => {
    // The picker only writes a colour when the lookup succeeds; these are the
    // results it would be handed, and none of them carries one.
    for (const typed of ["RAL 1234", "not a colour", ""]) {
      const found = lookupRal(typed);
      expect(found.ok, typed).toBe(false);
      expect("colour" in found, typed).toBe(false);
    }
  });
});
