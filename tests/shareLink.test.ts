import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * A link rebuilds the kitchen it was shared from. Round 94, Leo;
 * docs/decisions.md D23.
 *
 * A kitchen is made with real input (D17) — the mouse on a desktop, a finger
 * on a phone: a package chosen, a model picked on the card, a RAL code typed,
 * a wall slider stepped with the keyboard, the island turned, the language
 * changed. Share is pressed: on a desktop the link is read off the clipboard;
 * on a phone the share sheet is the system's and cannot be driven, so the
 * page's call to it is caught and the link it was handed is read. The link is
 * opened in a fresh browser, and the two pages are compared as the page
 * builds them: the settings (`__kitchen`), the room box by box (`__room`), and
 * every pin label's position, both at the default view.
 *
 * Not the canvas by its pixels: the page shared from has been rebuilt many
 * times and the opened one once, and a rebuild leaves a faint wash over the
 * whole picture (Open items, round 78). The pictures are compared in the
 * round's own before-and-after shots instead.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 5;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} share-link tests actually ran`).toBe(EXPECTED_TESTS);
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
  phone: boolean;
  errors: string[];
}

async function open(phone: boolean, query = "?quality=high&debug=1"): Promise<Session> {
  const context = await browser.newContext(
    phone
      ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: DESKTOP, permissions: ["clipboard-read", "clipboard-write"] },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  // The phone's share sheet is the system's: the call to it is caught, and the
  // link it was handed kept, so the test can open it.
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: string[] };
    w.__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { url: string }) => {
        w.__shared.push(data.url);
      },
    });
  });
  await page.goto(PREVIEW_URL + "/" + query, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);
  return { context, page, phone, errors };
}

async function press(s: Session, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
}

const settle = (s: Session, ms = 2500) => s.page.waitForTimeout(ms);

/** What the page is built from, the room it built, and where every pin label stands. */
const reading = (s: Session) =>
  s.page.evaluate(() => {
    const w = window as unknown as {
      __kitchen: () => unknown;
      __room: () => unknown;
      __pinLayout?: { labels: { slot: string; x: number; y: number; hidden: boolean }[] };
    };
    const round = (value: number) => Math.round(value * 100) / 100;
    return JSON.parse(
      JSON.stringify({
        kitchen: w.__kitchen(),
        room: w.__room(),
        pins: (w.__pinLayout?.labels ?? []).map((label) => ({
          slot: label.slot,
          x: round(label.x),
          y: round(label.y),
          hidden: label.hidden,
        })),
      }),
    );
  });

/** Choose a machine and pick a model on its card, as a customer does. */
async function pickOnCard(s: Session, slot: string, model: string) {
  await press(s, s.page.locator(`[data-pin-label="${slot}"]`).first());
  await settle(s);
  await press(s, s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first());
  await settle(s, 3000);
}

async function resetView(s: Session, label: string) {
  await press(s, s.page.getByRole("button", { name: label }).filter({ visible: true }).first());
  await settle(s);
}

describe("a shared kitchen opens the same", () => {
  it("on a desktop, with the mouse and the keyboard, copied and opened in a fresh browser", async () => {
    const s = await open(false);
    await press(s, s.page.locator(`[data-segment="package"] button`, { hasText: "D" }).first());
    await settle(s);
    await pickOnCard(s, "slot-hood", "thermador-ph36hws");
    await resetView(s, "Reset view");
    // A RAL code typed into the doors' field, and Enter.
    await press(s, s.page.locator(`[data-ral-input="cabinet"]`).first());
    await s.page.keyboard.type("7016");
    await s.page.keyboard.press("Enter");
    // The island turned, and the back wall two steps longer from the keyboard.
    await press(s, s.page.getByRole("button", { name: "Across the room" }).first());
    await settle(s);
    const slider = s.page.locator("label", { hasText: "Back wall" }).first().locator(`input[type="range"]`);
    await slider.focus();
    await s.page.keyboard.press("ArrowRight");
    await s.page.keyboard.press("ArrowRight");
    await settle(s);
    await press(s, s.page.locator("header button", { hasText: "中" }).first());
    await settle(s);

    await press(s, s.page.locator("header [data-share]").first());
    await settle(s, 800);
    const link = await s.page.evaluate(() => navigator.clipboard.readText());
    const shared = await reading(s);

    const o = await open(false, new URL(link).search + "&quality=high&debug=1");
    const opened = await reading(o);
    const notice = await o.page.locator("[data-share-notice]").count();
    expect({
      link: /^http:\/\/localhost:\d+\/\?v=1&pkg=D&lang=zh&/.test(link),
      kitchen: opened.kitchen,
      room: opened.room,
      pins: opened.pins,
      notice,
      errors: [...s.errors, ...o.errors],
    }).toEqual({
      link: true,
      kitchen: shared.kitchen,
      room: shared.room,
      pins: shared.pins,
      notice: 0,
      errors: [],
    });
    await s.context.close();
    await o.context.close();
  });

  it("on a phone, by touch, through the share sheet, and opened on a fresh phone", async () => {
    const s = await open(true);
    await press(s, s.page.locator(`[data-segment="package"] button`, { hasText: "E" }).first());
    await settle(s);
    await pickOnCard(s, "slot-dishwasher", "bosch-shx78cm5n");
    await resetView(s, "Reset view");
    await press(s, s.page.locator("header button", { hasText: "中" }).first());
    await settle(s, 800);
    await press(s, s.page.locator("header [data-share]").first());
    await settle(s, 800);
    const handed = await s.page.evaluate(() => (window as unknown as { __shared: string[] }).__shared);
    const shared = await reading(s);

    const o = await open(true, new URL(handed[0]).search + "&quality=high&debug=1");
    const opened = await reading(o);
    expect({
      handed: handed.length,
      kitchen: opened.kitchen,
      room: opened.room,
      pins: opened.pins,
      errors: [...s.errors, ...o.errors],
    }).toEqual({ handed: 1, kitchen: shared.kitchen, room: shared.room, pins: shared.pins, errors: [] });
    await s.context.close();
    await o.context.close();
  });
});

describe("an older link says what it could not show, in Leo's words", () => {
  it("names the model not in the catalogue and what is shown, in Chinese", async () => {
    const base = await open(false);
    const link = await base.page.evaluate(() => (window as unknown as { __shareUrl: () => string }).__shareUrl());
    await base.context.close();
    const query = new URLSearchParams(new URL(link).search);
    query.set("lang", "zh");
    query.set("hood", "ZZ9999XX");
    const o = await open(false, `?${query.toString()}&quality=high&debug=1`);
    const lines = await o.page.locator("[data-share-notice-line]").allInnerTexts();
    expect(lines).toEqual([
      "除以下几项外，均按链接显示：",
      "油烟机：链接中的 ZZ9999XX 目前不在产品目录中，此处显示 Thermador PH36HWS。",
    ]);
    await o.context.close();
  });

  it("says a link it cannot read could not be read, and shows the default kitchen", async () => {
    const o = await open(false, "?v=1&pkg=Z&quality=high&debug=1");
    const lines = await o.page.locator("[data-share-notice-line]").allInnerTexts();
    const pkg = await o.page.evaluate(() => (window as unknown as { __kitchen: () => { packageId: string } }).__kitchen().packageId);
    expect({ lines, pkg }).toEqual({
      lines: ["This link could not be read; the default kitchen is shown."],
      pkg: "package-a",
    });
    await o.context.close();
  });

  it("stays until it is closed, and closes with the mouse", async () => {
    const o = await open(false, "?v=1&pkg=Z&quality=high&debug=1");
    await o.page.waitForTimeout(5000);
    const after5s = await o.page.locator("[data-share-notice]").count();
    await press(o, o.page.locator("[data-share-notice-close]").first());
    await o.page.waitForTimeout(500);
    const closed = await o.page.locator("[data-share-notice]").count();
    expect({ after5s, closed }).toEqual({ after5s: 1, closed: 0 });
    await o.context.close();
  });
});
