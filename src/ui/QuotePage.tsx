import { useEffect, useMemo, useState } from "react";
import { formatInches, requiredOpening } from "../data/fit";
import { formatUSD } from "../data/money";
import { formatPrice } from "../data/packageSummary";
import { buildQuote, formatQuote, type Quote, type QuoteLine } from "../data/quote";
import { SLOTS, SLOT_BY_ID } from "../data/slots";
import { useChecklist } from "../data/useChecklist";
import { formatCfm } from "../data/ventilation";
import { DEBUG } from "../debug";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useActivePackage, useSelectedBlower, useSelection } from "../store/useSelection";
import type { Severity } from "../data/rules";

const DOT: Record<Severity, string> = {
  blocker: "bg-[#D93025]",
  warning: "bg-[#F2A100]",
  info: "bg-line",
};

/**
 * The whole package, on its own page.
 *
 * Prices left the main interface — this is where they went. One row per
 * appliance carrying the four things a quote has to survive being read by
 * somebody who was not in the room: which model, what opening it needs, what
 * has to be run to it, and what the installer still has to deal with.
 *
 * It is a page rather than a dialog because it is a document: the reader
 * scrolls it, reads a row, goes back to a row above. See docs/decisions.md D12.
 */
export function QuotePage() {
  const t = useT();
  const open = useAppStore((s) => s.quoteOpen);
  const setQuoteOpen = useAppStore((s) => s.setQuoteOpen);
  const showToast = useAppStore((s) => s.showToast);
  const selection = useSelection();
  const blower = useSelectedBlower();
  const { findings, blockers } = useChecklist();
  const [raw, setRaw] = useState<"none" | "summary" | "json">("none");

  const hood = selection["slot-hood"];
  const activePackage = useActivePackage();
  const quote = useMemo(
    () =>
      buildQuote({
        packageId: activePackage.entry.id,
        packageName: activePackage.name,
        slots: SLOTS,
        selection,
        blower,
        hoodNeedsBlower: hood?.blower === "required",
        findings,
        t,
      }),
    [activePackage, selection, blower, hood, findings, t],
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
      // Safari refuses the clipboard outside a gesture it recognises, and a
      // page served over http has none at all. Fall back to a selection the
      // user can copy by hand rather than failing silently.
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
    encodeURIComponent(t("quote.subject", { package: activePackage.name })) +
    "&body=" +
    encodeURIComponent(summary);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 md:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-display text-[18px] leading-none text-accent">
            {t("quote.title")}
          </h1>
          <p className="mt-1 truncate text-[11px] text-ink-muted">{activePackage.name}</p>
        </div>
        <button
          type="button"
          onClick={() => setQuoteOpen(false)}
          className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-surface"
        >
          <span aria-hidden="true">←</span> {t("quote.backToRoom")}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5 md:px-6 md:py-8">
          {blockers > 0 && (
            <p className="mb-5 rounded-sm border border-[#E5C6C2] bg-[#FDF3F2] px-4 py-2.5 text-[11px] leading-snug text-[#8A2018]">
              {t("quote.blockers", { blockers })}
            </p>
          )}

          <ul className="space-y-px overflow-hidden rounded-sm border border-line bg-line">
            {quote.lines.map((line) => (
              <Row key={line.slot} line={line} quote={quote} />
            ))}
            {quote.blower && (
              <li className="bg-surface px-4 py-4 md:px-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tracking-label text-[9px] text-ink-muted">
                      {t("blower.title")}
                    </p>
                    <p className="mt-1 text-[13px] text-ink">
                      {quote.blower.brand} {quote.blower.model}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {quote.blower.installType.join(", ")}
                      {quote.blower.cfm !== null &&
                        ` · ${t("blower.cfm", { cfm: formatCfm(quote.blower.cfm) })}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-ink">
                    {formatPrice(quote.blower.msrpUSD, t("price.onRequest"))}
                  </span>
                </div>
              </li>
            )}
          </ul>

          <dl className="mt-5 space-y-1 border-t border-line pt-4 text-[12px]">
            <Total label={t("panel.package.total")} value={formatUSD(quote.totals.subtotalUSD)} />
            {quote.totals.pricedCount < quote.totals.itemCount && (
              <p className="text-right text-[10px] text-ink-muted">
                {t("panel.package.priced", {
                  priced: quote.totals.pricedCount,
                  total: quote.totals.itemCount,
                })}
              </p>
            )}
            {quote.totals.leadTimeWeeks !== null && (
              <Total
                label={t("panel.package.lead")}
                value={t("panel.package.leadValue", { weeks: quote.totals.leadTimeWeeks })}
              />
            )}
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(summary)}
              className="flex-1 rounded-full bg-accent px-4 py-2.5 text-[12px] font-medium text-[#F7F5EF] transition-opacity hover:opacity-90"
            >
              {t("quote.copySummary")}
            </button>
            <a
              href={mailto}
              className="flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-center text-[12px] font-medium text-ink transition-colors hover:bg-bg"
            >
              {t("quote.email")}
            </a>
            <button
              type="button"
              onClick={() => copy(json)}
              className="rounded-full border border-line bg-surface px-4 py-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("quote.copyJson")}
            </button>
          </div>

          <div className="mt-4 flex gap-3 text-[11px] text-ink-muted">
            {(["summary", "json"] as const).map((which) => (
              <button
                key={which}
                type="button"
                onClick={() => setRaw(raw === which ? "none" : which)}
                className="underline-offset-2 transition-colors hover:text-accent hover:underline"
              >
                {raw === which ? t("quote.hideRaw") : t(`quote.${which}`)}
              </button>
            ))}
          </div>
          {raw !== "none" && (
            <pre className="mt-3 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-sm border border-line bg-surface p-3 font-mono text-[10px] leading-[1.55] text-ink">
              {raw === "summary" ? summary : json}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** One appliance: model, opening, services, findings, price. */
function Row({ line, quote }: { line: QuoteLine; quote: Quote }) {
  const t = useT();
  const slot = SLOT_BY_ID[line.slot];
  const appliance = useSelection()[line.slot];
  const needs = requiredOpening(appliance);
  const mine = quote.findings.filter((finding) => finding.slot === line.slot);
  const { utilities } = line;

  const services = [
    `${utilities.power.voltage}V · ${utilities.power.amps}A`,
    utilities.gas && `${t("spec.gas")} ${utilities.gas.pipeSize}`,
    utilities.water &&
      `${t("spec.water")} ${[
        utilities.water.supply ? t("spec.supply") : null,
        utilities.water.drain ? t("spec.drain") : null,
      ]
        .filter(Boolean)
        .join("/")}`,
    utilities.duct && `${t("spec.duct")} ${utilities.duct.diameterIn}"`,
  ].filter(Boolean) as string[];

  const triple = (w: number | null, h: number | null, d: number | null) =>
    [w, h, d].map((v) => (v === null ? "—" : formatInches(v))).join(" × ");

  return (
    <li className="bg-surface px-4 py-4 md:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="tracking-label text-[9px] text-ink-muted">{t(slot.labelKey)}</p>
          <p className="mt-1 text-[13px] text-ink">
            {line.brand} {line.model}
          </p>
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-ink">
          {formatPrice(line.msrpUSD, t("price.onRequest"))}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[11px]">
        <dt className="text-ink-muted">{t("spec.slotOpening")}</dt>
        <dd className="tabular-nums text-ink-muted">
          {triple(line.openingIn.w, line.openingIn.h, line.openingIn.d)}
        </dd>
        <dt className="text-ink-muted">{t("spec.modelNeeds", { model: line.model })}</dt>
        <dd className="tabular-nums text-ink">{triple(needs.w, needs.h, needs.d)}</dd>
        <dt className="text-ink-muted">{t("spec.services")}</dt>
        <dd className="text-ink">{services.join(" · ")}</dd>
      </dl>

      {mine.length > 0 && (
        <ul className="mt-2.5 space-y-1 border-t border-line pt-2.5">
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
                {finding.message}
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
    </li>
  );
}
