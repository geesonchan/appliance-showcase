import { describe, expect, it } from "vitest";
import {
  ACCESSORY_LIKE,
  BLANK_TYPE,
  SKIPPED_TYPES,
  classify,
  toFuel,
  toInstallType,
} from "./normalise.ts";
import type { Category } from "../src/types.ts";

/** The category a type maps to, or null when the row is deliberately skipped. */
const categoryOf = (type: string) => {
  const result = classify(type);
  return result.kind === "category" ? result.category : null;
};

const skipReason = (type: string) => {
  const result = classify(type);
  return result.kind === "skip" ? result.reason : null;
};

/**
 * Every Appliance Type value the 4,703-row census turned up, one case each.
 * The table is the specification: if a value is not here, nobody has decided
 * what it is, and the import will refuse the file rather than guess.
 */
describe("category mapping", () => {
  const cases: [string, Category | null][] = [
    // ranges and rangetops
    ["Gas Range", "range"],
    ["ERange", "range"],
    ["Induction Range", "range"],
    ["Dual-Fuel Range", "range"],
    ["G Rangetop", "range"],
    ["Induction Rangetop", "range"],
    // cooktops
    ["Gas Cooktop", "cooktop"],
    ["Induction Cooktop", "cooktop"],
    // ovens
    ["Wall Oven", "wall-oven"],
    ["Single Oven", "wall-oven"],
    ["Double Oven", "wall-oven"],
    ["Speed Oven", "wall-oven"],
    ["Steam Oven", "wall-oven"],
    ["Speed Combo Oven", "wall-oven"],
    ["Microwave Combo Oven", "wall-oven"],
    ["Steam Combo Oven", "wall-oven"],
    ["Triple Combo Oven", "wall-oven"],
    ["Steam Double Oven", "wall-oven"],
    // microwaves
    ["OTR", "microwave"],
    ["Microwave", "microwave"],
    ["Microwave Drawer", "microwave"],
    ["Built-In Microwave", "microwave"],
    ["Countertop Microwave", "microwave"],
    // refrigeration
    ["Refrigerator", "refrigerator"],
    ["Built-In Refrigerator", "refrigerator"],
    ["Refrigerator Column", "refrigerator"],
    ["Undercounter Refrigerator", "refrigerator"],
    ["Refrigerator Drawer", "refrigerator"],
    ["All Refrigerator", "refrigerator"],
    ["All Freezer", "refrigerator"],
    // the rest
    ["Dishwasher", "dishwasher"],
    ["Hood", "hood"],
    ["Wine Cooler", "wine"],
    ["Wine Reserve", "wine"],
    ["Wine Column", "wine"],
    ["Blower", "blower"],
    ["Beverage Center", "other"],
    ["Freezer", "other"],
    ["Warming Drawer", "other"],
    ["Built-In Coffee Machine", "other"],
    ["Countertop Coffee Machine", "other"],
    ["Countertop Combo Oven", "other"],
    ["Ice-Maker", "other"],
    ["Trash Compactor", "other"],
    // skipped
    ["Outdoor Grill", null],
    ["Outdoor Refrigerator", null],
  ];

  it.each(cases)("maps %s", (type, expected) => {
    expect(categoryOf(type)).toBe(expected);
  });

  it.each(SKIPPED_TYPES.map((type) => [type]))("skips %s by name", (type) => {
    expect(classify(type)).toEqual({ kind: "skip", reason: type });
  });
});

/**
 * The pairs that would collide if the rules were less specific. Each of these
 * is a real value from the census that sits one word away from a different
 * answer.
 */
describe("near misses", () => {
  it("keeps benchtop combo ovens out of the tall tower", () => {
    expect(categoryOf("Speed Combo Oven")).toBe("wall-oven");
    expect(categoryOf("Countertop Combo Oven")).toBe("other");
  });

  it("separates countertop microwaves from countertop coffee machines", () => {
    expect(categoryOf("Countertop Microwave")).toBe("microwave");
    expect(categoryOf("Countertop Coffee Machine")).toBe("other");
  });

  it("separates the three kinds of drawer", () => {
    expect(categoryOf("Microwave Drawer")).toBe("microwave");
    expect(categoryOf("Refrigerator Drawer")).toBe("refrigerator");
    expect(categoryOf("Warming Drawer")).toBe("other");
  });

  // Wine has its own island slot; a blower is a hood accessory, not a part.
  it("gives wine and blowers their own categories", () => {
    expect(categoryOf("Wine Column")).toBe("wine");
    expect(categoryOf("Blower")).toBe("blower");
    // The accessory for a wine column is still an accessory.
    expect(skipReason("Accessory for Wine Column")).toBe("Accessory for Wine Column");
  });

  it("distinguishes All Freezer from a plain Freezer", () => {
    expect(categoryOf("All Freezer")).toBe("refrigerator");
    expect(categoryOf("Freezer")).toBe("other");
  });

  it("does not mistake a rangetop for a range or a cooktop", () => {
    expect(categoryOf("G Rangetop")).toBe("range");
    expect(toFuel("G Rangetop")).toBe("gas");
    expect(toFuel("Induction Rangetop")).toBe("induction");
  });

  // Anchored patterns, so a part named after an appliance stays a part.
  it("keeps parts named after appliances out of the catalogue", () => {
    expect(categoryOf("Refrigerator Kit")).toBeNull();
    expect(categoryOf("Handle for Refrigerator")).toBeNull();
    expect(categoryOf("Dishwasher Panel Mounting Kit")).toBeNull();
    expect(categoryOf("Microwave Mounting Kit")).toBeNull();
    expect(categoryOf("Cafe Range Kit")).toBeNull();
  });
});

describe("install form from the Appliance Type", () => {
  const formOf = (type: string) => toInstallType("", type, "");

  it.each([
    ["Single Oven", "single"],
    ["Double Oven", "double"],
    ["Steam Double Oven", "double"],
    ["Speed Combo Oven", "combo"],
    ["Microwave Combo Oven", "combo"],
    ["Steam Combo Oven", "combo"],
    ["Triple Combo Oven", "combo"],
    ["Microwave Drawer", "drawer"],
    ["Built-In Microwave", "built-in"],
    ["Countertop Microwave", "countertop"],
    ["G Rangetop", "rangetop"],
    ["Induction Rangetop", "rangetop"],
    ["Refrigerator Column", "column"],
    ["Wine Column", "column"],
    ["Undercounter Refrigerator", "undercounter"],
    ["Refrigerator Drawer", "drawer"],
  ])("reads %s as %s", (type, expected) => {
    expect(formOf(type)).toContain(expected);
  });

  it.each([
    ["Internal", "internal"],
    ["Inline", "inline"],
    ["External", "external"],
  ])("reads a %s blower mounting", (feature, expected) => {
    expect(toInstallType(feature, "Blower", "")).toContain(expected);
  });

  it("still reads the Feature column, and still falls back", () => {
    expect(toInstallType("Slide-In, 4 Burner", "Gas Range", "30")).toEqual(["slide-in"]);
    expect(toInstallType("4 Burner", "Gas Range", "30")).toEqual(["freestanding"]);
  });
});

describe("the accessory catch-all", () => {
  it("catches parts nobody has listed yet", () => {
    for (const type of [
      "Some New Kit",
      "Louvre Panel",
      "Left Handle",
      "Chimney Cover",
      "Grease Filter",
      "Oven Accessory",
      "Range Accessories",
    ]) {
      expect(skipReason(type), type).toBe(ACCESSORY_LIKE);
    }
  });

  // It runs after the exact tables, so listed parts keep their own count and
  // real appliances are never swallowed.
  it("does not override a name that is already decided", () => {
    expect(skipReason("Water Filter")).toBe("Water Filter");
    expect(skipReason("Trim Kit")).toBe("Trim Kit");
    expect(categoryOf("Refrigerator Column")).toBe("refrigerator");
  });

  it("does not fire on a word that merely starts the same way", () => {
    expect(classify("Kitchen Hood")).toEqual({ kind: "category", category: "hood" });
  });
});

describe("blank and unrecognised", () => {
  it("treats a blank type as discontinued stock", () => {
    expect(classify("")).toEqual({ kind: "skip", reason: BLANK_TYPE });
    expect(classify("   ")).toEqual({ kind: "skip", reason: BLANK_TYPE });
  });

  it("reports anything else as unknown", () => {
    expect(classify("Sous Vide Circulator")).toEqual({ kind: "unknown" });
  });
});
