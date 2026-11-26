/**
 * Item 12e-3, D25: the one place an inch figure is written, held to a table.
 *
 * The samples are lopsided on purpose (a half of a sixteenth, a figure just under a
 * whole inch, an exact sixteenth written to three decimals), so a rule that only
 * looks right on 3.5 cannot pass.
 */
import { describe, expect, it } from "vitest";
import { feetAndInches, inchFigure, inches, inchText, sentenceValue } from "./inchText";

describe("inchFigure: reduced, to a sixteenth, the nearest, a half up, no 0 under an inch (D25)", () => {
  it.each([
    // Leo, 2026-11-24: 「咖啡机每侧填板 27/32，往上写 7/8″。」 TCM24PS each side in D's and E's coffee opening.
    [0.84375, "7/8"],
    [0.8125, "13/16"],
    [0.75, "3/4"],
    [0.0625, "1/16"],
    [0.03125, "1/16"],
    [0.03, "0"],
    [0, "0"],
    [3.5, "3-1/2"],
    [11.875, "11-7/8"],
    [35.97, "36"],
    [36, "36"],
    [29.6875, "29-11/16"],
    // An exact sixteenth the rule engine rounds to three decimals (rules.ts, `canopyClearance`).
    [29.688, "29-11/16"],
    [12.812, "12-13/16"],
    [178.75, "178-3/4"],
    [224.25, "224-1/4"],
    [-0.875, "-7/8"],
    [-28.3125, "-28-5/16"],
  ])("%s -> %s", (value, figure) => {
    expect(inchFigure(value)).toBe(figure);
  });
});

describe("inches: the figure with ″", () => {
  it.each([
    [3.5, "3-1/2″"],
    [0.75, "3/4″"],
    [8.8125, "8-13/16″"],
    [108.5, "108-1/2″"],
  ])("%s -> %s", (value, written) => {
    expect(inches(value)).toBe(written);
  });
});

describe("inchText: a size the data writes as text shows with ″, the data unchanged (Leo, 2026-11-24)", () => {
  it.each([
    ['1/2"', "1/2″"],
    ['3/4"', "3/4″"],
    ["3/4″", "3/4″"],
    ["120V", "120V"],
    ['"name"', '"name"'],
  ])("%s -> %s", (written, shown) => {
    expect(inchText(written)).toBe(shown);
  });
});

describe("feetAndInches: the room's size, the same in Chinese and English (Leo, 2026-11-24)", () => {
  it.each([
    [14, "14′"],
    [16 + 10 / 12, "16′10″"],
    [12.5, "12′6″"],
    [9.99, "10′"],
  ])("%s ft -> %s", (feet, written) => {
    expect(feetAndInches(feet)).toBe(written);
  });
});

describe("sentenceValue: what a sentence puts in for a placeholder", () => {
  it("a number right before ″ is a figure", () => {
    expect(sentenceValue(0.8125, true)).toBe("13/16");
    expect(sentenceValue(37.4375, true)).toBe("37-7/16");
  });
  it("a number not before ″ is left as it is", () => {
    expect(sentenceValue(119500, false)).toBe("119500");
    expect(sentenceValue(0.5, false)).toBe("0.5");
  });
  it("a data size string gets ″ wherever it stands", () => {
    expect(sentenceValue('3/4"', false)).toBe("3/4″");
  });
  it("any other string is left as it is", () => {
    expect(sentenceValue("119,500", false)).toBe("119,500");
  });
});
