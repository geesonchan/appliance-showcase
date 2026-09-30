/**
 * Brand · model, and the opening beside them where it is not the machine's
 * width — the one place this line is laid out.
 *
 * D12, round 79 (Leo): **the model number is never cut.** Where the line is too
 * narrow the brand gives way first, and the opening drops to a line of its
 * own. Round 82 made it one component so the appliance list, the alternatives,
 * the blowers and the model card cannot each grow their own version of the
 * rule (D17: one rule written once); `tests/modelLine.test.ts` holds every
 * copy of it on screen to the rule, at widths where the brand does give way.
 *
 * `className` sets the size and colour; the layout is this component's.
 */
export function ModelLine({
  brand,
  model,
  opening = null,
  className = "text-[11px] text-ink-muted",
}: {
  brand: string;
  model: string;
  /** Already worded, e.g. `36" opening`; null where there is nothing to add. */
  opening?: string | null;
  className?: string;
}) {
  return (
    <span
      data-model-line
      className={"flex flex-wrap items-baseline gap-x-1 leading-[1.3] " + className}
      title={`${brand} ${model}`}
    >
      <span className="flex min-w-0 max-w-full items-baseline gap-x-1">
        <span data-model-brand className="min-w-0 truncate">
          {brand}
        </span>
        <span className="shrink-0">·</span>
        <span data-model-model className="shrink-0 whitespace-nowrap">
          {model}
        </span>
      </span>
      {opening && (
        <span data-model-opening className="whitespace-nowrap tabular-nums">
          · {opening}
        </span>
      )}
    </span>
  );
}
