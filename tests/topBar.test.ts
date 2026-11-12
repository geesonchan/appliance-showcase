import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * Round 94, Leo: the phone's top bar holds everything on it without one
 * control drawn over another — at 360, 375, 390 and 414px, in English and in
 * Chinese — and has a place for the share button. Until round 94 the bar's
 * right-hand group drew over the package buttons (docs/decisions.md, Open
 * items, "the MT chip sits over the E package button"; D23).
 *
 * What is measured: every control in the bar — each package button, the "MT"
 * chip, Quote, Share, the two language buttons, Help, Fullscreen — by its box
 * on screen. Two boxes that share any area are an overlap, and a box past
 * either edge of the screen is out. The language is chosen with a tap, as a
 * customer would.
 */

const WIDTHS = [360, 375, 390, 414] as const;
const LANGS = ["en", "zh"] as const;
/**
 * U-2, A (Leo, 2026-11-11: 「形状开关放到主界面……我的倾向是顶栏、紧挨套餐按钮；手机顶栏
 * 放不下就放第二行」): the shape buttons beside the packages from 1024px, the bar
 * still 56px high; below it on a row of their own, the bar 96px. Measured in
 * docs/plans/u2-2026-11-11/topBarMeasure.mjs.
 */
const DESKTOP_WIDTHS = [1024, 1280, 1440] as const;

const EXPECTED_TESTS = WIDTHS.length * LANGS.length + 2 + DESKTOP_WIDTHS.length * LANGS.length;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} top-bar tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({
    args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
});
afterAll(async () => {
  await browser?.close();
});

async function openPhone(width: number, lang: "en" | "zh"): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await openWatched(page, `${PREVIEW_URL}?quality=high`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `topBar · ${expect.getState().currentTestName ?? ""}` });
  await page.waitForTimeout(800);
  if (lang === "zh") {
    const zh = page.locator("header button", { hasText: "中" }).first();
    const box = (await zh.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
  }
  return page;
}

interface Box {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Every control drawn in the top bar, by its box. */
const controls = (page: Page): Promise<Box[]> =>
  page.$$eval("header button, header [data-mt-chip], header span", (elements) =>
    elements
      .filter((e) => {
        // A span counts only when it is a control of its own: the MT chip.
        if (e.tagName === "SPAN") return e.textContent?.trim() === "MT" || e.hasAttribute("data-mt-chip");
        return true;
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        const style = getComputedStyle(e);
        return {
          name:
            e.getAttribute("aria-label") ||
            e.getAttribute("title") ||
            (e.textContent ?? "").trim() ||
            e.tagName,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          shown: style.display !== "none" && style.visibility !== "hidden" && r.width > 0 && r.height > 0,
        };
      })
      .filter((b) => b.shown)
      .map(({ name, x, y, w, h }) => ({ name, x, y, w, h })),
  );

/** Which row the shape buttons are on, how many, and the bar's height (U-2). */
const shapeRow = (page: Page) =>
  page.evaluate(() => {
    const row = [...document.querySelectorAll("header [data-shape-row]")].find((e) => getComputedStyle(e).display !== "none");
    return {
      row: row?.getAttribute("data-shape-row") ?? null,
      buttons: row?.querySelectorAll("[data-segment=shape] button").length ?? 0,
      header: Math.round(document.querySelector("header")!.getBoundingClientRect().height),
    };
  });

/** Pairs of controls that share any area, to a hundredth of a pixel. */
function overlaps(boxes: Box[]): string[] {
  const found: string[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const across = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (across > 0.01 && down > 0.01) {
        found.push(
          `"${a.name}" (${a.x.toFixed(1)}–${(a.x + a.w).toFixed(1)}) over "${b.name}" (${b.x.toFixed(1)}–${(b.x + b.w).toFixed(1)}) by ${across.toFixed(1)}px`,
        );
      }
    }
  }
  return found;
}

describe("the phone's top bar", () => {
  for (const lang of LANGS) {
    for (const width of WIDTHS) {
      it(`at ${width}px in ${lang === "en" ? "English" : "Chinese"} draws no control over another, and none off the screen`, async () => {
        const page = await openPhone(width, lang);
        const boxes = await controls(page);
        const shapes = await shapeRow(page);
        const off = boxes
          .filter((b) => b.x < -0.01 || b.x + b.w > width + 0.01)
          .map((b) => `"${b.name}" (${b.x.toFixed(1)}–${(b.x + b.w).toFixed(1)})`);
        await page.context().close();
        const found = [...overlaps(boxes), ...off.map((name) => `${name} off the screen`)];
        // The pairs are in the message, so each red case says which two
        // controls and by how much (vitest folds failures with one message).
        expect(found, `${width}px ${lang}, ${boxes.length} controls: ${found.join("; ")}`).toEqual([]);
        // The shapes on the second row, under the bar (U-2).
        expect(shapes).toEqual({ row: "second", buttons: 3, header: 96 });
        // An empty set passes anything (D22, round 72): the bar has at least
        // the five packages, the three shapes, Quote, two languages and Help.
        expect(boxes.length).toBeGreaterThanOrEqual(12);
      });
    }
  }

  for (const lang of LANGS) {
    for (const width of DESKTOP_WIDTHS) {
      it(`at ${width}px in ${lang === "en" ? "English" : "Chinese"} has the shapes beside the packages, the bar 56px, nothing over anything`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        await openWatched(page, `${PREVIEW_URL}?quality=high&lang=${lang}`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `topBar · ${expect.getState().currentTestName ?? ""}` });
        await page.waitForTimeout(800);
        const boxes = await controls(page);
        const shapes = await shapeRow(page);
        const off = boxes.filter((b) => b.x < -0.01 || b.x + b.w > width + 0.01).map((b) => `"${b.name}" off the screen`);
        await context.close();
        const found = [...overlaps(boxes), ...off];
        expect({ found, shapes }).toEqual({ found: [], shapes: { row: "first", buttons: 3, header: 56 } });
      });
    }
  }

  it("has a share button on a phone", async () => {
    const page = await openPhone(360, "zh");
    const share = await page.locator("header [data-share]").count();
    await page.context().close();
    expect(share).toBe(1);
  });

  it("has a share button on a desktop", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await openWatched(page, `${PREVIEW_URL}?quality=high`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `topBar · ${expect.getState().currentTestName ?? ""}` });
    const share = await page.locator("header [data-share]").count();
    await context.close();
    expect(share).toBe(1);
  });
});
