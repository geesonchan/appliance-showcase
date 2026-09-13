import { z } from "zod";
import ralFile from "../../data/ral.json";
import { metaSchema, parseDataFile } from "./schema";

/**
 * RAL Classic colours a cabinet door can be painted in, beyond the five on the
 * palette.
 *
 * A painter is given a RAL number, not a hex value, so that is what the finish
 * picker takes. The table is `data/ral.json`: forty codes that kitchens are
 * actually specified in, each with the sRGB approximation Wikipedia's list
 * gives — RAL itself publishes none, which the file says. A number outside the
 * table is reported as not included rather than guessed at, because a guessed
 * colour on a sales screen is a promise about a door nobody has seen.
 */
const ralSchema = z.object({
  _meta: metaSchema,
  colours: z
    .array(
      z.object({
        code: z.string().regex(/^RAL \d{4}$/),
        name: z.string().min(1),
        hex: z.string().regex(/^#[0-9A-F]{6}$/),
      }),
    )
    .min(30)
    .max(40),
});

export type RalColour = z.infer<typeof ralSchema>["colours"][number];

export const RAL = parseDataFile(ralSchema, ralFile, "data/ral.json");

const BY_CODE = new Map(RAL.colours.map((colour) => [colour.code, colour]));

export type RalLookup =
  | { ok: true; colour: RalColour }
  | { ok: false; reason: "format" }
  | { ok: false; reason: "unknown"; code: string };

/**
 * What a typed RAL number is.
 *
 * Takes it the ways people write it — `RAL 6005`, `ral6005`, `RAL-6005`, or
 * just `6005` — and nothing else: four digits, optionally after the letters.
 */
export function lookupRal(input: string): RalLookup {
  const match = input.trim().match(/^(?:ral)?[\s-]*(\d{4})$/i);
  if (!match) return { ok: false, reason: "format" };
  const code = `RAL ${match[1]}`;
  const colour = BY_CODE.get(code);
  return colour ? { ok: true, colour } : { ok: false, reason: "unknown", code };
}

/** The RAL colour a door is painted in, when it is one. */
export const ralForHex = (hex: string) =>
  RAL.colours.find((colour) => colour.hex.toLowerCase() === hex.toLowerCase());
