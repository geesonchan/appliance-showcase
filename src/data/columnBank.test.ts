import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { builtInFront } from "./fridgeModel";
import { setActivePackage, setLayoutParamsGrowing } from "./layoutState";
import { oneWallWantedIn, type LayoutParams } from "./layoutTemplate";
import { PACKAGE, PACKAGE_BY_ID } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { defaultSelectionOf, resetRoom } from "./testRoom";
import { checklistFor } from "./useChecklist";
import { sayWith, translate } from "../i18n";
import type { RunSegment } from "./roomShell";
import type { SlotId } from "../types";

/**
 * The columns side by side (round 101, step two; Leo, 2026-11-04, A-3, A-4,
 * A-16, A-17; item 5, 2026-11-05: 「不用，照 A-3」).
 *
 * The cases stand against each other with nothing between them, so a group of
 * columns is its columns' openings added up and a board at each end: 3/4"
 * (B's too, as the refrigerator's front round finished A's), and 3-1/2" of
 * filler beyond it, or in place of it on B, against a wall. Each door is its
 * opening less 1/4", an eighth each side; two doors side by side 1/4" apart.
 * The list names no part: 「柱子并排共 N 处，按说明书连接。」
 */

afterAll(() => resetRoom());

const BANK_PIECES = ["tall-inner", "tall-outer", "tall-clearance"];
const COLUMNS: SlotId[] = ["slot-freezer", "slot-fridge", "slot-wine"];
const inches = (feet: number) => Math.round(feet * 12 * 16) / 16;

/** A package's room in a shape, its refrigerator's end against cabinetry or a wall, at the wall it needs. */
function room(pkg: string, shape: "L" | "one-wall", fridgeEndAbuts: "cabinet" | "wall") {
  resetRoom();
  expect(setActivePackage(pkg).ok).toBe(true);
  const asked: LayoutParams = { ...REQUESTED_PARAMS, fridgeEndAbuts, shape };
  const backWallIn = shape === "one-wall" ? Math.max(asked.backWallIn, oneWallWantedIn(asked, PACKAGE_BY_ID[pkg])) : asked.backWallIn;
  const result = setLayoutParamsGrowing({ ...asked, backWallIn });
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
}

/** The group of columns on its run, in the order it stands: each piece's name, width and what it is made of. */
function theBank() {
  const run = RUNS.find((candidate) => candidate.segments.some((segment) => segment.slot && COLUMNS.includes(segment.slot)))!;
  const isBank = (segment: RunSegment) =>
    (!!segment.slot && COLUMNS.includes(segment.slot)) ||
    BANK_PIECES.some((piece) => segment.id.replace(/^(back|left)-/, "") === piece) ||
    /-tall-spacer-\d+$/.test(segment.id);
  const pieces = run.segments.filter(isBank);
  return {
    pieces: pieces.map((segment) => ({
      id: segment.slot ?? segment.id.replace(/^(back|left)-/, ""),
      widthIn: inches(segment.to - segment.from),
      kinds: segment.modules.map((module) => module.kind),
    })),
    // Each piece starts where the one before it stops: nothing between them.
    touching: pieces.every((segment, index) => index === 0 || Math.abs(segment.from - pieces[index - 1].to) < 1e-9),
    totalIn: inches(pieces[pieces.length - 1].to - pieces[0].from),
  };
}

describe("columns standing case against case (A-3, A-4)", () => {
  // Not symmetric on purpose: three packages with three different groups
  // (36 + 18, 24 + 30 + 24 or 18 + 24 + 18, 30 + 18), an end against
  // cabinetry in some and a wall in others, so no two totals are the same.
  // The boards: 3/4" at each end, and 3-1/2" of filler at a wall — beyond
  // the board on D, in place of it on B (as A's refrigerator). E on one wall
  // ends against its coffee tower, not the wall.
  const rooms: [string, string, "L" | "one-wall", "cabinet" | "wall", number[], number][] = [
    ["B, the L, its end against cabinetry", "package-b", "L", "cabinet", [0.75, 0.75], 55.5],
    ["B, the L, its end against a wall", "package-b", "L", "wall", [0.75, 3.5], 58.25],
    ["B, one wall", "package-b", "one-wall", "wall", [0.75, 3.5], 58.25],
    ["D, the L, its end against a wall", "package-d", "L", "wall", [0.75, 0.75, 3.5], 83],
    ["D, one wall", "package-d", "one-wall", "wall", [0.75, 0.75, 3.5], 65],
    ["E, the L, its end against cabinetry", "package-e", "L", "cabinet", [0.75, 0.75], 49.5],
    ["E, one wall", "package-e", "one-wall", "wall", [0.75, 0.75], 49.5],
  ];

  for (const [name, pkg, shape, abuts, endBoards, totalIn] of rooms) {
    it(`puts nothing between two columns, and the group is its openings and its end boards: ${name}`, () => {
      room(pkg, shape, abuts);
      const bank = theBank();
      const openings = bank.pieces.filter((piece) => piece.id.startsWith("slot-"));
      const boards = bank.pieces.filter((piece) => !piece.id.startsWith("slot-"));
      expect({
        nothingBetween: bank.pieces.every((piece) => !(piece.kinds as string[]).includes("spacer")),
        touching: bank.touching,
        // Each column's piece is its own opening.
        openings: openings.map((piece) => piece.widthIn),
        boards: boards.map((piece) => piece.widthIn).sort((a, b) => a - b),
        totalIn: bank.totalIn,
      }).toEqual({
        nothingBetween: true,
        touching: true,
        openings: openings.map((piece) => SLOT_BY_ID[piece.id as SlotId].cutout.w),
        boards: endBoards,
        totalIn,
      });
    });
  }
});

describe("the doors in a group of columns (A-16, A-17)", () => {
  /** Each refrigerator and freezer column's door width as drawn, by slot. */
  const doors = () =>
    Object.fromEntries(
      PACKAGE.slots
        .filter((slot) => slot.slotId === "slot-fridge" || slot.slotId === "slot-freezer")
        .map((slot) => [slot.slotId, builtInFront(SLOT_BY_ID[slot.slotId], APPLIANCE_BY_ID[PACKAGE.defaultSelection[slot.slotId]!])?.doorWidthIn ?? null]),
    );

  it("hangs each door 1/4\" narrower than its own opening: B's T36BT120NS 35-3/4\", from its manual", () => {
    room("package-b", "L", "cabinet");
    expect(doors()).toEqual({ "slot-fridge": 35.75 });
  });

  it("hangs D's freezer and refrigerator columns 23-3/4\" and 29-3/4\" in the L, and 17-3/4\" and 23-3/4\" on one wall", () => {
    room("package-d", "L", "wall");
    const l = doors();
    room("package-d", "one-wall", "wall");
    expect({ l, oneWall: doors() }).toEqual({
      l: { "slot-freezer": 23.75, "slot-fridge": 29.75 },
      oneWall: { "slot-freezer": 17.75, "slot-fridge": 23.75 },
    });
  });

  it("hangs E's 18\" freezer and 30\" refrigerator 17-3/4\" and 29-3/4\"", () => {
    room("package-e", "L", "cabinet");
    expect(doors()).toEqual({ "slot-freezer": 17.75, "slot-fridge": 29.75 });
  });
});

describe("the list's line for columns side by side (A-6; Leo's words, answer 3)", () => {
  const joints = (pkg: string) => {
    room(pkg, "L", "cabinet");
    const findings = checklistFor(defaultSelectionOf(pkg), null).findings;
    return findings
      .filter((finding) => finding.ruleId.startsWith("column-"))
      .map((finding) => ({ ruleId: finding.ruleId, messageKey: finding.messageKey, params: finding.params, under: COLUMNS.includes(finding.slot!) }));
  };

  it("counts the joints, names no part and no width, and is under one of the columns", () => {
    // One joint is said in the singular, more than one in the plural (Leo,
    // 2026-11-05): B's and E's one, D's two.
    expect({ B: joints("package-b"), D: joints("package-d"), E: joints("package-e") }).toEqual({
      B: [{ ruleId: "column-joints", messageKey: "rule.columnJoints.one", params: { count: 1 }, under: true }],
      D: [{ ruleId: "column-joints", messageKey: "rule.columnJoints.many", params: { count: 2 }, under: true }],
      E: [{ ruleId: "column-joints", messageKey: "rule.columnJoints.one", params: { count: 1 }, under: true }],
    });
  });

  it("says one joint and two joints in Leo's words, in English and in Chinese", () => {
    const said = (pkg: string, lang: "en" | "zh") => {
      room(pkg, "L", "cabinet");
      const line = checklistFor(defaultSelectionOf(pkg), null).findings.find((finding) => finding.ruleId === "column-joints")!;
      return sayWith((key, vars) => translate(lang, key, vars), line.messageKey, line.params);
    };
    expect({
      B: [said("package-b", "en"), said("package-b", "zh")],
      D: [said("package-d", "en"), said("package-d", "zh")],
      E: [said("package-e", "en"), said("package-e", "zh")],
    }).toEqual({
      B: ["1 column joint side by side: join it as the installation guide shows.", "柱子并排共 1 处，按说明书连接。"],
      D: ["2 column joints side by side: join them as the installation guide shows.", "柱子并排共 2 处，按说明书连接。"],
      E: ["1 column joint side by side: join it as the installation guide shows.", "柱子并排共 1 处，按说明书连接。"],
    });
  });

  it("is not on the list of a package with no columns side by side", () => {
    expect({ A: joints("package-a"), C: joints("package-c") }).toEqual({ A: [], C: [] });
  });
});
