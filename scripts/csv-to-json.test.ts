import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import slotsFile from "../data/slots.json";
import { convert, parseCsv } from "./csv-to-json.ts";
import {
  SKIPPED_TYPES,
  UnknownApplianceTypeError,
  toBrand,
  toCategory,
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

describe("Appliance Type mapping", () => {
  // Every value the spec lists, so a rule cannot quietly stop matching.
  const cases: [string, Category | null][] = [
    ["Gas Range", "range"],
    ["Induction Range", "range"],
    ["Dual-Fuel Range", "range"],
    ["ERange", "range"],
    ["Gas Cooktop", "cooktop"],
    ["Induction Cooktop", "cooktop"],
    ["Refrigerator", "refrigerator"],
    ["Built-In Refrigerator", "refrigerator"],
    ["Dishwasher", "dishwasher"],
    ["Hood", "hood"],
    ["OTR", "microwave"],
    ["Microwave", "microwave"],
    ["Wall Oven", "wall-oven"],
    ["Speed Oven", "wall-oven"],
    ["Steam Oven", "wall-oven"],
    ["Wine Cooler", "other"],
    ["Beverage Center", "other"],
    ["Freezer", "other"],
    ["Outdoor Grill", null],
    ["Outdoor Refrigerator", null],
  ];

  it.each(cases)("maps %s", (type, expected) => {
    expect(toCategory(type)).toBe(expected);
  });

  it.each(SKIPPED_TYPES.map((type) => [type]))("skips %s", (type) => {
    expect(toCategory(type)).toBeNull();
  });

  it("throws on an Appliance Type it has never seen", () => {
    expect(() => toCategory("Sous Vide Circulator", 7)).toThrow(UnknownApplianceTypeError);
    expect(() => toCategory("Sous Vide Circulator", 7)).toThrow(/row 7/);
  });

  it("throws rather than silently dropping a blank type", () => {
    expect(() => toCategory("", 3)).toThrow(UnknownApplianceTypeError);
  });
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
    // Cooktops and wine coolers are real appliances with no slot in this scene.
    expect(summary.skipped["no slot: cooktop"]).toBe(1);
    expect(summary.skipped["no slot: other"]).toBe(1);
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

  it("warns about rows with no sourceUrl instead of failing them", () => {
    const rows = fixture();
    rows[0].sourceUrl = "";
    const { summary } = convert(rows, SLOTS);
    expect(summary.warnings.some((w) => w.includes("no sourceUrl"))).toBe(true);
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
