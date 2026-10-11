import { describe, expect, it } from "vitest";
import { cabinetPaint, cabinetToken } from "../store/useAppStore";
import { finish } from "../three/materials";
import { RAL, lookupRal, ralForHex } from "./ral";

/**
 * RAL numbers typed into the finish picker. Round 33, Leo: the five swatches
 * stay as the quick picks, and any RAL number in the table paints the doors.
 */
describe("the RAL table", () => {
  /**
   * Round 92, Leo: every RAL Classic code, from Wikipedia's list — 215 from its
   * overview table and RAL 6031 and RAL 6039, which only its Green colour-group
   * table carries — each with its source and the day it was read.
   */
  it("carries every RAL Classic code the page lists: 217", () => {
    expect(RAL.colours.length).toBe(217);
  });

  it("carries each code once", () => {
    expect(new Set(RAL.colours.map((c) => c.code)).size).toBe(217);
  });

  it("gives no two codes the same colour, so a door's hex names one code", () => {
    // ralForHex reads a door's code back from its hex alone.
    expect(new Set(RAL.colours.map((c) => c.hex)).size).toBe(217);
  });

  it("says each value is from one fixed revision of the page", () => {
    const urls = Object.values(RAL.sources).map((source) => source.url);
    expect(urls).toEqual([
      "https://en.wikipedia.org/w/index.php?title=List_of_RAL_colours&oldid=1369650571",
      "https://en.wikipedia.org/w/index.php?title=List_of_RAL_colours&oldid=1369650571",
    ]);
  });

  it("takes two codes from the colour-group table and the rest from the overview", () => {
    const fromGroup = RAL.colours.filter((c) => c.source === "colour-group").map((c) => c.code);
    const fromOverview = RAL.colours.filter((c) => c.source === "overview");
    expect({ fromGroup, overview: fromOverview.length }).toEqual({
      fromGroup: ["RAL 6031", "RAL 6039"],
      overview: 215,
    });
  });

  it("says RAL publishes no free value, not that it publishes none", () => {
    expect(RAL._meta.provenance).toMatch(/no free sRGB value/);
    expect(RAL._meta.provenance).not.toMatch(/no official sRGB/);
  });

  it("keeps the forty chosen in round 33 exactly as they were, read on 2026-09-13", () => {
    // Written out from the committed table before round 92, not read back from
    // the new one: a door painted one of these must not change colour.
    const forty = [
      ["9001", "#EFEBDC"], ["9002", "#DDDED4"], ["9003", "#F4F8F4"],
      ["9010", "#F7F9EF"], ["9016", "#F7FBF5"], ["1013", "#E3D9C6"],
      ["1015", "#E6D2B5"], ["1001", "#D0B084"], ["1019", "#A48F7A"],
      ["8014", "#49392D"], ["8017", "#44322D"], ["8019", "#3F3A3A"],
      ["8024", "#79553C"], ["8025", "#755C49"], ["7035", "#CBD0CC"],
      ["7044", "#BDBDB2"], ["7047", "#CFD0CF"], ["7032", "#B9B9A8"],
      ["7030", "#939388"], ["7039", "#6B695F"], ["7022", "#4B4D46"],
      ["7015", "#51565C"], ["7016", "#373F43"], ["7021", "#2E3234"],
      ["7024", "#474A50"], ["7026", "#374447"], ["9005", "#0A0A0D"],
      ["6005", "#0F4336"], ["6009", "#26392F"], ["6012", "#31403D"],
      ["6021", "#86A47C"], ["6028", "#2D5546"], ["6011", "#68825B"],
      ["6013", "#797C5A"], ["5003", "#2A3756"], ["5008", "#313C48"],
      ["5011", "#232C3F"], ["5014", "#6C7C98"], ["5023", "#4D668E"],
      ["5024", "#6A93B0"],
    ];
    const found = forty.map(([code]) => {
      const colour = RAL.colours.find((c) => c.code === `RAL ${code}`);
      return [code, colour?.hex, colour?.readAt];
    });
    expect(found).toEqual(forty.map(([code, hex]) => [code, hex, "2026-09-13"]));
  });

  it("dates every other code to the day round 92 read it", () => {
    const others = RAL.colours.filter((c) => c.readAt !== "2026-09-13");
    expect({ count: others.length, dates: [...new Set(others.map((c) => c.readAt))] }).toEqual({
      count: 177,
      dates: ["2026-10-11"],
    });
  });

  it("carries the values on its source's tables", () => {
    // Spot checks against the page, so a mis-parse shows up as a named code.
    expect(lookupRal("RAL 9010")).toMatchObject({ ok: true, colour: { hex: "#F7F9EF" } });
    expect(lookupRal("RAL 6005")).toMatchObject({ ok: true, colour: { hex: "#0F4336" } });
    expect(lookupRal("RAL 7016")).toMatchObject({ ok: true, colour: { hex: "#373F43" } });
    expect(lookupRal("RAL 5015")).toMatchObject({ ok: true, colour: { hex: "#2874B2" } });
    expect(lookupRal("RAL 2017")).toMatchObject({ ok: true, colour: { hex: "#FA4402" } });
    expect(lookupRal("RAL 6031")).toMatchObject({ ok: true, colour: { hex: "#495746" } });
    expect(lookupRal("RAL 6039")).toMatchObject({ ok: true, colour: { hex: "#B3C43E" } });
    // The overview's Sample column says #9C9C9C here; its Hex triplet is taken.
    expect(lookupRal("RAL 9022")).toMatchObject({ ok: true, colour: { hex: "#858583" } });
  });
});

describe("colours a screen cannot show", () => {
  // Written out from the page's names, not from the code that marks them.
  const effects = (effect: string) =>
    RAL.colours.filter((c) => c.effect === effect).map((c) => c.code.slice(4));

  it("marks the fifteen pearl colours", () => {
    expect(effects("pearl")).toEqual([
      "1035", "1036", "2013", "3032", "3033", "4011", "4012", "5025",
      "5026", "6035", "6036", "7048", "8029", "9022", "9023",
    ]);
  });

  it("marks the two aluminium colours metallic", () => {
    expect(effects("metallic")).toEqual(["9006", "9007"]);
  });

  it("marks the six luminous colours", () => {
    expect(effects("luminous")).toEqual(["1026", "2005", "2007", "3024", "3026", "6038"]);
  });

  it("marks those twenty-three and no other", () => {
    expect(RAL.colours.filter((c) => c.effect !== undefined).length).toBe(23);
  });
});

describe("reading a typed RAL number", () => {
  it("takes the ways people write one", () => {
    for (const typed of ["RAL 6005", "ral6005", "RAL-6005", " 6005 ", "Ral 6005"]) {
      expect(lookupRal(typed), typed).toMatchObject({ ok: true, colour: { code: "RAL 6005" } });
    }
  });

  it("takes the three ways round 89's plan names, on a code round 33's table lacked", () => {
    for (const typed of ["5015", "RAL 5015", "ral5015"]) {
      expect(lookupRal(typed), typed).toMatchObject({ ok: true, colour: { code: "RAL 5015" } });
    }
  });

  it("says a well-formed number is not a Classic code, rather than guessing", () => {
    expect(lookupRal("RAL 1234")).toEqual({ ok: false, reason: "unknown", code: "RAL 1234" });
  });

  it("knows traffic red, which round 33's table did not carry", () => {
    expect(lookupRal("RAL 3020")).toMatchObject({ ok: true, colour: { hex: "#C1121C" } });
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
