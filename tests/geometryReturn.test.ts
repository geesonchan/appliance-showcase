import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The geometries that climbed with every model swap (round 100 measured 238
 * with the page open, 2,019 after fifty swaps), freed by hand (Leo: 甲,
 * `docs/plans/geometry-leak-plan.md`). His test: change away from a room and
 * back to the same room, and the renderer's count of geometries comes back to
 * the number it was — not one more.
 *
 * The renderer is read as `scripts/swapMemory.mjs` reads it, through three's
 * devtools hook, once the count has held for three readings half a second
 * apart (fiber frees what it frees in idle time, and a new room has to be
 * drawn before it counts). Each reading is taken with the page the same: the
 * same shape and mode, nothing chosen, the camera at its default view — three
 * counts a geometry once it has been drawn, so a room rebuilt while the camera
 * is flown in to one machine counts only what is in view until the view is
 * reset (found while building this round: 239 on opening, 227 after a hood
 * swapped and back with its card open, 239 again on Reset view). And the same
 * history: a machine keeps its selection outline while it stands and it counts
 * from its first drawing, so the machine is chosen and the view reset once
 * before the first reading too (238 with the hood never chosen, 239 once it
 * has been). A swap that did not take is a failure, not a pass. The page is
 * held at its tier (`?qualityLock=1`). The mouse on a 1440 desktop; a finger
 * on a 768 tablet and a 390 phone (Leo).
 *
 * Going back to "the same room" means its walls too: a package needing more
 * wall grows them, so the package cases start from the larger kitchen (B in
 * the L, E on one wall), where the smaller fits without a change.
 */

const DEVICES: Record<"desktop" | "tablet" | "phone", BrowserContextOptions> = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
};
type Device = keyof typeof DEVICES;

const EXPECTED_TESTS = 10;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} geometry tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function open(device: Device) {
  const context = await browser.newContext(DEVICES[device]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const hook = new EventTarget();
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const r = (event as CustomEvent).detail;
      if (r?.isWebGLRenderer) (window as unknown as { __renderer: unknown }).__renderer = r;
    });
  });
  await page.goto(`${PREVIEW_URL}?quality=high&qualityLock=1`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);
  return { context, page, errors };
}

/** The renderer's geometries, once three readings half a second apart agree; null if they never do in ten seconds. */
async function settled(page: Page): Promise<number | null> {
  const read = () =>
    page.evaluate(() => (window as unknown as { __renderer?: { info: { memory: { geometries: number } } } }).__renderer?.info.memory.geometries ?? -1);
  let last = await read();
  let same = 1;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(500);
    const now = await read();
    same = now === last ? same + 1 : 1;
    last = now;
    if (same >= 3) return now;
  }
  return null;
}

async function press(page: Page, device: Device, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox({ timeout: 5_000 });
  if (!box) throw new Error("nothing to press");
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (device === "desktop") await page.mouse.click(x, y);
  else await page.touchscreen.tap(x, y);
  await page.waitForTimeout(1200);
}
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

/** Opens a machine's card, if it is not open already. */
async function cardFor(page: Page, device: Device, slot: string) {
  if ((await page.locator(`[data-model-card="${slot}"]`).count()) > 0) return;
  await press(page, device, page.locator(`[data-pin-label="${slot}"]`).first());
}

/** The model standing in an opening, and another the opening takes. */
async function models(page: Page, slot: string) {
  const own = await page.locator(`[data-model-card="${slot}"] [data-candidate][aria-pressed="true"]`).first().getAttribute("data-candidate");
  const other = await page
    .locator(`[data-model-card="${slot}"] [data-candidate][data-fits="true"][aria-pressed="false"]`)
    .first()
    .getAttribute("data-candidate");
  return { own, other };
}

async function choose(page: Page, device: Device, slot: string, id: string) {
  await cardFor(page, device, slot);
  await press(page, device, page.locator(`[data-model-card="${slot}"] [data-candidate="${id}"]`).first());
  await cardFor(page, device, slot);
  return (await page.locator(`[data-model-card="${slot}"] [data-candidate="${id}"]`).first().getAttribute("aria-pressed")) === "true";
}

/** A machine swapped for another and back, read at the default view with nothing chosen; in the install view when asked. */
async function swapAndBack(device: Device, slot: string, install = false) {
  const { context, page, errors } = await open(device);
  if (install) await press(page, device, button(page, "Install"));
  await cardFor(page, device, slot);
  await press(page, device, button(page, "Reset view"));
  const before = await settled(page);
  await cardFor(page, device, slot);
  const { own, other } = await models(page, slot);
  if (!own || !other) throw new Error(`no model to swap ${slot} for`);
  const away = await choose(page, device, slot, other);
  const back = await choose(page, device, slot, own);
  await press(page, device, button(page, "Reset view"));
  const after = await settled(page);
  await context.close();
  return { before, after, swapped: away && back, errors };
}

/** A package tapped away and back, from the larger kitchen so the walls stay. */
async function packageAndBack(device: Device, shape: "L" | "one-wall", from: string, to: string) {
  const { context, page, errors } = await open(device);
  if (shape === "one-wall") {
    if (device === "phone") {
      await press(page, device, button(page, "Configure"));
      await press(page, device, button(page, "Layout"));
    } else await press(page, device, page.getByRole("tab", { name: "Layout", exact: true }).first());
    await press(page, device, button(page, "Single-wall kitchen"));
    if (device === "phone") await press(page, device, page.getByRole("button", { name: "Close", exact: true }).last());
  }
  await press(page, device, button(page, from));
  const before = await settled(page);
  await press(page, device, button(page, to));
  await press(page, device, button(page, from));
  const after = await settled(page);
  await context.close();
  return { before, after, swapped: true, errors };
}

const returns = (seen: { before: number | null; after: number | null; swapped: boolean; errors: string[] }) =>
  expect(seen).toEqual({ before: seen.before ?? "a steady count", after: seen.before, swapped: true, errors: [] });

describe("change away from a room and back, and the geometries come back to the number they were", () => {
  it("on a desktop: the hood swapped and back", async () => returns(await swapAndBack("desktop", "slot-hood")));
  it("on a desktop: the range swapped and back", async () => returns(await swapAndBack("desktop", "slot-range")));
  it("on a desktop: the dishwasher swapped and back", async () => returns(await swapAndBack("desktop", "slot-dishwasher")));
  it("on a desktop: package B to A and back to B", async () => returns(await packageAndBack("desktop", "L", "B", "A")));
  it("on a desktop, in the install view: the hood swapped and back", async () =>
    returns(await swapAndBack("desktop", "slot-hood", true)));
  it("on a desktop, on one wall: package E to A and back to E", async () =>
    returns(await packageAndBack("desktop", "one-wall", "E", "A")));
  it("on a tablet: the hood swapped and back", async () => returns(await swapAndBack("tablet", "slot-hood")));
  it("on a tablet: package B to A and back to B", async () => returns(await packageAndBack("tablet", "L", "B", "A")));
  it("on a phone: the hood swapped and back", async () => returns(await swapAndBack("phone", "slot-hood")));
  it("on a phone: package B to A and back to B", async () => returns(await packageAndBack("phone", "L", "B", "A")));
});
