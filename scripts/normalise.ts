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
  /** Hoods only: "integrated" or "required". */
  blower: string;
  /** Optional: the flat top of a wedge canopy, where the duct comes off. */
  topDepthIn: string;
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
  // Most high-end hoods ship without one. See docs/decisions.md D6.
  { match: (t) => /^blower$/i.test(t), category: "blower" },

  // Real appliances with no slot in this kitchen. They are classified rather
  // than skipped, so the summary says "no slot" rather than pretending they are
  // not appliances.
  // Wine gets its own category: the island has a slot that takes only wine.
  { match: (t) => /^wine/i.test(t), category: "wine" },
  { match: (t) => /^(beverage|freezer)/i.test(t), category: "other" },
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
  // Blower mounting: inside the hood, in the duct run, or on the outside wall.
  { pattern: /\binternal\b/i, value: "internal" },
  { pattern: /\binline\b/i, value: "inline" },
  { pattern: /\bexternal\b/i, value: "external" },
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
 * Whether a hood carries its own blower.
 *
 * Only meaningful on a hood. The sheet says "integrated" or "required";
 * anything else on a hood reads as integrated, because a hood with no note is
 * one that works out of the box. See docs/decisions.md D6.
 */
export function toBlower(
  category: Category,
  value: string,
): "integrated" | "required" | null {
  if (category !== "hood") return null;
  return /required|separate/i.test(value ?? "") ? "required" : "integrated";
}

/**
 * Which blowers a hood will take, by model.
 *
 * Manufacturer compatibility, not inventory, so it belongs in code rather than
 * in the sheet — same reasoning as every other cleaning rule (docs/decisions.md
 * D4). It is emitted onto the hood so the app never has to look anything up by
 * brand: pairing by maker is a guess that happens to work until a Zephyr blower
 * turns up next to a Thermador hood.
 *
 * Source: Thermador's ventilation accessory chart. Only models that have been
 * checked appear here; a hood that is not listed offers every blower in stock
 * and says the list is unverified rather than silently narrowing it.
 */
export const COMPATIBLE_BLOWERS: Record<string, string[]> = {
  PH36HWS: ["VTR1FZ", "VTR2FZ", "VTI1FZ", "VTI2FZ", "VTN2FZ", "VTN2DA"],
  // VTN1DZ is the 30" hood's blower and does not fit the 36".
  PH30HWS: ["VTR1FZ", "VTR2FZ", "VTI1FZ", "VTI2FZ", "VTN1DZ", "VTN2DA"],
};

/**
 * What a manufacturer's drawing says and the shop's sheet does not.
 *
 * The inventory sheet carries what a shop stocks: brand, model, width, price.
 * It does not carry the height of a range's carcass or how many burners are on
 * it, because no buyer needs that to order one — but this app draws the machine,
 * so it does. Same reasoning as the blower chart above and docs/decisions.md D4:
 * a fact from a published drawing belongs in code with its source, not typed
 * into a spreadsheet somebody else owns.
 *
 * Only models whose drawing has actually been read appear here. Anything else
 * falls back to the sheet, and then to the opening it goes in.
 *
 * PRG366WH / PRG304WH: Thermador Pro Harmony spec sheet, page 1
 * (docs/reference/prg366wh-spec.pdf).
 */
export interface DoorSplit {
  toeIn: number;
  drawerLowIn: number;
  drawerHighIn: number;
  doorIn: number;
}

/**
 * How a Thermador Freedom built-in divides up the front, from the elevation on
 * page 4 of the T36IT100NP sheet. The T36BT120NS is the same cabinet in the
 * same series and takes the same split.
 *
 * The four figures do not add to the 83-7/8" the same sheet gives as the
 * height — they come to 86-15/16", three inches over, before the gaps between
 * the panels. One of them is measured to somewhere this app cannot see. So they
 * are recorded here exactly as published and fitted to the machine in
 * `fridgeParts`, which keeps every proportion between them and makes the stack
 * come out at whatever the opening actually is.
 */
const FREEDOM_SPLIT: DoorSplit = {
  toeIn: 7.25,
  drawerLowIn: 19.75,
  drawerHighIn: 10.5,
  doorIn: 49.4375,
};

export const PUBLISHED_SPECS: Record<
  string,
  {
    widthIn?: number;
    heightIn?: number;
    depthIn?: number;
    burners?: number;
    /** Ranges with a backguard: where the cooking surface is, and how tall the
     *  panel above it stands. */
    cooktopIn?: number;
    backguardIn?: number;
    /** Refrigerators: the two depths that separate freestanding from built-in. */
    depthWithDoorsIn?: number;
    depthWithHandleIn?: number;
    rearSpacerIn?: number;
    frontLipIn?: number;
    doorConfig?: DoorConfig;
    doorSplit?: DoorSplit;
  }
> = {
  PRG366WH: { heightIn: 36.75, depthIn: 24.75, burners: 6 },
  PRG304WH: { heightIn: 36.75, depthIn: 24.75, burners: 4 },
  // Maytag MFES4030RS, from Leo's round-17 note. A freestanding range is a
  // different machine from a pro-style one: it is sold at its full height with
  // the backguard on, cooks at 36", and carries its controls on the front
  // rather than on a fascia under the deck.
  MFES4030RS: {
    widthIn: 29.875,
    heightIn: 47.875,
    depthIn: 28,
    cooktopIn: 36,
    backguardIn: 11.875,
    burners: 5,
  },
  // Thermador HMCB30WS. The canopy only; the chimney above it is sized to the
  // room, from the canopy's top to the ceiling.
  HMCB30WS: { widthIn: 29.9375, heightIn: 8.5625, depthIn: 23.1875, frontLipIn: 5 },
  // Thermador T36FT820NS. A 24" body held 1" off the wall by its own spacers,
  // with the doors and then the handles standing in front of it.
  T36FT820NS: {
    widthIn: 35.625,
    heightIn: 72,
    depthIn: 24,
    rearSpacerIn: 1,
    depthWithDoorsIn: 28.75,
    depthWithHandleIn: 31.4375,
  },
  // Thermador Freedom: two doors over a refrigerator drawer and a freezer
  // drawer. Sold as a four-door, which is what the Feature column tends to say.
  T36BT120NS: { doorConfig: "french-door-2-drawer", doorSplit: FREEDOM_SPLIT },
  T36IT100NP: { doorSplit: FREEDOM_SPLIT },
};

export type DoorConfig =
  | "french-door-2-drawer"
  | "french-door-1-drawer"
  | "bottom-freezer"
  | "side-by-side"
  | "column";

/**
 * How a refrigerator opens, read off the sheet's Feature column.
 *
 * The words are the ones a vendor actually writes: "French Door", "4 Door",
 * "2 Drawer", "Side by Side", "Column". A french door with two drawers under it
 * is sold as a four-door, so both spellings land in the same place.
 *
 * A refrigerator with nothing useful in Feature gets the commonest
 * configuration and is flagged as a guess, the same way a model with no
 * rough-in drawing is: the room still draws something, and `?debug=1` says
 * which ones nobody has checked.
 */
export function toDoorConfig(category: Category, feature: string): DoorConfig | null {
  if (category !== "refrigerator") return null;
  const text = (feature ?? "").toLowerCase();

  if (/column|all[- ]?(freezer|refrigerator)/.test(text)) return "column";
  if (/side[- ]?by[- ]?side/.test(text)) return "side-by-side";
  if (/french/.test(text) || /\bfd\b/.test(text)) {
    if (/4[- ]?door|2[- ]?drawer|two[- ]?drawer/.test(text)) return "french-door-2-drawer";
    return "french-door-1-drawer";
  }
  if (/bottom[- ]?(mount|freezer)/.test(text)) return "bottom-freezer";
  return null;
}

/** The one a refrigerator gets when the sheet says nothing about its doors. */
export const DEFAULT_DOOR_CONFIG: DoorConfig = "french-door-1-drawer";

/** The published figure for a model, where a drawing has been read. */
export function toPublished(model: string) {
  return PUBLISHED_SPECS[model.trim().toUpperCase()] ?? {};
}

/** The blowers a hood model accepts, or an empty list when nobody has checked. */
export function toCompatibleBlowers(category: Category, model: string): string[] {
  if (category !== "hood") return [];
  return COMPATIBLE_BLOWERS[model.trim().toUpperCase()] ?? [];
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
