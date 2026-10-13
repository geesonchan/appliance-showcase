import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The right panel in four tabs. Round 91, Leo (round 80's plan, section 2 and
 * decision 4; round 91's decisions): Look, Layout, Install, List; Look by
 * default; Install mode brings the Install tab forward and leaving it puts back
 * the tab before, unless one was chosen meanwhile; the dimension lines' switch
 * on Install; the checklist folded by machine, only the selected one open; the
 * tab kept for the browser tab and not for the next one. The mouse on a
 * desktop (D17). docs/decisions.md D12, round 91.
 */

const DESKTOP = { width: 1440, height: 900 };

const EXPECTED_TESTS = 9;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} right-tab tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function open(context?: BrowserContext): Promise<Page> {
  const page = await (context ?? (await browser.newContext({ viewport: DESKTOP }))).newPage();
  await page.goto(`${PREVIEW_URL}?quality=high`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  return page;
}

async function click(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(600);
}

const showing = (page: Page) => page.getAttribute("[data-right-panel]", "data-right-panel");
const mode = (page: Page, value: string) => click(page, `[data-segment="mode"] button[data-value="${value}"]`);

describe("the right panel's tabs", () => {
  it("opens on Look, with the finishes and no wall slider", async () => {
    const page = await open();
    const found = {
      tab: await showing(page),
      ral: await page.locator('[data-ral-input="cabinet"]').count(),
      sliders: await page.locator('[data-right-panel] input[type="range"]').count(),
    };
    await page.context().close();
    expect(found).toEqual({ tab: "look", ral: 1, sliders: 0 });
  });

  it("shows the layout and the room's sliders on Layout, and no finishes", async () => {
    const page = await open();
    await click(page, '[data-right-tab="layout"]');
    const found = {
      tab: await showing(page),
      backWall: await page.locator("[data-right-panel] label", { hasText: "Back wall" }).count(),
      ral: await page.locator('[data-ral-input="cabinet"]').count(),
    };
    await page.context().close();
    expect(found).toEqual({ tab: "layout", backWall: 1, ral: 0 });
  });

  it("goes to Install when Install mode starts, and back to the tab before when it ends", async () => {
    const page = await open();
    await click(page, '[data-right-tab="layout"]');
    await mode(page, "install");
    const during = await showing(page);
    await mode(page, "white");
    const after = await showing(page);
    await page.context().close();
    expect({ during, after }).toEqual({ during: "install", after: "layout" });
  });

  it("stays on a tab chosen while in Install mode", async () => {
    const page = await open();
    await click(page, '[data-right-tab="layout"]');
    await mode(page, "install");
    await click(page, '[data-right-tab="list"]');
    await mode(page, "realistic");
    const after = await showing(page);
    await page.context().close();
    expect(after).toBe("list");
  });

  it("has the dimension lines' switch on Install, where they are drawn", async () => {
    const page = await open();
    await click(page, '[data-right-tab="install"]');
    const onInstall = await page.locator('[data-right-panel] [role="switch"]', { hasText: "Dimension lines" }).count();
    await click(page, '[data-right-tab="layout"]');
    const onLayout = await page.locator('[data-right-panel] [role="switch"]', { hasText: "Dimension lines" }).count();
    await page.context().close();
    expect({ onInstall, onLayout }).toEqual({ onInstall: 1, onLayout: 0 });
  });

  it("folds every machine in the checklist when none is selected", async () => {
    const page = await open();
    await click(page, '[data-right-tab="list"]');
    const groups = await page.$$eval("[data-checklist-group] > button", (buttons) =>
      buttons.map((b) => b.getAttribute("aria-expanded")),
    );
    await page.context().close();
    expect({ groups: groups.length > 0, open: groups.filter((g) => g === "true").length }).toEqual({ groups: true, open: 0 });
  });

  it("opens only the selected machine in the checklist", async () => {
    const page = await open();
    await click(page, '[data-pin-label="slot-hood"]');
    await page.waitForTimeout(2000);
    await click(page, '[data-right-tab="list"]');
    const opened = await page.$$eval("[data-checklist-group]", (groups) =>
      groups.filter((g) => g.querySelector("button")?.getAttribute("aria-expanded") === "true").map((g) => g.getAttribute("data-checklist-group")),
    );
    await page.context().close();
    expect(opened).toEqual(["slot-hood"]);
  });

  it("has no fold over the whole checklist, only one per machine", async () => {
    const page = await open();
    await click(page, '[data-right-tab="list"]');
    const folds = await page.$$eval('[data-right-panel] button[aria-expanded]', (buttons) =>
      buttons.filter((b) => !b.closest("[data-checklist-group]")).length,
    );
    await page.context().close();
    expect(folds).toBe(0);
  });

  it("keeps a chosen tab for the browser tab, and a fresh one opens on Look", async () => {
    const context = await browser.newContext({ viewport: DESKTOP });
    const page = await open(context);
    await click(page, '[data-right-tab="list"]');
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("canvas", { timeout: 60_000 });
    const reloaded = await showing(page);
    await context.close();
    const fresh = await open();
    const another = await showing(fresh);
    await fresh.context().close();
    expect({ reloaded, another }).toEqual({ reloaded: "list", another: "look" });
  });
});
