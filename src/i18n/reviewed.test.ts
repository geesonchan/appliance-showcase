import { describe, expect, it } from "vitest";
import en from "./en.json";
import zh from "./zh.json";
import reviewed from "./reviewed.json";

/**
 * Copy Leo has approved stays the copy he approved (D10, round 70).
 *
 * Each case compares a dictionary line with the text recorded when it was
 * reviewed, word for word. This is a lock on purpose: a red here means an
 * approved sentence was edited, and the edit has to be read again and entered
 * in `reviewed.json` before it ships — not that the test wants updating.
 */
type Locked = Record<string, { text: string; reviewed: string }>;
const dictionaries = { en, zh } as Record<string, Record<string, string>>;
const list = reviewed as unknown as Record<string, Locked | string>;

const cases = Object.entries(list)
  .filter(([lang]) => !lang.startsWith("_"))
  .flatMap(([lang, keys]) =>
    Object.entries(keys as Locked).map(([key, { text }]) => [lang, key, text] as const),
  );

describe("reviewed copy", () => {
  it("lists something, so the cases below are not an empty pass", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)("%s %s says exactly what was reviewed", (lang, key, text) => {
    expect(dictionaries[lang][key]).toBe(text);
  });
});
