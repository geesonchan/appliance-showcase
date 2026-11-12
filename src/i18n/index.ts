import en from "./en.json";
import zh from "./zh.json";

export type Lang = "en" | "zh";

type Dict = Record<string, string>;

const dictionaries: Record<Lang, Dict> = {
  en: en as Dict,
  zh: zh as Dict,
};

/**
 * Whether a language's copy has been through a human.
 *
 * `zh` is a machine-translation placeholder, and says so in its own file. The
 * UI shows that plainly rather than letting unreviewed copy pass for finished
 * work — someone reading it should know what they are reading.
 */
export const isMachineTranslated = (lang: Lang) =>
  (dictionaries[lang] as Record<string, unknown>)._translationStatus === "machine";

/**
 * Look up a copy string. Missing keys fall back to English, then to the key
 * itself, so an untranslated string is visible rather than blank.
 * `{name}` placeholders are replaced from `vars`.
 */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const raw = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  if (!vars) return raw;
  if (lang !== "zh") {
    return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  }
  // Chinese: a space where a name put in meets the line with a Latin letter on
  // one side and Chinese on the other (Leo, 2026-11-12: 「已切换为U 型厨房」，"为"和"U"
  // 之间加一个空格；其他中文里夹英文字母的地方照同样的规矩查一遍」; and for Undo, 「后面是英文
  // 字母时留空格（退回 L 型、退回 U 型），后面是中文时不留（退回一字型）」). Only at the seams: a
  // line's own words are written to the rule already (cjkSpacing.test.ts holds
  // them to it), and a name's own inside is the name's.
  let said = "";
  let last = 0;
  let seam = false;
  const add = (piece: string, isSeam: boolean) => {
    if (piece === "") return;
    if ((seam || isSeam) && said !== "" && needsSpace(said[said.length - 1], piece[0])) said += " ";
    said += piece;
    seam = isSeam;
  };
  for (const match of raw.matchAll(/\{(\w+)\}/g)) {
    const name = match[1];
    add(raw.slice(last, match.index), false);
    if (name in vars) add(String(vars[name]), true);
    else add(match[0], false);
    last = match.index! + match[0].length;
  }
  add(raw.slice(last), false);
  return said;
}

const HAN = /\p{Script=Han}/u;
const LATIN = /[A-Za-z]/;
/** Chinese on one side, a Latin letter on the other. */
const needsSpace = (before: string, after: string) =>
  (HAN.test(before) && LATIN.test(after)) || (LATIN.test(before) && HAN.test(after));

type Vars = Record<string, string | number>;

/**
 * A message whose vars may name other messages.
 *
 * A var whose name ends in `Key` is itself a key: it is looked up with the same
 * plain vars and put in under the name without `Key` — `whereKey` fills
 * `{where}`. Rules, the generator and the rough-in points have no language, so
 * they name a string rather than write it, and each part of a line is a whole
 * phrase in its own language rather than English words put in English order.
 *
 * One place for the convention (round 70). It used to be written twice, in the
 * checklist and the toast, and the spec card and the quote did not follow it at
 * all — so a line with a keyed var printed its placeholder there.
 */
export function sayWith(
  t: (key: string, vars?: Vars) => string,
  key: string,
  vars?: Vars,
): string {
  if (!vars) return t(key);
  const plain: Vars = {};
  for (const [name, value] of Object.entries(vars)) if (!name.endsWith("Key")) plain[name] = value;
  const resolved: Vars = { ...plain };
  for (const [name, value] of Object.entries(vars)) {
    if (name.endsWith("Key") && typeof value === "string") resolved[name.slice(0, -3)] = t(value, plain);
  }
  return t(key, resolved);
}
