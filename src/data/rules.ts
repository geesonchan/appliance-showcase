import { dropsIntoCounter } from "./cookingSurface";
import { hoodMount } from "./hoodMount";
import rulesFile from "../../data/rules.json";
import { z } from "zod";
import type { Appliance, Slot, SlotId } from "../types";
import { fitCheck, type FitResult } from "./fit";
import { outletSize, hoodCabinetFloor } from "./hood";
import { SLOT_BY_ID } from "./slots";
import { parseDataFile, metaSchema } from "./schema";
import { effectiveCfm } from "./ventilation";
import { formatDimension } from "./dimensions";

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
  /** Where the rule and its figures come from, in words. Round 79. */
  basis: z.string().min(1).optional(),
});

const rulesFileSchema = z.object({
  _meta: metaSchema,
  /**
   * What "sticks out" is measured from, everywhere a customer can see it.
   *
   * `cabinetFace` is the front of the run — the line a customer's eye follows
   * along a kitchen, and the thing a machine visibly stands proud of. The
   * alternatives are draughtsman's datums: the carcass front is a foot inside
   * the doors, and the slot's published cutout is a hole nobody looks at. A
   * freestanding refrigerator is 5-3/4" past the cabinet face — 28-3/4" of
   * machine standing an inch off the wall on its own spacers — where the same
   * machine is 4-3/4" measured from its own back and 3-3/4" from the carcass
   * line. Printing whichever the calling code happened to have to hand is how
   * one machine got three figures.
   *
   * The datum includes the spacers: they are behind the machine but they are
   * what decides where its doors end up, which is the only part anyone sees.
   */
  protrusionDatum: z.enum(["cabinetFace", "cutout"]).default("cabinetFace"),
  rules: z.array(ruleSchema).min(1),
  thresholds: z.object({
    duct: z
      .array(
        z.object({
          maxCfm: z.number().positive().nullable(),
          diameterIn: z.union([z.literal(6), z.literal(8), z.literal(10)]),
          /** Where the band comes from, in words; "no source found" says so. Round 78. */
          basis: z.string().min(1),
        }),
      )
      .min(1),
  }),
});

const parsed = parseDataFile(rulesFileSchema, rulesFile, "data/rules.json");

export const RULES = parsed.rules;
export const THRESHOLDS = parsed.thresholds;
export const PROTRUSION_DATUM = parsed.protrusionDatum;

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

/** The gas line under 65,000 BTU, which no rule states: the rule only names the upsize. */
const GAS_PIPE_BASE = '1/2"' as const;
type GasPipe = '1/2"' | '3/4"';

/**
 * The gas line a machine drawing this many BTU needs.
 *
 * **Asked of the `gas-pipe-size` rule, not written again.** Round 78: the
 * threshold stood in the rule's condition, in `thresholds.gasPipeUpsizeBTU`
 * (read by nothing) and as a literal 65,000 in `utilities.ts` — which is the
 * copy the quote, the spec card and the install view actually printed. The
 * rule's own condition, run by the rule engine's own test, is now the only one;
 * the pipe it names is its `pipe` parameter. The same shape as makeup air (D6).
 */
export function gasPipeFor(btu: number): GasPipe {
  const rule = RULES.find((candidate) => candidate.id === "gas-pipe-size");
  if (!rule) throw new Error("data/rules.json has no gas-pipe-size rule");
  const upsized = rule.when
    .filter((condition) => condition.fact === "appliance.requires.gasBTU")
    .every((condition) => test(condition.op, btu, condition.value));
  const pipe = String(rule.params.pipe);
  if (pipe !== '1/2"' && pipe !== '3/4"') throw new Error(`gas-pipe-size names a pipe the schema has no size for: ${pipe}`);
  return upsized ? pipe : GAS_PIPE_BASE;
}

interface Context {
  appliance: Appliance;
  slot: Slot;
  fit: FitResult;
  /**
   * What the machine is, worked out once rather than read off a word. Round
   * 83: a range standing on the floor — freestanding or slide-in — gets an
   * anti-tip bracket, and "freestanding" in the data is often only the
   * importer's default (D4), so the rule asks this, which is
   * `dropsIntoCounter`, the same answer the run and the counter use.
   */
  machine: { standsOnTheFloor: boolean };
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
    /**
     * Whether there is a cabinet over the hood at all.
     *
     * An under-cabinet hood's duct goes up through the box above it, and that
     * box has to be cut for it. A chimney hood carries its own cover to the
     * ceiling and has nothing above it — telling an installer to cut a cabinet
     * that is not there is worse than saying nothing.
     */
    hoodHasCabinetAbove: boolean;
    /**
     * How much narrower the hood is than the cooking surface under it, in
     * inches; null where either is missing. Round 79, Leo's site practice:
     * "一般 Hood 宽度是大于等于炉头的宽度的". An insert liner counts as the
     * housing built round it, which is what is seen and what the slot is.
     */
    hoodNarrowerByIn: number | null;
    /** The two widths as a cabinetmaker writes them, 29-7/8, for the line. */
    hoodWidthText: string | null;
    cookingWidthText: string | null;
  };
}

/** Resolve a dotted path, or return the value unchanged if it is a literal. */
function resolve(context: Context, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!/^(appliance|slot|fit|package|machine)\./.test(value)) return value;

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
    machine: { standsOnTheFloor: appliance.category === "range" && !dropsIntoCounter(appliance) },
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
  /** The island's cooktop, which is the cooking surface where there is no range. */
  cooktop?: Appliance,
): Context["package"] {
  const cfm = effectiveCfm(hood, blower);
  const hoodIn = hoodWidthIn(hood);
  const cooking = range ?? cooktop;
  const cookingIn = cooking ? (cooking.widthIn ?? cooking.cutoutWidthIn) : null;
  const widthText = (value: number | null) => (value === null ? null : formatDimension(value).replace(/"$/, ""));
  return {
    hoodNarrowerByIn: hoodIn === null || cookingIn === null ? null : cookingIn - hoodIn,
    hoodWidthText: widthText(hoodIn),
    cookingWidthText: widthText(cookingIn),
    blower,
    effectiveCfm: cfm,
    ductDiameterIn: ductDiameterFor(cfm),
    canopyClearanceIn: canopyClearance(range),
    hoodOutletSize: outletSize(),
    hoodHasCabinetAbove: hoodCabinetFloor() !== null,
  };
}

/**
 * How wide a hood is, as the rule about hood and cooking surface reads it.
 * An insert liner is hidden in a housing the cabinetmaker builds, and the
 * housing is what the hood is to anybody standing at the range: the slot's own
 * width (round 79, Leo; 36" in every package since round 87).
 */
function hoodWidthIn(hood: Appliance | undefined): number | null {
  if (!hood) return null;
  if (hood.category === "hood" && hoodMount(hood) === "insert") return SLOT_BY_ID["slot-hood"].cutout.w;
  return hood.widthIn ?? hood.cutoutWidthIn;
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
  // The cooking surface, not the machine's top. A range with a backguard is
  // sold at 47-7/8" and cooks at 36": measuring to the top of it reported a
  // canopy eighteen inches over a cooktop that is thirty inches under it.
  const cooktopIn =
    range.cooktopIn ?? range.heightIn ?? range.cutoutHeightIn ?? SLOT_BY_ID["slot-range"].cutout.h;
  return Number((hood.position[1] * 12 - cooktopIn).toFixed(3));
}
