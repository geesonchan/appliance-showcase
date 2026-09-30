import { useState } from "react";
import { slotAvailability } from "../data/availability";
import { candidatesFor, type Candidate } from "../data/candidates";
import { SLOT_ORDER } from "../data/catalogue";
import { useChecklist } from "../data/useChecklist";
import { formatDimension } from "../data/dimensions";
import { listWidth } from "../data/fit";
import { SLOT_BY_ID, isOmitted } from "../data/slots";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useActivePackage, useSelection } from "../store/useSelection";
import type { SlotId } from "../types";
import { ModelLine } from "./ModelLine";
import { useRefusalText } from "./RefusalNote";
import { FitNotes } from "./SwapPanel";

/**
 * The selected machine, and the other models its opening takes, in the middle
 * of the scene.
 *
 * Round 82 (Leo, round 80: "如果客户不熟悉hood型号，会不知道可以有这些操作").
 * Changing a machine took selecting it, opening the list rail that starts
 * closed, and picking it there. This card is where every machine's models are
 * shown once it is selected; it replaces the small "View specs" card that sat
 * at the lower right. The plan and Leo's decisions:
 * `docs/plans/round-80-interface-plan.md`, section 9.
 *
 * - **The list is the list's.** `candidatesFor` is the alternatives list's own
 *   answer, moved (round 82), and a pick goes through the same store action,
 *   so the card and the list cannot disagree about what fits (D17's table,
 *   first row: no third judgement).
 * - **What does not fit is folded** into one line, "N more too wide", and
 *   listed with each one's reason only when opened (Leo, round 80).
 * - **No price** (D12; Leo, round 80).
 * - **A hood narrower than the cooking surface** shows the rule's own line,
 *   `hood-narrower-than-cooking` as the checklist has it — read, not judged
 *   again (Leo, round 80; D13 round 79).
 * - Pin labels keep clear of it (`data-pin-keep-out`). It moves no camera (D1).
 * - On a phone it hides while the sheet is open, which covers it, and comes
 *   back when the sheet closes (Leo, round 82). On a desktop it stays with the
 *   list rail open (Leo, round 82): the card is the way in, the rail the detail.
 */
export function ModelCard() {
  const t = useT();
  const say = useRefusalText();
  const selectedSlot = useAppStore((s) => s.selectedSlot);
  const sheetOpen = useAppStore((s) => s.mobilePanel !== "none");
  const selection = useSelection();
  const { entry } = useActivePackage();
  const checklist = useChecklist();
  const [showRefused, setShowRefused] = useState<SlotId | null>(null);

  const selectAppliance = useAppStore((s) => s.selectAppliance);
  const selectSlot = useAppStore((s) => s.selectSlot);
  const openSpec = useAppStore((s) => s.openSpec);
  const leftOpen = useAppStore((s) => s.leftOpen);
  const toggleLeft = useAppStore((s) => s.toggleLeft);
  const setMobilePanel = useAppStore((s) => s.setMobilePanel);

  if (!selectedSlot) return null;
  const slot = SLOT_BY_ID[selectedSlot];
  const current = selection[selectedSlot];
  if (!slot || !current) return null;

  const number = SLOT_ORDER.filter((slotId) => !isOmitted(slotId)).indexOf(selectedSlot) + 1;
  const candidates = candidatesFor(selectedSlot, entry);
  const fitting = candidates.filter((candidate) => candidate.fit.fits);
  // The specified model first: it is what the customer is looking at.
  fitting.sort((a, b) => Number(b.appliance.id === current.id) - Number(a.appliance.id === current.id));
  const refused = candidates.filter((candidate) => !candidate.fit.fits);
  const availability = slotAvailability(selection)[selectedSlot];
  const unavailable = availability?.available === false;
  const narrow = checklist.findings.find(
    (finding) => finding.ruleId === "hood-narrower-than-cooking" && finding.slot === selectedSlot,
  );
  const refusedOpen = showRefused === selectedSlot;

  const details = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      if (!leftOpen) toggleLeft();
    } else {
      setMobilePanel("list");
    }
  };

  const chip = ({ appliance, fit }: Candidate) => {
    const selected = appliance.id === current.id;
    const blocked = unavailable || !fit.fits;
    return (
      <li key={appliance.id} className="shrink-0">
        <button
          type="button"
          disabled={blocked}
          aria-pressed={selected}
          data-candidate={appliance.id}
          data-fits={fit.fits}
          onClick={() => selectAppliance(selectedSlot, appliance.id)}
          className={[
            "flex h-full w-[168px] flex-col items-stretch rounded-md border px-2.5 py-2 text-left transition-colors",
            selected
              ? "border-accent bg-[rgba(46,92,69,0.07)]"
              : blocked
                ? "cursor-not-allowed border-line opacity-55"
                : "border-line bg-bg hover:border-accent/60",
          ].join(" ")}
        >
          <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-ink">
            {formatDimension(listWidth(appliance, slot).modelIn)}
            {selected && (
              <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-medium text-[#F7F5EF]">
                {t("swap.selected")}
              </span>
            )}
          </span>
          <ModelLine className="mt-0.5 text-[11px] text-ink-muted" brand={appliance.brand} model={appliance.model} />
          <FitNotes fit={fit} />
        </button>
      </li>
    );
  };

  return (
    <div
      data-pin-keep-out
      data-model-card={selectedSlot}
      className={[
        "pointer-events-auto absolute inset-x-2 bottom-[120px] z-20 rounded-lg border border-line bg-surface p-3",
        "shadow-[0_8px_24px_rgba(31,42,34,0.14)]",
        "md:inset-x-auto md:bottom-24 md:left-1/2 md:w-[min(720px,calc(100%-32px))] md:-translate-x-1/2 md:p-4",
        sheetOpen ? "hidden md:block" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tracking-label text-[9px] text-ink-muted">
            {String(number).padStart(2, "0")} · {t(slot.labelKey)}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <ModelLine className="min-w-0 text-[14px] text-ink" brand={current.brand} model={current.model} />
            <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
              {formatDimension(listWidth(current, slot).modelIn)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => openSpec(selectedSlot)}
            className="flex items-center gap-1 text-[12px] font-medium text-accent transition-opacity hover:opacity-80"
          >
            {t("scene.enter")}
            <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            onClick={() => selectSlot(null)}
            aria-label={t("mobile.close")}
            className="grid h-6 w-6 place-items-center rounded-full text-[13px] text-ink-muted hover:text-ink"
          >
            ×
          </button>
        </div>
      </div>

      {narrow && (
        <p data-card-narrow className="mt-2 text-[11px] leading-snug text-[#8A4B12]">
          {say(narrow.messageKey, narrow.params ?? {})}
        </p>
      )}
      {unavailable && (
        <p className="mt-2 text-[11px] leading-snug text-ink-muted">
          <span className="font-medium text-ink">{t("swap.unavailable")}</span>{" "}
          {t(availability.reasonKey!, { takenBy: availability.takenBy! })}
        </p>
      )}

      <div className="mb-2 mt-3 flex items-baseline justify-between gap-3">
        <span className="tracking-label text-[9px] text-ink-muted">
          {t("card.models", { count: fitting.length })}
        </span>
        <button
          type="button"
          onClick={details}
          className="shrink-0 text-[11px] font-medium text-accent transition-opacity hover:opacity-80"
        >
          {t("card.details")}
        </button>
      </div>

      <ul className="flex gap-2 overflow-x-auto pb-1">{fitting.map(chip)}</ul>

      {fitting.length <= 1 && refused.length === 0 && (
        <p className="mt-2 text-[11px] text-ink-muted">{t("swap.noneOther")}</p>
      )}

      {refused.length > 0 && (
        <>
          <button
            type="button"
            data-card-refused-toggle
            aria-expanded={refusedOpen}
            onClick={() => setShowRefused(refusedOpen ? null : selectedSlot)}
            className="mt-2 text-[11px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {refusedOpen ? t("card.hideRefused") : t("card.moreRefused", { count: refused.length })}
          </button>
          {refusedOpen && <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">{refused.map(chip)}</ul>}
        </>
      )}
    </div>
  );
}
