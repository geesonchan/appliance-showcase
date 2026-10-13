import { createServer } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { startDev } from "./globalSetup";

/**
 * The wall sliders raise no React style warning. Round 91; docs/decisions.md,
 * Open items, "A React style warning from the wall sliders".
 *
 * `Slider` set `background` and `backgroundSize` on the same input, and React
 * warns about mixing a shorthand with one of its parts — in its development
 * build only, and only when the shorthand's value changes: when a switch moves
 * a slider's feasible band (the corner, the island turned, the package), not
 * when the slider itself is dragged (measured in round 91's plan). The
 * production build the rest of the suite runs never prints it, so this file
 * serves the working tree through Vite's development server, on its own port,
 * and stops it after; the suite runs its files one after another, so nothing
 * else runs beside it. The mouse throughout (D17).
 */

const DEV_PORT = 4175;
const DESKTOP = { width: 1440, height: 900 };

const EXPECTED_TESTS = 1;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});

let browser: Browser;
let stop: () => Promise<void>;
beforeAll(async () => {
  stop = await startDev(DEV_PORT);
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});

/** Whether a port can be listened on again: the server let it go. */
const portFree = (port: number) =>
  new Promise<boolean>((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });

afterAll(async () => {
  await browser?.close();
  await stop?.();
  expect(await portFree(DEV_PORT), `the development server let port ${DEV_PORT} go`).toBe(true);
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} slider-warning tests actually ran`).toBe(EXPECTED_TESTS);
});

describe("the wall sliders", () => {
  it("raise no style warning when a switch moves their band (corner, island, package)", async () => {
    const page = await (await browser.newContext({ viewport: DESKTOP })).newPage();
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (/conflicting property/.test(message.text())) warnings.push(message.text().replace(/\s+/g, " ").slice(0, 160));
    });
    await page.goto(`http://localhost:${DEV_PORT}/?quality=low`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector("canvas", { timeout: 120_000 });
    await page.waitForTimeout(2000);
    const click = async (locator: ReturnType<typeof page.locator>) => {
      await locator.scrollIntoViewIfNeeded();
      const box = (await locator.boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1200);
    };
    // The sliders are on the Layout tab since round 91; before, on the one panel.
    const layoutTab = page.locator('[data-right-tab="layout"]');
    if ((await layoutTab.count()) > 0) await click(layoutTab.first());
    await click(page.getByRole("button", { name: "Lazy susan" }).first());
    await click(page.getByRole("button", { name: "Across the room" }).first());
    await click(page.locator('[data-segment="package"] button', { hasText: "D" }).first());
    await page.context().close();
    expect({ warnings: warnings.length, first: warnings[0] ?? null }).toEqual({ warnings: 0, first: null });
  });
});
