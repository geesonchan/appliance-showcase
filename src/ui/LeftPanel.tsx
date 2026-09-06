import { SCHEME, SLOT_ORDER } from "../data/catalogue";
import { formatPrice, formatThousands, usePackageSummary } from "../data/packageSummary";
import { SLOT_BY_ID } from "../data/slots";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";
import { SwapPanel } from "./SwapPanel";

/**
 * Hero copy, the two headline numbers, and the appliance list — until a slot is
 * selected, at which point the column drills into that slot's alternatives.
 */
export function LeftPanel() {
  const t = useT();
  const summary = usePackageSummary();
  const selection = useSelection();
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const selectSlot = useAppStore((s) => s.selectSlot);

  if (selectedSlot) return <SwapPanel slotId={selectedSlot} />;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-5 pb-6 pt-6">
        <p className="tracking-label text-[10px] text-ink-muted">{t("hero.eyebrow")}</p>
        <h1 className="mt-2 font-display text-[30px] leading-[1.15] text-ink">
          {t("hero.title")}
        </h1>
        <p className="mt-3 text-[12px] leading-[1.6] text-ink-muted">{t("hero.body")}</p>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-line bg-line">
        <div className="bg-surface px-5 py-4">
          <div className="font-display text-[32px] leading-none text-accent">
            {String(summary.count).padStart(2, "0")}
          </div>
          <div className="tracking-label mt-2 text-[9px] text-ink-muted">
            {t("hero.stat.appliances")}
          </div>
        </div>
        <div className="bg-surface px-5 py-4">
          <div className="font-display text-[32px] leading-none text-accent">
            {formatThousands(summary.rangeLow)}
            <span className="text-ink-muted">–</span>
            {formatThousands(summary.rangeHigh)}
          </div>
          <div className="tracking-label mt-2 text-[9px] text-ink-muted">
            {t("hero.stat.priceRange")}
          </div>
          {!summary.fullyPriced && (
            <div className="mt-1 text-[9px] text-ink-muted/70">
              {t("panel.package.priced", {
                priced: summary.pricedCount,
                total: summary.count,
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
        <h2 className="tracking-label text-[10px] text-ink-muted">{t("list.title")}</h2>
        <span className="text-[10px] text-ink-muted/70">{t("list.hint")}</span>
      </div>

      <ul className="pb-6">
        {SLOT_ORDER.map((slotId, index) => {
          const slot = SLOT_BY_ID[slotId];
          const appliance = selection[slotId];
          const active = selectedSlot === slotId;
          return (
            <li key={slotId}>
              <button
                type="button"
                onClick={() => selectSlot(slotId)}
                className={[
                  "group flex w-full items-center gap-3 border-l-2 px-5 py-3 text-left transition-colors",
                  active
                    ? "border-l-accent bg-[rgba(46,92,69,0.07)]"
                    : "border-l-transparent hover:bg-[rgba(46,92,69,0.04)]",
                ].join(" ")}
              >
                <span className="w-5 shrink-0 font-display text-[13px] tabular-nums text-ink-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">
                    {t(slot.labelKey)}
                  </span>
                  {appliance && (
                    <span className="block truncate text-[11px] text-ink-muted">
                      {appliance.brand} · {appliance.model}
                    </span>
                  )}
                </span>
                {appliance && (
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
                    {formatPrice(appliance.msrpUSD, t("price.onRequest"))}
                  </span>
                )}
                <span
                  className={
                    "shrink-0 text-[12px] transition-transform " +
                    (active ? "translate-x-0.5 text-accent" : "text-ink-muted/50")
                  }
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-auto border-t border-line px-5 py-4 text-[11px] leading-[1.6] text-ink-muted">
        {t(SCHEME.conceptKey)}
      </p>
    </div>
  );
}
