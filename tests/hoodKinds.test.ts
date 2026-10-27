import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The chimney fillers' round, Leo: "油烟机在嵌入式和别的种类之间来回换，不报错".
 * The hood's canopy used to be made after the insert liner's early return in
 * `Hood` (`src/three/hoodHooks.test.ts`); here the kinds are swapped in the
 * page, the insert liner and each other kind in turn, back and forth, and
 * each swap is taken with no page error and no part fenced off.
 *
 * Green on the code before the fix too: every hood chosen makes the whole 3D
 * room again (`layoutVersion`, `Scene.tsx`), so `Hood` never changed kind
 * while standing. This holds the page as it is; the source check is the one
 * that is red.
 *
 * Package A's L: its own under-cabinet hood; VCIN36GWS the insert, HMCB30WS
 * and HMCB36WS chimneys, PH36HWS under a cabinet, JVM3160RFSS over the range.
 * The mouse on a 1440 desktop, a finger on a 390 phone.
 */

const DEVICES: Record<"desktop" | "phone", BrowserContextOptions> = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
};
type Device = keyof typeof DEVICES;

const INSERT = "thermador-vcin36gws";
const ORDER = [
  INSERT,
  "thermador-hmcb30ws",
  INSERT,
  "thermador-ph36hws",
  INSERT,
  "ge-jvm3160rfss",
  INSERT,
  "thermador-hmcb36ws",
  INSERT,
  "zephyr-ak7136bs-bf",
];

const EXPECTED_TESTS = 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} hood kind tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function press(page: Page, device: Device, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox({ timeout: 5_000 });
  if (!box) throw new Error("nothing to press");
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (device === "desktop") await page.mouse.click(x, y);
  else await page.touchscreen.tap(x, y);
  await page.waitForTimeout(1200);
}

/** The hood's card open, from the default view if another card has flown the camera off its pin. */
async function hoodCard(page: Page, device: Device) {
  if ((await page.locator('[data-model-card="slot-hood"]').count()) > 0) return;
  if ((await page.locator("[data-model-card]").count()) > 0) {
    await press(page, device, page.getByRole("button", { name: "Reset view", exact: true }).filter({ visible: true }).first());
  }
  await press(page, device, page.locator('[data-pin-label="slot-hood"]').first());
}

/** Each hood of ORDER chosen in turn: whether it was taken, and what the page showed after. */
async function swapKinds(device: Device) {
  const context = await browser.newContext(DEVICES[device]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${PREVIEW_URL}?quality=low&qualityLock=1`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2000);
  const steps: string[] = [];
  for (const id of ORDER) {
    await hoodCard(page, device);
    await press(page, device, page.locator(`[data-model-card="slot-hood"] [data-candidate="${id}"]`).first());
    await hoodCard(page, device);
    const taken =
      (await page.locator(`[data-model-card="slot-hood"] [data-candidate="${id}"]`).first().getAttribute("aria-pressed")) === "true";
    const fenced = await page.locator("[data-part-failed]").evaluateAll((els) => els.map((el) => el.getAttribute("data-part-failed")));
    const canvas = (await page.locator("canvas").count()) > 0;
    steps.push(`${id}: ${taken ? "taken" : "NOT TAKEN"}${fenced.length ? `, fenced ${fenced.join(", ")}` : ""}${canvas ? "" : ", no canvas"}`);
  }
  await context.close();
  return { steps, errors };
}

const expected = { steps: ORDER.map((id) => `${id}: taken`), errors: [] };

describe("a hood swapped between the insert liner and every other kind, back and forth, keeps the page", () => {
  it("on a desktop, by the mouse", async () => expect(await swapKinds("desktop")).toEqual(expected));
  it("on a phone, by a finger", async () => expect(await swapKinds("phone")).toEqual(expected));
});
