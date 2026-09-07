import { LAYOUT_ISSUES, LAYOUT_PARAMS } from "../data/room";
import { useT } from "../i18n/useT";

/**
 * What the template refused to build, and why.
 *
 * A layout that cannot be made is not a bug to hide — it is the answer to the
 * question the parameters asked, and the sentence explaining it is the useful
 * part. The room falls back to the default so there is still something to look
 * at, and this says which room you are actually looking at.
 */
export function LayoutIssues() {
  const t = useT();
  if (LAYOUT_ISSUES.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-4">
      <div className="pointer-events-auto max-w-md rounded-sm border border-[#E5C6C2] bg-[#FDF3F2] px-4 py-2.5">
        <p className="text-[11px] font-medium text-[#8A2018]">{t("layout.refused")}</p>
        <ul className="mt-1 space-y-0.5">
          {LAYOUT_ISSUES.map((issue) => (
            <li key={issue} className="text-[11px] leading-snug text-[#8A2018]">
              {issue}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[10px] text-[#8A2018]/70">
          {t("layout.showing", {
            island: LAYOUT_PARAMS.islandLengthIn,
            fridge: LAYOUT_PARAMS.fridgeEnd,
          })}
        </p>
      </div>
    </div>
  );
}
