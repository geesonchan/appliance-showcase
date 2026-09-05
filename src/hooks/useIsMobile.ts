import { useEffect, useState } from "react";

/** Matches Tailwind's `md` breakpoint, which is where the layout switches. */
const QUERY = "(max-width: 767px)";

/**
 * Phone-sized viewport. Used for treatments that have to differ in kind rather
 * than in scale, such as thinning the install wireframe down to a silhouette.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
