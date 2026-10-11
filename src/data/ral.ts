import { z } from "zod";
import ralFile from "../../data/ral.json";
import { metaSchema, parseDataFile } from "./schema";

/**
 * RAL Classic colours a cabinet door can be painted in, beyond the five on the
 * palette.
 *
 * A painter is given a RAL number, not a hex value, so that is what the finish
 * picker takes. The table is `data/ral.json`: every RAL Classic code, each with
 * the sRGB approximation Wikipedia's list gives, the table it was read from and
 * the date it was read (round 92; forty hand-picked codes until then). RAL
 * publishes no free value, which the file says. A number that is not a Classic
 * code is reported as not one rather than guessed at, because a guessed colour
 * on a sales screen is a promise about a door nobody has seen.
 */
const sourceSchema = z.object({
  url: z.url(),
  table: z.string().min(1),
  column: z.string().min(1),
});

const ralSchema = z
  .object({
    _meta: metaSchema,
    sources: z.record(z.string(), sourceSchema),
    colours: z
      .array(
        z.object({
          code: z.string().regex(/^RAL \d{4}$/),
          name: z.string().min(1),
          hex: z.string().regex(/^#[0-9A-F]{6}$/),
          /**
           * A colour a screen cannot show: a pearl, a metallic (the two
           * aluminium colours) or a luminous one. Shown as any other, with a
           * line saying so (round 92, Leo).
           */
          effect: z.enum(["pearl", "metallic", "luminous"]).optional(),
          /** A key of `sources`: which table of the page the value is from. */
          source: z.string(),
          /** The day the value was read off that table. */
          readAt: z.iso.date(),
        }),
      )
      .min(1),
  })
  .refine((file) => file.colours.every((colour) => colour.source in file.sources), {
    message: "every colour's source is one of the file's sources",
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

/**
 * The RAL colour a door is painted in, when it is one. The door keeps only its
 * hex, so this answers only because no two codes share one — `ral.test.ts`
 * holds that.
 */
export const ralForHex = (hex: string) =>
  RAL.colours.find((colour) => colour.hex.toLowerCase() === hex.toLowerCase());
