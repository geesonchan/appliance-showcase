import { useEffect, useRef, useState } from "react";

/**
 * A value worked out now when the component first shows, and after that in
 * the page's idle time, not in the frame that changed it.
 *
 * Round 99a, Leo: the Layout tab's bill under each wall slider and the
 * slider's greyed band are worked out again whenever the room is rebuilt, a
 * model swap included, and that is 4 to 40 ms more on the frame a customer
 * swaps a machine in (package D's run up to 95). The figures are only read
 * once the room has settled, so they are worked out once it has: on the
 * browser's idle callback, or after the next frame where there is none
 * (Safari). Until then the last figures stay up; they always end as the
 * room's.
 */
export function useIdleValue<T>(compute: () => T, deps: readonly unknown[]): T {
  const [value, setValue] = useState(compute);
  const latest = useRef(compute);
  latest.current = compute;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    const run = () => {
      if (!cancelled) setValue(latest.current());
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 1000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(run, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // The caller's own dependencies decide when the value is worked out again.
  }, deps);

  return value;
}
