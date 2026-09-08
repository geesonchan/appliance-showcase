import { useState } from "react";
import { useChecklist } from "../data/useChecklist";
import { SLOT_BY_ID } from "../data/slots";
import { DEBUG } from "../debug";
import { useT } from "../i18n/useT";
import { useRefusalText } from "./RefusalNote";
import type { Severity } from "../data/rules";

const DOT: Record<Severity, string> = {
  blocker: "bg-[#D93025]",
  warning: "bg-[#F2A100]",
  info: "bg-line",
};

/**
 * What this package needs before it can be installed.
 *
 * Grouped by appliance, because that is how the conversation goes on site, and
 * ordered blockers first. Every line carries the rule that produced it, which is
 * what the quote sheet will serialise. Rule ids are shown under ?debug=1.
 */
export function InstallChecklist() {
  const t = useT();
  // One convention, both renderers: a param whose name ends in `Key` is itself
  // a key. Rules have no language — they name the string rather than writing
  // it — and a checklist that substituted the key raw printed "leg.left".
  const say = useRefusalText();
  const { findings, blockers, warnings } = useChecklist();
  const [open, setOpen] = useState(true);

  const bySlot = new Map<string, typeof findings>();
  const order: Severity[] = ["blocker", "warning", "info"];
  const sorted = [...findings].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  );
  for (const finding of sorted) {
    const list = bySlot.get(finding.slot);
    if (list) list.push(finding);
    else bySlot.set(finding.slot, [finding]);
  }

  return (
    <section className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="tracking-label text-[10px] text-ink-muted">
          {t("checklist.title")}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums text-ink-muted">
            {findings.length === 0
              ? t("checklist.clear")
              : t("checklist.count", { blockers, warnings })}
          </span>
          <span
            className={
              "text-[10px] text-ink-muted transition-transform " + (open ? "rotate-180" : "")
            }
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>

      {open && findings.length > 0 && (
        <ul className="space-y-3 px-5 pb-5">
          {[...bySlot.entries()].map(([slotId, group]) => (
            <li key={slotId}>
              <p className="text-[11px] font-medium text-ink">
                {t(SLOT_BY_ID[slotId as keyof typeof SLOT_BY_ID].labelKey)}
              </p>
              <ul className="mt-1 space-y-1">
                {group.map((finding) => (
                  <li
                    key={finding.ruleId}
                    className="flex items-start gap-2 text-[11px] leading-snug text-ink-muted"
                  >
                    <span
                      className={"mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " + DOT[finding.severity]}
                      title={t(`checklist.${finding.severity}`)}
                    />
                    <span>
                      {say(finding.messageKey, finding.params ?? {})}
                      {DEBUG && (
                        <span className="ml-1.5 font-mono text-[9px] text-ink-muted/60">
                          {finding.ruleId}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
