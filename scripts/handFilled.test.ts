import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import slotsFile from "../data/slots.json";
import type { Category, SlotId } from "../src/types.ts";
import {
  assertHandFilledKept,
  convert,
  emptiedCheckedModels,
  parseCsv,
  runImport,
} from "./csv-to-json.ts";

/**
 * Round 92, Leo: an import whose hand-filled cells come in blank for a model
 * the committed file has checked stops, names the model and the fields, and
 * writes nothing — T18IW100SP lost its price, source, check date, cutout and
 * amps that way after two edits to the sheet (rounds 87 and 90). A model may be
 * let through only by naming it, `--allow-empty=MODEL`, and the result prints
 * it. docs/decisions.md D4, round 92.
 */

const slots = slotsFile.slots as { id: SlotId; compatibleCategories: Category[] }[];
const FIXTURE = fileURLToPath(new URL("../tests/fixtures/showcase_export.sample.csv", import.meta.url));
const rows = parseCsv(readFileSync(FIXTURE, "utf8"));

/** The `showcase_specs` columns, as the export carries them (docs/data-sheet-spec.md). */
const HAND_COLUMNS = [
  "cutoutWidthIn", "cutoutHeightIn", "cutoutDepthIn", "gasBTU", "voltage", "amps", "cfm",
  "water", "blower", "msrpUSD", "leadTimeWeeks", "sourceUrl", "verifiedAt",
];

// The fixture's checked refrigerator: verifiedAt 2026-09-01, a price, a source,
// a cutout, amps and a lead time. Its voltage is 120 and its water blank, so
// it is lopsided on purpose: those two are already what a blank cell gives.
const CHECKED = "CL3650UFD";

const edit = (model: string, change: (row: Record<string, string>) => void) =>
  rows.map((row) => {
    if (row.Model !== model) return row;
    const copy = { ...row };
    change(copy);
    return copy;
  });
const blankAll = (row: Record<string, string>) => {
  for (const column of HAND_COLUMNS) row[column] = "";
};
const committed = convert(rows, slots).appliances;
const importOf = (changed: Record<string, string>[]) => convert(changed, slots).appliances;

describe("which checked models' hand-filled cells came in blank", () => {
  it("names every field of a checked model whose lookup found nothing, with what it had", () => {
    expect(emptiedCheckedModels(committed, importOf(edit(CHECKED, blankAll)))).toEqual([
      {
        brand: "Sub-Zero",
        model: CHECKED,
        fields: [
          { field: "msrpUSD", was: 12995 },
          { field: "sourceUrl", was: "https://www.subzero-wolf.com/sub-zero/refrigeration" },
          { field: "verifiedAt", was: "2026-09-01" },
          { field: "cutoutWidthIn", was: 36 },
          { field: "cutoutHeightIn", was: 72 },
          { field: "cutoutDepthIn", was: 25 },
          { field: "leadTimeWeeks", was: 14 },
          { field: "requires.amps", was: 15 },
        ],
      },
    ]);
  });

  it("names the one field that came in blank, and no other", () => {
    const changed = edit(CHECKED, (row) => {
      row.msrpUSD = "";
    });
    expect(emptiedCheckedModels(committed, importOf(changed))).toEqual([
      { brand: "Sub-Zero", model: CHECKED, fields: [{ field: "msrpUSD", was: 12995 }] },
    ]);
  });

  it("counts a 240 V machine's voltage going to the blank cell's 120 as gone", () => {
    const before = committed.map((a) =>
      a.model === CHECKED ? { ...a, requires: { ...a.requires, voltage: 240 as const } } : a,
    );
    expect(emptiedCheckedModels(before, importOf(rows))).toEqual([
      { brand: "Sub-Zero", model: CHECKED, fields: [{ field: "requires.voltage", was: 240 }] },
    ]);
  });

  it("leaves a model nobody has checked alone, however much of it came in blank", () => {
    const unchecked = committed.filter((a) => a.verifiedAt === null && a.msrpUSD !== null);
    const changed = rows.map((row) =>
      unchecked.some((a) => a.model === row.Model) ? { ...row, ...blank() } : row,
    );
    // Says how many went in, so an empty set cannot pass it (D22, round 72).
    expect({
      unchecked: unchecked.length,
      emptied: emptiedCheckedModels(committed, importOf(changed)),
    }).toEqual({ unchecked: 31, emptied: [] });
  });

  it("lets a value changed to another value through: that is an edit", () => {
    const changed = edit(CHECKED, (row) => {
      row.msrpUSD = "13995";
      row.verifiedAt = "2026-10-11";
    });
    expect(emptiedCheckedModels(committed, importOf(changed))).toEqual([]);
  });

  it("finds nothing in an import of the same sheet", () => {
    expect(emptiedCheckedModels(committed, importOf(rows))).toEqual([]);
  });
});

function blank(): Record<string, string> {
  return Object.fromEntries(HAND_COLUMNS.map((column) => [column, ""]));
}

describe("what a run may write", () => {
  const emptied = emptiedCheckedModels(committed, importOf(edit(CHECKED, blankAll)));

  it("stops on a model that came in blank and was not named, naming it", () => {
    expect(() => assertHandFilledKept(emptied, [], committed)).toThrow(
      /1 checked model\(s\)[\s\S]*Sub-Zero CL3650UFD: msrpUSD \(was 12995\)/,
    );
  });

  it("lets a named model through and prints what came in blank", () => {
    expect(assertHandFilledKept(emptied, ["cl3650ufd"], committed)).toEqual([
      "allowed to come in blank (--allow-empty):\n" +
        "  Sub-Zero CL3650UFD: msrpUSD (was 12995), " +
        'sourceUrl (was "https://www.subzero-wolf.com/sub-zero/refrigeration"), ' +
        'verifiedAt (was "2026-09-01"), cutoutWidthIn (was 36), cutoutHeightIn (was 72), ' +
        "cutoutDepthIn (was 25), leadTimeWeeks (was 14), requires.amps (was 15)",
    ]);
  });

  it("refuses a name the committed file does not have", () => {
    expect(() => assertHandFilledKept(emptied, ["CL3650UF"], committed)).toThrow(
      /--allow-empty names CL3650UF, which the committed data\/appliances.json does not have/,
    );
  });

  it("says so when a named model had nothing come in blank", () => {
    expect(assertHandFilledKept([], [CHECKED], committed)).toEqual([
      `--allow-empty=${CHECKED}: nothing of it came in blank`,
    ]);
  });
});

/**
 * The importer as Leo runs it, whole, in a folder of its own with its own
 * data/ — called in this process, not spawned: CI runs Node 20, which cannot
 * run a .ts file (round 92's first push failed there on exactly that).
 */
function importIn(changed: Record<string, string>[], ...flags: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "import-"));
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "data", "slots.json"), JSON.stringify(slotsFile));
  const before = `${JSON.stringify(
    { _meta: { generatedBy: "test", updatedAt: "2026-10-11", provenance: "test" }, appliances: committed },
    null,
    2,
  )}\n`;
  writeFileSync(join(dir, "data", "appliances.json"), before);
  const header = Object.keys(rows[0]);
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const csv = [header.join(","), ...changed.map((row) => header.map((h) => cell(row[h] ?? "")).join(","))].join("\n");
  writeFileSync(join(dir, "export.csv"), csv);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = runImport(["export.csv", ...flags], {
    cwd: dir,
    log: (line) => stdout.push(line),
    error: (line) => stderr.push(line),
  });
  const after = readFileSync(join(dir, "data", "appliances.json"), "utf8");
  return { status, stdout: stdout.join("\n"), stderr: stderr.join("\n"), unchanged: after === before };
}

describe("the import, run", () => {
  it("stops, names the model and writes nothing", () => {
    const run = importIn(edit(CHECKED, blankAll));
    expect({
      status: run.status,
      named: run.stderr.includes("Sub-Zero CL3650UFD: msrpUSD (was 12995)"),
      nothingWritten: run.stderr.includes("nothing written"),
      unchanged: run.unchanged,
    }).toEqual({ status: 1, named: true, nothingWritten: true, unchanged: true });
  });

  it("writes, and prints the model, when the run names it", () => {
    const run = importIn(edit(CHECKED, blankAll), `--allow-empty=${CHECKED}`);
    expect({
      status: run.status,
      printed: run.stdout.includes("allowed to come in blank (--allow-empty):\n  Sub-Zero CL3650UFD:"),
      written: !run.unchanged,
    }).toEqual({ status: 0, printed: true, written: true });
  });

  it("refuses --allow-empty with no model", () => {
    const run = importIn(edit(CHECKED, blankAll), "--allow-empty");
    expect({ status: run.status, usage: run.stderr.includes("--allow-empty=MODEL"), unchanged: run.unchanged }).toEqual({
      status: 1,
      usage: true,
      unchanged: true,
    });
  });
});
