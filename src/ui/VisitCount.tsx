import { useEffect, useState } from "react";
import { useT } from "../i18n/useT";
import { pageVisits } from "../visitCount";

/**
 * The visit count, 「1,234 次访问」 / "1,234 visits" (item 12c; Leo, 2026-11-17).
 *
 * On a desktop beside the title (his 乙); on a phone at the left of the second
 * row, as the prototype had it (「放左上角第二行，照原型」). One place at a time,
 * split at 640px: below it the second row's, from it the title's — the
 * breakpoints the page's stylesheet already has, so it is not rebuilt for this
 * (between 430px and 640px, where the title shows, the count is still the
 * second row's). Nothing at all until there is a figure to show, and nothing
 * if there never is (`pageVisits`): no element, no space kept.
 */
export function VisitCount({ place }: { place: "title" | "row" }) {
  const t = useT();
  const [count, setCount] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void pageVisits().then((shown) => {
      if (live) setCount(shown);
    });
    return () => {
      live = false;
    };
  }, []);
  if (count === null) return null;
  const text = t("topbar.visits", { count });
  return place === "title" ? (
    <span data-visits="title" className="hidden whitespace-nowrap text-[11px] tabular-nums text-ink-muted sm:block">
      {text}
    </span>
  ) : (
    <span
      data-visits="row"
      className="absolute bottom-0 left-3 top-0 flex items-center whitespace-nowrap text-[11px] tabular-nums text-ink-muted sm:hidden"
    >
      {text}
    </span>
  );
}
