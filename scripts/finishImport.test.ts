import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import slotsFile from "../data/slots.json";
import type { Category, SlotId } from "../src/types.ts";
import { convert, parseCsv, runImport } from "./csv-to-json.ts";

/**
 * Stainless or panel-ready (Leo, 2026-10-28, his answer 4): a built-in
 * column's or built-in refrigerator's finish must be given: blank stops the
 * import, lists the models and writes nothing, where it used to come in
 * stainless. Every other blank Color still does.
 *
 * Leo, 2026-10-29: the web's finish is a column of its own in
 * `showcase_specs`, `webColor`, and Stock current's Color is not touched (his
 * answer 1); filled, it is the finish, Color and Feature unread. And the two
 * real models that are one built-in refrigerator two ways name each other in
 * `pairModel` (his answer 2).
 *
 * Leo, 2026-11-02: a built-in column is two rows of the sheet too — its own
 * number, `webColor` Panel Ready, and the number with -SS, `webColor` SS, each
 * naming the other in `pairModel`. `webColor` is SS or Panel Ready and nothing
 * else. The -SS row is the same machine, so every cell but Model, webColor,
 * msrpUSD and pairModel must be its pair's, or the import stops and lists each
 * one; and it is read by its pair's drawing.
 */

const slots = slotsFile.slots as { id: SlotId; compatibleCategories: Category[] }[];
const FIXTURE = fileURLToPath(new URL("../tests/fixtures/showcase_export.sample.csv", import.meta.url));
const rows = parseCsv(readFileSync(FIXTURE, "utf8"));

/** A row of the fixture's, as another model with some cells changed. */
const like = (model: string, changes: Record<string, string>) => ({
  ...rows.find((row) => row.Model === model)!,
  ...changes,
});

// Lopsided on purpose: a column and a built-in refrigerator with their Color
// blank, a column whose webColor gives it, and a dishwasher with its Color
// blank, which may be.
const FILLED_COLUMN = like("ICBIC-30R", { Brand: "THERMADOR", Model: "T24IF905SP", "Appliance Type": "Freezer Column", Width: "24", Color: "", Feature: "", webColor: "Panel Ready" });
const BLANK_COLUMN = like("ICBIC-30R", { Brand: "THERMADOR", Model: "T30IR905SP", Color: "", Feature: "" });
const BLANK_BUILT_IN = like("JBRFR36IGX", { Brand: "THERMADOR", Model: "T36BT120NS", Color: "", Feature: "French Door" });
const dishwasher = rows.find((row) => row["Appliance Type"] === "Dishwasher")!;
const BLANK_DISHWASHER = { ...dishwasher, Model: `${dishwasher.Model}X`, Color: "", Feature: "" };

const header = [...Object.keys(rows[0]), "webColor", "pairModel"];
const csvOf = (list: Record<string, string>[]) => {
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [header.join(","), ...list.map((row) => header.map((h) => cell(row[h] ?? "")).join(","))].join("\n");
};

/** The importer as Leo runs it, in a folder of its own, called in this process (round 92). */
function importIn(list: Record<string, string>[]) {
  const dir = mkdtempSync(join(tmpdir(), "finish-import-"));
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "data", "slots.json"), JSON.stringify(slotsFile));
  writeFileSync(join(dir, "export.csv"), csvOf(list));
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = runImport(["export.csv"], { cwd: dir, log: (l) => stdout.push(l), error: (l) => stderr.push(l) });
  let written: unknown = null;
  try {
    written = JSON.parse(readFileSync(join(dir, "data", "appliances.json"), "utf8"));
  } catch {
    written = null;
  }
  return { status, stdout: stdout.join("\n"), stderr: stderr.join("\n"), written };
}

describe("a built-in column's or refrigerator's finish left blank (Leo, 2026-10-28, 4)", () => {
  it("still makes a blank Color stainless on anything that is not a built-in column or refrigerator", () => {
    const list = convert([...rows, BLANK_DISHWASHER], slots).appliances;
    expect(list.find((a) => a.model === `${dishwasher.Model}X`)!.finish).toEqual(["stainless"]);
  });

  it("stops the import, lists each model, and writes nothing", () => {
    const run = importIn([...rows, FILLED_COLUMN, BLANK_COLUMN, BLANK_BUILT_IN, BLANK_DISHWASHER]);
    expect({
      status: run.status,
      column: run.stderr.includes("  Thermador T30IR905SP"),
      builtIn: run.stderr.includes("  Thermador T36BT120NS"),
      filled: run.stderr.includes("T24IF905SP"),
      dishwasher: run.stderr.includes(`${dishwasher.Model}X`),
      nothingWritten: run.stderr.includes("nothing written"),
      written: run.written,
    }).toEqual({ status: 1, column: true, builtIn: true, filled: false, dishwasher: false, nothingWritten: true, written: null });
  });

  it("writes once every one of them is filled", () => {
    const run = importIn([...rows, FILLED_COLUMN, BLANK_DISHWASHER]);
    expect({ status: run.status, written: run.written !== null }).toEqual({ status: 0, written: true });
  });
});

// Lopsided: a column whose Color is blank and whose webColor says panel-ready;
// a row whose Color and Feature both say panel-ready and whose webColor says
// SS, so only webColor can make it stainless; and three it may not say —
// both, a colour, a typo.
const WEB_PANEL = like("ICBIC-30R", { Brand: "THERMADOR", Model: "T24IR905SP", Color: "", Feature: "", webColor: "Panel Ready" });
const WEB_OVER = like("ICBIC-30R", { Brand: "THERMADOR", Model: "T18IF900SP", Color: "Panel Ready", Feature: "Panel Ready", webColor: "SS" });
const WEB_BOTH = like("ICBIC-30R", { Brand: "THERMADOR", Model: "T30IR905SP", Color: "", Feature: "", webColor: "SS / Panel Ready" });
const WEB_WHITE = like("ICBIC-30R", { Brand: "THERMADOR", Model: "T18IW905SP", Color: "", Feature: "", webColor: "White" });
const WEB_TYPO = like("ICBIC-30R", { Brand: "THERMADOR", Model: "T24IW905SP", Color: "", Feature: "", webColor: "Panel" });

describe("webColor, the web's own finish in showcase_specs (Leo, 2026-10-29, 1; 2026-11-02)", () => {
  const convertWith = (list: Record<string, string>[]) => convert([...rows, ...list], slots).appliances;

  it("is the finish when it is filled, whatever Color and Feature say", () => {
    const [panel, over] = ["T24IR905SP", "T18IF900SP"].map((model) => convertWith([WEB_PANEL, WEB_OVER]).find((a) => a.model === model)!.finish);
    expect({ panel, over }).toEqual({ panel: ["panel-ready"], over: ["stainless"] });
  });

  it("fills a built-in column's blank Color, so the import goes through", () => {
    const run = importIn([...rows, WEB_PANEL, WEB_OVER]);
    expect({ status: run.status, stderr: run.stderr }).toEqual({ status: 0, stderr: "" });
  });

  it("is SS or Panel Ready and nothing else: anything else stops, each named with its value, and nothing is written", () => {
    const run = importIn([...rows, WEB_PANEL, WEB_BOTH, WEB_WHITE, WEB_TYPO]);
    expect({
      status: run.status,
      named: ['Thermador T30IR905SP: "SS / Panel Ready"', 'Thermador T18IW905SP: "White"', 'Thermador T24IW905SP: "Panel"'].map((line) =>
        run.stderr.includes(line),
      ),
      others: run.stderr.includes("T24IR905SP"),
      written: run.written,
    }).toEqual({ status: 1, named: [true, true, true], others: false, written: null });
  });
});

// The pair as Leo fills it: each row names the other. T36BT120NS's Color is
// blank in Stock current, so its webColor says SS. Two factory models, so
// their cells may differ: T36IT100NP's height and depth are given, and
// T36BT120NS's are blank.
const PAIR_SS = like("JBRFR36IGX", { Brand: "THERMADOR", Model: "T36BT120NS", Color: "", Feature: "French Door", Height: "", Depth: "", webColor: "SS", pairModel: "T36IT100NP" });
const PAIR_PANEL = like("JBRFR36IGX", { Brand: "THERMADOR", Model: "T36IT100NP", Color: "Panel Ready", Feature: "French Door", Height: "84", Depth: "24", pairModel: "T36BT120NS" });

describe("pairModel, two real models that are one refrigerator two ways (Leo, 2026-10-29, 2)", () => {
  it("is carried on each row as the other's model", () => {
    const list = convert([...rows, PAIR_SS, PAIR_PANEL], slots).appliances;
    const pairOf = (model: string) => list.find((a) => a.model === model)!.pairModel;
    // A row nobody paired has none.
    expect([pairOf("T36BT120NS"), pairOf("T36IT100NP"), pairOf("JBRFR36IGX")]).toEqual(["T36IT100NP", "T36BT120NS", null]);
  });

  it("goes through when the two name each other, one stainless and one panel-ready, their other cells their own", () => {
    expect(importIn([...rows, PAIR_SS, PAIR_PANEL]).status).toBe(0);
  });

  it("stops on a pair that is one-sided, names a model not in the export, or is not one stainless and one panel-ready", () => {
    const oneSided = importIn([...rows, PAIR_SS, { ...PAIR_PANEL, pairModel: "" }]);
    const missing = importIn([...rows, { ...PAIR_SS, pairModel: "T36IT100NQ" }]);
    const bothSteel = importIn([...rows, PAIR_SS, { ...PAIR_PANEL, Color: "", webColor: "SS" }]);
    expect(
      [oneSided, missing, bothSteel].map((run) => ({
        status: run.status,
        // Stopped for the pair, not for anything else.
        named: run.stderr.includes("pairModel") && run.stderr.includes("Thermador T36BT120NS"),
        written: run.written,
      })),
    ).toEqual([
      { status: 1, named: true, written: null },
      { status: 1, named: true, written: null },
      { status: 1, named: true, written: null },
    ]);
  });
});

// A column as Leo fills it on 2026-11-02: T18IW100SP, whose drawing the
// import already reads, panel-ready; its -SS row stainless, the sheet's
// figures copied across, at a price of its own (lopsided: not the same).
const COLUMN = like("ICBIC-30R", {
  Brand: "THERMADOR", Model: "T18IW100SP", "Appliance Type": "Wine Column", Width: "18", Height: "", Depth: "",
  Color: "", Feature: "", cutoutWidthIn: "18", cutoutHeightIn: "84", cutoutDepthIn: "25", msrpUSD: "7799",
  webColor: "Panel Ready", pairModel: "T18IW100SP-SS",
});
const COLUMN_SS = { ...COLUMN, Model: "T18IW100SP-SS", msrpUSD: "8150", webColor: "SS", pairModel: "T18IW100SP" };

type Written = { appliances: { model: string; finish: string[]; msrpUSD: number; pairModel: string; widthIn: number; heightIn: number; depthIn: number }[] };

describe("a built-in column, two rows of the sheet (Leo, 2026-11-02)", () => {
  it("comes in as two rows, each its own model, finish and price, the -SS row read by its pair's drawing", () => {
    const run = importIn([...rows, COLUMN, COLUMN_SS]);
    const of = (model: string) => {
      const a = (run.written as Written | null)?.appliances.find((row) => row.model === model);
      return a && [a.finish, a.msrpUSD, a.pairModel, a.widthIn, a.heightIn, a.depthIn];
    };
    expect({ status: run.status, panel: of("T18IW100SP"), steel: of("T18IW100SP-SS") }).toEqual({
      status: 0,
      // 17.75" x 83-7/8" x 24": docs/reference/t18iw100sp-spec.pdf, for both.
      panel: [["panel-ready"], 7799, "T18IW100SP-SS", 17.75, 83.875, 24],
      steel: [["stainless"], 8150, "T18IW100SP", 17.75, 83.875, 24],
    });
  });

  it("stops when the -SS row's other cells are not its pair's, one line a cell, and writes nothing", () => {
    const run = importIn([...rows, COLUMN, { ...COLUMN_SS, cutoutDepthIn: "24", sourceUrl: "https://example.com/other.pdf" }]);
    expect({
      status: run.status,
      depth: run.stderr.includes(`Thermador T18IW100SP-SS: cutoutDepthIn "24", T18IW100SP's "25"`),
      source: run.stderr.includes("Thermador T18IW100SP-SS: sourceUrl"),
      // Model, webColor, msrpUSD and pairModel are the -SS row's own.
      own: ["Model", "webColor", "msrpUSD", "pairModel"].some((cell) => run.stderr.includes(`T18IW100SP-SS: ${cell} `)),
      written: run.written,
    }).toEqual({ status: 1, depth: true, source: true, own: false, written: null });
  });
});
