import { useEffect } from "react";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";

export function HelpDialog() {
  const t = useT();
  const open = useAppStore((s) => s.helpOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setHelpOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(31,42,34,0.35)] p-6"
      onClick={() => setHelpOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("help.title")}
        className="w-full max-w-sm rounded-md border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[22px] text-ink">{t("help.title")}</h2>
        <ul className="mt-4 space-y-2.5 text-[12px] leading-[1.6] text-ink-muted">
          <li>{t("help.rotate")}</li>
          <li>{t("help.zoom")}</li>
          <li>{t("help.select")}</li>
          <li>{t("help.modes")}</li>
        </ul>
        <button
          type="button"
          onClick={() => setHelpOpen(false)}
          className="mt-5 w-full rounded-full bg-accent py-2 text-[12px] font-medium text-[#F7F5EF]"
        >
          {t("help.close")}
        </button>
      </div>
    </div>
  );
}
