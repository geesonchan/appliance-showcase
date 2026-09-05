import { useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { translate } from "./index";

/** Returns a `t(key, vars?)` bound to the currently selected language. */
export function useT() {
  const lang = useAppStore((s) => s.lang);
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
}
