/**
 * Item 12e-3, D25: how the dictionaries write an inch figure. Leo, 2026-11-23 and
 * 2026-11-24, word for word:
 * 「英寸号统一用 ″，不用 "。」「尺寸用分数，不用小数。」「整数和分数之间用连字符，写成 3-1/2″。」
 * 「分数约到最简，最细到 1/16。不到 1 英寸的不写 0，写成 3/4″。」
 * 「一句里每个数都带 ″；大小用 ×，范围用 –；x 统一成 ×。」
 * 「英尺：英文用 ′，中文保留"英尺"两个字。」「中英文数字的写法完全一样。」
 * 「尺寸线旁的小字加 ″。」
 *
 * The exceptions, by key, each with its reason, and no other.
 */
import { describe, expect, it } from "vitest";
import en from "./en.json";
import zh from "./zh.json";

const EXEMPT: Record<string, string> = {
  // `"{raw}"` is a quotation of what was typed, not an inch mark.
  "refusal.notALength": "quotes what was typed",
  "refusal.notAChoice": "quotes what was typed",
  // Leo, 2026-11-24: 「5-29/32″ 照说明书原样留。」 TCM24PS's installation manual, p. 10.
  "rule.coffeeDrainOptional": "5-29/32″ as its manual prints it",
};

const lines = (dict: Record<string, unknown>) =>
  Object.entries(dict).filter((entry): entry is [string, string] => typeof entry[1] === "string" && !entry[0].startsWith("_"));
const BOTH = [["en", lines(en)], ["zh", lines(zh)]] as const;

/** Every line breaking a rule, as "lang key: line". */
function breaking(test: (line: string, key: string, lang: string) => boolean, honourExempt = true): string[] {
  const out: string[] = [];
  for (const [lang, entries] of BOTH) {
    for (const [key, line] of entries) {
      if (honourExempt && key in EXEMPT) continue;
      if (test(line, key, lang)) out.push(`${lang} ${key}: ${line}`);
    }
  }
  return out;
}

describe("the dictionaries write an inch figure one way (D25)", () => {
  it('no " after a figure or a placeholder', () => {
    expect(breaking((line) => /[0-9}]"/.test(line))).toEqual([]);
  });
  it("no ½ ¼ ¾ ⅛ ⅜ ⅝ ⅞", () => {
    expect(breaking((line) => /[½¼¾⅛⅜⅝⅞]/.test(line))).toEqual([]);
  });
  it("no decimal before ″", () => {
    expect(breaking((line) => /\d\.\d+″/.test(line))).toEqual([]);
  });
  it("a fraction is reduced, a sixteenth at the finest, with no 0 before it", () => {
    expect(
      breaking((line) => [...line.matchAll(/(?:(\d+)-)?(\d+)\/(\d+)″/g)].some((m) => {
        const [n, d] = [Number(m[2]), Number(m[3])];
        return ![2, 4, 8, 16].includes(d) || n % 2 === 0 || n >= d || m[1] === "0";
      })),
    ).toEqual([]);
  });
  it("× between the figures of a size, never x", () => {
    expect(breaking((line) => /[0-9}]″\s*x\s*[0-9{]/.test(line))).toEqual([]);
  });
  it("both ends of a range carry ″", () => {
    expect(breaking((line) => /[0-9}]–[0-9{][^\s，,;；]*″/.test(line))).toEqual([]);
  });
  it("English writes feet ′, not '", () => {
    // A ' with a letter after it is a possessive ("D13's"), not a foot.
    expect(breaking((line, _key, lang) => lang === "en" && /\d'(?![A-Za-z])/.test(line))).toEqual([]);
  });
  it("Chinese and English write the same figures the same way", () => {
    const figures = (line: string) => [...line.matchAll(/\d+(?:-\d+\/\d+|\/\d+)?″/g)].map((m) => m[0]).sort();
    const zhByKey = new Map(lines(zh));
    // Leo, 2026-11-25: 「refusal.windowGap 的英文改成 within 6″ of the sink，别的字不动。」 No key is held out.
    const differing = lines(en)
      .filter(([key, line]) => zhByKey.has(key) && JSON.stringify(figures(line)) !== JSON.stringify(figures(zhByKey.get(key)!)))
      .map(([key]) => key);
    expect(differing).toEqual([]);
  });
  // Leo, 2026-11-24: 「尺寸线旁的小字加 ″。」四个键都加，中英文一样。
  it.each(["dimension.clearanceRangeCooktop", "dimension.clearanceRangeRecommended", "dimension.clearanceMinIsland", "dimension.standard"])(
    "%s: every figure carries ″, in both languages",
    (key) => {
      for (const dict of [en, zh] as Record<string, string>[]) {
        const placeholders = [...dict[key].matchAll(/\{(min|max|value)\}(″?)/g)];
        expect(placeholders.length).toBeGreaterThan(0);
        expect(placeholders.filter((m) => m[2] !== "″").map((m) => m[0])).toEqual([]);
      }
    },
  );
  it("every exception is still needed", () => {
    const rules = [/[0-9}]"/, /(\d+)\/(32|64)″/];
    const stale = Object.keys(EXEMPT).filter((key) => !rules.some((rule) => rule.test((en as Record<string, string>)[key] ?? "")));
    expect(stale).toEqual([]);
  });
});
