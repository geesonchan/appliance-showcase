import { APPLIANCES_BY_SLOT, blowersFor } from "../data/catalogue";
import { slotAvailability } from "../data/availability";
import { fitCheck, formatInches } from "../data/fit";
import { formatPrice } from "../data/packageSummary";
import { SLOT_BY_ID } from "../data/slots";
import { DebugBadge } from "./DebugBadge";
import { SCHEME_FALLBACKS } from "../data/catalogue";
import { formatCfm } from "../data/ventilation";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useSelectedAppliance, useSelectedBlower, useSelection } from "../store/useSelection";
import type { Appliance, SlotId } from "../types";

/**
 * The alternatives for one slot.
 *
 * Width is what gates: a model wider than the rough opening is offered but
 * cannot be chosen, with the overrun spelled out, because "it is 6 inches too
 * wide" is the sentence a salesperson needs, not a hidden row.
 */
export function SwapPanel({ slotId }: { slotId: SlotId }) {
  const t = useT();
  const slot = SLOT_BY_ID[slotId];
  const candidates = APPLIANCES_BY_SLOT[slotId];
  const selectedId = useAppStore((s) => s.selection[slotId]);
  const selectAppliance = useAppStore((s) => s.selectAppliance);
  const selectSlot = useAppStore((s) => s.selectSlot);
  const selection = useSelection();
  const availability = slotAvailability(selection)[slotId];
  const unavailable = availability?.available === false;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-line px-5 py-4">
        <button
          type="button"
          onClick={() => selectSlot(null)}
          className="flex items-center gap-1.5 text-[11px] text-ink-muted transition-colors hover:text-accent"
        >
          <span aria-hidden="true">←</span>
          {t("swap.back")}
        </button>
        <h2 className="mt-3 flex items-center gap-2 font-display text-[24px] leading-tight text-ink">
          {t(slot.labelKey)}
          {SCHEME_FALLBACKS[slotId] && (
            <DebugBadge
              labelKey="debug.fallback"
              title={`scheme asked for ${SCHEME_FALLBACKS[slotId]}, which is not in the catalogue`}
            />
          )}
        </h2>
        <p className="mt-1 text-[11px] tabular-nums text-ink-muted">
          {t("swap.opening", {
            w: formatInches(slot.cutout.w),
            h: formatInches(slot.cutout.h),
            d: formatInches(slot.cutout.d),
          })}
        </p>
      </div>

      {unavailable && (
        <div className="border-b border-line bg-[rgba(217,48,37,0.06)] px-5 py-3">
          <p className="text-[11px] font-medium text-ink">{t("swap.unavailable")}</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-muted">
            {t(availability.reasonKey!, { takenBy: availability.takenBy! })}
          </p>
        </div>
      )}

      <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
        <h3 className="tracking-label text-[10px] text-ink-muted">{t("swap.title")}</h3>
        <span className="text-[10px] text-ink-muted/70">
          {t("swap.count", { count: candidates.length })}
        </span>
      </div>

      <ul className={"pb-6 " + (unavailable ? "pointer-events-none opacity-40" : "")}>
        {candidates.map((appliance) => (
          <CandidateRow
            key={appliance.id}
            appliance={appliance}
            slotId={slotId}
            selected={appliance.id === selectedId}
            disabled={unavailable}
            onSelect={() => selectAppliance(slotId, appliance.id)}
          />
        ))}
        {candidates.length <= 1 && (
          <li className="px-5 py-3 text-[11px] text-ink-muted">{t("swap.noneOther")}</li>
        )}
      </ul>

      {slotId === "slot-hood" && <BlowerSection />}
    </div>
  );
}

/**
 * The blower that goes with the hood.
 *
 * Only appears when the specified hood needs one. A blower is not a slot: it
 * hangs off the hood, carries its own line on the package, and supplies the CFM
 * the hood itself does not have.
 */
function BlowerSection() {
  const t = useT();
  const hood = useSelectedAppliance("slot-hood");
  const blower = useSelectedBlower();
  const selectBlower = useAppStore((s) => s.selectBlower);

  if (hood?.blower !== "required") {
    return (
      <div className="border-t border-line px-5 py-4">
        <h3 className="tracking-label text-[10px] text-ink-muted">{t("blower.title")}</h3>
        <p className="mt-1.5 text-[11px] text-ink-muted">
          {t("blower.integrated")}
          {hood?.requires.cfm !== null && hood?.requires.cfm !== undefined
            ? ` · ${t("blower.cfm", { cfm: formatCfm(hood.requires.cfm) })}`
            : ""}
        </p>
      </div>
    );
  }

  const options = blowersFor(hood);

  return (
    <div className="border-t border-line">
      <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
        <h3 className="tracking-label text-[10px] text-ink-muted">{t("blower.title")}</h3>
        <span className="text-[10px] text-ink-muted/70">{t("blower.required")}</span>
      </div>
      <ul className="pb-6">
        {options.map((option) => {
          const selected = option.id === blower?.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => selectBlower(option.id)}
                aria-pressed={selected}
                className={[
                  "flex w-full items-start gap-3 border-l-2 px-5 py-3 text-left transition-colors",
                  selected
                    ? "border-l-accent bg-[rgba(46,92,69,0.07)]"
                    : "border-l-transparent hover:bg-[rgba(46,92,69,0.04)]",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13px] text-ink">{option.brand}</span>
                    {selected && (
                      <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-medium text-[#F7F5EF]">
                        {t("swap.selected")}
                      </span>
                    )}
                    {option.verifiedAt === null && <DebugBadge labelKey="debug.unverified" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                    {option.model} · {option.installType.join(", ")}
                    {option.requires.cfm !== null
                      ? ` · ${t("blower.cfm", { cfm: formatCfm(option.requires.cfm) })}`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
                  {formatPrice(option.msrpUSD, t("price.onRequest"))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CandidateRow({
  appliance,
  slotId,
  selected,
  disabled = false,
  onSelect,
}: {
  appliance: Appliance;
  slotId: SlotId;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const fit = fitCheck(SLOT_BY_ID[slotId], appliance);
  const tooDeep = fit.depthOverIn !== null && fit.depthOverIn > 0;
  const blocked = disabled || !fit.fits;

  return (
    <li>
      <button
        type="button"
        disabled={blocked}
        onClick={onSelect}
        aria-pressed={selected}
        className={[
          "flex w-full items-start gap-3 border-l-2 px-5 py-3 text-left transition-colors",
          blocked
            ? "cursor-not-allowed border-l-transparent opacity-45"
            : selected
              ? "border-l-accent bg-[rgba(46,92,69,0.07)]"
              : "border-l-transparent hover:bg-[rgba(46,92,69,0.04)]",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] text-ink">{appliance.brand}</span>
            {selected && (
              <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-medium text-[#F7F5EF]">
                {t("swap.selected")}
              </span>
            )}
            {appliance.verifiedAt === null && <DebugBadge labelKey="debug.unverified" />}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
            {appliance.model}
          </span>

          {!fit.fits && (
            <span className="mt-1 block text-[11px] font-medium text-ink">
              {t("swap.tooWide", { delta: formatInches(fit.widthOverIn) })}
            </span>
          )}
          {fit.fits && fit.fillerEachSideIn !== null && fit.fillerEachSideIn > 0.05 && (
            <span className="mt-1 block text-[11px] text-ink-muted">
              {t("swap.tooNarrow", { delta: formatInches(fit.fillerEachSideIn) })}
            </span>
          )}
          {fit.fits && tooDeep && (
            <span className="mt-1 block text-[11px] text-ink-muted">
              {t("swap.deepNote", { delta: formatInches(fit.depthOverIn!) })}
            </span>
          )}
        </span>

        <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
          {formatPrice(appliance.msrpUSD, t("price.onRequest"))}
        </span>
      </button>
    </li>
  );
}
