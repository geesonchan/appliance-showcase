import { useEffect, useMemo, useState } from "react";
import { SCHEME } from "../data/catalogue";
import { SLOTS } from "../data/slots";
import { buildQuote, formatQuote } from "../data/quote";
import { useChecklist } from "../data/useChecklist";
import { useSelectedBlower, useSelection } from "../store/useSelection";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";

/**
 * The configuration, ready to leave the browser.
 *
 * Two tabs over one document: the summary a person reads and the JSON a system
 * reads. Both are built from the same state the scene is showing, so a quote
 * cannot describe a package the customer did not see.
 *
 * Copying is the primary action and email the secondary one. A mailto: is at
 * the mercy of whatever the OS has registered, and long bodies get truncated,
 * so the clipboard is what the user can rely on.
 */
export function QuoteDialog() {
  const t = useT();
  const open = useAppStore((s) => s.quoteOpen);
  const setQuoteOpen = useAppStore((s) => s.setQuoteOpen);
  const showToast = useAppStore((s) => s.showToast);
  const selection = useSelection();
  const blower = useSelectedBlower();
  const { findings, blockers } = useChecklist();
  const [tab, setTab] = useState<"summary" | "json">("summary");

  const hood = selection["slot-hood"];
  const quote = useMemo(
    () =>
      buildQuote({
        schemeId: SCHEME.id,
        schemeNameKey: SCHEME.nameKey,
        slots: SLOTS,
        selection,
        blower,
        hoodNeedsBlower: hood?.blower === "required",
        findings,
        t,
      }),
    [selection, blower, hood, findings, t],
  );

  const summary = useMemo(() => formatQuote(quote, t), [quote, t]);
  const json = useMemo(() => JSON.stringify(quote, null, 2), [quote]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuoteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setQuoteOpen]);

  if (!open) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Safari refuses the clipboard outside a user gesture it recognises, and
      // any page served over http has no clipboard at all. Fall back to a
      // selection the user can copy by hand rather than failing silently.
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast("quote.copied");
  };

  const mailto =
    "mailto:?subject=" +
    encodeURIComponent(t("quote.subject", { scheme: t(SCHEME.nameKey) })) +
    "&body=" +
    encodeURIComponent(summary);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[rgba(31,42,34,0.35)] sm:place-items-center sm:p-6"
      onClick={() => setQuoteOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("quote.title")}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-lg border border-line bg-surface sm:max-h-[80vh] sm:rounded-md"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-[19px] text-ink">{t("quote.title")}</h2>
          <button
            type="button"
            onClick={() => setQuoteOpen(false)}
            aria-label={t("quote.close")}
            className="grid h-7 w-7 place-items-center rounded-full border border-line text-[13px] text-ink-muted"
          >
            ×
          </button>
        </header>

        {blockers > 0 && (
          <p className="border-b border-line bg-[#FDF3F2] px-5 py-2.5 text-[11px] leading-snug text-[#8A2018]">
            {t("quote.blockers", { blockers })}
          </p>
        )}

        <div className="flex gap-1 px-5 pt-3">
          {(["summary", "json"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={[
                "rounded-full px-3 py-1 text-[11px] transition-colors",
                tab === value ? "bg-ink text-[#F7F5EF]" : "text-ink-muted hover:text-ink",
              ].join(" ")}
            >
              {t(`quote.${value}`)}
            </button>
          ))}
        </div>

        <pre className="mx-5 my-3 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-line bg-bg p-3 font-mono text-[10px] leading-[1.55] text-ink">
          {tab === "summary" ? summary : json}
        </pre>

        <footer className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={() => copy(tab === "summary" ? summary : json)}
            className="flex-1 rounded-full bg-accent px-4 py-2 text-[12px] font-medium text-[#F7F5EF] transition-opacity hover:opacity-90"
          >
            {tab === "summary" ? t("quote.copySummary") : t("quote.copyJson")}
          </button>
          <a
            href={mailto}
            className="flex-1 rounded-full border border-line px-4 py-2 text-center text-[12px] font-medium text-ink transition-colors hover:bg-bg"
          >
            {t("quote.email")}
          </a>
        </footer>
      </div>
    </div>
  );
}
