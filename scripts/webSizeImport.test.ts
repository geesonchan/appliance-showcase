import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import slotsFile from "../data/slots.json";
import { parseCsv, runImport } from "./csv-to-json.ts";

/**
 * `webSize`: the nominal size Leo fills in `showcase_specs` and the export
 * carries (D4, D21; 2026-11-08). A number on every machine but a blower. A cell
 * that is blank or is not a number stops the import and lists the row, because
 * the code will not make a size up from the width. And the import writes no
 * day and no path into `_meta` (Open items, "The import's `_meta` is in the
 * main chunk", way 3), so the same rows on another day are the same file.
 */

const FIXTURE = fileURLToPath(new URL("../tests/fixtures/showcase_export.sample.csv", import.meta.url));
const rows = parseCsv(readFileSync(FIXTURE, "utf8"));
const header = Object.keys(rows[0]);
const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csvOf = (list: Record<string, string>[]) => {
  const columns = Object.keys(list[0]);
  return [columns.join(","), ...list.map((row) => columns.map((h) => cell(row[h] ?? "")).join(","))].join("\n");
};

function importIn(list: Record<string, string>[], input = "export.csv") {
  const dir = mkdtempSync(join(tmpdir(), "websize-import-"));
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "data", "slots.json"), JSON.stringify(slotsFile));
  writeFileSync(join(dir, input), csvOf(list));
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = runImport([input], { cwd: dir, log: (l) => stdout.push(l), error: (l) => stderr.push(l) });
  const path = join(dir, "data", "appliances.json");
  let written: string | null = null;
  try {
    written = readFileSync(path, "utf8");
  } catch {
    written = null;
  }
  return { status, stdout: stdout.join("\n"), stderr: stderr.join("\n"), written };
}

const edit = (model: string, webSize: string) => rows.map((r) => (r.Model === model ? { ...r, webSize } : r));
const FRIDGE = "CL3650UFD";
const BLOWER = "VTN2FZ";

afterEach(() => vi.useRealTimers());

describe("webSize at the import", () => {
  it("has the column in the sample", () => {
    expect(header).toContain("webSize");
  });

  it("comes in as a number", () => {
    const run = importIn(rows);
    expect(run.status).toBe(0);
    const row = JSON.parse(run.written!).appliances.find((a: { model: string }) => a.model === FRIDGE);
    expect(row.webSizeIn).toBe(36);
  });

  it("stops on a blank cell, names the model and writes nothing", () => {
    const run = importIn(edit(FRIDGE, ""));
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(new RegExp(`${FRIDGE}.*blank`));
    expect(run.stderr).toMatch(/nothing written/);
    expect(run.written).toBeNull();
  });

  it('stops on a cell that is not a number: 36"x', () => {
    const run = importIn(edit(FRIDGE, '36"x'));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('36\\"x');
    expect(run.written).toBeNull();
  });

  it("stops when the column is not there at all: the wrong tab", () => {
    const run = importIn(rows.map(({ webSize: _gone, ...rest }) => rest as Record<string, string>));
    expect(run.status).toBe(1);
    expect(run.written).toBeNull();
  });

  it("lets a blower be blank, and keeps it null", () => {
    const run = importIn(rows);
    const row = JSON.parse(run.written!).appliances.find((a: { model: string }) => a.model === BLOWER);
    expect(row.webSizeIn).toBeNull();
  });

  it("stops on a blower given a size: its title has none", () => {
    const run = importIn(edit(BLOWER, "30"));
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(new RegExp(`${BLOWER}.*blower`));
    expect(run.written).toBeNull();
  });

  it('prints a size more than 1" from the width and does not stop', () => {
    const run = importIn(edit(FRIDGE, "40"));
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(new RegExp(`${FRIDGE}.*40.*36`));
  });
});

describe("_meta", () => {
  it("carries neither a day nor a path", () => {
    const { _meta } = JSON.parse(importIn(rows).written!);
    expect(Object.keys(_meta)).toEqual(["provenance"]);
    expect(JSON.stringify(_meta)).not.toMatch(/\d{4}-\d{2}-\d{2}|export\.csv/);
  });

  it("writes the same bytes on another day, from another path", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    const first = importIn(rows, "export.csv").written;
    vi.setSystemTime(new Date("2027-03-21T12:00:00Z"));
    const second = importIn(rows, "other-name.csv").written;
    expect(second).toBe(first);
  });
});
