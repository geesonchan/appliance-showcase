import en from "./en.json";
import zh from "./zh.json";

export type Lang = "en" | "zh";

type Dict = Record<string, string>;

const dictionaries: Record<Lang, Dict> = {
  en: en as Dict,
  // M1 ships English copy only; zh is intentionally empty and falls back to en
  // so the language switch is wired up and ready for the M2 translation pass.
  zh: zh as Dict,
};

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
