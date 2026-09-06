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

/**
 * Appliance Type values that are deliberately out of scene.
 *
 * Compared exactly, case-insensitively. Laundry, then the long tail of parts
 * and accessories the inventory carries alongside the machines, then the
 * non-products (warranties, payment codes) the sheet uses as line items.
 */
export const SKIPPED_TYPES = [
  // laundry
  "Washer",
  "Dryer",
  "E Dryer",
  "Gas Dryer",
  "Stacked Gas Dryer",
  "Laundry Center",
  "Washer Dryer Combo",
  "Pedestal Washer",
  "Pedestal",
  "Steam Clothing Care System",
  "Stacking Kit",
  // trim, panels and fittings
  "Accessory",
  "Trim Kit",
  "Toekick",
  "Backguard",
  "Knob",
  "Handle",
  "Griddle",
  "Wok Ring",
  "Backsplash",
  "Duct Cover",
  "Transition",
  "Recirculating Kit",
  "Baffle Filter",
  "Blower",
  "Decorative Plate",
  "Handle for DW",
  "Handle for Refrigerator",
  "Door Panel",
  "Door Panel for Built-In Fridge",
  "Refrigerator Kit",
  "Built-In Refrigerator Mounting Kit",
  "Dishwasher Panel Mounting Kit",
  "Dishwasher Set",
  "Cafe Range Kit",
  "Mounting Plate",
  "Microwave Mounting Kit",
  // consumables and spares
  "Filter",
  "Water Filter",
  "Refrigerator Air Filter",
  "Microwave Charcoal Filter",
  "Ice-Maker Kit",
  "Power Adapter",
  "Propane Conversion Kit",
  "Remote Control",
  // plumbing and other departments
  "Sink",
  "Faucet",
  "Disposer",
  "Bottom Grid For Sink",
  "Sink Accessories",
  "Vacuums",
  "Vacuums Accessory",
  "Grill Base",
  "Grill Cover",
  "Warming Shelf",
  "Accessory for Wine Column",
  // not products at all
  "Extension Warranty",
  "Shine Pay",
  "CON",
] as const;

/** The summary key for the catch-all accessory bucket. */
export const ACCESSORY_LIKE = "accessory-like";

/**
 * Catch-all for the parts nobody has listed by name yet.
 *
 * Deliberately matched *after* the exact tables, so a real appliance whose name
 * happens to contain one of these words is classified on its own terms first.
 * Word boundaries rather than substrings, so "Kit" cannot swallow a "Kitchen"
 * anything.
 */
const ACCESSORY_LIKE_PATTERN = /\b(kits?|panels?|handles?|covers?|filters?|accessor\w*)\b/i;

/**
 * Appliance Type to category.
 *
 * Ordered: the first matching rule wins. The `*Range`, `*Rangetop` and
 * `*Cooktop` suffixes catch every fuel prefix without a row per combination;
 * everything else is anchored, so a part named after an appliance ("Refrigerator
 * Kit", "Handle for Refrigerator") cannot be mistaken for one.
 */
const CATEGORY_RULES: { match: (type: string) => boolean; category: Category }[] = [
  // Ovens. The combo list is explicit because "Countertop Combo Oven" is a
  // benchtop appliance, not something that goes in a tall tower.
  { match: (t) => /^(wall|speed|steam)\s+oven$/i.test(t), category: "wall-oven" },
  { match: (t) => /^(single|double)\s+oven$/i.test(t), category: "wall-oven" },
  { match: (t) => /^steam\s+double\s+oven$/i.test(t), category: "wall-oven" },
  {
    match: (t) => /^(speed|microwave|steam|triple)\s+combo\s+oven$/i.test(t),
    category: "wall-oven",
  },

  // Microwaves, including the ones that name their install form.
  { match: (t) => /^(otr|microwave)$/i.test(t), category: "microwave" },
  {
    match: (t) => /^(microwave\s+drawer|built-in\s+microwave|countertop\s+microwave)$/i.test(t),
    category: "microwave",
  },

  // Ranges and rangetops. A rangetop is a range without the oven, but it takes
  // the same slot and the same rough-in, so it lands in the same category.
  { match: (t) => /range$/i.test(t), category: "range" },
  { match: (t) => /rangetop$/i.test(t), category: "range" },

  { match: (t) => /cooktop$/i.test(t), category: "cooktop" },

  // Refrigeration.
  { match: (t) => /^(built-in\s+)?refrigerator$/i.test(t), category: "refrigerator" },
  { match: (t) => /^refrigerator\s+(column|drawer)$/i.test(t), category: "refrigerator" },
  { match: (t) => /^undercounter\s+refrigerator$/i.test(t), category: "refrigerator" },
  { match: (t) => /^all\s+(refrigerator|freezer)$/i.test(t), category: "refrigerator" },

  { match: (t) => /^dishwasher$/i.test(t), category: "dishwasher" },
  { match: (t) => /hood$/i.test(t), category: "hood" },

  // Real appliances with no slot in this kitchen. They are classified rather
  // than skipped, so the summary says "no slot" rather than pretending they are
  // not appliances.
  { match: (t) => /^(wine|beverage|freezer)/i.test(t), category: "other" },
  { match: (t) => /^warming\s+drawer$/i.test(t), category: "other" },
  { match: (t) => /^(built-in|countertop)\s+coffee\s+machine$/i.test(t), category: "other" },
  { match: (t) => /^countertop\s+combo\s+oven$/i.test(t), category: "other" },
  { match: (t) => /^ice-?\s?maker$/i.test(t), category: "other" },
  { match: (t) => /^trash\s+compactor$/i.test(t), category: "other" },
];

/** The summary key for rows the sheet left unclassified. */
export const BLANK_TYPE = "blank type";

export interface UnknownType {
  type: string;
  row: number;
  brand: string;
  model: string;
}

export class UnknownApplianceTypeError extends Error {
  // Plain fields, not parameter properties: Node runs this file directly and
  // its strip-only TypeScript mode cannot compile that shorthand.
  unknowns: UnknownType[];

  constructor(unknowns: UnknownType[]) {
    const list = unknowns
      .map(
        ({ row, type, brand, model }) =>
          `  row ${row}: ${JSON.stringify(type)} (${brand} ${model})`,
      )
      .join("\n");
    super(
      `${unknowns.length} unrecognised Appliance Type value(s):\n${list}\n` +
        `Add a rule to scripts/normalise.ts, or add the value to SKIPPED_TYPES, ` +
        `rather than letting the rows through.`,
    );
    this.name = "UnknownApplianceTypeError";
    this.unknowns = unknowns;
  }
}

export type Classification =
  | { kind: "category"; category: Category }
  | { kind: "skip"; reason: string }
  | { kind: "unknown" };

/**
 * Classify an Appliance Type.
 *
 * Three outcomes, and the difference between the last two is the whole point:
 *
 * - a category, for a row that belongs in the scene;
 * - a skip, for a row that deliberately does not — an accessory, a laundry
 *   machine, or a blank type, which in this sheet means the model has almost
 *   certainly been discontinued;
 * - unknown, for a value nobody has classified. The caller collects these and
 *   fails the whole import, because a silent skip would shrink the catalogue
 *   and nobody would spot the missing model until a customer asked for it.
 */
export function classify(type: string): Classification {
  const value = type.trim();

  // A blank type is a data signal, not a gap in this table: discontinued stock
  // loses its type in Stock current. Skip it, but say which models so Leo can
  // confirm rather than take it on trust.
  if (!value) return { kind: "skip", reason: BLANK_TYPE };

  if (/^outdoor/i.test(value)) return { kind: "skip", reason: value };

  // Exact tables first, both of them, so a part named after an appliance is
  // decided by name and a real appliance is never swallowed by the catch-all.
  const listed = SKIPPED_TYPES.find(
    (skipped) => skipped.toLowerCase() === value.toLowerCase(),
  );
  if (listed) return { kind: "skip", reason: listed };

  for (const rule of CATEGORY_RULES) {
    if (rule.match(value)) return { kind: "category", category: rule.category };
  }

  // Only now the catch-all, for the parts nobody has listed yet.
  if (ACCESSORY_LIKE_PATTERN.test(value)) {
    return { kind: "skip", reason: ACCESSORY_LIKE };
  }

  return { kind: "unknown" };
}

/** Fuel from the Appliance Type prefix. Anything else has no fuel of its own. */
export function toFuel(type: string): Fuel | null {
  const value = type.trim();
  if (/^dual[- ]fuel\b/i.test(value)) return "dual";
  if (/^induction\b/i.test(value)) return "induction";
  if (/^gas\b/i.test(value)) return "gas";
  // The sheet abbreviates the fuel on rangetops: "G Rangetop".
  if (/^G\s/.test(value)) return "gas";
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
  { pattern: /\bcountertop\b/i, value: "countertop" },
  { pattern: /\bundercounter\b/i, value: "undercounter" },
  { pattern: /\brangetop\b/i, value: "rangetop" },
];

export function toInstallType(
  feature: string,
  type: string,
  width: string,
  depth = "",
): string[] {
  const found: string[] = [];
  // Both columns carry install form. The Appliance Type names it directly for
  // the families that come in several ("Single Oven", "Microwave Drawer",
  // "Refrigerator Column"); the Feature column names it for the rest.
  const words = `${feature} ${type}`;
  for (const { pattern, value } of INSTALL_WORDS) {
    if (pattern.test(words) && !found.includes(value)) found.push(value);
  }
  if (/\bbuilt[- ]in\b/i.test(type) && !found.includes("built-in")) found.push("built-in");
  // Counter-depth is written either as a Width suffix ("36 CD") or as the whole
  // Depth cell ("CD"), depending on who entered the row.
  const counterDepth = /\bCD\b/i.test(width) || /\bCD\b/i.test(depth);
  if (counterDepth && !found.includes("counter-depth")) found.push("counter-depth");

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
  return toDimension(width.replace(/\b(CD|RD)\b/gi, ""));
}

/** `33-7/8`, `33 7/8`, or a bare `7/8`. */
const FRACTIONAL = /^(?:(\d+(?:\.\d+)?)\s*[-\s]\s*)?(\d+)\s*\/\s*(\d+)$/;
const DECIMAL = /^(\d+(?:\.\d+)?)$/;

/**
 * A dimension cell, in inches.
 *
 * Spec sheets mix decimals and fractions, and the sheet carries both as typed:
 * `33.875`, `33-7/8` and `33 7/8` are the same measurement. Anything with no
 * number in it at all — blank, or a bare `CD` in the Depth column — is null
 * rather than zero, so a missing dimension stays visibly missing.
 */
export function toDimension(value: string): number | null {
  // Drop inch marks and any trailing suffix words before parsing.
  const trimmed = (value ?? "").replace(/["″]/g, "").trim();
  if (!trimmed) return null;

  const fraction = FRACTIONAL.exec(trimmed);
  if (fraction) {
    const [, whole, numerator, denominator] = fraction;
    if (Number(denominator) === 0) return null;
    return (whole ? Number(whole) : 0) + Number(numerator) / Number(denominator);
  }

  const decimal = DECIMAL.exec(trimmed);
  if (decimal) return Number(decimal[1]);

  // Fall back to the first number in a cell that carries extra words.
  const loose = /(\d+(?:\.\d+)?)/.exec(trimmed);
  return loose ? Number(loose[1]) : null;
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
