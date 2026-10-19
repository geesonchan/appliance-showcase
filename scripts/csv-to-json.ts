/**
 * Turn a `showcase_export` CSV into `data/appliances.json`.
 *
 *   npm run import:csv -- path/to/showcase_export.csv
 *
 * Download the tab as CSV from the inventory sheet and point this at it. The
 * result is validated with the same zod schema the app loads, so a bad row
 * fails here rather than at runtime. See docs/data-sheet-spec.md.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
  categoryOf,
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

/** The voltage cell: 240, or anything else reads as 120. */
const voltageOf = (value: string | undefined): 120 | 240 => (Number(value) === 240 ? 240 : 120);

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
    // How it installs, before which slot takes it: an over-the-range microwave
    // is the hood's (`categoryOf`, round 97).
    const installType =
      toPublished((row.Model ?? "").trim()).installType ??
      toInstallType(row.Feature ?? "", type, row.Width ?? "", row.Depth ?? "");
    const category = categoryOf(classified.category, installType);

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

    const voltage = voltageOf(row.voltage);
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
      installType,
      fuel: toFuel(type),
      blower: published.blower ?? toBlower(category, row.blower ?? ""),
      compatibleBlowers: toCompatibleBlowers(category, model),
      topDepthIn: category === "hood" ? toDimension(row.topDepthIn ?? "") : null,
      frontLipIn: published.frontLipIn ?? null,
      // Whether the tower round it breathes at the back: the manual's or Leo's
      // word, per model, never a column in the sheet (D11 rule 12, round 73).
      rearVent: published.rearVent ?? null,
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
      cutoutWidthIn: published.cutoutWidthIn ?? numberOrNull(row.cutoutWidthIn),
      cutoutHeightIn: published.cutoutHeightIn ?? numberOrNull(row.cutoutHeightIn),
      cutoutDepthIn: published.cutoutDepthIn ?? numberOrNull(row.cutoutDepthIn),
      finish: toFinish(row.Color ?? "", row.Feature ?? ""),
      leadTimeWeeks: numberOrNull(row.leadTimeWeeks),
      highlights: { en: toHighlights(row.Feature ?? ""), zh: [] },
      imageUrl: null,
      requires: {
        voltage,
        amps: numberOrNull(row.amps),
        gasBTU: numberOrNull(row.gasBTU),
        water: toBoolean(row.water),
        // No makeup-air flag: whether a package raises makeup air is the
        // `makeup-air` rule's, on the airflow the package actually moves
        // (round 65). The sheet's makeupAirRequired column is not read.
        cfm,
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

const totalSkipped = (summary: ConversionSummary) =>
  Object.values(summary.skipped).reduce((a, b) => a + b, 0);

/**
 * Every row read is either exported or counted under a skip reason. Checked on
 * the real run, not only in the tests: an import once reported 33 read and 29
 * exported beside a single skip line, and nothing stopped it being read as a
 * run that had lost three rows. A run that does not close writes nothing.
 */
export function assertAccounted(summary: ConversionSummary): void {
  const skipped = totalSkipped(summary);
  if (summary.exported + skipped !== summary.rowsRead) {
    throw new Error(
      `read ${summary.rowsRead} rows but exported ${summary.exported} + skipped ${skipped} = ` +
        `${summary.exported + skipped}: ${summary.rowsRead - summary.exported - skipped} rows unaccounted for`,
    );
  }
}

/**
 * The fields filled in by hand in `showcase_specs` and looked up by Model
 * (docs/data-sheet-spec.md), each with what a blank cell comes in as — worked
 * out by the same parsers `convert` reads the cells with, not written again.
 */
const HAND_FILLED: {
  field: string;
  read: (appliance: Appliance) => unknown;
  blank: (appliance: Appliance) => unknown;
}[] = [
  { field: "msrpUSD", read: (a) => a.msrpUSD, blank: () => priceOrNull("") },
  { field: "sourceUrl", read: (a) => a.sourceUrl, blank: () => textOrNull("") },
  { field: "verifiedAt", read: (a) => a.verifiedAt, blank: () => textOrNull("") },
  { field: "cutoutWidthIn", read: (a) => a.cutoutWidthIn, blank: () => numberOrNull("") },
  { field: "cutoutHeightIn", read: (a) => a.cutoutHeightIn, blank: () => numberOrNull("") },
  { field: "cutoutDepthIn", read: (a) => a.cutoutDepthIn, blank: () => numberOrNull("") },
  { field: "leadTimeWeeks", read: (a) => a.leadTimeWeeks, blank: () => numberOrNull("") },
  {
    field: "topDepthIn",
    read: (a) => a.topDepthIn,
    blank: (a) => (a.category === "hood" ? toDimension("") : null),
  },
  { field: "blower", read: (a) => a.blower, blank: (a) => toBlower(a.category, "") },
  { field: "requires.voltage", read: (a) => a.requires.voltage, blank: () => voltageOf("") },
  { field: "requires.amps", read: (a) => a.requires.amps, blank: () => numberOrNull("") },
  { field: "requires.gasBTU", read: (a) => a.requires.gasBTU, blank: () => numberOrNull("") },
  { field: "requires.water", read: (a) => a.requires.water, blank: () => toBoolean("") },
  { field: "requires.cfm", read: (a) => a.requires.cfm, blank: () => numberOrNull("") },
];

export interface EmptiedModel {
  brand: string;
  model: string;
  /** Each hand-filled field that had a value and comes in blank, with the value it had. */
  fields: { field: string; was: unknown }[];
}

/**
 * The checked models whose hand-filled cells came in blank.
 *
 * Round 92, Leo: T18IW100SP's price, source, check date, cutout and amps came
 * in empty twice after edits to the sheet (rounds 87 and 90) — its
 * `showcase_specs` lookup by Model finding nothing — and both times only a
 * reading of the diff caught it. So for a model the committed file has
 * checked (`verifiedAt`), any hand-filled field that had a value and now comes
 * in as a blank cell does is reported here, field by field. A value changed to
 * another value is an edit, and is not. A model the import no longer has at
 * all is another check, registered beside the package's default model (Open
 * items), not this one.
 */
export function emptiedCheckedModels(committed: Appliance[], imported: Appliance[]): EmptiedModel[] {
  const byId = new Map(imported.map((appliance) => [appliance.id, appliance]));
  const emptied: EmptiedModel[] = [];
  for (const before of committed) {
    if (before.verifiedAt === null) continue;
    const after = byId.get(before.id);
    if (!after) continue;
    const fields = HAND_FILLED.filter(
      (f) => f.read(before) !== f.blank(before) && f.read(after) === f.blank(after),
    ).map((f) => ({ field: f.field, was: f.read(before) }));
    if (fields.length > 0) emptied.push({ brand: before.brand, model: before.model, fields });
  }
  return emptied;
}

/**
 * What the run may write, given what came in blank and the models named with
 * `--allow-empty=MODEL` (Leo, round 92: the model has to be named, and the
 * result prints it). Throws on a model that came in blank and was not named,
 * and on a named model the committed file does not have — a typo is not a
 * permission. Gives back the lines the run prints for the named ones.
 */
export function assertHandFilledKept(
  emptied: EmptiedModel[],
  allowed: string[],
  committed: Appliance[],
): string[] {
  const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();
  const strangers = allowed.filter((model) => !committed.some((a) => same(a.model, model)));
  if (strangers.length > 0) {
    throw new Error(
      `--allow-empty names ${strangers.join(", ")}, which the committed data/appliances.json does not have`,
    );
  }
  const line = (e: EmptiedModel) =>
    `  ${e.brand} ${e.model}: ` +
    e.fields.map((f) => `${f.field} (was ${JSON.stringify(f.was)})`).join(", ");
  const stopped = emptied.filter((e) => !allowed.some((model) => same(e.model, model)));
  if (stopped.length > 0) {
    throw new Error(
      [
        `hand-filled cells came in blank for ${stopped.length} checked model(s), ` +
          "each with a verifiedAt in the committed data/appliances.json:",
        ...stopped.map(line),
        "Most likely the showcase_specs lookup by Model found nothing for it (docs/data-sheet-spec.md).",
        "Mend the sheet; or, if emptying them is meant, run again with --allow-empty=MODEL for each model.",
      ].join("\n"),
    );
  }
  return allowed.map((model) => {
    const found = emptied.find((e) => same(e.model, model));
    return found
      ? `allowed to come in blank (--allow-empty):\n${line(found)}`
      : `--allow-empty=${model}: nothing of it came in blank`;
  });
}

export function formatSummary(summary: ConversionSummary, verbose = false): string {
  // The skipped total is on the first line, so the line read on its own closes.
  const lines = [
    `read ${summary.rowsRead} rows, exported ${summary.exported}, skipped ${totalSkipped(summary)}`,
  ];

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

/**
 * The import as `npm run import:csv` runs it: read the CSV, check it, write
 * `data/appliances.json`. Gives back the exit code rather than exiting, and
 * reads and writes under `io.cwd`, so a test can run it whole in a folder of
 * its own (round 92: CI's Node 20 cannot run the script as a `.ts` file).
 */
export function runImport(
  args: string[],
  io: { cwd: string; log: (line: string) => void; error: (line: string) => void },
): number {
  const at = (path: string) => resolve(io.cwd, path);
  const verbose = args.includes("--verbose");
  const input = args.find((arg) => !arg.startsWith("--"));
  // --allow-empty=MODEL, once per model. A bare --allow-empty names nothing and
  // is refused, never read as "allow everything" (Leo, round 92).
  const allowEmpty = args
    .filter((arg) => arg === "--allow-empty" || arg.startsWith("--allow-empty="))
    .map((arg) => arg.slice("--allow-empty=".length).trim());
  if (!input || allowEmpty.some((model) => model === "")) {
    io.error(
      "usage: npm run import:csv -- path/to/showcase_export.csv [--verbose] [--allow-empty=MODEL ...]",
    );
    return 1;
  }

  const slotsFile = JSON.parse(readFileSync(at("data/slots.json"), "utf8"));
  const rows = parseCsv(readFileSync(at(input), "utf8"));

  let result;
  try {
    result = convert(rows, slotsFile.slots);
  } catch (error) {
    if (error instanceof UnknownApplianceTypeError) {
      // Show what it did manage to classify first, so one run reports both the
      // values that need a rule and the blank-type models worth confirming.
      const partial = (error as UnknownApplianceTypeError & { summary?: ConversionSummary })
        .summary;
      if (partial) io.log(formatSummary(partial, verbose));
      io.error(`\n${error.message}\n`);
      return 1;
    }
    throw error;
  }

  try {
    assertAccounted(result.summary);
  } catch (error) {
    io.log(formatSummary(result.summary, verbose));
    io.error(`\n${(error as Error).message}\nnothing written\n`);
    return 1;
  }

  // Read before anything is written: a checked model's hand-filled cells may
  // not come in blank unless the run names it (round 92).
  const committed = existsSync(at("data/appliances.json"))
    ? parseDataFile(
        appliancesFileSchema,
        JSON.parse(readFileSync(at("data/appliances.json"), "utf8")),
        "data/appliances.json",
      ).appliances
    : [];
  let allowedLines: string[];
  try {
    allowedLines = assertHandFilledKept(
      emptiedCheckedModels(committed, result.appliances),
      allowEmpty,
      committed,
    );
  } catch (error) {
    io.log(formatSummary(result.summary, verbose));
    io.error(`\n${(error as Error).message}\nnothing written\n`);
    return 1;
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
  writeFileSync(at("data/appliances.json"), `${JSON.stringify(file, null, 2)}\n`, "utf8");

  io.log(formatSummary(result.summary, verbose));
  for (const line of allowedLines) io.log(`\n${line}`);
  io.log(`\nwrote data/appliances.json`);
  return 0;
}

// Only run the CLI when invoked directly, so the tests can import the module.
if (process.argv[1]?.endsWith("csv-to-json.ts")) {
  process.exitCode = runImport(process.argv.slice(2), {
    cwd: process.cwd(),
    log: console.log,
    error: console.error,
  });
}
