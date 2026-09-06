import rulesFile from "../../data/rules.json";
import { z } from "zod";
import type { Appliance, Slot, SlotId } from "../types";
import { fitCheck, type FitResult } from "./fit";
import { outletSize } from "./hood";
import { SLOT_BY_ID } from "./slots";
import { parseDataFile, metaSchema } from "./schema";
import { effectiveCfm } from "./ventilation";

/**
 * The install rules from §3.5.4, plus the sizing thresholds that used to be
 * constants in the scene code.
 *
 * They live in `data/rules.json` for the same reason the catalogue does: a
 * threshold is a business judgement, and changing one should not need a
 * release. See docs/decisions.md D7.
 */

const conditionSchema = z.object({
  /** A dotted path into the evaluation context. */
  fact: z.string().min(1),
  op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "includes", "isNull", "notNull"]),
  /** A literal, or another dotted path when it starts with a known root. */
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const ruleSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["blocker", "warning", "info"]),
  /**
   * Whether the rule is about one appliance or about the package as a whole.
   * Package rules read only `package.*` facts, so evaluating them per slot
   * would report the same finding six times.
   */
  scope: z.enum(["slot", "package"]).default("slot"),
  messageKey: z.string().min(1),
  when: z.array(conditionSchema).min(1),
  /** Values interpolated into the message, as paths or literals. */
  params: z.record(z.string(), z.union([z.string(), z.number()])),
});

const rulesFileSchema = z.object({
  _meta: metaSchema,
  rules: z.array(ruleSchema).min(1),
  thresholds: z.object({
    gasPipeUpsizeBTU: z.number().positive(),
    makeupAirCfm: z.number().positive(),
    duct: z
      .array(
        z.object({
          maxCfm: z.number().positive().nullable(),
          diameterIn: z.union([z.literal(6), z.literal(8), z.literal(10)]),
        }),
      )
      .min(1),
  }),
});

const parsed = parseDataFile(rulesFileSchema, rulesFile, "data/rules.json");

export const RULES = parsed.rules;
export const THRESHOLDS = parsed.thresholds;

export type Severity = z.infer<typeof ruleSchema>["severity"];

export interface Finding {
  ruleId: string;
  severity: Severity;
  messageKey: string;
  params: Record<string, string | number>;
  /** The slot the finding is about, so the checklist can group by appliance. */
  slot: SlotId;
}

/** Duct diameter for a given airflow, from the thresholds table. */
export function ductDiameterFor(cfm: number | null): 6 | 8 | 10 | null {
  if (cfm === null) return null;
  for (const band of THRESHOLDS.duct) {
    if (band.maxCfm === null || cfm <= band.maxCfm) return band.diameterIn;
  }
  return THRESHOLDS.duct[THRESHOLDS.duct.length - 1].diameterIn;
}

interface Context {
  appliance: Appliance;
  slot: Slot;
  fit: FitResult;
  package: {
    blower: Appliance | null;
    effectiveCfm: number | null;
    ductDiameterIn: number | null;
    /**
     * How much air there is between the cooking surface and the canopy, given
     * the two models actually specified. The hood is screwed to the wall at a
     * fixed height; a taller range eats into the clearance.
     */
    canopyClearanceIn: number | null;
    /** The opening the duct comes off the canopy through, as a size to quote. */
    hoodOutletSize: string;
  };
}

/** Resolve a dotted path, or return the value unchanged if it is a literal. */
function resolve(context: Context, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!/^(appliance|slot|fit|package)\./.test(value)) return value;

  let current: unknown = context;
  for (const key of value.split(".")) {
    if (current === null || current === undefined) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? null;
}

function test(op: string, left: unknown, right: unknown): boolean {
  switch (op) {
    case "eq":
      return left === right;
    case "ne":
      return left !== right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case "includes":
      return Array.isArray(left) && left.includes(right);
    case "isNull":
      return left === null || left === undefined;
    case "notNull":
      return left !== null && left !== undefined;
    default:
      return false;
  }
}

/**
 * Run every rule against one slot's specified appliance.
 *
 * A rule fires only when all of its conditions hold. Conditions that reference
 * a fact the context has no value for simply do not fire, rather than throwing:
 * a hood with no CFM should produce no duct advice, not an error.
 */
export function evaluateSlot(
  slot: Slot,
  appliance: Appliance | undefined,
  packageContext: Context["package"],
  scope: "slot" | "package" = "slot",
): Finding[] {
  if (!appliance) return [];

  const context: Context = {
    appliance,
    slot,
    fit: fitCheck(slot, appliance),
    package: packageContext,
  };

  const findings: Finding[] = [];
  for (const rule of RULES) {
    if (rule.scope !== scope) continue;
    const fires = rule.when.every((condition) =>
      test(condition.op, resolve(context, condition.fact), resolve(context, condition.value)),
    );
    if (!fires) continue;

    findings.push({
      ruleId: rule.id,
      severity: rule.severity,
      messageKey: rule.messageKey,
      slot: slot.id,
      params: Object.fromEntries(
        Object.entries(rule.params).map(([key, path]) => {
          const value = resolve(context, path);
          return [key, typeof value === "number" ? formatNumber(key, value) : String(value)];
        }),
      ),
    });
  }
  return findings;
}

/**
 * How a number reads in a message.
 *
 * Inches to one decimal; airflow and gas load with thousands separators,
 * because "119500 BTU" on a quote is a number nobody reads at a glance.
 */
const formatNumber = (key: string, value: number) => {
  if (/filler|depth/i.test(key)) return Number(value.toFixed(1));
  if (/btu|cfm/i.test(key)) return value.toLocaleString("en-US");
  return value;
};

/** Everything the rules need to know about the package as a whole. */
export function packageContext(
  hood: Appliance | undefined,
  blower: Appliance | null,
  range?: Appliance,
): Context["package"] {
  const cfm = effectiveCfm(hood, blower);
  return {
    blower,
    effectiveCfm: cfm,
    ductDiameterIn: ductDiameterFor(cfm),
    canopyClearanceIn: canopyClearance(range),
    hoodOutletSize: outletSize(),
  };
}

/**
 * The gap between the cooking surface and the underside of the canopy.
 *
 * The canopy hangs where the room was built for it. Specifying a range whose
 * top sits above the counter closes that gap, and below 30" a gas range is
 * outside what the manufacturer allows — which is a thing worth being told
 * before the hood is on the wall.
 */
export function canopyClearance(range: Appliance | undefined): number | null {
  if (!range) return null;
  const hood = SLOT_BY_ID["slot-hood"];
  const cooktopIn = range.heightIn ?? range.cutoutHeightIn ?? SLOT_BY_ID["slot-range"].cutout.h;
  return Number((hood.position[1] * 12 - cooktopIn).toFixed(3));
}
