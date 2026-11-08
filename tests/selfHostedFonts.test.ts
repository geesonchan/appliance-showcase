import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type BrowserContext, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { report } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * The fonts round, 2026-11-06 (Leo: 「字体自带：字体文件放进网站自己的文件里、
 * 不再请求 Google，设成字体没到先用系统字显示」): the page draws whatever Google is
 * doing, and asks Google nothing.
 *
 * Until this round `index.html` asked Google for its stylesheet in `<head>`,
 * before the site's own script. With Google's two hosts held open — the
 * request sent and never answered, as a blocked network can do — the page
 * drew nothing in 90 s, twice (docs/plans/fonts-plan.md, section 4). Here
 * the two hosts are held open the same way, at the HTTP level: every request
 * to them is taken and never answered. The page must draw its canvas within
 * 10 s, make no request to either host, and load Inter and Cormorant
 * Garamond from the site's own files. Then a real click with the mouse on a
 * desktop, a real tap with a finger on a phone, on the 中 button: the page
 * goes on in Chinese and still asks Google nothing.
 *
 * Cormorant is not drawn on a phone (the title is hidden below 430px), so on
 * the phone it is asked for with `document.fonts.load`, and must come from
 * the site the same.
 */

const GOOGLE = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const DRAW_WITHIN = 10_000;

const EXPECTED_TESTS = 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} self-hosted font tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

interface Opened {
  context: BrowserContext;
  page: Page;
  /** Every request to one of Google's two font hosts, as its URL. */
  google: string[];
  /** Milliseconds from navigation start to a canvas with a size, or null. */
  drawnAt: number | null;
}

async function open(options: Parameters<Browser["newContext"]>[0], label: string): Promise<Opened> {
  const context = await browser.newContext(options);
  const google: string[] = [];
  // Held open: taken, never answered, never failed.
  await context.route((url) => GOOGLE.has(url.hostname), (route) => {
    google.push(route.request().url());
  });
  const page = await context.newPage();
  page.on("request", (request) => {
    if (GOOGLE.has(new URL(request.url()).hostname) && !google.includes(request.url())) google.push(request.url());
  });
  await page.goto(`${PREVIEW_URL}?quality=high`, { waitUntil: "commit", timeout: 30_000 });
  const drawnAt = await page
    .waitForFunction(
      () => {
        const canvas = document.querySelector("canvas");
        return canvas && canvas.width > 0 && canvas.height > 0 ? performance.now() : false;
      },
      null,
      { timeout: DRAW_WITHIN, polling: 50 },
    )
    .then((handle) => handle.jsonValue() as Promise<number>)
    .catch(async (error: Error) => {
      await report(page, "canvas", error, label).catch(() => {});
      return null;
    });
  return { context, page, google, drawnAt };
}

/** The faces of a family that have loaded, and every font file the page fetched, with its origin. */
const fonts = (page: Page) =>
  page.evaluate(() => ({
    loaded: [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => `${face.family.replace(/["']/g, "")} ${face.weight}`),
    files: performance
      .getEntriesByType("resource")
      .filter((entry) => /\.woff2(\?|$)/.test(entry.name))
      .map((entry) => new URL(entry.name).origin),
    origin: location.origin,
  }));

const waitForFaces = (page: Page, families: string[]) =>
  page.waitForFunction(
    (wanted) => wanted.every((family) => [...document.fonts].some((face) => face.family.replace(/["']/g, "") === family && face.status === "loaded")),
    families,
    { timeout: 15_000, polling: 100 },
  );

/** The page is in Chinese: the help button is named 帮助 ("Help" in English). The 中 button itself is there in both. */
const chinese = (page: Page) => page.evaluate(() => document.querySelector('header button[aria-label="帮助"]') !== null);

describe("the fonts are the site's own: Google held open (2026-11-06)", () => {
  it("a desktop draws within 10 s, loads both fonts from the site, and a mouse click on 中 asks Google nothing", async () => {
    const label = `selfHostedFonts · ${expect.getState().currentTestName ?? ""}`;
    const { context, page, google, drawnAt } = await open({ viewport: { width: 1440, height: 900 } }, label);
    try {
      expect(drawnAt, `the canvas within ${DRAW_WITHIN / 1000} s with Google held open (requests to Google: ${google.length})`).not.toBeNull();
      await waitForFaces(page, ["Inter", "Cormorant Garamond"]);
      const before = await fonts(page);
      expect(before.loaded).toEqual(expect.arrayContaining(["Inter 400", "Inter 500", "Cormorant Garamond 400"]));
      expect(before.files.length, "font files fetched").toBeGreaterThan(0);
      expect(before.files.every((origin) => origin === before.origin), JSON.stringify(before.files)).toBe(true);

      expect(await chinese(page), "in English before the 中 button").toBe(false);
      const zh = page.locator("header button", { hasText: "中" }).first();
      const box = (await zh.boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => document.querySelector('header button[aria-label="帮助"]') !== null, null, { timeout: 5_000 });
      await page.waitForTimeout(500);
      expect(await chinese(page)).toBe(true);
      expect(google, "requests to Google").toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("a phone draws within 10 s, its fonts come from the site, and a tap on 中 asks Google nothing", async () => {
    const label = `selfHostedFonts · ${expect.getState().currentTestName ?? ""}`;
    const { context, page, google, drawnAt } = await open(
      { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
      label,
    );
    try {
      expect(drawnAt, `the canvas within ${DRAW_WITHIN / 1000} s with Google held open (requests to Google: ${google.length})`).not.toBeNull();
      await waitForFaces(page, ["Inter"]);
      // Not drawn on a phone; asked for, it must come from the site.
      await page.evaluate(() => document.fonts.load("400 16px 'Cormorant Garamond'", "Kitchen"));
      await waitForFaces(page, ["Inter", "Cormorant Garamond"]);
      const before = await fonts(page);
      expect(before.loaded).toEqual(expect.arrayContaining(["Inter 400", "Cormorant Garamond 400"]));
      expect(before.files.every((origin) => origin === before.origin), JSON.stringify(before.files)).toBe(true);

      expect(await chinese(page), "in English before the 中 button").toBe(false);
      const zh = page.locator("header button", { hasText: "中" }).first();
      const box = (await zh.boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => document.querySelector('header button[aria-label="帮助"]') !== null, null, { timeout: 5_000 });
      await page.waitForTimeout(500);
      expect(await chinese(page)).toBe(true);
      expect(google, "requests to Google").toEqual([]);
    } finally {
      await context.close();
    }
  });
});
