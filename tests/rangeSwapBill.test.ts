import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 99a, Leo, from the live site: A on one wall with its 36" range swapped
 * for a 30" one, and "墙长下面仍写 36" RO36". Two faults behind the one line:
 * on one wall the room was never built round the range chosen (`shapeOfChoice`,
 * packages.ts), and in either shape the figures under the back-wall slider
 * were worked out once per room setting — a model swapped rebuilds the room
 * without changing a setting, so they stayed the old range's. Real input: the
 * mouse on a desktop (D17).
 */

const EXPECTED_TESTS = 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} range-swap bill tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function press(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(2500);
}

/** The figures under the back-wall slider, as the Layout tab prints them, with each one's hover. */
const backWallBill = (page: Page) =>
  page.evaluate(() => {
    const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent?.trim() === "Back wall");
    let box = label as HTMLElement | null | undefined;
    while (box && !box.querySelector("span[title]")) box = box.parentElement;
    return [...(box?.querySelectorAll("span[title]") ?? [])].map((span) => `${span.textContent?.replace(/^\s*\+\s*/, "").trim()} (${span.getAttribute("title")})`);
  });

async function swapToThirty(shape: "L" | "one-wall") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(PREVIEW_URL + "?quality=high", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2000);
  await press(page, page.getByRole("tab", { name: "Layout", exact: true }).first());
  if (shape === "one-wall") await press(page, page.getByRole("button", { name: "Single-wall kitchen", exact: true }).first());
  await press(page, page.locator('[data-pin-label="slot-range"]').first());
  await press(page, page.locator('[data-model-card] [data-candidate="thermador-prg304wh"]').first());
  await page.waitForTimeout(1000);
  const bill = (await backWallBill(page)).filter((line) => /\(range\)/.test(line));
  await context.close();
  return { bill, errors };
}

describe("a 30-inch range swapped into A's 36-inch opening shows on the back wall's bill (round 99a)", () => {
  it("in the L", async () => {
    expect(await swapToThirty("L")).toEqual({ bill: ['36" BF3 + RO30 + BF3 (range)'], errors: [] });
  });

  it("on one wall", async () => {
    expect(await swapToThirty("one-wall")).toEqual({ bill: ['36" BF3 + RO30 + BF3 (range)'], errors: [] });
  });
});
