import { PARAM_LIMITS } from "../data/room";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { PanelSection, Segmented, Slider } from "./primitives";

/**
 * The parameters the room is generated from, as controls.
 *
 * The point of M3-3 is that Scheme 01 is not a drawing — it is one set of
 * numbers put through the template. Putting those numbers on screen is what
 * makes that visible: move the refrigerator to the other end and the sink and
 * the dishwasher move with it, because a back wall will not carry a range, a
 * sink, a dishwasher and a 42" tower at once.
 *
 * A combination the template will not build does not clear the screen. The room
 * that is standing stays up, the control still shows what you asked for, and
 * the reason prints underneath. See docs/decisions.md D14.
 */
export function LayoutControls() {
  const t = useT();
  const params = useAppStore((s) => s.layoutParams);
  const issues = useAppStore((s) => s.layoutIssues);
  const setLayout = useAppStore((s) => s.setLayout);

  return (
    <PanelSection title={t("panel.layout")}>
      <Slider
        label={t("panel.layout.island")}
        value={params.islandLengthIn}
        min={PARAM_LIMITS.islandLengthIn.min}
        max={PARAM_LIMITS.islandLengthIn.max}
        step={PARAM_LIMITS.islandLengthIn.step}
        onChange={(islandLengthIn) => setLayout({ islandLengthIn })}
      />

      <div className="mt-2">
        <span className="mb-1.5 block text-[13px] text-ink">{t("panel.layout.fridge")}</span>
        <Segmented
          size="sm"
          value={params.fridgeEnd}
          onChange={(fridgeEnd) => setLayout({ fridgeEnd })}
          options={[
            { value: "left" as const, label: t("panel.layout.fridge.left") },
            { value: "back" as const, label: t("panel.layout.fridge.back") },
          ]}
        />
      </div>

      {issues.length > 0 && (
        <ul className="mt-3 space-y-1 border-l-2 border-[#E5C6C2] pl-2.5">
          {issues.map((issue) => (
            <li key={issue} className="text-[11px] leading-snug text-[#8A2018]">
              {issue}
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
