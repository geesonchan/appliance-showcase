import { useT } from "../i18n/useT";
import {
  ACCENT_COLORS,
  CABINET_COLORS,
  useAppStore,
  type AccentRun,
  type CounterFinish,
  type FloorFinish,
} from "../store/useAppStore";
import { PanelSection, Segmented } from "./primitives";

/**
 * How the room is finished, as against what is in it.
 *
 * None of it reaches the data, the package or the quote: a customer choosing
 * between five greens is choosing how to look at the kitchen, not what to buy,
 * and the moment a paint colour has a price this stops being a tool for
 * explaining a room. See docs/decisions.md D12.
 *
 * The second colour goes on a whole run rather than on the wall cabinets,
 * because that is the decision a designer actually makes: the island in oak,
 * or the back wall in ink. Splitting a kitchen at counter height is a different
 * thing and mostly a dated one. See docs/decisions.md D15.
 */
function Swatches({
  label,
  palette,
  value,
  onChange,
}: {
  label: string;
  palette: typeof CABINET_COLORS | typeof ACCENT_COLORS;
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useT();
  return (
    <>
      <span className="mb-1.5 block text-[13px] text-ink">{label}</span>
      <div className="flex gap-2">
        {palette.map((paint) => {
          const active = value === paint.value;
          return (
            <button
              key={paint.value}
              type="button"
              data-swatch={paint.value}
              aria-pressed={active}
              title={t(paint.key)}
              onClick={() => onChange(paint.value)}
              className={[
                "h-7 w-7 rounded-full border transition-all",
                active ? "border-ink ring-2 ring-accent ring-offset-1" : "border-line",
              ].join(" ")}
              style={{ background: paint.value }}
            />
          );
        })}
      </div>
    </>
  );
}

export function FinishPicker() {
  const t = useT();
  const finishes = useAppStore((s) => s.finishes);
  const setFinish = useAppStore((s) => s.setFinish);

  return (
    <PanelSection title={t("panel.finishes")}>
      <Swatches
        label={t("finish.cabinet")}
        palette={CABINET_COLORS}
        value={finishes.cabinet}
        onChange={(cabinet) => setFinish({ cabinet })}
      />

      <div className="mt-4">
        <span className="mb-1.5 block text-[13px] text-ink">{t("finish.accentRun")}</span>
        <Segmented
          size="sm"
          name="accent-run"
          value={finishes.accentRun}
          onChange={(accentRun: AccentRun) => setFinish({ accentRun })}
          options={[
            { value: "none" as const, label: t("finish.accentRun.none") },
            { value: "left" as const, label: t("panel.layout.leg.left") },
            { value: "back" as const, label: t("panel.layout.leg.back") },
            { value: "island" as const, label: t("panel.layout.island") },
          ]}
        />
      </div>

      {/* The second palette only means anything once a run is wearing it. */}
      {finishes.accentRun !== "none" && (
        <div className="mt-3">
          <Swatches
            label={t("finish.accent")}
            palette={ACCENT_COLORS}
            value={finishes.accent}
            onChange={(accent) => setFinish({ accent })}
          />
        </div>
      )}

      <div className="mt-4">
        <span className="mb-1.5 block text-[13px] text-ink">{t("finish.counter")}</span>
        <Segmented
          size="sm"
          value={finishes.counter}
          onChange={(counter: CounterFinish) => setFinish({ counter })}
          options={[
            { value: "quartz-white" as const, label: t("finish.counter.quartz") },
            { value: "marble-veined" as const, label: t("finish.counter.marble") },
            { value: "wood-oak" as const, label: t("finish.counter.oak") },
          ]}
        />
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-[13px] text-ink">{t("finish.floor")}</span>
        <Segmented
          size="sm"
          value={finishes.floor}
          onChange={(floor: FloorFinish) => setFinish({ floor })}
          options={[
            { value: "floor-oak" as const, label: t("finish.floor.oak") },
            { value: "tile-white" as const, label: t("finish.floor.tile") },
          ]}
        />
      </div>
    </PanelSection>
  );
}
