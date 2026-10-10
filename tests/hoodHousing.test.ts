import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 87, Leo, from package A: its hood changed on the model card to the
 * insert liner VCIN36GWS hung on its own between the wall cabinets, with no
 * housing. An insert hood always comes with its housing (Leo's site practice),
 * and what is over any hood is the chosen hood's to say. Real input throughout
 * — the mouse on a desktop, a finger on a phone (D17). docs/decisions.md D16,
 * round 87.
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
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} hood-housing tests actually ran`).toBe(EXPECTED_TESTS);
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

interface Session {
  page: Page;
  phone: boolean;
  errors: string[];
}

async function open(phone: boolean): Promise<Session> {
  const context = await browser.newContext(
    phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  // Three.js announces each scene to its devtools hook; keep them to look in.
  await page.addInitScript(() => {
    const hook = new EventTarget();
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const detail = (event as CustomEvent).detail as { isScene?: boolean };
      if (!detail.isScene) return;
      const w = window as unknown as { __scenes?: unknown[] };
      w.__scenes = [...(w.__scenes ?? []), detail];
    });
  });
  await page.goto(PREVIEW_URL + "?quality=high", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2000);
  return { page, phone, errors };
}

async function press(s: Session, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
}

const button = (s: Session, name: string) =>
  s.page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

/** How many housings the room draws (`HoodCabinet`, a group named "hood-cabinet"). */
const housings = (s: Session) =>
  s.page.evaluate(() => {
    type Node = { name?: string; children: Node[]; getObjectByName?: (n: string) => Node | undefined };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    let count = 0;
    const walk = (node: Node) => {
      if (node.name === "hood-cabinet") count += 1;
      node.children.forEach(walk);
    };
    // The room's scene: the one holding the cabinets, as rangeSwap.test.ts
    // finds it. (The first draft walked the last scene announced, which is not
    // the room, and counted none in package B as it opens.)
    const layer = scenes.map((scene) => scene.getObjectByName?.("cabinet-layer")).find(Boolean);
    if (layer) walk(layer);
    return count;
  });

/** Whether the housing-shape control is in the configuration (it shows only for an insert). */
const housingControl = (s: Session) =>
  s.page.evaluate(() =>
    [...document.querySelectorAll("span")].some((el) => el.textContent?.trim() === "Hood housing"),
  );

async function pickHood(s: Session, pkg: string, model: string) {
  if (pkg !== "A") {
    await press(s, button(s, pkg));
    await s.page.waitForTimeout(2500);
  }
  await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
  await s.page.waitForTimeout(2500);
  await press(s, s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first());
  await s.page.waitForTimeout(3000);
}

describe("an insert hood comes with its housing (round 87)", () => {
  it("builds the housing when package A's hood is changed to the insert liner on the card, on a desktop", async () => {
    const s = await open(false);
    const before = { housings: await housings(s), control: await housingControl(s) };
    await pickHood(s, "A", "thermador-vcin36gws");
    const after = { housings: await housings(s), control: await housingControl(s) };
    expect({ before, after, errors: s.errors }).toEqual({
      before: { housings: 0, control: false },
      after: { housings: 1, control: true },
      errors: [],
    });
    await s.page.context().close();
  });

  it("builds it by touch on a phone", async () => {
    const s = await open(true);
    await pickHood(s, "A", "thermador-vcin36gws");
    expect(await housings(s)).toBe(1);
    await s.page.context().close();
  });

  it("takes it away again when A's own hood is put back", async () => {
    const s = await open(false);
    await pickHood(s, "A", "thermador-vcin36gws");
    await press(s, s.page.locator('[data-model-card] [data-candidate="thermador-ph36hws"]').first());
    await s.page.waitForTimeout(3000);
    expect({ housings: await housings(s), control: await housingControl(s) }).toEqual({ housings: 0, control: false });
    await s.page.context().close();
  });

  it("takes package B's housing away for an under-cabinet hood", async () => {
    const s = await open(false);
    await press(s, button(s, "B"));
    await s.page.waitForTimeout(2500);
    const before = await housings(s);
    await pickHood(s, "A", "thermador-ph36hws");
    expect({ before, after: await housings(s), control: await housingControl(s) }).toEqual({
      before: 1,
      after: 0,
      control: false,
    });
    await s.page.context().close();
  });

  it("sends a chimney hood's duct through the ceiling in package A, on its spec card", async () => {
    const s = await open(false);
    await pickHood(s, "A", "thermador-hmcb30ws");
    await press(s, s.page.locator("[data-model-card]").getByRole("button", { name: /View specs/ }).first());
    await s.page.waitForTimeout(1200);
    const card = await s.page.locator('[role="dialog"]').filter({ visible: true }).first().innerText();
    expect({ ceiling: card.includes("Up through the ceiling"), cabinet: card.includes("Up through cabinet") }).toEqual({
      ceiling: true,
      cabinet: false,
    });
    await s.page.context().close();
  });
});
