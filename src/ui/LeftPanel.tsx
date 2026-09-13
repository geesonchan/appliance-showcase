import { SCHEME, SCHEME_FALLBACKS, SLOT_ORDER } from "../data/catalogue";
import { usePackageSummary } from "../data/packageSummary";
import { formatInches } from "../data/fit";
import { ROOM, SLOT_BY_ID, isOmitted } from "../data/slots";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useSelection } from "../store/useSelection";
import { DebugBadge } from "./DebugBadge";
import { SwapPanel } from "./SwapPanel";

/** A length in feet as 16′10″, or 14′ when it is whole. */
function feetInches(feet: number) {
  const total = Math.round(feet * 12);
  const whole = Math.floor(total / 12);
  const inches = total - whole * 12;
  return inches === 0 ? `${whole}′` : `${whole}′${inches}″`;
}

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
    <div data-panel="list" className="flex h-full flex-col overflow-y-auto overflow-x-hidden">
      <div className="px-5 pb-6 pt-6">
        <p className="tracking-label text-[10px] text-ink-muted">{t("hero.eyebrow")}</p>
        <h1 className="mt-2 font-display text-[30px] leading-[1.15] text-ink">
          {t("hero.title")}
        </h1>
        <p className="mt-3 text-[12px] leading-[1.6] text-ink-muted">{t("hero.body")}</p>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-line bg-line">
        <div className="min-w-0 bg-surface px-5 py-4">
          <div className="font-display text-[32px] leading-none text-accent">
            {String(summary.count).padStart(2, "0")}
          </div>
          <div className="tracking-label mt-2 text-[9px] text-ink-muted">
            {t("hero.stat.appliances")}
          </div>
        </div>
        {/* The room's size, not its price: what this screen is for. In feet and
            inches, because a generated room is not a whole number of feet, and
            printed raw in display type it ran 400px past the column. */}
        <div className="flex min-w-0 flex-col justify-between bg-surface px-5 py-4">
          <div className="font-display text-[18px] leading-[1.15] text-accent">
            <span className="whitespace-nowrap">{feetInches(ROOM.halfX * 2)}</span>{" "}
            <span className="text-ink-muted">×</span>{" "}
            <span className="whitespace-nowrap">{feetInches(ROOM.halfZ * 2)}</span>
          </div>
          <div className="tracking-label mt-2 text-[9px] text-ink-muted">
            {t("hero.stat.room")}
          </div>
        </div>
      </div>

      {/* Two machines short of the package, and why: the count above is the
          room as drawn, and the difference is the one thing on this screen the
          customer did not ask for. */}
      {summary.omitted.length > 0 && (
        <p className="border-b border-line bg-[rgba(46,92,69,0.05)] px-5 py-3 text-[11px] leading-[1.5] text-ink-muted">
          {t("rule.noIslandOmitted")}
        </p>
      )}

      <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
        <h2 className="tracking-label text-[10px] text-ink-muted">{t("list.title")}</h2>
        <span className="text-[10px] text-ink-muted/70">{t("list.hint")}</span>
      </div>

      <ul className="pb-6">
        {SLOT_ORDER.filter((slotId) => !isOmitted(slotId)).map((slotId, index) => {
          const slot = SLOT_BY_ID[slotId];
          const appliance = selection[slotId];
          const active = selectedSlot === slotId;
          return (
            <li key={slotId}>
              <button
                type="button"
                onClick={() => selectSlot(slotId)}
                className={[
                  "group flex w-full items-center gap-2.5 border-l-2 py-2.5 pl-4 pr-3 text-left transition-colors",
                  active
                    ? "border-l-accent bg-[rgba(46,92,69,0.07)]"
                    : "border-l-transparent hover:bg-[rgba(46,92,69,0.04)]",
                ].join(" ")}
              >
                <span className="w-5 shrink-0 self-start pt-px font-display text-[12px] tabular-nums text-ink-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {/* Two lines: what it is, with the opening it takes on the
                    right; then which model, cut short rather than wrapped. */}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] leading-[1.3] text-ink">
                      <span className="truncate">{t(slot.labelKey)}</span>
                      {SCHEME_FALLBACKS[slotId] && (
                        <DebugBadge
                          labelKey="debug.fallback"
                          title={`scheme asked for ${SCHEME_FALLBACKS[slotId]}`}
                        />
                      )}
                    </span>
                    {/* The opening, not the price. See docs/decisions.md D12. */}
                    <span className="shrink-0 text-right text-[10px] tabular-nums text-ink-muted/80">
                      {formatInches(slot.cutout.w)}
                    </span>
                  </span>
                  {appliance && (
                    <span
                      className="mt-0.5 block truncate text-[11px] leading-[1.3] text-ink-muted"
                      title={`${appliance.brand} ${appliance.model}`}
                    >
                      {appliance.brand} · {appliance.model}
                    </span>
                  )}
                </span>
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
