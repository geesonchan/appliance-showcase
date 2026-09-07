import { useEffect } from "react";
import { fitCheck, formatInches, requiredOpening } from "../data/fit";
import { formatPrice } from "../data/packageSummary";
import { SLOT_BY_ID } from "../data/slots";
import { deriveUtilities } from "../data/utilities";
import { hasGenericRoughIn } from "../data/roughIn";
import { DebugBadge } from "./DebugBadge";
import { useChecklist } from "../data/useChecklist";
import { effectiveCfm, formatCfm } from "../data/ventilation";
import { DEBUG } from "../debug";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useSelectedBlower, useSelection } from "../store/useSelection";
import type { Severity } from "../data/rules";

const DOT: Record<Severity, string> = {
  blocker: "bg-[#D93025]",
  warning: "bg-[#F2A100]",
  info: "bg-line",
};

/**
 * Everything about the model standing in one slot.
 *
 * This is the card the salesperson talks from, so it answers the questions
 * asked in front of a customer in the order they get asked: what is it, will it
 * fit, what has to be run to it, what is special about it, and what the
 * installer still has to deal with. The install findings for this slot live
 * here rather than in a separate list, because "this hood needs makeup air" is
 * a fact about this hood.
 */
export function SpecCard() {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const slotId = useAppStore((s) => s.specSlot);
  const closeSpec = useAppStore((s) => s.closeSpec);
  const selection = useSelection();
  const blower = useSelectedBlower();
  const { findings } = useChecklist();

  useEffect(() => {
    if (!slotId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSpec();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slotId, closeSpec]);

  if (!slotId) return null;
  const slot = SLOT_BY_ID[slotId];
  const appliance = selection[slotId];
  if (!appliance) return null;

  const fit = fitCheck(slot, appliance);
  const needs = requiredOpening(appliance);
  const cfm = slotId === "slot-hood" ? effectiveCfm(appliance, blower) : null;
  const utilities = deriveUtilities(slot, appliance, cfm);
  const mine = findings.filter((finding) => finding.slot === slotId);
  const highlights = appliance.highlights[lang] ?? appliance.highlights.en;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-end sm:items-stretch sm:bg-transparent"
      onClick={closeSpec}
    >
      {/* Only the phone gets a scrim: on a desktop the card sits beside the
          scene, which stays live behind it. */}
      <div className="absolute inset-0 bg-[rgba(31,42,34,0.35)] sm:hidden" />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label={t("spec.title")}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-lg border border-line bg-surface sm:my-3 sm:mr-3 sm:max-h-none sm:w-[330px] sm:rounded-md"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="tracking-label text-[9px] text-ink-muted">{t(slot.labelKey)}</p>
            <h2 className="mt-1 font-display text-[21px] leading-tight text-ink">
              {appliance.brand}
            </h2>
            <p className="text-[12px] text-ink-muted">{appliance.model}</p>
          </div>
          <button
            type="button"
            onClick={closeSpec}
            aria-label={t("spec.close")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-[13px] text-ink-muted"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Section title={t("spec.dimensions")}>
            <Row
              label={t("spec.product")}
              value={triple(appliance.widthIn, appliance.heightIn, appliance.depthIn)}
            />
            <Row label={t("spec.opening")} value={triple(needs.w, needs.h, needs.d)} />
            <Row
              label={t("spec.slotOpening")}
              value={triple(slot.cutout.w, slot.cutout.h, slot.cutout.d)}
            />
            {fit.fillerEachSideIn !== null && fit.fillerEachSideIn > 0.05 && (
              <Note>{t("swap.tooNarrow", { delta: formatInches(fit.fillerEachSideIn) })}</Note>
            )}
            {fit.heightOverIn !== null && fit.heightOverIn > 0.05 && (
              <Note>{t("swap.tallNote", { delta: formatInches(fit.heightOverIn) })}</Note>
            )}
            {fit.depthOverIn !== null && fit.depthOverIn > 0.05 && (
              <Note>{t("swap.deepNote", { delta: formatInches(fit.depthOverIn) })}</Note>
            )}
          </Section>

          <Section title={t("spec.services")}>
            {hasGenericRoughIn(appliance) && (
              <div className="mb-1.5">
                <DebugBadge
                  labelKey="debug.genericRoughIn"
                  title="No installation drawing read for this model; the room's generic heights are shown"
                />
              </div>
            )}
            <Row
              label={t("spec.power")}
              value={
                `${utilities.power.voltage}V · ${utilities.power.amps}A` +
                (utilities.power.dedicated ? ` · ${t("spec.dedicated")}` : "")
              }
            />
            <Row
              label={t("spec.gas")}
              value={
                utilities.gas
                  ? `${utilities.gas.pipeSize}` +
                    (utilities.gas.shutoff ? ` · ${t("spec.shutoff")}` : "")
                  : null
              }
            />
            <Row
              label={t("spec.water")}
              value={
                utilities.water
                  ? [
                      utilities.water.supply ? t("spec.supply") : null,
                      utilities.water.drain ? t("spec.drain") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : null
              }
            />
            <Row
              label={t("spec.duct")}
              value={
                utilities.duct
                  ? `${utilities.duct.diameterIn}" · ${t(`duct.${utilities.duct.route}`)}` +
                    (cfm !== null ? ` · ${t("blower.cfm", { cfm: formatCfm(cfm) })}` : "")
                  : null
              }
            />
          </Section>

          {highlights.length > 0 && (
            <Section title={t("spec.highlights")}>
              <ul className="space-y-1.5">
                {highlights.map((line) => (
                  <li key={line} className="flex gap-2 text-[11px] leading-snug text-ink-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {line}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={t("checklist.title")}>
            {mine.length === 0 ? (
              <p className="text-[11px] text-ink-muted">{t("checklist.clear")}</p>
            ) : (
              <ul className="space-y-1.5">
                {mine.map((finding) => (
                  <li
                    key={finding.ruleId}
                    className="flex items-start gap-2 text-[11px] leading-snug text-ink-muted"
                  >
                    <span
                      className={"mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " + DOT[finding.severity]}
                      title={t(`checklist.${finding.severity}`)}
                    />
                    <span>
                      {t(finding.messageKey, finding.params)}
                      {DEBUG && (
                        <span className="ml-1.5 font-mono text-[9px] text-ink-muted/60">
                          {finding.ruleId}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <div className="min-w-0">
            <p className="text-[13px] tabular-nums text-ink">
              {formatPrice(appliance.msrpUSD, t("price.onRequest"))}
            </p>
            <p className="truncate text-[10px] text-ink-muted">
              {appliance.verifiedAt
                ? t("spec.verified", { date: appliance.verifiedAt })
                : t("spec.unverified")}
            </p>
          </div>
          {appliance.sourceUrl && (
            <a
              href={appliance.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-bg"
            >
              {t("spec.source")} <span aria-hidden="true">↗</span>
            </a>
          )}
        </footer>
      </aside>
    </div>
  );
}

/** W × H × D, with an em dash wherever the sheet has no figure. */
function triple(w: number | null, h: number | null, d: number | null) {
  const one = (value: number | null) => (value === null ? "—" : formatInches(value));
  return `${one(w)} × ${one(h)} × ${one(d)}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-b-0">
      <h3 className="tracking-label mb-2 text-[9px] text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

/** A row is omitted entirely when the service is not needed here. */
function Row({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="shrink-0 text-[11px] text-ink-muted">{label}</span>
      <span className="text-right text-[11px] tabular-nums text-ink">{value}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">{children}</p>;
}
