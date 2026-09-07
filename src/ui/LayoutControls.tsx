import { useMemo } from "react";
import { PARAM_LIMITS, feasibleRange, wallRequirement, type LayoutParams } from "../data/room";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { RefusalNote } from "./RefusalNote";
import { PanelSection, Segmented, Slider, Toggle } from "./primitives";

/**
 * The parameters the room is generated from, as controls.
 *
 * The point of M3-3 is that Scheme 01 is not a drawing — it is one set of
 * numbers put through the template. Putting those numbers on screen is what
 * makes that visible: move the refrigerator to the other end and the sink and
 * the dishwasher move with it, because a leg will not carry both.
 *
 * A combination the template will not build does not clear the screen. The room
 * that is standing stays up, the control still shows what you asked for, and
 * the reason prints underneath with the arithmetic and a way out. See
 * docs/decisions.md D14.
 */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="py-1.5">
      <span className="mb-1.5 block text-[13px] text-ink">{label}</span>
      <Segmented size="sm" value={value} onChange={onChange} options={options} />
    </div>
  );
}

/**
 * What the shortest buildable wall is made of.
 *
 * Printed under the slider so the greyed-out half of the track has a reason
 * beside it rather than just being unavailable. Every figure names either the
 * cabinet it pays for or the rule that asks for it.
 */
function WallMinimum({ params, leg }: { params: LayoutParams; leg: "left" | "back" }) {
  const t = useT();
  const requirement = useMemo(() => wallRequirement(params, leg), [params, leg]);

  return (
    <>
      <span className="font-medium text-ink">
        {t("panel.room.minimum", { value: requirement.minimumIn })}
      </span>{" "}
      {requirement.items.map((item, index) => (
        <span key={`${item.labelKey}-${index}`} title={t(item.labelKey)}>
          {index > 0 && " + "}
          <span className="tabular-nums">{item.widthIn}&quot;</span>{" "}
          <span className="opacity-65">{item.code ?? item.rule?.toUpperCase()}</span>
        </span>
      ))}
    </>
  );
}

export function LayoutControls() {
  const t = useT();
  const params = useAppStore((s) => s.layoutParams);
  const issues = useAppStore((s) => s.layoutIssues);
  const setLayout = useAppStore((s) => s.setLayout);

  // Probing the generator, so the greyed band and the room can never disagree.
  const feasible = useMemo(
    () => ({
      backWallIn: feasibleRange(params, "backWallIn"),
      leftWallIn: feasibleRange(params, "leftWallIn"),
    }),
    [params],
  );

  /** The two legs of the L, which is the choice both the sink and the tower have. */
  const legs = [
    { value: "left" as const, label: t("panel.layout.leg.left") },
    { value: "back" as const, label: t("panel.layout.leg.back") },
  ];

  return (
    <>
      <PanelSection title={t("panel.room")}>
        <Slider
          label={t("panel.room.backWall")}
          value={params.backWallIn}
          {...PARAM_LIMITS.backWallIn}
          feasible={feasible.backWallIn}
          caption={<WallMinimum params={params} leg="back" />}
          onChange={(backWallIn) => setLayout({ backWallIn })}
        />
        <Slider
          label={t("panel.room.leftWall")}
          value={params.leftWallIn}
          {...PARAM_LIMITS.leftWallIn}
          feasible={feasible.leftWallIn}
          caption={<WallMinimum params={params} leg="left" />}
          onChange={(leftWallIn) => setLayout({ leftWallIn })}
        />
        <Choice
          label={t("panel.room.corner")}
          value={params.cornerType}
          onChange={(cornerType) => setLayout({ cornerType })}
          options={[
            { value: "lazy-susan" as const, label: t("panel.room.corner.lazySusan") },
            { value: "blind" as const, label: t("panel.room.corner.blind") },
          ]}
        />
      </PanelSection>

      <PanelSection title={t("panel.layout")}>
        <Choice
          label={t("panel.layout.fridge")}
          value={params.fridgeEnd}
          onChange={(fridgeEnd) => setLayout({ fridgeEnd })}
          options={legs}
        />
        <Choice
          label={t("panel.layout.sink")}
          value={params.sinkLeg}
          onChange={(sinkLeg) => setLayout({ sinkLeg })}
          options={legs}
        />

        <div className="mt-1 border-t border-line pt-1">
          <Toggle
            label={t("panel.layout.island")}
            checked={params.hasIsland}
            onChange={(hasIsland) => setLayout({ hasIsland })}
          />
          {/* The island's own dimensions are meaningless without one, so they
              go rather than sitting there greyed out. */}
          {params.hasIsland && (
            <>
              <Slider
                label={t("panel.layout.islandLength")}
                value={params.islandLengthIn}
                {...PARAM_LIMITS.islandLengthIn}
                onChange={(islandLengthIn) => setLayout({ islandLengthIn })}
              />
              <Slider
                label={t("panel.layout.islandDepth")}
                value={params.islandDepthIn}
                {...PARAM_LIMITS.islandDepthIn}
                onChange={(islandDepthIn) => setLayout({ islandDepthIn })}
              />
              <Slider
                label={t("panel.layout.aisle")}
                value={params.aisleIn}
                {...PARAM_LIMITS.aisleIn}
                onChange={(aisleIn) => setLayout({ aisleIn })}
              />
            </>
          )}
        </div>

        {issues.length > 0 && (
          <ul className="mt-3 space-y-2.5">
            {issues.map((refusal, index) => (
              <RefusalNote key={`${refusal.key}-${index}`} refusal={refusal} />
            ))}
          </ul>
        )}
      </PanelSection>
    </>
  );
}
