import { describe, expect, it } from "vitest";
import en from "./en.json";
import zh from "./zh.json";

const PLACEHOLDER = /\{(\w+)\}/g;
const placeholders = (value: string) =>
  [...value.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();

const enKeys = Object.keys(en as Record<string, string>);
const zhEntries = Object.entries(zh as Record<string, string>).filter(
  ([key]) => !key.startsWith("_"),
);

describe("translations", () => {
  it("covers every English key", () => {
    const zhKeys = new Set(zhEntries.map(([key]) => key));
    const missing = enKeys.filter((key) => !zhKeys.has(key));
    expect(missing).toEqual([]);
  });

  it("has no keys English does not", () => {
    const extra = zhEntries.map(([key]) => key).filter((key) => !enKeys.includes(key));
    expect(extra).toEqual([]);
  });

  // A dropped {cfm} would render a sentence with a hole in it.
  it("keeps the same interpolation placeholders", () => {
    for (const [key, value] of zhEntries) {
      expect(placeholders(value), key).toEqual(
        placeholders((en as Record<string, string>)[key]),
      );
    }
  });

  it("marks itself as unreviewed", () => {
    expect((zh as Record<string, string>)._translationStatus).toBe("machine");
  });
});
