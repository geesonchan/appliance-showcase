import { useState } from "react";
import { lookupRal, ralForHex } from "../data/ral";
import { useT } from "../i18n/useT";
import {
  ACCENT_COLORS,
  CABINET_COLORS,
  useAppStore,
  type AccentRun,
  type CounterFinish,
  type FloorFinish,
  type TileSize,
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
  ral,
}: {
  label: string;
  palette: typeof CABINET_COLORS | typeof ACCENT_COLORS;
  value: string;
  onChange: (next: string) => void;
  /** Which of the two RAL inputs goes under this palette. */
  ral: "cabinet" | "accent";
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
      <RalInput which={ral} value={value} onApply={onChange} />
    </>
  );
}

/**
 * A RAL number, typed. Round 33, Leo.
 *
 * The swatches are the quick picks; this is for the customer who arrives with a
 * number from a painter or a brochure. A number in `data/ral.json` paints the
 * doors that colour; anything else says why and changes nothing — a colour the
 * table does not have is not guessed at.
 */
function RalInput({
  which,
  value,
  onApply,
}: {
  which: "cabinet" | "accent";
  value: string;
  onApply: (hex: string) => void;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [error, setError] = useState<{ key: string; vars?: Record<string, string> } | null>(null);
  const current = ralForHex(value);

  const apply = () => {
    const found = lookupRal(text);
    if (!found.ok) {
      setError(
        found.reason === "unknown"
          ? { key: "finish.ral.unknown", vars: { code: found.code } }
          : { key: "finish.ral.format" },
      );
      return;
    }
    setError(null);
    setText("");
    onApply(found.colour.hex);
  };

  return (
    <div className="mt-2">
      <form
        className="flex min-w-0 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <input
          data-ral-input={which}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          placeholder={t("finish.ral.placeholder")}
          aria-label={t("finish.ral.label")}
          className="h-7 w-24 min-w-0 rounded-sm border border-line bg-surface px-2 text-[12px] text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          data-ral-apply={which}
          className="h-7 shrink-0 rounded-sm border border-line px-2 text-[11px] text-ink transition-colors hover:border-accent"
        >
          {t("finish.ral.set")}
        </button>
        {current && (
          <span
            data-ral-current={which}
            className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-muted"
            title={current.name}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-line"
              style={{ background: current.hex }}
            />
            <span className="truncate">{current.code}</span>
          </span>
        )}
      </form>
      {error && (
        <p data-ral-error={which} className="mt-1 text-[11px] leading-snug text-[#8A2018]">
          {t(error.key, error.vars)}
        </p>
      )}
    </div>
  );
}

const TILE_LABEL: Record<TileSize, string> = {
  "24x48": "24″ × 48″",
  "32x32": "32″ × 32″",
  "48x48": "48″ × 48″",
};

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
        ral="cabinet"
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
            ral="accent"
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
          name="floor"
          value={finishes.floor}
          onChange={(floor: FloorFinish) => setFinish({ floor })}
          options={[
            { value: "floor-oak" as const, label: t("finish.floor.oak") },
            { value: "floor-tile" as const, label: t("finish.floor.tile") },
          ]}
        />
        {finishes.floor === "floor-tile" && (
          <div className="mt-2">
            <span className="mb-1 block text-[11px] text-ink-muted">{t("finish.floor.tileSize")}</span>
            <Segmented
              size="sm"
              name="tile-size"
              value={finishes.tileSize}
              onChange={(tileSize: TileSize) => setFinish({ tileSize })}
              options={(["24x48", "32x32", "48x48"] as const).map((size) => ({
                value: size,
                label: TILE_LABEL[size],
              }))}
            />
          </div>
        )}
      </div>
    </PanelSection>
  );
}
