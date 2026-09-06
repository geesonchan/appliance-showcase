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
  "other",
]);

export const fuelSchema = z.enum(["gas", "electric", "induction", "dual"]);

export const slotIdSchema = z.enum([
  "slot-fridge",
  "slot-range",
  "slot-hood",
  "slot-wall-oven",
  "slot-dishwasher",
  "slot-microwave",
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

  msrpUSD: z.number().int().positive(),
  /** Where the model and its list price can be checked. */
  sourceUrl: z.url(),
  /**
   * ISO date the row was last checked against `sourceUrl`, or null if nobody
   * has. Seed data ships as null on purpose: unverified pricing should be
   * visible in the data rather than assumed.
   */
  verifiedAt: z.iso.date().nullable(),

  installType: z.string().min(1),
  fuel: fuelSchema.nullable(),

  widthIn: inches,
  heightIn: inches,
  depthIn: inches,
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
  compatibleCategories: z.array(categorySchema).min(1),
  cabinetConfig: cabinetConfigSchema,
  utilities: utilitiesSchema,
});

export const schemeSchema = z.object({
  id: z.string().min(1),
  nameKey: z.string().min(1),
  conceptKey: z.string().min(1),
  palette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).min(1),
  defaultSelection: z.record(slotIdSchema, z.string().min(1)),
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

export type ApplianceRecord = z.infer<typeof applianceSchema>;
export type SlotRecord = z.infer<typeof slotRecordSchema>;
export type SchemeRecord = z.infer<typeof schemeSchema>;

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
