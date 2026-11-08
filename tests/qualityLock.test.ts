import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * Round 100, Leo: a switch for the pixel proofs only — a page opened with
 * `?qualityLock=1` keeps the tier it opened at, the guard never dropping it,
 * where round 99b's shots found 22 of 45 states differing from their own
 * build's other run, most likely a drop mid-shot. On no control; a page
 * opened without it is as it was. Both asked on a page that cannot hold 55:
 * locked it stays at the high tier's 512-pixel textures; without the lock the
 * guard still drops it to the low tier's 256.
 *
 * How the page is made slow (the quality lock's test round, Leo, 2026-11-04,
 * 乙): every `requestAnimationFrame` callback waits 30 ms before it runs, in
 * the page's init script, so every frame of the scene takes 30 ms and more —
 * about 30 a second, from the page's opening to its closing. The page's own
 * code is not touched: the switch is in this file only. It slows the page's
 * few one-off callbacks too (`ShaderWarmup`, `useIdleValue`, `SceneDebug`),
 * once each.
 *
 * Why this test used to fail now and then (decisions.md, the 2026-10-29 full
 * suite, found 2026-11-04): it slowed the CPU sixteen times over for eight
 * seconds. That slows the page's JavaScript only, and a settled room needs so
 * little each frame that it drew at 58–60 slowed; what was slow was the page's
 * first seconds after it opened. In the runs that failed the room was under
 * 55 for two seconds of the slowing, and the guard, which drops only after two
 * whole seconds of its own under 55, did not see them as two in a row: 4 runs
 * in 55, the page visible in every one. A frame made slow by the clock stays
 * slow for as long as the test reads it.
 */

const EXPECTED_TESTS = 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} quality lock tests actually ran`).toBe(EXPECTED_TESTS);
});

/** How long each frame is held, in ms (Leo, 2026-11-04: 30). */
const SLOW_MS = 30;
/** How often the textures are read, and for how long at most (Leo, 2026-11-04). */
const READ_EVERY_MS = 250;
const READ_FOR_MS = 15_000;

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

/** A page every frame of which takes `SLOW_MS` and more, with the scene and its frames' times kept to read. */
async function slowPage(query: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript((slowMs: number) => {
    type Kept = { __scene?: unknown; __frames: number[]; __visibility: string[] };
    const kept = window as unknown as Kept;
    kept.__frames = [];
    kept.__visibility = [];
    const own = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      own((time) => {
        const until = performance.now() + slowMs;
        while (performance.now() < until) {
          // Held on purpose: this frame takes slowMs before its work begins.
        }
        callback(time);
      });
    const hook = new EventTarget();
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const r = (event as CustomEvent).detail;
      if (!r?.isWebGLRenderer || !r.render) return;
      const render = r.render.bind(r);
      r.render = (scene: unknown, camera: unknown) => {
        kept.__scene = scene;
        kept.__frames.push(performance.now());
        render(scene, camera);
      };
    });
  }, SLOW_MS);
  await openWatched(page, `${PREVIEW_URL}${query}`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `qualityLock · ${expect.getState().currentTestName ?? ""}` });
  return page;
}

/** The widest texture on screen now: 512 at the high tier, 256 at the low, 0 before any is up. */
const widest = (page: Page) =>
  page.evaluate(() => {
    let most = 0;
    (window as unknown as { __scene?: { traverse: (f: (o: any) => void) => void } }).__scene?.traverse((object) => {
      for (const material of [object.material].flat()) most = Math.max(most, material?.map?.image?.width ?? 0);
    });
    return most;
  });

/**
 * The textures read every `READ_EVERY_MS` until `stopAt` says so or
 * `READ_FOR_MS` has gone, and what the page was doing meanwhile — the frames
 * drawn each second and its visibility — to print should it fail.
 */
async function readWhileSlow(page: Page, stopAt: (width: number) => boolean) {
  const readings: [number, number][] = [];
  const started = Date.now();
  while (Date.now() - started < READ_FOR_MS) {
    const width = await widest(page);
    readings.push([Date.now() - started, width]);
    await page.evaluate(() => (window as unknown as { __visibility: string[] }).__visibility.push(document.visibilityState));
    if (stopAt(width)) break;
    await page.waitForTimeout(READ_EVERY_MS);
  }
  const seen = await page.evaluate(() => {
    const kept = window as unknown as { __frames: number[]; __visibility: string[] };
    const last = kept.__frames[kept.__frames.length - 1] ?? 0;
    const perSecond: number[] = [];
    for (let end = last; end > last - 15_000 && end > 0; end -= 1000)
      perSecond.unshift(kept.__frames.filter((t) => t > end - 1000 && t <= end).length);
    return { perSecond, visibility: [...new Set(kept.__visibility)] };
  });
  await page.context().close();
  return { readings, ...seen };
}

describe("the pixel proofs' quality lock (round 100)", () => {
  it("keeps a locked page at the high tier however slow it is", async () => {
    const page = await slowPage("?quality=high&qualityLock=1");
    const read = await readWhileSlow(page, () => false);
    const widths = [...new Set(read.readings.map(([, width]) => width).filter((width) => width > 0))];
    expect(widths, JSON.stringify(read)).toEqual([512]);
    // Slow the whole time, or the lock was never asked anything.
    expect(Math.max(...read.perSecond), JSON.stringify(read)).toBeLessThan(55);
  });

  it("leaves the guard dropping a page opened without it", async () => {
    const page = await slowPage("?quality=high");
    const read = await readWhileSlow(page, (width) => width === 256);
    expect(read.readings[read.readings.length - 1]?.[1], JSON.stringify(read)).toBe(256);
  });
});
