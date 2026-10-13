import { SCHEME } from "../data/catalogue";
import { useActivePackage } from "../store/useSelection";
import { usePackageSummary } from "../data/packageSummary";
import { useT } from "../i18n/useT";
import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import type { RightTab } from "../store/railState";
import type { UtilityType } from "../types";
import { FinishPicker } from "./FinishPicker";
import { InstallChecklist } from "./InstallChecklist";
import { LayoutControls } from "./LayoutControls";
import { PlanThumbnail } from "./PlanThumbnail";
import { PanelSection, Segmented, Toggle } from "./primitives";
import { RoughInList } from "./RoughInList";

/**
 * The four utility layers, as switches. No colour swatch beside them: the runs
 * they switch are drawn faint grey whatever the service (D21), and the legend
 * for what the looks mean is with the rough-in list below. Round 42.
 */
const UTILITY_TYPES: UtilityType[] = ["gas", "power", "water", "duct"];

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="text-right text-[12px] tabular-nums text-ink">{value}</span>
    </div>
  );
}

/** The four tabs, in Leo's order (round 80's plan, decision 4). */
const TABS: { tab: RightTab; key: string }[] = [
  { tab: "look", key: "panel.tab.look" },
  { tab: "layout", key: "panel.tab.layout" },
  { tab: "install", key: "panel.tab.install" },
  { tab: "list", key: "panel.tab.list" },
];

/**
 * The right panel's tabs, at its top. Four equal buttons across the panel's
 * width rather than a control as wide as its words, so it holds one line at
 * the narrowest the rail is drawn (240px).
 */
function TabBar() {
  const t = useT();
  const rightTab = useAppStore((s) => s.rightTab);
  const setRightTab = useAppStore((s) => s.setRightTab);
  return (
    <div className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-3">
      <div role="tablist" className="grid grid-cols-4 rounded-2xl border border-line bg-surface p-[3px]">
        {TABS.map(({ tab, key }) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={rightTab === tab}
            data-right-tab={tab}
            onClick={() => setRightTab(tab)}
            className={[
              "whitespace-nowrap rounded-full px-1 py-1 text-[11px] font-medium transition-colors",
              rightTab === tab ? "bg-accent text-[#F7F5EF]" : "text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The settings, in four tabs. Round 91, Leo (round 80's plan, section 2 and
 * decision 4): Look — the finishes and the atmosphere; Layout — the layout,
 * the room's dimensions and the plan; Install — the utility layers, the
 * rough-in points and the dimension lines, which are drawn only in Install
 * mode (Leo, round 91); List — the package and the install checklist, folded
 * by machine. Every section is as it was; only where it is changed.
 *
 * On a desktop the tabs are at the panel's top (`tabs`); in the phone's sheet
 * they are the sheet's own, beside Appliances (MobileSheet.tsx).
 */
export function RightPanel({ tabs = true }: { tabs?: boolean }) {
  const t = useT();
  const summary = usePackageSummary();
  const activePackage = useActivePackage();

  const lighting = useAppStore((s) => s.lighting);
  const setLighting = useAppStore((s) => s.setLighting);
  const showCabinets = useAppStore((s) => s.showCabinets);
  const toggleCabinets = useAppStore((s) => s.toggleCabinets);
  const showLabels = useAppStore((s) => s.showLabels);
  const toggleLabels = useAppStore((s) => s.toggleLabels);
  const renderMode = useAppStore((s) => s.renderMode);
  const visibleUtilities = useAppStore((s) => s.visibleUtilities);
  const toggleUtility = useAppStore((s) => s.toggleUtility);
  const showDimensions = useAppStore((s) => s.showDimensions);
  const toggleDimensions = useAppStore((s) => s.toggleDimensions);
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const rightTab = useAppStore((s) => s.rightTab);
  const scroller = useRef<HTMLDivElement>(null);

  // A tab opens at its top, not wherever the last one was scrolled to.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [rightTab]);

  return (
    <div
      ref={scroller}
      data-right-panel={rightTab}
      className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden"
    >
      {tabs && <TabBar />}

      {rightTab === "look" && (
        <>
          <FinishPicker />

          <PanelSection title={t("panel.atmosphere")}>
            <Segmented
              size="sm"
              value={lighting}
              onChange={setLighting}
              options={[
                { value: "day", label: t("panel.lighting.day") },
                { value: "night", label: t("panel.lighting.night") },
              ]}
            />
            <div className="mt-3">
              <Toggle
                label={t("panel.toggle.cabinets")}
                checked={showCabinets}
                onChange={toggleCabinets}
              />
              <Toggle
                label={t("panel.toggle.labels")}
                checked={showLabels}
                onChange={toggleLabels}
              />
            </div>
          </PanelSection>
        </>
      )}

      {rightTab === "layout" && (
        <>
          <LayoutControls />

          <PanelSection title={t("panel.plan")}>
            <PlanThumbnail key={layoutVersion} />
          </PanelSection>
        </>
      )}

      {rightTab === "install" && (
        <>
          {/* Utility layers are only meaningful in install mode, so the section
              stays visible but goes quiet outside it. */}
          <PanelSection title={t("panel.utilities")}>
            <div className={renderMode === "install" ? "" : "opacity-45"}>
              {UTILITY_TYPES.map((type) => (
                <Toggle
                  key={type}
                  label={t("utility." + type)}
                  checked={visibleUtilities[type]}
                  onChange={() => toggleUtility(type)}
                />
              ))}
            </div>
          </PanelSection>

          {/* Every point this package roughs in, by where its figures come from,
              with the legend for the three looks. */}
          <RoughInList key={`rough-in-${layoutVersion}`} />

          {/* Its own group: a dimension is drawn over the room rather than run
              through it, and it is the last thing anybody turns on. */}
          <PanelSection title={t("panel.dimensions")}>
            <Toggle
              label={t("panel.dimensions.show")}
              checked={showDimensions}
              onChange={toggleDimensions}
            />
          </PanelSection>
        </>
      )}

      {rightTab === "list" && (
        <>
          <PanelSection title={t("panel.package")}>
            {/* No total here: money lives on the quote page. See D12. */}
            <SummaryRow label={t("panel.package.series")} value={activePackage.name} />
            <SummaryRow
              label={t("panel.package.energy")}
              value={summary.energyKeys.map((key) => t(key)).join(" + ")}
            />
            {summary.blower && (
              <SummaryRow
                label={t("panel.package.blower")}
                value={`${summary.blower.brand} ${summary.blower.model}`}
              />
            )}
            {summary.leadTimeWeeks !== null && (
              <SummaryRow
                label={t("panel.package.lead")}
                value={t("panel.package.leadValue", { weeks: summary.leadTimeWeeks })}
              />
            )}
            <div className="mt-3 flex gap-1.5">
              {SCHEME.palette.map((color) => (
                <span
                  key={color}
                  className="h-4 w-4 rounded-full border border-line"
                  style={{ background: color }}
                  title={color}
                />
              ))}
            </div>
          </PanelSection>

          <InstallChecklist key={layoutVersion} />
        </>
      )}
    </div>
  );
}
