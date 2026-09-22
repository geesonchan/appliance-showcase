import { useMemo } from "react";
import type { LineTier } from "../data/roughIn";
import { roughInWords } from "../data/roughIn";
import { TIER_ORDER, listRoughIn, roughInCallout, type RoughInItem } from "../data/roughInList";
import { SLOT_BY_ID } from "../data/slots";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useRoughInFocus } from "../store/useRoughInFocus";
import { useSelection } from "../store/useSelection";
import { UNCONFIRMED, UNREVIEWED } from "../three/materials";
import { PanelSection } from "./primitives";

/** A short stroke drawn the way the tier is drawn in the room. */
function TierSample({ tier }: { tier: LineTier }) {
  if (tier === "confirmed") {
    return <span className="inline-block h-[3px] w-5 shrink-0 rounded-full bg-ink" aria-hidden="true" />;
  }
  if (tier === "unconfirmed") {
    return (
      <span
        className="inline-block w-5 shrink-0 border-t-2 border-dashed"
        style={{ borderColor: UNCONFIRMED }}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className="inline-block w-5 shrink-0 border-t"
      style={{ borderColor: UNREVIEWED.color }}
      aria-hidden="true"
    />
  );
}

/**
 * Every rough-in point in this package, grouped by where its figures come from
 * (D21), and the legend for the three looks.
 *
 * Picking a point switches to the install view, highlights the point and shows
 * the callout a click on it would. It is how a point is reached when an
 * appliance stands in front of it, and it is the table of contents of what this
 * package needs roughed in. Round 42.
 */
export function RoughInList() {
  const t = useT();
  const selection = useSelection();
  const renderMode = useAppStore((s) => s.renderMode);
  const setRenderMode = useAppStore((s) => s.setRenderMode);
  const showToast = useAppStore((s) => s.showToast);
  const active = useRoughInFocus((s) => s.active);
  const setActive = useRoughInFocus((s) => s.setActive);

  const items = useMemo(() => listRoughIn(selection), [selection]);

  const pick = (item: RoughInItem) => {
    if (renderMode !== "install") setRenderMode("install");
    setActive(item.key);
    const callout = roughInCallout(item);
    showToast(callout.key, callout.vars);
  };

  return (
    <PanelSection title={t("panel.roughIn")}>
      <div className={renderMode === "install" ? "" : "opacity-60"} data-panel="rough-in">
        {items.length === 0 ? (
          <p className="text-[11px] text-ink-muted">{t("roughIn.none")}</p>
        ) : (
          TIER_ORDER.map((tier) => {
            const group = items.filter((item) => item.tier === tier);
            return (
              <div key={tier} className="mb-3 last:mb-0" data-tier={tier}>
                <p className="flex items-center gap-2 text-[11px] font-medium text-ink">
                  <TierSample tier={tier} />
                  <span className="min-w-0 flex-1">{t(`roughIn.tier.${tier}`)}</span>
                  <span className="tabular-nums text-ink-muted">{group.length}</span>
                </p>
                {group.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-7">
                    {group.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          data-rough-in={item.key}
                          aria-pressed={active === item.key}
                          onClick={() => pick(item)}
                          className={
                            "w-full py-0.5 text-left text-[11px] leading-snug transition-colors hover:text-accent " +
                            (active === item.key ? "text-accent" : "text-ink-muted")
                          }
                        >
                          {t(SLOT_BY_ID[item.slotId].labelKey)} · {t(roughInWords(item.resolved).typeKey)}
                          <span className="block text-[10px] text-ink-muted/80">
                            {t(roughInWords(item.resolved).whereKey)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
        <p className="mt-3 flex items-center gap-2 text-[10px] text-ink-muted">
          <TierSample tier="unreviewed" />
          <span>{t("roughIn.generic")}</span>
        </p>
      </div>
    </PanelSection>
  );
}
