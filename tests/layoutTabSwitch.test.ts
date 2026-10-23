import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 99b. Found in round 100's measurements, on the build that was live
 * (102f05e, and round 99's 5afb98b before it): with the Layout tab open, a
 * package tapped emptied the page. The bill under each wall slider is worked
 * out in idle time (round 99a) — and before that was kept per room setting
 * (round 99) — so for a render or two it is the room before's, while the
 * words for it were looked up in the new package's selection at once: D's
 * oven tower named under A, which has none, throws (`billLabelKey`, round 99)
 * and React takes the page down. 24 of the 40 switches, in the L and on one
 * wall.
 *
 * Each walk taps every package after every other once — a circuit through
 * all twenty ordered pairs, starting from A, where the page opens — in each
 * shape, on a desktop by the mouse and on a tablet and a phone by a finger
 * (D17; Leo, round 99b: the three widths). The phone's Layout is a section
 * of its Configure sheet, which keeps the package buttons above it.
 */

const DEVICES: Record<"desktop" | "tablet" | "phone", BrowserContextOptions> = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
};
type Device = keyof typeof DEVICES;

const EXPECTED_TESTS = 6;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} Layout tab switch tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

/** A to B, B to A, A to C … every ordered pair of the five once. */
const CIRCUIT = ["B", "A", "C", "A", "D", "A", "E", "B", "C", "B", "D", "B", "E", "C", "D", "C", "E", "D", "E", "A"];

async function press(page: Page, device: Device, role: "button" | "tab", name: string) {
  const locator = page.getByRole(role, { name, exact: true }).filter({ visible: true }).first();
  const box = await locator.boundingBox({ timeout: 5_000 }).catch(() => null);
  if (!box) return false;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (device === "desktop") await page.mouse.click(x, y);
  else await page.touchscreen.tap(x, y);
  return true;
}

async function walk(device: Device, shape: "L" | "one-wall") {
  const context = await browser.newContext(DEVICES[device]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // The low tier: what is asked here is the page's words, not its frame rate.
  await page.goto(PREVIEW_URL + "?quality=low", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const opened =
    device === "phone"
      ? (await press(page, device, "button", "Configure")) &&
        (await page.waitForTimeout(800), await press(page, device, "button", "Layout"))
      : await press(page, device, "tab", "Layout");
  if (!opened) {
    await context.close();
    return [`no Layout to open on the ${device}`];
  }
  await page.waitForTimeout(1000);
  if (shape === "one-wall" && !(await press(page, device, "button", "Single-wall kitchen"))) {
    await context.close();
    return [`no one-wall switch on the ${device}`];
  }
  await page.waitForTimeout(1500);
  const fell: string[] = [];
  let from = "A";
  for (const to of CIRCUIT) {
    if (!(await press(page, device, "button", to))) {
      fell.push(`${from}→${to}: no ${to} to tap`);
      break;
    }
    // Past the idle callback's one-second ceiling, so the bill is the new room's.
    await page.waitForTimeout(1300);
    if (errors.length > 0 || (await page.locator("canvas").count()) === 0) {
      fell.push(`${from}→${to}: ${errors.join("; ") || "no canvas"}`);
      break;
    }
    from = to;
  }
  await context.close();
  return fell;
}

describe("with the Layout tab open, every package tapped after every other keeps the page (round 99b)", () => {
  for (const device of Object.keys(DEVICES) as Device[]) {
    it(`on a ${device}, in the L`, async () => {
      expect(await walk(device, "L")).toEqual([]);
    });

    it(`on a ${device}, on one wall`, async () => {
      expect(await walk(device, "one-wall")).toEqual([]);
    });
  }
});
