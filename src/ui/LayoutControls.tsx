import { PARAM_LIMITS, feasibleRange, wallRequirement, type LayoutParams } from "../data/room";
import { LAYOUT_SHAPES } from "../data/layoutShape";
import { paramLimitsFor } from "../data/layoutTemplate";
import { showsControl, type LayoutControl } from "./shapeControls";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useActivePackage, useSelectedAppliance, useSelection } from "../store/useSelection";
import { billLabelKey } from "../data/machineLabel";
import { hoodMount } from "../data/hoodMount";
import { comboHandleAt, comboSillFor } from "../data/columnModel";
import { atCoffeeManualHeight, snapCoffeeSill, underCoffee } from "../data/layoutTemplate";
import { formatDimension } from "../data/dimensions";
import { RefusalNote } from "./RefusalNote";
import { useIdleValue } from "./useIdleValue";
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
  // Worked out again whenever the room is: a model swapped rebuilds the room
  // round it without changing a setting, and the bill is that model's (round
  // 99a — a 30" range in A's 36" opening still showed "36" RO36" here). In
  // the page's idle time, not the frame the room changed in (`useIdleValue`).
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const requirement = useIdleValue(() => wallRequirement(params, leg), [params, leg, layoutVersion]);
  const selection = useSelection();

  return (
    <>
      <span className="font-medium text-ink">
        {t("panel.room.minimum", { value: requirement.minimumIn })}
      </span>{" "}
      {requirement.items.map((item, index) => (
        <span key={`${billLabelKey(item, selection)}-${index}`} title={t(billLabelKey(item, selection))}>
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
  // A microwave handle to reach for is a combination oven's, in a tower beside
  // the range or on its own in the run; package D's steam oven has none, and
  // hangs at its own figure. Round 74: shown wherever the parameter decides a
  // height on screen — it had been deciding E's with no control for it.
  const hasMicrowaveTower = specified.some(
    (slot) => slot.category === "wall-oven" && slot.installType === "combo",
  );
  // And a coffee cabinet, which can go on either leg at a height somebody sets.
  const hasCoffee = specified.some((slot) => slot.category === "coffee");
  // What stands under it, which the caption names rather than assumes (round 73).
  const underIt = underCoffee(specified);
  // And whether the hood in the room is a liner that goes up inside joinery,
  // which is the only kind with a shape to choose. The hood chosen, not the
  // package's own (round 87, Leo): A with VCIN36GWS shows it, B or D with an
  // under-cabinet hood does not.
  const hood = useSelectedAppliance("slot-hood");
  const hasHousing = !!hood && hoodMount(hood) === "insert";
  const issues = useAppStore((s) => s.layoutIssues);
  const setLayout = useAppStore((s) => s.setLayout);
  const setLayoutShape = useAppStore((s) => s.setLayoutShape);
  // What the shape shows (round 98b-2): one wall hides what it has not got
  // and what it decides itself (`shapeControls.ts`).
  const on = (control: LayoutControl) => showsControl(params.shape, control);
  const limits = paramLimitsFor(params.shape);

  // Probing the generator, so the greyed band and the room can never disagree:
  // again whenever the room is rebuilt, a model swapped included, in the
  // page's idle time (round 99a, `useIdleValue`).
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const feasible = useIdleValue(
    () => ({
      backWallIn: feasibleRange(params, "backWallIn"),
      leftWallIn: feasibleRange(params, "leftWallIn"),
    }),
    [params, layoutVersion],
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
        {/* The layout's shape, first: it decides which of the rest apply.
            Round 98b-2. Switching it grows the wall where the package needs
            it, says so and offers Undo (D18), and leaves the camera (D1). */}
        <Choice
          label={t("panel.layout.shape")}
          value={params.shape}
          onChange={(shape) => setLayoutShape(shape)}
          options={LAYOUT_SHAPES.map((shape) => ({ value: shape, label: t(`panel.layout.shape.${shape}`) }))}
        />
        {on("fridgeEnd") && (
          <Choice
            label={t("panel.layout.fridge")}
            value={params.fridgeEnd}
            onChange={(fridgeEnd) => setLayout({ fridgeEnd })}
            options={legs}
          />
        )}
        {/* What is past the refrigerator. A door opens through more than the
            machine's own width, and against a wall that costs three and a half
            inches of the run. See docs/decisions.md D11 rule 11. */}
        {on("fridgeEndAbuts") && (
          <Choice
            label={t("panel.layout.fridgeAbuts")}
            value={params.fridgeEndAbuts}
            onChange={(fridgeEndAbuts) => setLayout({ fridgeEndAbuts })}
            options={[
              { value: "cabinet" as const, label: t("panel.layout.abuts.cabinet") },
              { value: "wall" as const, label: t("panel.layout.abuts.wall") },
            ]}
          />
        )}
        {on("sinkLeg") && (
          <Choice
            label={t("panel.layout.sink")}
            value={params.sinkLeg}
            onChange={(sinkLeg) => setLayout({ sinkLeg })}
            options={legs}
          />
        )}

        {on("cornerType") && (
          <Choice
            label={t("panel.room.corner")}
            value={params.cornerType}
            onChange={(cornerType) => setLayout({ cornerType })}
            options={[
              { value: "blind" as const, label: t("panel.room.corner.blind") },
              { value: "lazy-susan" as const, label: t("panel.room.corner.lazySusan") },
            ]}
          />
        )}

        {/* Only where the hood is a liner in a housing somebody builds. A
            canopy has a shape of its own and nothing to choose. */}
        {hasHousing && on("housingStyle") && (
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
        {hasTower && on("towerSide") && (
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

        {hasCoffee && on("coffeeLeg") && (
          <Choice
            label={t("panel.layout.coffee")}
            value={params.coffeeLeg}
            onChange={(coffeeLeg) => setLayout({ coffeeLeg })}
            options={legs}
          />
        )}

        {on("hasIsland") && (
          <div className="mt-1 border-t border-line pt-1">
            <Toggle
              label={t("panel.layout.island")}
              checked={params.hasIsland}
              onChange={(hasIsland) => setLayout({ hasIsland })}
            />
          </div>
        )}

        {params.hasIsland && on("islandOrientation") && (
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
          {...limits.backWallIn}
          feasible={feasible.backWallIn}
          caption={<WallMinimum params={params} leg="back" />}
          onChange={(backWallIn) => setLayout({ backWallIn })}
        />
        {on("leftWallIn") && (
          <Slider
            label={t("panel.room.leftWall")}
            value={params.leftWallIn}
            {...PARAM_LIMITS.leftWallIn}
            feasible={feasible.leftWallIn}
            caption={<WallMinimum params={params} leg="left" />}
            onChange={(leftWallIn) => setLayout({ leftWallIn })}
          />
        )}
        {/* Where a hand reaches, which is what the oven tower is built round:
            the hole is cut from this rather than the other way about. */}
        {hasMicrowaveTower && on("microwaveHandleIn") && (
          <Slider
            label={t("panel.layout.microwaveHandle")}
            value={params.microwaveHandleIn}
            {...PARAM_LIMITS.microwaveHandleIn}
            caption={<MicrowaveReach handleIn={params.microwaveHandleIn} />}
            onChange={(microwaveHandleIn) => setLayout({ microwaveHandleIn })}
          />
        )}
        {hasCoffee && on("coffeeSillIn") && (
          <Slider
            label={t("panel.layout.coffeeSill")}
            value={params.coffeeSillIn}
            {...PARAM_LIMITS.coffeeSillIn}
            // As a tape reads it. At the manual's 37-7/16" a line under the
            // track says whose figure that is (round 76): on its own line, as
            // the value beside the label it wrapped the label to three.
            format={formatDimension}
            caption={
              <>
                {atCoffeeManualHeight(params.coffeeSillIn) && (
                  <span className="block text-accent" data-coffee-recommended>
                    {t("panel.layout.coffeeSill.recommended")}
                  </span>
                )}
                {t(`panel.layout.coffeeSill.caption.${underIt}`, {
                  sillIn: formatDimension(params.coffeeSillIn).replace(/"$/, ""),
                })}
              </>
            }
            // Within half an inch of the manual's figure it is the manual's
            // figure, so dragging up and back finds it again (round 76).
            onChange={(position) => setLayout({ coffeeSillIn: snapCoffeeSill(position) })}
          />
        )}
        {params.hasIsland && on("islandLengthIn") && (
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
