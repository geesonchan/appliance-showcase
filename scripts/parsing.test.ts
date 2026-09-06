import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import slotsFile from "../data/slots.json";
import { convert, parseCsv } from "./csv-to-json.ts";
import { toDimension, toHighlights, toInstallType, toWidthIn } from "./normalise.ts";
import type { Category, SlotId } from "../src/types.ts";

const SLOTS = slotsFile.slots as { id: SlotId; compatibleCategories: Category[] }[];
const run = () =>
  convert(
    parseCsv(readFileSync("tests/fixtures/showcase_export.sample.csv", "utf8")),
    SLOTS,
  );
const byModel = (model: string) => run().appliances.find((item) => item.model === model);

describe("inch fractions", () => {
  it.each([
    ["33-7/8", 33.875],
    ["33 7/8", 33.875],
    ["33.875", 33.875],
    ["36", 36],
    ["7/8", 0.875],
    ['33-7/8"', 33.875],
    ["68-5/8", 68.625],
  ])("reads %s as %s", (input, expected) => {
    expect(toDimension(input)).toBe(expected);
  });

  it("is still null for a cell with no number in it", () => {
    expect(toDimension("")).toBeNull();
    expect(toDimension("CD")).toBeNull();
    expect(toDimension("   ")).toBeNull();
  });

  it("reads a fractional width with a suffix", () => {
    expect(toWidthIn("35-3/4 CD")).toBe(35.75);
  });

  it("carries fractions through a conversion", () => {
    expect(byModel("PRD48WCSHU")?.heightIn).toBe(36.375);
    expect(byModel("JBRFR36IGX")?.heightIn).toBe(83.875);
    expect(byModel("REF36PIXR")?.heightIn).toBe(68.625);
  });
});

describe("a Depth column carrying CD", () => {
  it("reads it as counter-depth, not as a dimension", () => {
    expect(toInstallType("French Door", "Built-In Refrigerator", "36", "CD")).toContain(
      "counter-depth",
    );
    expect(toDimension("CD")).toBeNull();
  });

  it("carries through a conversion with a null depth", () => {
    const fridge = byModel("JBRFR36IGX");
    expect(fridge?.installType).toContain("counter-depth");
    expect(fridge?.depthIn).toBeNull();
  });
});

describe("empty cells", () => {
  it("leaves a blank price null rather than zero", () => {
    expect(byModel("PRD48WCSHU")?.msrpUSD).toBeNull();
  });

  // Zero in the inventory means nobody has set a price, not that it is free.
  it("treats a zero price as no price", () => {
    expect(byModel("REF36PIXR")?.msrpUSD).toBeNull();
  });

  it("leaves a blank sourceUrl null rather than an empty string", () => {
    expect(byModel("PRD48WCSHU")?.sourceUrl).toBeNull();
  });

  it("counts the missing values as warnings rather than failing", () => {
    const { summary } = run();
    expect(summary.warnings["no msrpUSD"]).toHaveLength(2);
    expect(summary.warnings["no sourceUrl"]).toHaveLength(1);
  });
});

describe("Feature words that are not install form", () => {
  it("keeps Bar Handle as a highlight", () => {
    expect(toHighlights("Slide-In, Bar Handle")).toEqual(["Bar Handle"]);
    expect(byModel("PRD48WCSHU")?.highlights.en).toContain("Bar Handle");
  });

  it("does not read it as an install form", () => {
    expect(toInstallType("Bar Handle", "Gas Range", "30")).toEqual(["freestanding"]);
  });
});
