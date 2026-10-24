import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 100, Leo: a switch for the pixel proofs only — a page opened with
 * `?qualityLock=1` keeps the tier it opened at, the guard never dropping it,
 * where round 99b's shots found 22 of 45 states differing from their own
 * build's other run, most likely a drop mid-shot. On no control; a page
 * opened without it is as it was. Both asked on a page slowed until it cannot
 * hold 55 (the CPU sixteen times over, where round 100's runs dropped every
 * page before any tap): locked it stays at the high tier's 512-pixel
 * textures; without the lock the guard still drops it.
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

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

/** The widest texture on screen after eight slow seconds: 512 at the high tier, 256 at the low. */
async function widestAfterSlowing(query: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const hook = new EventTarget();
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const r = (event as CustomEvent).detail;
      if (!r?.isWebGLRenderer || !r.render) return;
      const own = r.render.bind(r);
      r.render = (scene: unknown, camera: unknown) => {
        (window as unknown as { __scene: unknown }).__scene = scene;
        own(scene, camera);
      };
    });
  });
  await page.goto(`${PREVIEW_URL}${query}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 16 });
  await page.waitForTimeout(8000);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.waitForTimeout(1500);
  const widest = await page.evaluate(() => {
    let most = 0;
    (window as unknown as { __scene?: { traverse: (f: (o: any) => void) => void } }).__scene?.traverse((object) => {
      for (const material of [object.material].flat()) most = Math.max(most, material?.map?.image?.width ?? 0);
    });
    return most;
  });
  await context.close();
  return widest;
}

describe("the pixel proofs' quality lock (round 100)", () => {
  it("keeps a locked page at the high tier however slow it is", async () => {
    expect(await widestAfterSlowing("?quality=high&qualityLock=1")).toBe(512);
  });

  it("leaves the guard dropping a page opened without it", async () => {
    expect(await widestAfterSlowing("?quality=high")).toBe(256);
  });
});
