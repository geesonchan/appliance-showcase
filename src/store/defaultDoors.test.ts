import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import schemes from "../../data/schemes.json";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import { SCENE_COLORS } from "../three/materials";
import { ACCENT_COLORS, CABINET_COLORS, useAppStore } from "./useAppStore";

/**
 * Round 92a, Leo: the doors every package opens with are RAL 5015, which
 * replaces the forest green as the first cabinet chip. Only the doors: the
 * interface's own green and the accent palette are as they were.
 * docs/decisions.md D15, round 92a.
 */
describe("the doors a package opens with", () => {
  it("makes RAL 5015 the first cabinet chip, at the RAL table's value", () => {
    // #2874B2 written out from Wikipedia's overview table (D15, round 92).
    expect(CABINET_COLORS[0]).toEqual({
      key: "finish.cabinet.skyBlue",
      value: "#2874B2",
      token: "painted",
    });
  });

  it("opens with the doors that colour", () => {
    expect(useAppStore.getState().finishes.cabinet).toBe("#2874B2");
  });

  it("names the chip sky blue, in English and in Chinese", () => {
    expect([en["finish.cabinet.skyBlue"], zh["finish.cabinet.skyBlue"]]).toEqual(["Sky blue", "天蓝"]);
  });

  it("leaves no forest green among the cabinet chips, nor its name", () => {
    expect({
      chips: CABINET_COLORS.filter((paint) => paint.value === "#2E5C45").length,
      en: "finish.cabinet.green" in en,
      zh: "finish.cabinet.green" in zh,
    }).toEqual({ chips: 0, en: false, zh: false });
  });

  it("shows the doors' colour among Scheme 01's dots under the package summary, not the green", () => {
    // Leo, round 92a. Written out from the file, the second dot changed.
    expect(schemes.schemes[0].palette).toEqual(["#EFEDE6", "#2874B2", "#C9A77B", "#1F2A22"]);
  });

  it("keeps the other four cabinet chips as they were", () => {
    expect(CABINET_COLORS.slice(1).map((paint) => paint.value)).toEqual([
      "#2B3A4A", "#6E2639", "#E3DFD3", "#8B6B47",
    ]);
  });
});

describe("what does not change with the doors", () => {
  it("keeps the interface's own green, the buttons and what is selected", () => {
    const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
    expect({
      accent: css.match(/--accent:\s*(#[0-9a-fA-F]{6})/)?.[1].toUpperCase(),
      selection: SCENE_COLORS.selection,
    }).toEqual({ accent: "#2E5C45", selection: "#2E5C45" });
  });

  it("keeps the accent palette and the accent the page opens with", () => {
    expect({
      palette: ACCENT_COLORS.map((paint) => paint.value),
      opens: useAppStore.getState().finishes.accent,
    }).toEqual({
      palette: ["#8B6B47", "#23282B", "#8A4A38", "#EFE8D8", "#6B7375"],
      opens: "#8B6B47",
    });
  });
});
