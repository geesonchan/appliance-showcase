/**
 * The test as it was at 5d5da45, without injected stalls: what broken.test.ts runs with
 * OLD=1, to show the old test against the four broken watches.
 */
import { describe, expect, it } from "vitest";
import { watchMainThread } from "../../../../scripts/previewServer.mjs";

describe("the main-thread watch", () => {
  it("writes a stall when its thread is held, with how long, and nothing while it is free", async () => {
    const written: Array<Record<string, unknown>> = [];
    const stop = watchMainThread((record) => written.push(record), { intervalMs: 20, thresholdMs: 150 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const quiet = written.filter((r) => r.ev === "stall").length;
    const until = Date.now() + 400;
    while (Date.now() < until) {
      // held
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    stop();
    const stalls = written.filter((r) => r.ev === "stall");
    expect(quiet).toBe(0);
    expect(stalls).toHaveLength(1);
    expect(stalls[0].ms).toBeGreaterThanOrEqual(350);
    expect(stalls[0].ms).toBeLessThan(1_000);
  });
});
