import { LAYOUT_PARAMS } from "../data/room";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { useRefusalText } from "./RefusalNote";

/**
 * What the template refused to build, over the scene.
 *
 * A layout that cannot be made is not a bug to hide — it is the answer to the
 * question the parameters asked. The room that was standing stays standing, and
 * this says which room you are actually looking at.
 *
 * The full argument — what is taking up the wall, and the change that would fix
 * it — is under the control that caused it, where the fix is one click away.
 * This is the notice, not the explanation, so it stays short and it sits below
 * the mode switch rather than over it.
 */
export function LayoutIssues() {
  const t = useT();
  const text = useRefusalText();
  const issues = useAppStore((s) => s.layoutIssues);
  const rightOpen = useAppStore((s) => s.rightOpen);
  if (issues.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-20 flex justify-center px-4">
      <div className="pointer-events-auto max-w-md rounded-sm border border-[#E5C6C2] bg-[#FDF3F2] px-4 py-2.5">
        <p className="text-[11px] font-medium text-[#8A2018]">{t("layout.refused")}</p>
        <ul className="mt-1 space-y-0.5">
          {issues.map((refusal, index) => (
            <li key={`${refusal.key}-${index}`} className="text-[11px] leading-snug text-[#8A2018]">
              {text(refusal.key, refusal.vars)}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[10px] text-[#8A2018]/70">
          {t("layout.showing", {
            island: LAYOUT_PARAMS.islandLengthIn,
            fridge: t(`leg.${LAYOUT_PARAMS.fridgeEnd}`),
          })}
          {/* On a phone the configuration is behind the sheet whatever the
              desktop rail is doing, so the pointer to it always shows there. */}
          <span className={rightOpen ? "md:hidden" : undefined}>{` ${t("layout.seeConfig")}`}</span>
        </p>
      </div>
    </div>
  );
}
