/**
 * The watch broken four ways, one a run (BREAK=1..4), and the tests as they are now run
 * against it: each must go red (Leo, 2026-11-12: 「4 种改坏都必须变红」). With OLD=1 the test
 * as it was at 5d5da45 instead, for comparison. Run with `-t "main-thread watch"`.
 *   1 never writes; 2 writes on every tick; 3 the time a tick short; 4 a hold written twice.
 */
import { vi } from "vitest";

vi.mock("../../../../scripts/previewServer.mjs", async (load) => {
  const real = (await load()) as Record<string, unknown>;
  const way = Number(process.env.BREAK);
  function watchMainThread(
    write: (r: Record<string, unknown>) => void,
    { intervalMs = 50, thresholdMs = 200, now = () => performance.now(), every = setInterval, cancel = clearInterval }: Record<string, any> = {},
  ) {
    let last = now();
    const timer = every(() => {
      const at = now();
      const gap = at - last;
      if (way === 1) {
        // never writes
      } else if (way === 2) write({ ev: "stall", ms: Math.round(gap) });
      else if (gap - intervalMs > thresholdMs) {
        write({ ev: "stall", ms: Math.round(way === 3 ? gap - intervalMs : gap) });
        if (way === 4) write({ ev: "stall", ms: Math.round(gap) });
      }
      last = at;
    }, intervalMs);
    return () => cancel(timer);
  }
  return { ...real, watchMainThread };
});

if (process.env.OLD === "1") await import("./old-unstalled");
else await import("../../../../scripts/previewServer.test");
