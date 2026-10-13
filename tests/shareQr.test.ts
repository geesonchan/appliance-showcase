import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import jsQR from "jsqr";
import qrcode from "qrcode-generator";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The share box on a desktop, with the link as a QR code. Round 95, Leo;
 * docs/decisions.md D23, round 95.
 *
 * Share still copies the link and says "Link copied" (round 94's test holds
 * that unchanged), and now also opens a box: the link, Copy, and the QR code.
 * The code is read back from the canvas the page drew and must give the link
 * character for character; it is drawn at error correction L, 4 CSS pixels a
 * module, each module whole pixels, unsmoothed; and its script is fetched only
 * when the box opens. The mouse throughout (D17).
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 7;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} share-box tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

interface Session {
  context: BrowserContext;
  page: Page;
  scripts: string[];
  errors: string[];
}

async function open(phone = false): Promise<Session> {
  const context = await browser.newContext(
    phone
      ? { viewport: PHONE, isMobile: true, hasTouch: true }
      : { viewport: DESKTOP, permissions: ["clipboard-read", "clipboard-write"] },
  );
  const page = await context.newPage();
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  if (phone) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: async () => {} });
    });
  }
  await page.goto(PREVIEW_URL + "/?quality=high", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2000);
  return { context, page, scripts, errors };
}

async function click(s: Session, selector: string) {
  const box = (await s.page.locator(selector).first().boundingBox())!;
  await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function tap(s: Session, selector: string) {
  const box = (await s.page.locator(selector).first().boundingBox())!;
  await s.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/** Press Share with the mouse and wait for the code to be drawn. */
async function share(s: Session) {
  await click(s, "header [data-share]");
  await s.page.waitForSelector("[data-share-qr][data-modules]", { timeout: 15_000 });
  await s.page.waitForTimeout(300);
}

const clipboard = (s: Session) => s.page.evaluate(() => navigator.clipboard.readText());

/** The pixels the page drew on the code's canvas, and how it is shown. */
const drawn = (s: Session) =>
  s.page.$eval("[data-share-qr]", (element) => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const rect = canvas.getBoundingClientRect();
    return {
      width: canvas.width,
      height: canvas.height,
      pixels: Array.from(pixels),
      cssWidth: rect.width,
      modules: Number(canvas.dataset.modules),
      ratio: window.devicePixelRatio,
      rendering: getComputedStyle(canvas).imageRendering,
    };
  });

describe("the share box on a desktop", () => {
  it("copies the link and says so, as in round 94, and opens the box with that link", async () => {
    const s = await open();
    await share(s);
    const copied = await clipboard(s);
    const shown = await s.page.$eval("[data-share-link]", (input) => (input as HTMLInputElement).value);
    const toast = await s.page.locator('[role="status"]').first().innerText();
    expect({ link: /^http:\/\/localhost:\d+\/\?v=1&pkg=A&/.test(copied), shown, toast, errors: s.errors }).toEqual({
      link: true,
      shown: copied,
      toast: "Link copied",
      errors: [],
    });
    await s.context.close();
  });

  it("draws the link as a QR code that reads back to the link, character for character", async () => {
    const s = await open();
    await share(s);
    const link = await clipboard(s);
    const canvas = await drawn(s);
    const read = jsQR(new Uint8ClampedArray(canvas.pixels), canvas.width, canvas.height);
    expect(read?.data).toBe(link);
    await s.context.close();
  });

  it("draws it at error correction L, 4 CSS pixels a module, whole pixels, unsmoothed", async () => {
    const s = await open();
    await share(s);
    const link = await clipboard(s);
    const canvas = await drawn(s);
    // The modules error correction L gives this link, worked out here.
    const expected = qrcode(0, "L");
    expected.addData(link, "Byte");
    expected.make();
    const greys = new Set<number>();
    for (let i = 0; i < canvas.pixels.length; i += 4) {
      const value = canvas.pixels[i];
      if (value !== 0 && value !== 255) greys.add(value);
    }
    const cell = Math.round(4 * canvas.ratio);
    expect({
      modules: canvas.modules,
      cssWidth: Math.round(canvas.cssWidth * 100) / 100,
      backing: canvas.width,
      greys: greys.size,
      rendering: canvas.rendering,
    }).toEqual({
      modules: expected.getModuleCount(),
      cssWidth: ((expected.getModuleCount() + 8) * cell) / canvas.ratio,
      backing: (expected.getModuleCount() + 8) * cell,
      greys: 0,
      rendering: "pixelated",
    });
    await s.context.close();
  });

  it("fetches the QR code's script only when the box opens", async () => {
    const s = await open();
    const before = s.scripts.filter((path) => /shareQr/.test(path)).length;
    await share(s);
    const after = s.scripts.filter((path) => /shareQr/.test(path)).length;
    expect({ before, after }).toEqual({ before: 0, after: 1 });
    await s.context.close();
  });

  it("copies the link again from the box's own Copy", async () => {
    const s = await open();
    await share(s);
    const link = await clipboard(s);
    await s.page.evaluate(() => navigator.clipboard.writeText("emptied"));
    await click(s, "[data-share-copy]");
    await s.page.waitForTimeout(300);
    expect(await clipboard(s)).toBe(link);
    await s.context.close();
  });

  it("closes with its ×, with Escape, and with a press outside it", async () => {
    const s = await open();
    await share(s);
    await click(s, "[data-share-box-close]");
    const byCross = await s.page.locator("[data-share-box]").count();
    await share(s);
    await s.page.keyboard.press("Escape");
    const byEscape = await s.page.locator("[data-share-box]").count();
    await share(s);
    await s.page.mouse.click(700, 500);
    await s.page.waitForTimeout(300);
    const byOutside = await s.page.locator("[data-share-box]").count();
    expect({ byCross, byEscape, byOutside }).toEqual({ byCross: 0, byEscape: 0, byOutside: 0 });
    await s.context.close();
  });
});

describe("on a phone", () => {
  it("opens no box: the share sheet is the phone's (round 94)", async () => {
    const s = await open(true);
    await tap(s, "header [data-share]");
    await s.page.waitForTimeout(800);
    expect({
      box: await s.page.locator("[data-share-box]").count(),
      fetched: s.scripts.filter((path) => /shareQr/.test(path)).length,
    }).toEqual({ box: 0, fetched: 0 });
    await s.context.close();
  });
});
