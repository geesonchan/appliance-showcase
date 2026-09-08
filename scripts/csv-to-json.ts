/**
 * Turn a `showcase_export` CSV into `data/appliances.json`.
 *
 *   npm run import:csv -- path/to/showcase_export.csv
 *
 * Download the tab as CSV from the inventory sheet and point this at it. The
 * result is validated with the same zod schema the app loads, so a bad row
 * fails here rather than at runtime. See docs/data-sheet-spec.md.
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { Appliance, Category, SlotId } from "../src/types.ts";
import type { UnknownType } from "./normalise.ts";
import { appliancesFileSchema, parseDataFile } from "../src/data/schema.ts";
import {
  BLANK_TYPE,
  UnknownApplianceTypeError,
  type RawRow,
  classify,
  slotForCategory,
  toBlower,
  toBoolean,
  toBrand,
  toCompatibleBlowers,
  toDoorConfig,
  toPublished,
  toDimension,
  toFinish,
  toFuel,
  toHighlights,
  toId,
  toInstallType,
  toWidthIn,
} from "./normalise.ts";

export interface ConversionSummary {
  rowsRead: number;
  exported: number;
  /** Rows dropped, keyed by the reason, e.g. "Washer" or "no slot: cooktop". */
  skipped: Record<string, number>;
  /**
   * The models whose Appliance Type was blank. Blank means discontinued, so
   * they are skipped — but they are named, because "probably discontinued" is
   * a judgement Leo should confirm rather than a silent deletion.
   */
  blankTypeModels: string[];
  /** The models skipped for having no usable Width. */
  noWidthModels: string[];
  /**
   * Rows that parsed but are missing something the app needs, grouped by
   * reason. Counted by default and listed only under --verbose: at full-catalogue
   * scale a line per row buries the summary it belongs to.
   */
  warnings: Record<string, string[]>;
}

/** Minimal RFC 4180 reader: Sheets quotes any cell containing a comma. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const source = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!header) return [];
  return body.map((cells) =>
    Object.fromEntries(header.map((name, i) => [name.trim(), (cells[i] ?? "").trim()])),
  );
}

const numberOrNull = (value: string) => {
  const parsed = toDimension(value ?? "");
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
};

/** A text cell: blank becomes null, never an empty string. */
const textOrNull = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * A money cell. Blank is null, and so is zero: a zero price in the inventory
 * means nobody has set one, not that the model is free.
 */
const priceOrNull = (value: string | undefined) => {
  const parsed = numberOrNull((value ?? "").replace(/[$,]/g, ""));
  if (parsed === null || parsed <= 0) return null;
  return Math.round(parsed);
};

/**
 * Convert parsed CSV rows into catalogue entries.
 *
 * Pure, so the tests can exercise the rules without touching the filesystem.
 * Throws on an Appliance Type it does not recognise: a silent skip would
 * shrink the catalogue invisibly.
 */
export function convert(
  rows: Record<string, string>[],
  slots: { id: SlotId; compatibleCategories: Category[] }[],
): { appliances: Appliance[]; summary: ConversionSummary } {
  const appliances: Appliance[] = [];
  const summary: ConversionSummary = {
    rowsRead: rows.length,
    exported: 0,
    skipped: {},
    blankTypeModels: [],
    noWidthModels: [],
    warnings: {},
  };
  const warn = (reason: string, id: string) => {
    (summary.warnings[reason] ??= []).push(id);
  };
  // Collected rather than thrown on sight, so one run reports every value that
  // needs a rule instead of making Leo fix them one at a time.
  const unknowns: UnknownType[] = [];

  const skip = (reason: string) => {
    summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
  };

  rows.forEach((raw, index) => {
    const row = raw as unknown as RawRow;
    const rowNumber = index + 2; // 1-based, plus the header
    const type = row["Appliance Type"] ?? "";

    const classified = classify(type);
    if (classified.kind === "unknown") {
      unknowns.push({
        type,
        row: rowNumber,
        brand: (row.Brand ?? "").trim(),
        model: (row.Model ?? "").trim(),
      });
      return;
    }
    if (classified.kind === "skip") {
      skip(classified.reason);
      if (classified.reason === BLANK_TYPE) {
        summary.blankTypeModels.push(
          `${toBrand(row.Brand ?? "")} ${(row.Model ?? "").trim()}`.trim(),
        );
      }
      return;
    }
    const category = classified.category;

    const slot = slotForCategory(category, slots);
    if (slot === null) {
      skip(`no slot: ${category}`);
      return;
    }

    // The manufacturer's drawing where one has been read, then the sheet. A
    // shop records what it sells — a "30-inch range" — and the drawing records
    // what it measures, 29-7/8". Both are true and only one of them fits a
    // cabinet, so where they disagree the drawing wins. See PUBLISHED_SPECS.
    const widthIn = toPublished((row.Model ?? "").trim()).widthIn ?? toWidthIn(row.Width ?? "");
    // A blower is an accessory bolted to a hood, not something that goes in an
    // opening, so it has no width in the sheet and does not need one. Every
    // other category is checked against a cutout, so a missing width means the
    // row cannot be placed.
    if (widthIn === null && category !== "blower") {
      // One bucket, not one line per model: at 4,700 rows the per-model form
      // drowns everything else. The models are still named under --verbose.
      skip("no width");
      summary.noWidthModels.push(
        `${toBrand(row.Brand ?? "")} ${(row.Model ?? "").trim()}`.trim(),
      );
      return;
    }

    const brand = toBrand(row.Brand ?? "");
    const model = (row.Model ?? "").trim();
    const id = toId(brand, model);
    const published = toPublished(model);

    const voltage = Number(row.voltage) === 240 ? 240 : 120;
    const cfm = numberOrNull(row.cfm);

    appliances.push({
      id,
      slot,
      category,
      brand,
      model,
      series: null,
      msrpUSD: priceOrNull(row.msrpUSD),
      // The drawing's own page where one has been read, then the sheet's
      // column. And a row the drawing overrode is unverified until somebody
      // checks it against that drawing: re-typing a figure is not checking it.
      sourceUrl: published.sourceUrl ?? textOrNull(row.sourceUrl),
      verifiedAt: published.unverified ? null : textOrNull(row.verifiedAt),
      installType:
        published.installType ??
        toInstallType(row.Feature ?? "", type, row.Width ?? "", row.Depth ?? ""),
      fuel: toFuel(type),
      blower: toBlower(category, row.blower ?? ""),
      compatibleBlowers: toCompatibleBlowers(category, model),
      topDepthIn: category === "hood" ? toDimension(row.topDepthIn ?? "") : null,
      frontLipIn: published.frontLipIn ?? null,
      widthIn,
      // The drawing first, then the sheet — same reason as the width.
      heightIn: published.heightIn ?? numberOrNull(row.Height) ?? null,
      depthIn: published.depthIn ?? numberOrNull(row.Depth) ?? null,
      burners: published.burners ?? null,
      // Figures that only a drawing carries: where a range cooks as against how
      // tall it is, and how far a refrigerator's doors and handles stand out
      // from its carcass. No sheet has a column for any of them.
      cooktopIn: published.cooktopIn ?? null,
      backguardIn: published.backguardIn ?? null,
      depthWithDoorsIn: published.depthWithDoorsIn ?? null,
      depthWithHandleIn: published.depthWithHandleIn ?? null,
      rearSpacerIn: published.rearSpacerIn ?? null,
      // The drawing first where one has been read, then the sheet's own words.
      // Null means nobody has said, and the app draws the commonest front and
      // marks it a guess.
      doorConfig: published.doorConfig ?? toDoorConfig(category, row.Feature ?? ""),
      doorSplit: published.doorSplit ?? null,
      cutoutWidthIn: numberOrNull(row.cutoutWidthIn),
      cutoutHeightIn: numberOrNull(row.cutoutHeightIn),
      cutoutDepthIn: numberOrNull(row.cutoutDepthIn),
      finish: toFinish(row.Color ?? "", row.Feature ?? ""),
      leadTimeWeeks: numberOrNull(row.leadTimeWeeks),
      highlights: { en: toHighlights(row.Feature ?? ""), zh: [] },
      imageUrl: null,
      requires: {
        voltage,
        amps: numberOrNull(row.amps),
        gasBTU: numberOrNull(row.gasBTU),
        water: toBoolean(row.water),
        cfm,
        // Title 24: a hood at or above 400 CFM needs makeup air. Honour an
        // explicit yes in the sheet, otherwise derive it.
        makeupAirRequired: toBoolean(row.makeupAirRequired) || (cfm !== null && cfm >= 400),
      },
    });

    if (textOrNull(row.sourceUrl) === null) warn("no sourceUrl", id);
    if (priceOrNull(row.msrpUSD) === null) warn("no msrpUSD", id);
    if (numberOrNull(row.cutoutWidthIn) === null) warn("no cutoutWidthIn", id);
    summary.exported++;
  });

  if (unknowns.length > 0) {
    const error = new UnknownApplianceTypeError(unknowns);
    // Carry the partial summary so the CLI can still show what it did classify,
    // including the blank-type models, in the same run.
    (error as UnknownApplianceTypeError & { summary: ConversionSummary }).summary = summary;
    throw error;
  }

  return { appliances, summary };
}

export function formatSummary(summary: ConversionSummary, verbose = false): string {
  const lines = [`read ${summary.rowsRead} rows, exported ${summary.exported}`];

  const skipped = Object.entries(summary.skipped).sort((a, b) => b[1] - a[1]);
  if (skipped.length > 0) {
    lines.push("skipped:");
    for (const [reason, count] of skipped) {
      lines.push(`  ${count.toString().padStart(4)}  ${reason}`);
    }
  }

  // Named rather than counted: skipping these is an inference from an empty
  // cell, and the inference is worth confirming.
  if (summary.blankTypeModels.length > 0) {
    lines.push(
      `blank type (probably discontinued), check these ${summary.blankTypeModels.length}:`,
    );
    for (const model of summary.blankTypeModels) lines.push(`  ${model}`);
  }

  const warnings = Object.entries(summary.warnings).sort((a, b) => b[1].length - a[1].length);
  if (warnings.length > 0) {
    lines.push("warnings:");
    for (const [reason, ids] of warnings) {
      lines.push(`  ${ids.length.toString().padStart(4)}  ${reason}`);
      if (verbose) for (const id of ids) lines.push(`          ${id}`);
    }
  }

  if (verbose && summary.noWidthModels.length > 0) {
    lines.push(`no width (${summary.noWidthModels.length}):`);
    for (const model of summary.noWidthModels) lines.push(`  ${model}`);
  }

  if (!verbose && (warnings.length > 0 || summary.noWidthModels.length > 0)) {
    lines.push("re-run with --verbose to list the rows behind those counts");
  }

  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const input = args.find((arg) => !arg.startsWith("--"));
  if (!input) {
    console.error(
      "usage: npm run import:csv -- path/to/showcase_export.csv [--verbose]",
    );
    process.exit(1);
  }

  const slotsFile = JSON.parse(readFileSync("data/slots.json", "utf8"));
  const rows = parseCsv(readFileSync(input, "utf8"));

  let result;
  try {
    result = convert(rows, slotsFile.slots);
  } catch (error) {
    if (error instanceof UnknownApplianceTypeError) {
      // Show what it did manage to classify first, so one run reports both the
      // values that need a rule and the blank-type models worth confirming.
      const partial = (error as UnknownApplianceTypeError & { summary?: ConversionSummary })
        .summary;
      if (partial) console.log(formatSummary(partial, verbose));
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const file = {
    _meta: {
      generatedBy: `scripts/csv-to-json.ts from ${input}`,
      updatedAt: new Date().toISOString().slice(0, 10),
      provenance:
        "Derived from the showcase_export tab of the 2026 AA Inventory Manager. " +
        "Brand, Model, Appliance Type, Feature, Width, Depth, Height and Color come " +
        "from Stock current; everything else is hand entered. Normalisation lives in " +
        "scripts/normalise.ts, not in the sheet. verifiedAt is null until a row has " +
        "been checked against its sourceUrl.",
    },
    appliances: result.appliances,
  };

  parseDataFile(appliancesFileSchema, file, "data/appliances.json");
  writeFileSync("data/appliances.json", `${JSON.stringify(file, null, 2)}\n`, "utf8");

  console.log(formatSummary(result.summary, verbose));
  console.log(`\nwrote data/appliances.json`);
}

// Only run the CLI when invoked directly, so the tests can import the module.
if (process.argv[1]?.endsWith("csv-to-json.ts")) main();
