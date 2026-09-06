/**
 * Normalisation rules for the `showcase_export` tab.
 *
 * The inventory sheet is the system of record for a shop, not for this app, so
 * its raw columns are left exactly as they are and every bit of cleaning lives
 * here. That means a change to the rules is a code review and a test run, not
 * a silent edit to a formula in a spreadsheet.
 *
 * See docs/data-sheet-spec.md for the column-by-column mapping.
 */

import type { Category, Finish, Fuel, SlotId } from "../src/types.ts";

export interface RawRow {
  Brand: string;
  Model: string;
  "Appliance Type": string;
  Feature: string;
  Width: string;
  Depth: string;
  Height: string;
  Color: string;
  // Hand-filled columns to the right of the QUERY output.
  cutoutWidthIn: string;
  cutoutHeightIn: string;
  cutoutDepthIn: string;
  gasBTU: string;
  voltage: string;
  amps: string;
  cfm: string;
  water: string;
  makeupAirRequired: string;
  msrpUSD: string;
  leadTimeWeeks: string;
  sourceUrl: string;
  verifiedAt: string;
}

/** Appliance Type values that are real appliances but not part of this scene. */
export const SKIPPED_TYPES = [
  "Washer",
  "Dryer",
  "Backguard",
  "Handle",
  "Filter",
  "Blower",
  "Pedestal",
] as const;

/**
 * Appliance Type to category.
 *
 * Ordered: the first matching rule wins, so the `*Range` and `*Cooktop`
 * suffixes catch every fuel prefix without needing a row per combination.
 */
const CATEGORY_RULES: { match: (type: string) => boolean; category: Category }[] = [
  { match: (t) => /range$/i.test(t), category: "range" },
  { match: (t) => /cooktop$/i.test(t), category: "cooktop" },
  { match: (t) => /^(built-in\s+)?refrigerator$/i.test(t), category: "refrigerator" },
  { match: (t) => /^dishwasher$/i.test(t), category: "dishwasher" },
  { match: (t) => /hood$/i.test(t), category: "hood" },
  { match: (t) => /^(otr|microwave)$/i.test(t), category: "microwave" },
  { match: (t) => /^(wall|speed|steam)\s+oven$/i.test(t), category: "wall-oven" },
  { match: (t) => /^(wine|beverage|freezer)/i.test(t), category: "other" },
];

export class UnknownApplianceTypeError extends Error {
  // Plain fields, not parameter properties: Node runs this file directly and
  // its strip-only TypeScript mode cannot compile that shorthand.
  value: string;
  row: number;

  constructor(value: string, row: number) {
    super(
      `row ${row}: unrecognised Appliance Type ${JSON.stringify(value)}. ` +
        `Add a rule to scripts/normalise.ts rather than letting the row through.`,
    );
    this.name = "UnknownApplianceTypeError";
    this.value = value;
    this.row = row;
  }
}

/**
 * Classify an Appliance Type.
 *
 * Returns null for the types this scene deliberately ignores. An unrecognised
 * value throws: silently dropping it would quietly shrink the catalogue and
 * nobody would notice until a model went missing from the picker.
 */
export function toCategory(type: string, row = 0): Category | null {
  const value = type.trim();
  if (!value) throw new UnknownApplianceTypeError(type, row);

  if (/^outdoor/i.test(value)) return null;
  if (SKIPPED_TYPES.some((skipped) => new RegExp(`^${skipped}$`, "i").test(value))) {
    return null;
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.match(value)) return rule.category;
  }
  throw new UnknownApplianceTypeError(type, row);
}

/** Fuel from the Appliance Type prefix. Anything else has no fuel of its own. */
export function toFuel(type: string): Fuel | null {
  const value = type.trim();
  if (/^dual[- ]fuel\b/i.test(value)) return "dual";
  if (/^induction\b/i.test(value)) return "induction";
  if (/^gas\b/i.test(value)) return "gas";
  // "Electric Cooktop", "E Range", and the sheet's compact "ERange".
  if (/^electric\b/i.test(value)) return "electric";
  if (/^E\s/.test(value) || /^E(?=[A-Z])/.test(value)) return "electric";
  return null;
}

/**
 * Install form, gathered from three places: the words the Feature column uses,
 * "Built-In" in the type, and a CD suffix on the width.
 */
const INSTALL_WORDS: { pattern: RegExp; value: string }[] = [
  { pattern: /\bslide[- ]in\b/i, value: "slide-in" },
  { pattern: /\bunder[- ]cabinet\b/i, value: "under-cabinet" },
  { pattern: /\bchimney\b/i, value: "wall-mount" },
  { pattern: /\binsert\b/i, value: "insert" },
  { pattern: /\bisland\b/i, value: "island" },
  { pattern: /\bdowndraft\b/i, value: "downdraft" },
  { pattern: /\bcolumn\b/i, value: "column" },
  { pattern: /\bdrawer\b/i, value: "drawer" },
  { pattern: /\bsingle\b/i, value: "single" },
  { pattern: /\bdouble\b/i, value: "double" },
  { pattern: /\bcombo\b/i, value: "combo" },
];

export function toInstallType(feature: string, type: string, width: string): string[] {
  const found: string[] = [];
  for (const { pattern, value } of INSTALL_WORDS) {
    if (pattern.test(feature) && !found.includes(value)) found.push(value);
  }
  if (/\bbuilt[- ]in\b/i.test(type) && !found.includes("built-in")) found.push("built-in");
  if (/\bCD\b/i.test(width) && !found.includes("counter-depth")) found.push("counter-depth");

  return found.length > 0 ? found : ["freestanding"];
}

/**
 * Finishes, from the Color column plus any "Panel Ready" in Feature.
 *
 * The Sheet says "Black"; the scene's palette calls that finish matte-black,
 * which is the only one it knows how to render.
 */
export function toFinish(color: string, feature: string): Finish[] {
  const found: Finish[] = [];
  const add = (finish: Finish) => {
    if (!found.includes(finish)) found.push(finish);
  };

  const value = color.trim();
  if (/\bss\b|stainless/i.test(value)) add("stainless");
  if (/panel[- ]ready/i.test(value) || /panel[- ]ready/i.test(feature)) add("panel-ready");
  if (/\bwhite\b/i.test(value)) add("white");
  if (/\bblack\b/i.test(value)) add("matte-black");

  // Every row needs at least one finish to render; stainless is the shop default.
  return found.length > 0 ? found : ["stainless"];
}

/** Feature words that are captured elsewhere and should not become highlights. */
const CONSUMED_BY_OTHER_COLUMNS =
  /\b(slide[- ]in|under[- ]cabinet|chimney|insert|island|downdraft|column|drawer|single|double|combo|panel[- ]ready|built[- ]in)\b/i;

/** Whatever the Feature column has left once install form and finish are taken. */
export function toHighlights(feature: string): string[] {
  return feature
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !CONSUMED_BY_OTHER_COLUMNS.test(part));
}

/** Width carries a CD (counter-depth) or RD (rear-depth) suffix in the sheet. */
export function toWidthIn(width: string): number | null {
  const match = /(\d+(?:\.\d+)?)/.exec(width.replace(/\b(CD|RD)\b/gi, ""));
  return match ? Number(match[1]) : null;
}

/** A dimension cell, which is routinely blank. */
export function toDimension(value: string): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const match = /(-?\d+(?:\.\d+)?)/.exec(trimmed);
  return match ? Number(match[1]) : null;
}

export function toBoolean(value: string): boolean {
  return /^(true|yes|y|1)$/i.test(value?.trim() ?? "");
}

/**
 * Brands arrive in whatever case the vendor invoice used.
 *
 * Known brands win outright, because title casing would turn GE into "Ge" and
 * KitchenAid into "Kitchenaid". Otherwise an all-caps name gets title cased and
 * anything already mixed case is left alone, on the assumption it was typed
 * deliberately.
 */
const KNOWN_BRANDS = [
  "GE",
  "GE Profile",
  "Café",
  "JennAir",
  "KitchenAid",
  "BlueStar",
  "Sub-Zero",
  "Vent-A-Hood",
  "LG",
  "U-Line",
  "Bosch",
  "Thermador",
  "Bertazzoni",
  "Miele",
  "Fisher & Paykel",
  "Zephyr",
  "Broan",
  "Sharp",
  "Whirlpool",
  "Samsung",
  "Frigidaire",
  "Monogram",
  "Dacor",
  "Wolf",
  "Viking",
  "SMEG",
];

export function toBrand(brand: string): string {
  const value = brand.trim().replace(/\s+/g, " ");
  const known = KNOWN_BRANDS.find((candidate) => candidate.toLowerCase() === value.toLowerCase());
  if (known) return known;
  if (value === value.toUpperCase()) {
    return value
      .toLowerCase()
      .split(" ")
      .map((word) =>
        word
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("-"),
      )
      .join(" ");
  }
  return value;
}

/** A stable id from brand and model, which together identify a SKU. */
export function toId(brand: string, model: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `${slug(brand)}-${slug(model)}`;
}

/**
 * Which slot a category belongs to, derived from the slots file so the two
 * cannot drift. A category no slot accepts means the row is out of scene.
 */
export function slotForCategory(
  category: Category,
  slots: { id: SlotId; compatibleCategories: Category[] }[],
): SlotId | null {
  const slot = slots.find((candidate) => candidate.compatibleCategories.includes(category));
  return slot ? slot.id : null;
}
