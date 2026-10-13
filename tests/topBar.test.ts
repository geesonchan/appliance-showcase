import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

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

const EXPECTED_TESTS = WIDTHS.length * LANGS.length + 2;
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
  browser = await chromium.launch({
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
  await page.goto(`${PREVIEW_URL}?quality=high`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
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
        const off = boxes
          .filter((b) => b.x < -0.01 || b.x + b.w > width + 0.01)
          .map((b) => `"${b.name}" (${b.x.toFixed(1)}–${(b.x + b.w).toFixed(1)})`);
        await page.context().close();
        const found = [...overlaps(boxes), ...off.map((name) => `${name} off the screen`)];
        // The pairs are in the message, so each red case says which two
        // controls and by how much (vitest folds failures with one message).
        expect(found, `${width}px ${lang}, ${boxes.length} controls: ${found.join("; ")}`).toEqual([]);
        // An empty set passes anything (D22, round 72): the bar has at least
        // the five packages, Quote, two languages and Help.
        expect(boxes.length).toBeGreaterThanOrEqual(9);
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
    await page.goto(`${PREVIEW_URL}?quality=high`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForSelector("canvas", { timeout: 60_000 });
    const share = await page.locator("header [data-share]").count();
    await context.close();
    expect(share).toBe(1);
  });
});
