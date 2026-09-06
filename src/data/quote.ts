import type { Appliance, Slot, SlotId } from "../types";
import type { Finding, Severity } from "./rules";
import { fitCheck } from "./fit";
import { deriveUtilities } from "./utilities";
import { effectiveCfm } from "./ventilation";

/**
 * The configuration as a document.
 *
 * Two forms, because they answer different questions. The JSON is what a
 * system reads: every id, every dimension, every rule that fired. The summary
 * is what a person reads on a phone, in an email, standing in a kitchen.
 *
 * Both are derived from exactly the same state the scene is showing, so a quote
 * can never describe a package the customer did not see.
 */

export interface QuoteLine {
  slot: SlotId;
  slotLabelKey: string;
  applianceId: string;
  brand: string;
  model: string;
  category: string;
  msrpUSD: number | null;
  /** The rough opening this model goes into, in inches. */
  openingIn: { w: number; h: number; d: number };
  /** Positive means it exceeds the opening; negative means filler is needed. */
  widthOverIn: number;
  leadTimeWeeks: number | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  utilities: ReturnType<typeof deriveUtilities>;
}

export interface Quote {
  generatedAt: string;
  scheme: { id: string; nameKey: string };
  lines: QuoteLine[];
  /** The blower, when the hood needs one. Its own line, not folded into the hood. */
  blower: {
    applianceId: string;
    brand: string;
    model: string;
    msrpUSD: number | null;
    installType: string[];
    cfm: number | null;
  } | null;
  totals: {
    /** Only the models that have a price. */
    subtotalUSD: number;
    itemCount: number;
    pricedCount: number;
    /** The longest lead time on the package, or null when none is published. */
    leadTimeWeeks: number | null;
    effectiveCfm: number | null;
  };
  /** Every rule that fired, with the id that produced it. */
  findings: {
    ruleId: string;
    severity: Severity;
    slot: SlotId;
    message: string;
  }[];
}

export interface QuoteInput {
  schemeId: string;
  schemeNameKey: string;
  slots: Slot[];
  selection: Record<SlotId, Appliance>;
  blower: Appliance | null;
  hoodNeedsBlower: boolean;
  findings: Finding[];
  /** Resolves a message key and its params into finished copy. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const SEVERITY_ORDER: Severity[] = ["blocker", "warning", "info"];

export function buildQuote(input: QuoteInput): Quote {
  const { slots, selection, blower, hoodNeedsBlower, findings, t } = input;
  const hood = selection["slot-hood"];
  const cfm = effectiveCfm(hood, blower);

  const lines: QuoteLine[] = slots
    .filter((slot) => selection[slot.id])
    .map((slot) => {
      const appliance = selection[slot.id];
      const fit = fitCheck(slot, appliance);
      return {
        slot: slot.id,
        slotLabelKey: slot.labelKey,
        applianceId: appliance.id,
        brand: appliance.brand,
        model: appliance.model,
        category: appliance.category,
        msrpUSD: appliance.msrpUSD,
        openingIn: slot.cutout,
        widthOverIn: Number(fit.widthOverIn.toFixed(1)),
        leadTimeWeeks: appliance.leadTimeWeeks,
        sourceUrl: appliance.sourceUrl,
        verifiedAt: appliance.verifiedAt,
        utilities: deriveUtilities(slot, appliance, slot.id === "slot-hood" ? cfm : null),
      };
    });

  const priced = [
    ...lines.map((line) => line.msrpUSD),
    ...(hoodNeedsBlower && blower ? [blower.msrpUSD] : []),
  ].filter((price): price is number => price !== null);

  // The package is ready when its slowest item arrives. An unpublished lead
  // time is unknown, not zero: promising "0 weeks" for a catalogue that has no
  // lead times at all would be worse than saying nothing.
  const leadTimes = [
    ...lines.map((line) => line.leadTimeWeeks),
    hoodNeedsBlower && blower ? blower.leadTimeWeeks : null,
  ].filter((weeks): weeks is number => weeks !== null);

  return {
    generatedAt: new Date().toISOString(),
    scheme: { id: input.schemeId, nameKey: input.schemeNameKey },
    lines,
    blower:
      hoodNeedsBlower && blower
        ? {
            applianceId: blower.id,
            brand: blower.brand,
            model: blower.model,
            msrpUSD: blower.msrpUSD,
            installType: blower.installType,
            cfm: blower.requires.cfm,
          }
        : null,
    totals: {
      subtotalUSD: priced.reduce((sum, price) => sum + price, 0),
      itemCount: lines.length + (hoodNeedsBlower && blower ? 1 : 0),
      pricedCount: priced.length,
      leadTimeWeeks: leadTimes.length > 0 ? Math.max(...leadTimes) : null,
      effectiveCfm: cfm,
    },
    findings: [...findings]
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
      .map((finding) => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      slot: finding.slot,
      message: t(finding.messageKey, finding.params),
    })),
  };
}

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** Plain text, for an email body or a message. */
export function formatQuote(
  quote: Quote,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const out: string[] = [];
  out.push(t(quote.scheme.nameKey));
  out.push("=".repeat(t(quote.scheme.nameKey).length));
  out.push("");

  for (const line of quote.lines) {
    out.push(`${t(line.slotLabelKey)}`);
    out.push(
      `  ${line.brand} ${line.model}` +
        (line.msrpUSD === null ? `  ${t("price.onRequest")}` : `  ${usd(line.msrpUSD)}`),
    );
    out.push(
      `  ${t("spec.opening")} ${line.openingIn.w}" x ${line.openingIn.h}" x ${line.openingIn.d}"`,
    );
    if (line.leadTimeWeeks !== null) {
      out.push(`  ${t("panel.package.lead")} ${t("panel.package.leadValue", { weeks: line.leadTimeWeeks })}`);
    }
    out.push("");
  }

  if (quote.blower) {
    out.push(t("blower.title"));
    out.push(
      `  ${quote.blower.brand} ${quote.blower.model}` +
        (quote.blower.cfm !== null ? `  ${t("blower.cfm", { cfm: quote.blower.cfm })}` : "") +
        (quote.blower.msrpUSD === null
          ? `  ${t("price.onRequest")}`
          : `  ${usd(quote.blower.msrpUSD)}`),
    );
    out.push("");
  }

  out.push("-".repeat(40));
  out.push(`${t("panel.package.total")}  ${usd(quote.totals.subtotalUSD)}`);
  if (quote.totals.pricedCount < quote.totals.itemCount) {
    out.push(
      `  ${t("panel.package.priced", {
        priced: quote.totals.pricedCount,
        total: quote.totals.itemCount,
      })}`,
    );
  }
  if (quote.totals.leadTimeWeeks !== null) {
    out.push(
      `${t("panel.package.lead")}  ${t("panel.package.leadValue", { weeks: quote.totals.leadTimeWeeks })}`,
    );
  }

  if (quote.findings.length > 0) {
    out.push("");
    out.push(t("checklist.title"));
    for (const finding of quote.findings) {
      const mark = finding.severity === "blocker" ? "!" : finding.severity === "warning" ? "?" : "-";
      out.push(`  ${mark} ${finding.message}`);
    }
  }

  return out.join("\n");
}
