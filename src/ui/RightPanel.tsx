import { SCHEME } from "../data/catalogue";
import { usePackageSummary } from "../data/packageSummary";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { UTILITY_COLORS } from "../three/materials";
import type { UtilityType } from "../types";
import { InstallChecklist } from "./InstallChecklist";
import { PlanThumbnail } from "./PlanThumbnail";
import { PanelSection, Segmented, Toggle } from "./primitives";

const UTILITY_SWATCH: Record<UtilityType, string> = {
  gas: UTILITY_COLORS.gas,
  power: UTILITY_COLORS.power240,
  water: UTILITY_COLORS.water,
  duct: UTILITY_COLORS.duct,
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="text-right text-[12px] tabular-nums text-ink">{value}</span>
    </div>
  );
}

export function RightPanel() {
  const t = useT();
  const summary = usePackageSummary();

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

  return (
    <div className="flex h-full flex-col overflow-y-auto">
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

      {/* Utility layers are only meaningful in install mode, so the section
          stays visible but goes quiet outside it. */}
      <PanelSection title={t("panel.utilities")}>
        <div className={renderMode === "install" ? "" : "opacity-45"}>
          {(Object.keys(UTILITY_SWATCH) as UtilityType[]).map((type) => (
            <Toggle
              key={type}
              label={t("utility." + type)}
              swatch={UTILITY_SWATCH[type]}
              checked={visibleUtilities[type]}
              onChange={() => toggleUtility(type)}
            />
          ))}
          {/* Not a service, but it belongs with them: another thing the
              install view draws over the room. */}
          <Toggle
            label={t("panel.dimensions")}
            checked={showDimensions}
            onChange={toggleDimensions}
          />
        </div>
      </PanelSection>

      <PanelSection title={t("panel.package")}>
        {/* No total here: money lives on the quote page. See D12. */}
        <SummaryRow label={t("panel.package.series")} value={t(SCHEME.nameKey)} />
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

      <InstallChecklist />

      <PanelSection title={t("panel.plan")}>
        <PlanThumbnail />
      </PanelSection>
    </div>
  );
}
