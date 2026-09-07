import type { Refusal, RequirementItem } from "../data/room";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";

/**
 * A refusal, rendered as an argument rather than an apology.
 *
 * Three parts, in the order somebody needs them: what will not fit, what is
 * taking up the room — every line a cabinet you could order or a rule somebody
 * wrote down — and one change that would make it fit, with a button that
 * applies it. A refusal that only says no makes the tool look broken; this is
 * the part of the product where the constraint gets explained.
 */
export function useRefusalText() {
  const t = useT();
  /**
   * Values whose names end in `Key` are themselves keys — the generator has no
   * language, so it names the string rather than writing it.
   */
  return (key: string, vars: Record<string, string | number>) => {
    const resolved: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(vars)) {
      if (name.endsWith("Key") && typeof value === "string") {
        resolved[name.slice(0, -3)] = t(value);
      } else {
        resolved[name] = value;
      }
    }
    return t(key, resolved);
  };
}

/** One line of the bill: a width, and the cabinet or rule that asks for it. */
export function OccupancyList({ items }: { items: RequirementItem[] }) {
  const t = useT();
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1">
      {items.map((item, index) => (
        <li
          key={`${item.labelKey}-${index}`}
          title={`${t(item.labelKey)} · ${item.code ?? t(`rule.${item.rule}`)}`}
          className="rounded-sm border border-[#E5C6C2] px-1 py-px text-[10px] leading-tight text-[#8A2018]"
        >
          <span className="tabular-nums font-medium">{item.widthIn}&quot;</span>{" "}
          <span className="opacity-70">{item.code ?? item.rule?.toUpperCase()}</span>
        </li>
      ))}
    </ul>
  );
}

export function RefusalNote({ refusal }: { refusal: Refusal }) {
  const t = useT();
  const text = useRefusalText();
  const setLayout = useAppStore((s) => s.setLayout);

  return (
    <li className="border-l-2 border-[#E5C6C2] pl-2.5">
      <p className="text-[11px] leading-snug text-[#8A2018]">{text(refusal.key, refusal.vars)}</p>
      {refusal.occupancy && <OccupancyList items={refusal.occupancy} />}
      {refusal.suggestion && (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[11px] leading-snug text-[#8A2018]">
            {text(refusal.suggestion.key, refusal.suggestion.vars)}
          </span>
          <button
            type="button"
            onClick={() => setLayout(refusal.suggestion!.patch)}
            className="rounded-full border border-[#8A2018] px-2 py-px text-[10px] font-medium text-[#8A2018] transition-colors hover:bg-[#8A2018] hover:text-[#FDF3F2]"
          >
            {t("layout.applySuggestion")}
          </button>
        </div>
      )}
    </li>
  );
}
