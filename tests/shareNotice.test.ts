import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { writeLink } from "../src/store/shareLink";
import { kitchenNow } from "../src/store/openLink";
import { resetRoom } from "../src/data/testRoom";
import en from "../src/i18n/en.json";

/**
 * Round 99d, Leo: a link notice of more than three lines is one sentence with
 * Details, which opens the list and becomes Hide details, which closes it
 * again; Close stays. Three lines or fewer are listed as before. Every line
 * counts — a setting left out, a model not in the catalogue, one that does
 * not fit, a setting that cannot be used. Round 99c's preview had a link cut
 * to its version and package list some thirty lines over the whole scene.
 */

resetRoom();
const whole = new URLSearchParams(writeLink(kitchenNow()));
const words = en as Record<string, string>;

/** A's own link with these fields left out. */
function without(...names: string[]) {
  const query = new URLSearchParams(whole);
  for (const name of names) query.delete(name);
  return `?${query.toString()}`;
}

const EXPECTED_TESTS = 6;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} notice tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

const lines = (page: Page) => page.locator("[data-share-notice-line]").allInnerTexts();
const buttons = (page: Page) =>
  page.locator("[data-share-notice] button").evaluateAll((all) => all.map((b) => b.getAttribute("aria-label") || b.textContent?.trim()));

async function press(page: Page, name: string) {
  const box = await page.getByRole("button", { name, exact: true }).first().boundingBox();
  if (!box) throw new Error(`no button "${name}"`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
}

async function open(query: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${PREVIEW_URL}${query}&quality=low`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);
  return { context, page, errors };
}

describe("a long link notice is one sentence with Details (round 99d)", () => {
  it("cut to its version and package: one sentence counting every line, Details to open them all, Hide details to close", async () => {
    const { context, page, errors } = await open("?v=2&pkg=A");
    const shut = await lines(page);
    const shutButtons = await buttons(page);
    await press(page, "Details");
    const opened = await lines(page);
    const openButtons = await buttons(page);
    await press(page, "Hide details");
    const shutAgain = await lines(page);
    await context.close();
    const count = opened.length - 1; // the list, under "Everything is as in the link, except:"
    expect({
      shut,
      shutButtons,
      opened: { first: opened[0], count: count > 3 },
      openButtons,
      shutAgain,
      errors,
    }).toEqual({
      shut: [(words["share.notice.incomplete"] ?? "(no sentence)").replace("{count}", String(count))],
      shutButtons: ["Details", "Close"],
      opened: { first: words["share.notice.except"], count: true },
      openButtons: ["Hide details", "Close"],
      shutAgain: shut,
      errors: [],
    });
  });

  it("three lines are listed as before, with no Details", async () => {
    const { context, page, errors } = await open(without("cabinet", "accent", "counter"));
    const seen = await lines(page);
    const seenButtons = await buttons(page);
    await context.close();
    expect({ count: seen.length, first: seen[0], buttons: seenButtons, errors }).toEqual({
      count: 4,
      first: words["share.notice.except"],
      buttons: ["Close"],
      errors: [],
    });
  });

  it("four lines are one sentence", async () => {
    const { context, page, errors } = await open(without("cabinet", "accent", "counter", "floor"));
    const seen = await lines(page);
    await context.close();
    expect({ seen, errors }).toEqual({
      seen: [(words["share.notice.incomplete"] ?? "(no sentence)").replace("{count}", "4")],
      errors: [],
    });
  });
});

/**
 * Round 99d, after Leo's look at the preview: opened, a link cut to its
 * version and package listed 31 lines in a box taller than the screen, and
 * Hide details and Close went off it. Opened, the box is at most six tenths
 * of the screen's height, its lines scroll on their own, and the two buttons
 * stand at its top, on screen and pressable, at every width. And a setting
 * the link does not have at all says so: "Not in the link; showing X."
 */
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
} as const;

/** Where a button is, whether it lies on the screen, and whether a press at its middle reaches it. */
const reach = (page: Page, name: string) =>
  page.evaluate((label) => {
    const button = [...document.querySelectorAll<HTMLElement>("[data-share-notice] button")].find(
      (b) => (b.getAttribute("aria-label") || b.textContent?.trim()) === label,
    );
    if (!button) return { there: false, onScreen: false, reached: false };
    const r = button.getBoundingClientRect();
    const onScreen = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.width > 0;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { there: true, onScreen, reached: !!hit && (hit === button || button.contains(hit)) };
  }, name);

describe("a long link notice, opened, keeps its buttons on the screen (round 99d)", () => {
  for (const [device, options] of Object.entries(DEVICES)) {
    it(`on a ${device}: Hide details and Close on screen and pressable, Hide details closes it`, async () => {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${PREVIEW_URL}?v=2&pkg=A&quality=low`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForTimeout(2500);
      const tap = async (name: string) => {
        const box = await page.getByRole("button", { name, exact: true }).first().boundingBox();
        if (!box) throw new Error(`no button "${name}" on the ${device}`);
        const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
        if (device === "desktop") await page.mouse.click(x, y);
        else await page.touchscreen.tap(x, y);
        await page.waitForTimeout(500);
      };
      await tap("Details");
      const opened = await lines(page);
      const hide = await reach(page, "Hide details");
      const close = await reach(page, "Close");
      const box = await page.locator("[data-share-notice]").first().boundingBox();
      const height = options.viewport.height;
      await tap("Hide details");
      const shut = await lines(page);
      await context.close();
      const missing = (words["share.notice.missing"] ?? "(no sentence)")
        .replace("{item}", words["finish.wall"])
        .replace("{to}", words["finish.wall.warmGrey"]);
      expect({
        hide,
        close,
        boxWithinSixTenths: !!box && box.height <= height * 0.6 + 1,
        saysWallMissing: opened.includes(missing),
        shut: shut.length,
        errors,
      }).toEqual({
        hide: { there: true, onScreen: true, reached: true },
        close: { there: true, onScreen: true, reached: true },
        boxWithinSixTenths: true,
        saysWallMissing: true,
        shut: 1,
        errors: [],
      });
    });
  }
});
