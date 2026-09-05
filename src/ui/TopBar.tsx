import { useEffect, useState } from "react";
import { SCHEME } from "../data/appliances";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
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

export function TopBar() {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const { isFullscreen, toggle } = useFullscreen();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3 md:gap-5">
        <span className="whitespace-nowrap font-display text-[17px] leading-none tracking-wide text-accent md:text-[19px]">
          {t("app.title")}
        </span>
        <span className="hidden h-4 w-px bg-line sm:block" />
        <span className="hidden truncate text-[13px] text-ink sm:block">{t(SCHEME.nameKey)}</span>
        <span className="tracking-label hidden shrink-0 rounded-full border border-line px-2.5 py-1 text-[9px] text-ink-muted lg:inline-block">
          {t("app.tagline")}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <Segmented
          size="sm"
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
          className="grid h-8 w-8 place-items-center rounded-full border border-line text-[12px] text-ink-muted transition-colors hover:border-accent hover:text-accent"
          aria-label={t("topbar.help")}
          title={t("topbar.help")}
        >
          ?
        </button>
        <button
          type="button"
          onClick={toggle}
          className="hidden h-8 w-8 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent sm:grid"
          aria-label={isFullscreen ? t("topbar.exitFullscreen") : t("topbar.fullscreen")}
          title={isFullscreen ? t("topbar.exitFullscreen") : t("topbar.fullscreen")}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
