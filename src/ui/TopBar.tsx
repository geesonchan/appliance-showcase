import { useEffect, useRef, useState } from "react";
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
 * 94). On a phone it hands the link to the system's share sheet; where a
 * phone's browser has none (WeChat's, for one), it copies it. On a desktop it
 * copies the link and says so, as in round 94, and opens a box with the link,
 * Copy and the link as a QR code, for a customer in the shop to scan (round 95,
 * Leo).
 */
function ShareButton() {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);
  const [boxUrl, setBoxUrl] = useState<string | null>(null);
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
    if (!phone) setBoxUrl(url);
  };
  return (
    <>
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
      {boxUrl && <ShareBox url={boxUrl} onClose={() => setBoxUrl(null)} />}
    </>
  );
}

/**
 * The share box on a desktop: the link, Copy, and the QR code. Round 95, Leo.
 *
 * The code is drawn by `shareQr.ts`, which with its library is loaded only
 * now, when the box opens. Closed by its ×, by Escape, or by a press outside
 * it. It is laid over the scene and moves no camera (D1).
 */
function ShareBox({ url, onClose }: { url: string; onClose: () => void }) {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    void import("./shareQr").then(({ drawQr }) => {
      if (live && canvas.current) drawQr(canvas.current, url);
    });
    return () => {
      live = false;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (box.current?.contains(target)) return;
      // The share button itself opens it again with a fresh link.
      if ((target as Element).closest?.("[data-share]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPress);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPress);
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={t("share.box.title")}
      data-share-box
      className="fixed right-4 top-16 z-50 w-max rounded-2xl border border-line bg-surface p-4 shadow-[0_12px_32px_rgba(31,42,34,0.18)]"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[13px] font-medium text-ink">{t("share.box.title")}</h2>
        <button
          type="button"
          data-share-box-close
          onClick={onClose}
          aria-label={t("mobile.close")}
          className="grid h-7 w-7 place-items-center rounded-full border border-line text-[13px] text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          ×
        </button>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <input
          readOnly
          data-share-link
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-1.5 font-mono text-[11px] text-ink-muted"
        />
        <button
          type="button"
          data-share-copy
          onClick={() => void copyText(url).then(() => showToast("share.copied"))}
          className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          {t("share.box.copy")}
        </button>
      </div>
      <canvas ref={canvas} data-share-qr className="mx-auto block" />
      <p className="mt-2 text-center text-[11px] text-ink-muted">{t("share.box.scan")}</p>
    </div>
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
