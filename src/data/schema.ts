import { z } from "zod";

/**
 * Runtime schemas for everything under `data/`.
 *
 * The catalogue is exported from a spreadsheet, so every column is always
 * present and empty cells arrive as `null` rather than as missing keys. The
 * schemas mirror that: optional values are `.nullable()`, not `.optional()`.
 * A row that silently loses a column is then a validation error rather than an
 * `undefined` that surfaces three screens later.
 */

export const categorySchema = z.enum([
  "refrigerator",
  "range",
  "cooktop",
  "wall-oven",
  "dishwasher",
  "hood",
  "microwave",
  "wine",
  "blower",
  "other",
]);

export const fuelSchema = z.enum(["gas", "electric", "induction", "dual"]);

export const slotIdSchema = z.enum([
  "slot-fridge",
  "slot-range",
  "slot-hood",
  "slot-dishwasher",
  "slot-microwave",
  "slot-wine",
]);

export const finishSchema = z.enum([
  "stainless",
  "panel-ready",
  "matte-black",
  "white",
]);

const voltageSchema = z.union([z.literal(120), z.literal(240)]);

/** A positive measurement in inches. */
const inches = z.number().positive().max(120);

export const localisedListSchema = z.object({
  en: z.array(z.string()),
  zh: z.array(z.string()),
});

export const applianceSchema = z.object({
  id: z.string().min(1),
  slot: slotIdSchema,
  category: categorySchema,
  brand: z.string().min(1),
  model: z.string().min(1),
  series: z.string().nullable(),

  /**
   * List price, or null when the sheet has no price for the model. Unpriced is
   * a real state in the inventory — an allocated or made-to-order line — and
   * the UI says "price on request" rather than inventing a number.
   */
  msrpUSD: z.number().int().positive().nullable(),
  /** Where the model and its list price can be checked, when there is a page. */
  sourceUrl: z.url().nullable(),
  /**
   * ISO date the row was last checked against `sourceUrl`, or null if nobody
   * has. Seed data ships as null on purpose: unverified pricing should be
   * visible in the data rather than assumed.
   */
  verifiedAt: z.iso.date().nullable(),

  /**
   * Install form, as an array: the Sheet's Feature column can name several at
   * once ("Slide-In" plus "counter-depth"), and §3.5.1 treats each of those as
   * part of the same answer. Defaults to ["freestanding"] when nothing matches.
   */
  installType: z.array(z.string().min(1)).min(1),
  fuel: fuelSchema.nullable(),

  /**
   * Hoods only. Most high-end hoods ship without a blower; `required` means one
   * has to be specified separately, and the package's effective CFM comes from
   * that blower rather than from the hood. Null on everything else.
   */
  blower: z.enum(["integrated", "required"]).nullable(),
  /**
   * Blower models this hood accepts, from the manufacturer's chart. Empty means
   * nobody has checked, not that nothing fits — the picker says so rather than
   * offering an empty list. See docs/decisions.md D13.
   */
  compatibleBlowers: z.array(z.string()).default([]),
  /**
   * Hoods only: the depth of the flat top of a wedge canopy, where the duct
   * comes off. Null falls back to the 12" the clearance drawing shows.
   */
  topDepthIn: inches.nullable().default(null),

  /**
   * Width, or null for a blower. Everything else needs one, because the fit
   * check gates on it — but a blower is an accessory bolted to a hood, not
   * something that goes in an opening, so the sheet has no width for it.
   */
  widthIn: inches.nullable(),
  heightIn: inches.nullable(),
  depthIn: inches.nullable(),
  cutoutWidthIn: inches.nullable(),
  cutoutHeightIn: inches.nullable(),
  cutoutDepthIn: inches.nullable(),

  finish: z.array(finishSchema).min(1),
  leadTimeWeeks: z.number().int().nonnegative().nullable(),
  highlights: localisedListSchema,
  imageUrl: z.url().nullable(),

  requires: z.object({
    voltage: voltageSchema,
    amps: z.number().positive().nullable(),
    gasBTU: z.number().positive().nullable(),
    water: z.boolean(),
    cfm: z.number().positive().nullable(),
    makeupAirRequired: z.boolean(),
  }),
}).refine((appliance) => appliance.category === "blower" || appliance.widthIn !== null, {
  message: "widthIn is required for everything except a blower",
  path: ["widthIn"],
});

export const cabinetConfigSchema = z.object({
  type: z.enum(["base", "tall", "upper", "enclosure", "countertop-cutout"]),
  openingIn: z.object({ w: inches, h: inches, d: inches }),
  panelReady: z.boolean(),
  finishedSides: z.number().int().min(0).max(4),
});

export const utilitiesSchema = z.object({
  gas: z
    .object({
      pipeSize: z.enum(['1/2"', '3/4"']),
      shutoff: z.boolean(),
    })
    .nullable(),
  power: z.object({
    voltage: voltageSchema,
    amps: z.number().positive(),
    dedicated: z.boolean(),
  }),
  water: z.object({ supply: z.boolean(), drain: z.boolean() }).nullable(),
  duct: z
    .object({
      diameterIn: z.union([z.literal(6), z.literal(8), z.literal(10)]),
      route: z.enum(["up-through-cabinet", "back-wall", "recirc"]),
    })
    .nullable(),
});

/**
 * The half of a slot that is product data. Placement lives in `room.ts`,
 * because where the oven tower stands is scene construction rather than
 * something maintained in the Sheet.
 */
export const slotRecordSchema = z.object({
  id: slotIdSchema,
  labelKey: z.string().min(1),
  cutout: z.object({ w: inches, h: inches, d: inches }),
  /**
   * Where the fly-in views this slot from: azimuth measured like the default
   * isometric view, pitch above the floor plane, both in degrees. Every slot
   * declares one, because "the default angle happens to work" is a fact about
   * this room's geometry and stops being true the moment a template moves it.
   */
  bestView: z.object({
    azimuth: z.number().min(-360).max(360),
    pitch: z.number().min(5).max(80),
  }),
  /**
   * Where this slot's label sits relative to its dot, in screen pixels. Preset
   * per slot for the angle `bestView` arrives at, then adjusted by the
   * collision pass; a label that lands on the appliance it is naming explains
   * nothing.
   */
  labelOffset: z.object({ dx: z.number(), dy: z.number() }),
  /**
   * Hood slots only: the cooking surface the wall was drilled for. The canopy
   * hangs its clearance above *this*, not above the counter beside it — a
   * slide-in range's grates sit proud of the top. See docs/decisions.md D13.
   */
  builtForCooktopIn: inches.nullable().default(null),
  compatibleCategories: z.array(categorySchema).min(1),
  cabinetConfig: cabinetConfigSchema,
  utilities: utilitiesSchema,
});

/**
 * A fixture is a fitting the kitchen has rather than a product it was sold:
 * the sink, and later the pot filler or the water line for the ice maker. It
 * carries services and takes up a cabinet segment, but it has no brand, no
 * price and no alternatives, so it is deliberately not an Appliance.
 * See docs/decisions.md D11.
 */
export const fixtureIdSchema = z.enum(["fixture-sink"]);

export const fixtureRecordSchema = z.object({
  id: fixtureIdSchema,
  type: z.enum(["sink"]),
  labelKey: z.string().min(1),
  /** The cabinet opening it occupies. */
  cutout: z.object({ w: inches, h: inches, d: inches }),
  /** The basin itself, for the scene to draw. Null for types that have none. */
  bowlIn: z.object({ w: inches, h: inches, d: inches }).nullable().default(null),
  utilities: utilitiesSchema,
});

export const schemeSchema = z.object({
  id: z.string().min(1),
  nameKey: z.string().min(1),
  conceptKey: z.string().min(1),
  palette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).min(1),
  defaultSelection: z.record(slotIdSchema, z.string().min(1)),
  /** The blower specified with the hood, when the hood needs one. */
  defaultBlower: z.string().min(1).nullable().default(null),
});

/** Every data file carries provenance so its trust level travels with it. */
export const metaSchema = z.object({
  generatedBy: z.string(),
  updatedAt: z.iso.date(),
  provenance: z.string(),
});

export const appliancesFileSchema = z.object({
  _meta: metaSchema,
  appliances: z.array(applianceSchema).min(1),
});

export const slotsFileSchema = z.object({
  _meta: metaSchema,
  slots: z.array(slotRecordSchema).length(6),
});

export const schemesFileSchema = z.object({
  _meta: metaSchema,
  schemes: z.array(schemeSchema).min(1),
});

export const fixturesFileSchema = z.object({
  _meta: metaSchema,
  fixtures: z.array(fixtureRecordSchema).min(1),
});

export type ApplianceRecord = z.infer<typeof applianceSchema>;
export type SlotRecord = z.infer<typeof slotRecordSchema>;
export type SchemeRecord = z.infer<typeof schemeSchema>;
export type FixtureRecord = z.infer<typeof fixtureRecordSchema>;

/**
 * Parse a data file, failing loudly.
 *
 * The app refuses to start on a schema violation rather than rendering
 * something subtly wrong: a missing cutout or a mistyped voltage would
 * otherwise surface as a silently wrong fit check or install list.
 */
export function parseDataFile<T>(schema: z.ZodType<T>, raw: unknown, file: string): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;

  const issues = result.error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`${file} failed validation:\n${issues}`);
}
