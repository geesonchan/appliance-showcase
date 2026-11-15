import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * Item 12, 10 (Leo, 2026-11-14), with real input: the mouse on a desktop, a finger on a phone (D17).
 * Install mode, and the words beside the line from the cooking surface to the hood as the page
 * shows them: what the chosen hood's own manual says, 「建议最大」 where it calls its maximum
 * recommended or suggested, and the microwave's 「店里做法」. Four rooms, lopsided: C's own (no
 * maximum; C's room singled out by Leo), B's own (VCIN36GWS, recommended), A with AK7136BS-BF
 * (Zephyr's 24 and recommended 32), D with the microwave.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 4;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} hood-line tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function press(page: Page, phone: boolean, locator: ReturnType<Page["locator"]>) {
  const box = (await locator.filter({ visible: true }).first().boundingBox({ timeout: 8000 }))!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** The room by its link, Install pressed, and the line's figure and words as shown. */
async function lineIn(query: string, phone: boolean) {
  const context = await browser.newContext(
    phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openWatched(page, `${PREVIEW_URL}?${query}&quality=low&qualityLock=1`, {
    gotoTimeout: 90_000,
    canvasTimeout: 60_000,
    label: `hoodLineReal · ${expect.getState().currentTestName ?? ""}`,
  });
  await page.waitForTimeout(2500);
  // A short link's notice ("N settings … shown with defaults"), closed as a visitor would.
  const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await notice.count()) {
    await press(page, phone, notice);
    await page.waitForTimeout(800);
  }
  await press(page, phone, page.locator('[data-segment="mode"] button[data-value="install"]'));
  await page.waitForTimeout(2500);
  const lines = await page.evaluate(() =>
    [...document.querySelectorAll("span.whitespace-nowrap.rounded-sm")]
      .filter((label) => Number(getComputedStyle(label).opacity) > 0.5)
      .map((label) => [...label.children].map((child) => (child.textContent ?? "").trim()))
      .filter(([, note]) => note && /最小|店里|店内|min|shop/.test(note))
      .map(([value, note]) => `${value} ${note}`),
  );
  await context.close();
  return { lines, errors };
}

describe("the words beside the line to the hood, as the page shows them (item 12)", () => {
  it("C's own room, desktop, Chinese: no maximum, gas and induction alike", async () => {
    const got = await lineIn("v=3&pkg=C&shape=L&lang=zh", false);
    expect(got.lines).toEqual(['30-1/2" 最小 30，燃气与电磁相同']);
    expect(got.errors).toEqual([]);
  });

  it("B's own room, desktop, English: VCIN36GWS's suggested maximum", async () => {
    const got = await lineIn("v=3&pkg=B&shape=L&lang=en", false);
    expect(got.lines).toEqual(['30" min 30, recommended max 40']);
    expect(got.errors).toEqual([]);
  });

  it("A with AK7136BS-BF, phone, English: Zephyr's 24 and recommended 32, by finger", async () => {
    const got = await lineIn("v=3&pkg=A&shape=L&lang=en&hood=AK7136BS-BF", true);
    expect(got.lines).toEqual(['30" min 24, recommended max 32']);
    expect(got.errors).toEqual([]);
  });

  it("D with the microwave, phone, Chinese: 「店里做法」, no figure", async () => {
    const got = await lineIn("v=3&pkg=D&shape=L&lang=zh&hood=JVM3160RFSS", true);
    expect(got.lines).toEqual(['24" 店里做法']);
    expect(got.errors).toEqual([]);
  });
});
