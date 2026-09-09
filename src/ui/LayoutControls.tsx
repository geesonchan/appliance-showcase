import { useMemo } from "react";
import { PARAM_LIMITS, feasibleRange, wallRequirement, type LayoutParams } from "../data/room";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useActivePackage } from "../store/useSelection";
import { comboHandleAt, comboSillFor } from "../data/columnModel";
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

/**
 * What the tower's hole comes out as, under the slider that sets it.
 *
 * The figure a person cares about is where their hand goes; the figure the
 * joiner cares about is where the hole starts. Both, so the control explains
 * itself — and when the two disagree, because the drawing will not allow the
 * hole that height asks for, it says where the handle actually lands.
 */
function MicrowaveReach({ handleIn }: { handleIn: number }) {
  const t = useT();
  const { sillIn, clamped } = comboSillFor(handleIn);
  return (
    <>
      <span className={clamped ? "font-medium text-ink" : undefined}>
        {t("panel.layout.microwaveHandle.sill", {
          sillIn: Math.round(sillIn * 8) / 8,
          atIn: Math.round(comboHandleAt(sillIn) * 8) / 8,
        })}
      </span>
    </>
  );
}

export function LayoutControls() {
  const t = useT();
  const params = useAppStore((s) => s.layoutParams);
  const specified = useActivePackage().entry.slots;
  // Whether this package has an oven tower to stand on one side or the other.
  const hasTower = specified.some((slot) => slot.beside === "range");
  // And whether its hood is a liner that goes up inside joinery, which is the
  // only kind with a shape to choose.
  const hasHousing = specified.some(
    (slot) => slot.slotId === "slot-hood" && slot.installType === "insert",
  );
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
      {/* What is where. These are the decisions a designer makes first and
          changes most, so they sit above the dimensions they are made in. */}
      <PanelSection title={t("panel.layout")}>
        <Choice
          label={t("panel.layout.fridge")}
          value={params.fridgeEnd}
          onChange={(fridgeEnd) => setLayout({ fridgeEnd })}
          options={legs}
        />
        {/* What is past the refrigerator. A door opens through more than the
            machine's own width, and against a wall that costs three and a half
            inches of the run. See docs/decisions.md D11 rule 11. */}
        <Choice
          label={t("panel.layout.fridgeAbuts")}
          value={params.fridgeEndAbuts}
          onChange={(fridgeEndAbuts) => setLayout({ fridgeEndAbuts })}
          options={[
            { value: "cabinet" as const, label: t("panel.layout.abuts.cabinet") },
            { value: "wall" as const, label: t("panel.layout.abuts.wall") },
          ]}
        />
        <Choice
          label={t("panel.layout.sink")}
          value={params.sinkLeg}
          onChange={(sinkLeg) => setLayout({ sinkLeg })}
          options={legs}
        />

        <Choice
          label={t("panel.room.corner")}
          value={params.cornerType}
          onChange={(cornerType) => setLayout({ cornerType })}
          options={[
            { value: "blind" as const, label: t("panel.room.corner.blind") },
            { value: "lazy-susan" as const, label: t("panel.room.corner.lazySusan") },
          ]}
        />

        {/* Only where the hood is a liner in a housing somebody builds. A
            canopy has a shape of its own and nothing to choose. */}
        {hasHousing && (
          <Choice
            label={t("panel.layout.housing")}
            value={params.housingStyle}
            onChange={(housingStyle) => setLayout({ housingStyle })}
            options={[
              { value: "box" as const, label: t("panel.layout.housing.box") },
              { value: "sweep" as const, label: t("panel.layout.housing.sweep") },
            ]}
          />
        )}

        {/* Only where there is a tower to put on a side. A control that does
            nothing in two packages out of three is a question nobody asked. */}
        {hasTower && (
          <Choice
            label={t("panel.layout.tower")}
            value={params.towerSide}
            onChange={(towerSide) => setLayout({ towerSide })}
            options={[
              { value: "left" as const, label: t("panel.layout.tower.left") },
              { value: "right" as const, label: t("panel.layout.tower.right") },
            ]}
          />
        )}

        <div className="mt-1 border-t border-line pt-1">
          <Toggle
            label={t("panel.layout.island")}
            checked={params.hasIsland}
            onChange={(hasIsland) => setLayout({ hasIsland })}
          />
        </div>

        {params.hasIsland && (
          <Choice
            label={t("panel.layout.islandOrientation")}
            value={params.islandOrientation}
            onChange={(islandOrientation) => setLayout({ islandOrientation })}
            options={[
              { value: "parallel" as const, label: t("panel.layout.island.parallel") },
              { value: "perpendicular" as const, label: t("panel.layout.island.perpendicular") },
            ]}
          />
        )}

        {issues.length > 0 && (
          <ul className="mt-3 space-y-2.5">
            {issues.map((refusal, index) => (
              <RefusalNote key={`${refusal.key}-${index}`} refusal={refusal} />
            ))}
          </ul>
        )}
      </PanelSection>

      {/* And the dimensions those decisions are made in. The island's own are
          here rather than beside its switch: they are sizes, and they are
          meaningless without one, so they go rather than sit there greyed out. */}
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
        {/* Where a hand reaches, which is what the oven tower is built round:
            the hole is cut from this rather than the other way about. */}
        {hasTower && (
          <Slider
            label={t("panel.layout.microwaveHandle")}
            value={params.microwaveHandleIn}
            {...PARAM_LIMITS.microwaveHandleIn}
            caption={<MicrowaveReach handleIn={params.microwaveHandleIn} />}
            onChange={(microwaveHandleIn) => setLayout({ microwaveHandleIn })}
          />
        )}
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
      </PanelSection>
    </>
  );
}
