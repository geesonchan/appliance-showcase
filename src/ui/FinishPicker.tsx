import { useT } from "../i18n/useT";
import {
  CABINET_COLORS,
  useAppStore,
  type CounterFinish,
  type FloorFinish,
} from "../store/useAppStore";
import { PanelSection, Segmented, Toggle } from "./primitives";

/**
 * How the room is finished, as against what is in it.
 *
 * Four cabinet colours, three countertops, two floors. None of it reaches the
 * data, the package or the quote: a customer choosing between four greens is
 * choosing how to look at the kitchen, not what to buy, and the moment a paint
 * colour has a price this stops being a tool for explaining a room. See
 * docs/decisions.md D12.
 */
export function FinishPicker() {
  const t = useT();
  const finishes = useAppStore((s) => s.finishes);
  const setFinish = useAppStore((s) => s.setFinish);

  return (
    <PanelSection title={t("panel.finishes")}>
      <span className="mb-1.5 block text-[13px] text-ink">{t("finish.cabinet")}</span>
      <div className="flex gap-2">
        {CABINET_COLORS.map((paint) => {
          const active = finishes.cabinet === paint.value;
          return (
            <button
              key={paint.value}
              type="button"
              aria-pressed={active}
              title={t(paint.key)}
              onClick={() => setFinish({ cabinet: paint.value })}
              className={[
                "h-7 w-7 rounded-full border transition-all",
                active ? "border-ink ring-2 ring-accent ring-offset-1" : "border-line",
              ].join(" ")}
              style={{ background: paint.value }}
            />
          );
        })}
      </div>

      <div className="mt-3">
        <Toggle
          label={t("finish.twoTone")}
          checked={finishes.twoToneUppers}
          onChange={(twoToneUppers) => setFinish({ twoToneUppers })}
        />
      </div>

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
