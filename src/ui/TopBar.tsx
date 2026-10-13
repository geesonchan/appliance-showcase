import { useEffect, useState } from "react";
import { PACKAGES } from "../data/packages";
import { isMachineTranslated } from "../i18n";
import { useT } from "../i18n/useT";
import { shareUrl } from "../store/openLink";
import { useAppStore } from "../store/useAppStore";
import { copyText } from "./copyText";
import { Segmented } from "./primitives";

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  return { isFullscreen, toggle };
}

/**
 * The share button: a link that rebuilds the kitchen on screen (D23, round
 * 94). On a phone it hands the link to the system's share sheet; on a desktop,
 * or where the browser has no share sheet (WeChat's, for one), it copies it.
 */
function ShareButton() {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);
  const share = async () => {
    const url = shareUrl();
    const phone = window.matchMedia("(max-width: 767px)").matches;
    if (phone && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("app.title"), url });
        return;
      } catch (error) {
        // Closing the sheet is an answer, not a failure.
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    await copyText(url);
    showToast("share.copied");
  };
  return (
    <button
      type="button"
      data-share
      onClick={() => void share()}
      className="grid h-7 w-7 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent md:h-8 md:w-8"
      aria-label={t("share.button")}
      title={t("share.button")}
    >
      {/* A box with an arrow leaving it: the share mark on both phones. */}
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M7 1.5v7.5M4.2 4.2 7 1.5l2.8 2.7M4.5 6.5H3v6h8v-6H9.5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function TopBar() {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const setQuoteOpen = useAppStore((s) => s.setQuoteOpen);
  const packageId = useAppStore((s) => s.packageId);
  const setPackageId = useAppStore((s) => s.setPackageId);
  const { isFullscreen, toggle } = useFullscreen();

  // Below the desktop width every control is held on one line down to a
  // 360px phone, in both languages, with room for Share: tighter padding and
  // gaps, nothing taken away (round 94, D23; tests/topBar.test.ts).
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3 md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3 md:gap-5">
        {/* The title gives way first. On a narrow phone the header has to hold
            the package switch and the quote, and both of those are controls —
            a label the reader can already see in the tab is not. */}
        <span className="hidden truncate font-display text-[17px] leading-none tracking-wide text-accent min-[430px]:block md:text-[19px]">
          {t("app.title")}
        </span>
        <span className="hidden h-4 w-px shrink-0 bg-line min-[430px]:block" />
        {/* Which package the room is showing. It is the top-level choice — it
            decides how wide every opening is, so it sits where the scheme's
            name used to and everything below follows it. See D16. */}
        <div className="shrink-0">
          <Segmented
            size="sm"
            tight
            name="package"
            value={packageId}
            onChange={setPackageId}
            options={PACKAGES.map((entry) => {
              const name = entry.name[lang] ?? entry.name.en;
              return {
                value: entry.id,
                // The letter, because this has to be a control on a phone as
                // well as on a desk, and A/B/C is what everybody calls them.
                label: entry.code,
                // Registered rather than hidden: the range on offer stays
                // visible where it is not finished yet.
                disabled: !entry.available,
                title: entry.available
                  ? name
                  : `${name} — ${t("topbar.package.planned")}`,
              };
            })}
          />
        </div>
        <span className="tracking-label hidden shrink-0 rounded-full border border-line px-2.5 py-1 text-[9px] text-ink-muted lg:inline-block">
          {t("app.tagline")}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-3">
        {/* Unreviewed copy says so, rather than passing for finished work. */}
        {isMachineTranslated(lang) && (
          <span
            data-mt-chip
            title={t("translation.machine")}
            className="rounded-sm border border-line px-1 py-0.5 md:px-1.5 font-mono text-[9px] uppercase tracking-wide text-ink-muted"
          >
            MT
          </span>
        )}
        {/* The one way to the package and its prices. See docs/decisions.md D12. */}
        <button
          type="button"
          onClick={() => setQuoteOpen(true)}
          className="whitespace-nowrap rounded-full border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent md:px-3"
        >
          {t("topbar.quote")}
        </button>
        <ShareButton />
        <Segmented
          size="sm"
          tight
          value={lang}
          onChange={setLang}
          options={[
            { value: "en", label: t("topbar.lang.en") },
            { value: "zh", label: t("topbar.lang.zh") },
          ]}
        />
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="grid h-7 w-7 place-items-center md:h-8 md:w-8 rounded-full border border-line text-[12px] text-ink-muted transition-colors hover:border-accent hover:text-accent"
          aria-label={t("topbar.help")}
          title={t("topbar.help")}
        >
          ?
        </button>
        <button
          type="button"
          onClick={toggle}
          className="hidden h-8 w-8 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent sm:grid"
          aria-label={
            isFullscreen ? t("topbar.exitFullscreen") : t("topbar.fullscreen")
          }
          title={
            isFullscreen ? t("topbar.exitFullscreen") : t("topbar.fullscreen")
          }
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
