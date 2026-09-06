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
