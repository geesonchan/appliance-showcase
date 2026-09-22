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
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

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
