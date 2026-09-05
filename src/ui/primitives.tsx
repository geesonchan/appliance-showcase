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
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-[12px]";
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-[3px]">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
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
