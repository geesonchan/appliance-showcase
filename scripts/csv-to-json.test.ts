import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import slotsFile from "../data/slots.json";
import { convert, formatSummary, parseCsv } from "./csv-to-json.ts";
import {
  BLANK_TYPE,
  UnknownApplianceTypeError,
  toBrand,
  toFinish,
  toFuel,
  toHighlights,
  toInstallType,
  toWidthIn,
} from "./normalise.ts";
import { appliancesFileSchema, parseDataFile } from "../src/data/schema.ts";
import type { Category, SlotId } from "../src/types.ts";

const SLOTS = slotsFile.slots as { id: SlotId; compatibleCategories: Category[] }[];

const fixture = () =>
  parseCsv(readFileSync("tests/fixtures/showcase_export.sample.csv", "utf8"));

const run = () => convert(fixture(), SLOTS);

const meta = () => ({
  generatedBy: "test",
  updatedAt: "2026-09-06",
  provenance: "test",
});

describe("fuel from the type prefix", () => {
  it.each([
    ["Gas Range", "gas"],
    ["ERange", "electric"],
    ["Electric Cooktop", "electric"],
    ["Induction Range", "induction"],
    ["Dual-Fuel Range", "dual"],
    ["Dishwasher", null],
    ["Hood", null],
  ])("reads %s", (type, expected) => {
    expect(toFuel(type)).toBe(expected);
  });
});

describe("width suffixes", () => {
  it('parses "36 CD" as 36 inches, counter-depth', () => {
    expect(toWidthIn("36 CD")).toBe(36);
    expect(toInstallType("French Door", "Refrigerator", "36 CD")).toContain("counter-depth");
  });

  it("parses a plain width without adding counter-depth", () => {
    expect(toWidthIn("30")).toBe(30);
    expect(toInstallType("French Door", "Refrigerator", "30")).not.toContain("counter-depth");
  });

  it("handles the RD suffix and decimals", () => {
    expect(toWidthIn("35.75 RD")).toBe(35.75);
  });

  it("carries the counter-depth suffix through a full conversion", () => {
    const { appliances } = run();
    const bosch = appliances.find((item) => item.model === "B36CL80SNS")!;
    expect(bosch.widthIn).toBe(36);
    expect(bosch.installType).toContain("counter-depth");
  });
});

describe("skipping rows the scene has no place for", () => {
  it("skips the Washer and counts it", () => {
    const { appliances, summary } = run();
    expect(appliances.some((item) => item.model === "WM4000HWA")).toBe(false);
    expect(summary.skipped.Washer).toBe(1);
  });

  it("counts every other out-of-scene type too", () => {
    const { summary } = run();
    expect(summary.skipped.Dryer).toBe(1);
    expect(summary.skipped.Backguard).toBe(1);
    expect(summary.skipped.Filter).toBe(1);
    // Cooktops and the "other" family are real appliances with no slot in this
    // kitchen. Wall ovens had none either until package B stood a combination
    // oven in a tall tower: `slot-microwave` takes the category now, so those
    // rows are exported rather than counted here.
    expect(summary.skipped["no slot: cooktop"]).toBe(1);
    // The built-in coffee machine has a slot now, in package D.
    expect(summary.skipped["no slot: other"]).toBe(2);
    expect(summary.skipped["no slot: wall-oven"]).toBeUndefined();
  });

  it("accounts for every row it read", () => {
    const { summary } = run();
    const skipped = Object.values(summary.skipped).reduce((a, b) => a + b, 0);
    expect(summary.exported + skipped).toBe(summary.rowsRead);
  });
});

describe("the rest of the normalisation", () => {
  it("title cases shouty brands but leaves known ones alone", () => {
    expect(toBrand("BOSCH")).toBe("Bosch");
    expect(toBrand("BERTAZZONI")).toBe("Bertazzoni");
    expect(toBrand("SUB-ZERO")).toBe("Sub-Zero");
    expect(toBrand("GE")).toBe("GE");
    expect(toBrand("KITCHENAID")).toBe("KitchenAid");
    expect(toBrand("Fisher & Paykel")).toBe("Fisher & Paykel");
  });

  it("folds Panel Ready in from either column and maps Black", () => {
    expect(toFinish("Panel Ready", "")).toEqual(["panel-ready"]);
    expect(toFinish("SS", "Panel Ready")).toEqual(["stainless", "panel-ready"]);
    expect(toFinish("Black", "")).toEqual(["matte-black"]);
    expect(toFinish("", "")).toEqual(["stainless"]);
  });

  it("keeps only the Feature words no other column claimed", () => {
    expect(toHighlights("Slide-In, French Door, Panel Ready, Bottom Freezer")).toEqual([
      "French Door",
      "Bottom Freezer",
    ]);
  });

  it("reads Chimney as a wall mount", () => {
    expect(toInstallType("Chimney, Baffle Filters", "Hood", "36")).toContain("wall-mount");
  });

  it("falls back to freestanding when nothing matches", () => {
    expect(toInstallType("4 Burner", "Gas Range", "30")).toEqual(["freestanding"]);
  });

  it("derives makeup air from CFM at the Title 24 threshold", () => {
    const { appliances } = run();
    const byModel = (model: string) => appliances.find((item) => item.model === model)!;
    expect(byModel("ZSA-E36CS").requires.makeupAirRequired).toBe(true); // 600
    expect(byModel("PRH9-136SS").requires.makeupAirRequired).toBe(false); // 300
    expect(byModel("PM390").requires.makeupAirRequired).toBe(false); // 390
  });

  it("leaves blank dimensions as null rather than zero", () => {
    const { appliances } = run();
    const insert = appliances.find((item) => item.model === "PM390")!;
    expect(insert.heightIn).toBeNull();
    expect(insert.depthIn).toBeNull();
  });
});

describe("the new families, end to end", () => {
  const byModel = (model: string) => {
    const { appliances } = run();
    return appliances.find((item) => item.model === model);
  };

  it.each([
    ["SMD2470AH", "slot-microwave", "drawer"],
    ["CWL112P2RS1", "slot-microwave", "built-in"],
    ["PCG366WL", "slot-range", "rangetop"],
    ["ICBSRT366", "slot-range", "rangetop"],
    ["ICBIC-30R", "slot-fridge", "column"],
    ["PRW24C01CG", "slot-wine", "undercounter"],
    ["VTN2FZ", "slot-hood", "internal"],
    ["T24UR915LS", "slot-fridge", "undercounter"],
    ["RB24S25MKIW1", "slot-fridge", "drawer"],
  ])("%s lands in %s as %s", (model, slot, form) => {
    const appliance = byModel(model);
    expect(appliance?.slot).toBe(slot);
    expect(appliance?.installType).toContain(form);
  });

  it("reads the fuel off a rangetop prefix", () => {
    expect(byModel("PCG366WL")?.fuel).toBe("gas");
    expect(byModel("ICBSRT366")?.fuel).toBe("induction");
  });

  it("keeps appliances with no slot out, and counts them by category", () => {
    const { summary } = run();
    // Ice-maker and warming drawer. The wine cooler has a slot of its own, so do
    // the wall ovens, and so does a built-in coffee machine now that package D
    // has a tall cabinet for one.
    expect(summary.skipped["no slot: other"]).toBe(2);
    expect(byModel("CVA7440")?.category).toBe("coffee");
    expect(byModel("CVA7440")?.slot).toBe("slot-coffee");
  });

  /**
   * A wall oven is not homeless any more.
   *
   * Package B stands a 30" combination oven in a tall tower where A and C put
   * a 24" microwave drawer, so `slot-microwave` accepts the category — and the
   * importer, which reads the slots file rather than a list of its own, stops
   * dropping every wall oven in the sheet. Which of them a package will
   * actually take is a separate question, and `suitsPackageSlot` answers it.
   */
  it("gives a wall oven the slot that takes one", () => {
    const { summary } = run();
    expect(summary.skipped["no slot: wall-oven"]).toBeUndefined();
    for (const model of ["POD301W", "HSLP451UC", "H7880BP", "MEDMCW31JS", "HBL8753UC"]) {
      expect(byModel(model)?.slot, model).toBe("slot-microwave");
    }
    expect(byModel("MEDMCW31JS")?.installType).toContain("combo");
  });
});

describe("the accessory catch-all in a real file", () => {
  it("collects unlisted parts into one bucket", () => {
    const { appliances, summary } = run();
    expect(summary.skipped["accessory-like"]).toBe(2);
    expect(appliances.some((item) => item.model === "ACC-LOUVRE")).toBe(false);
  });
});

describe("blowers have no width, and do not need one", () => {
  const blower = () => run().appliances.find((item) => item.model === "VTN2FZ");

  it("exports a blower whose Width cell is empty", () => {
    expect(blower()).toBeDefined();
    expect(blower()?.widthIn).toBeNull();
    expect(blower()?.category).toBe("blower");
  });

  it("does not count it against the no-width bucket", () => {
    const { summary } = run();
    expect(summary.noWidthModels).not.toContain("Thermador VTN2FZ");
  });

  // The exemption is for blowers only: anything that goes in an opening still
  // needs a width, or the fit check has nothing to work with.
  it("still skips a real appliance with no width", () => {
    const { summary, appliances } = run();
    expect(summary.noWidthModels).toContain("Bosch SHX78CM5N");
    expect(appliances.some((item) => item.model === "SHX78CM5N")).toBe(false);
  });

  it("rejects a non-blower with a null width at the schema", () => {
    const rows = fixture();
    const dishwasher = rows.find((r) => r.Model === "G5892SCVI")!;
    const asBlower = { ...blower()!, category: "dishwasher" as const };
    expect(dishwasher).toBeDefined();
    expect(() =>
      parseDataFile(
        appliancesFileSchema,
        { _meta: meta(), appliances: [asBlower] },
        "test",
      ),
    ).toThrow(/widthIn/);
  });
});

describe("rows with no usable width", () => {
  it("skips them into one bucket rather than one line each", () => {
    const { appliances, summary } = run();
    expect(summary.skipped["no width"]).toBe(1);
    expect(summary.noWidthModels).toEqual(["Bosch SHX78CM5N"]);
    expect(appliances.some((item) => item.model === "SHX78CM5N")).toBe(false);
  });

  it("names them only under verbose", () => {
    const { summary } = run();
    expect(formatSummary(summary)).not.toMatch(/SHX78CM5N/);
    expect(formatSummary(summary, true)).toMatch(/SHX78CM5N/);
  });

  it("does not fail the import over it", () => {
    expect(() => run()).not.toThrow();
  });
});

describe("the converted file", () => {
  it("passes the schema the app loads", () => {
    const { appliances } = run();
    expect(() =>
      parseDataFile(
        appliancesFileSchema,
        {
          _meta: { generatedBy: "test", updatedAt: "2026-09-05", provenance: "test" },
          appliances,
        },
        "test",
      ),
    ).not.toThrow();
  });

  it("counts rows with no sourceUrl instead of failing them", () => {
    const before = run().summary.warnings["no sourceUrl"]?.length ?? 0;
    const rows = fixture();
    rows[0].sourceUrl = "";
    const { summary } = convert(rows, SLOTS);
    expect(summary.warnings["no sourceUrl"]).toHaveLength(before + 1);
    expect(summary.warnings["no sourceUrl"]).toContain("bosch-b36cl80sns");
    // Counted by default, listed only when asked.
    expect(formatSummary(summary)).not.toMatch(/bosch-b36cl80sns/);
    expect(formatSummary(summary, true)).toMatch(/bosch-b36cl80sns/);
  });
});

describe("CSV parsing", () => {
  it("keeps commas inside quoted cells", () => {
    const rows = parseCsv('Brand,Feature\nBOSCH,"French Door, Bottom Freezer"\n');
    expect(rows[0].Feature).toBe("French Door, Bottom Freezer");
  });

  it("handles escaped quotes and a BOM", () => {
    const rows = parseCsv('﻿Brand,Model\nSUB-ZERO,"36"" Column"\n');
    expect(rows[0].Model).toBe('36" Column');
  });
});
