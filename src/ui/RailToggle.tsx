/**
 * The handle that opens and closes a side column.
 *
 * When the column is closed it *is* the column — a 36px rail with the panel's
 * name set sideways, so the reader can still see what is behind it. When the
 * column is open it sits at the bottom as a plain strip, out of the way of the
 * content above it.
 */
export function RailToggle({
  side,
  open,
  label,
  onClick,
}: {
  side: "left" | "right";
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  const chevron = (side === "left") === open ? "‹" : "›";

  if (open) {
    return (
      <button
        type="button"
        data-rail={side}
        onClick={onClick}
        title={label}
        className="flex h-8 shrink-0 items-center justify-center gap-1.5 border-t border-line text-[10px] text-ink-muted transition-colors hover:text-accent"
      >
        <span aria-hidden="true">{chevron}</span>
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-rail={side}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-full w-full flex-col items-center gap-3 py-3 text-ink-muted transition-colors hover:text-accent"
    >
      <span aria-hidden="true" className="text-[12px]">
        {chevron}
      </span>
      <span
        className="tracking-label whitespace-nowrap text-[9px]"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        {label}
      </span>
    </button>
  );
}
