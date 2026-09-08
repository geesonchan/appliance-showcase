import type { ReactNode } from "react";

export function PanelSection({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"border-b border-line px-5 py-5 last:border-b-0 " + className}>
      {title && (
        <h3 className="tracking-label mb-3 text-[10px] text-ink-muted">{title}</h3>
      )}
      {children}
    </section>
  );
}

/** A labelled on/off row, matching the reference product's right-hand panel. */
export function Toggle({
  label,
  checked,
  onChange,
  swatch,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between py-1.5 text-left text-[13px] text-ink transition-colors hover:text-accent"
    >
      <span className="flex items-center gap-2">
        {swatch && (
          <span
            className="h-2.5 w-2.5 rounded-full border border-line"
            style={{ background: swatch }}
          />
        )}
        {label}
      </span>
      <span
        className={
          "relative h-[18px] w-8 shrink-0 rounded-full transition-colors " +
          (checked ? "bg-accent" : "bg-line")
        }
      >
        <span
          className={
            "absolute top-[2px] h-[14px] w-[14px] rounded-full bg-surface transition-all " +
            (checked ? "left-4" : "left-[2px]")
          }
        />
      </span>
    </button>
  );
}

/**
 * A dimension you can drag, with the figure it is currently at.
 *
 * The steps are the trade's, not the pixel's: an island comes in 6" increments
 * because that is how a countertop is ordered, so the control snaps to them and
 * there is no way to ask for 50".
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  format = (n) => `${n}"`,
  feasible,
  caption,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  /**
   * The stretch of the range this configuration can actually be built at. The
   * slider keeps its whole travel — shortening it would hide the constraint
   * instead of teaching it — and greys out the rest.
   */
  feasible?: { minIn: number; maxIn: number } | null;
  /** What the limit is made of, printed under the track. */
  caption?: ReactNode;
  onChange: (next: number) => void;
}) {
  const at = (n: number) => ((n - min) / (max - min)) * 100;
  const band = feasible
    ? `linear-gradient(to right, var(--line) 0 ${at(feasible.minIn)}%, ` +
      `var(--ink-muted) ${at(feasible.minIn)}% ${at(feasible.maxIn)}%, ` +
      `var(--line) ${at(feasible.maxIn)}% 100%)`
    : undefined;
  const outside = feasible ? value < feasible.minIn || value > feasible.maxIn : false;

  return (
    <label className="block py-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink">{label}</span>
        <span
          className={
            "text-[12px] tabular-nums " + (outside ? "font-medium text-[#8A2018]" : "text-ink-muted")
          }
        >
          {format(value)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={band ? { background: band, backgroundSize: "100% 4px" } : undefined}
        className="mt-1.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-line bg-center bg-no-repeat accent-accent"
      />
      {caption && <span className="mt-1 block text-[10px] leading-tight text-ink-muted">{caption}</span>}
    </label>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  name,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: "sm" | "md";
  /** Names the control in the DOM, so a test can reach it without its label. */
  name?: string;
}) {
  const pad = size === "sm" ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-[12px]";
  return (
    // Wraps rather than overflowing. A four-option control does not fit a
    // 240px panel at any font size worth reading, and a panel that scrolls
    // sideways is a panel whose right-hand options nobody finds.
    <div
      data-segment={name}
      className="flex flex-wrap gap-y-[3px] rounded-2xl border border-line bg-surface p-[3px]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            data-value={option.value}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={[
              "whitespace-nowrap rounded-full font-medium transition-colors",
              pad,
              option.disabled
                ? "cursor-not-allowed text-ink-muted/50"
                : active
                  ? "bg-accent text-[#F7F5EF]"
                  : "text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "grid h-8 w-8 place-items-center rounded-full border border-line bg-surface",
        "text-ink transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:border-accent hover:text-accent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
