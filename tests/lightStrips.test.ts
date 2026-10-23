import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 99a (Leo: "一字型和 L 型互切后吊柜下的灯带位置不更新…因为是切形状带来的"):
 * the under-cabinet strips, one along each run, were placed when the lights
 * last rendered, and the lights did not render again when the room was
 * rebuilt — so after switching to one wall at night the L's left strip stayed
 * lit over a wall with no run on it, until day/night or the mode changed.
 * Real input: the mouse on a desktop (D17).
 */

const EXPECTED_TESTS = 1;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} light-strip tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function open(): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
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
  return { page, errors };
}

async function click(page: Page, name: string, role: "button" | "tab" = "button") {
  const locator = page.getByRole(role, { name, exact: true }).filter({ visible: true }).first();
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(2500);
}

/** The under-cabinet strips that are lit, each at its position in inches, from the scene. */
const litStrips = (page: Page) =>
  page.evaluate(() => {
    type Node = {
      children: Node[];
      isPointLight?: boolean;
      intensity?: number;
      color?: { getHexString(): string };
      getWorldPosition?: (v: { x: number; y: number; z: number }) => { x: number; y: number; z: number };
      position: { x: number; y: number; z: number; clone(): { x: number; y: number; z: number } };
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const found: number[][] = [];
    const walk = (node: Node) => {
      if (node.isPointLight && node.color?.getHexString() === "ffc98a" && (node.intensity ?? 0) > 0) {
        const p = node.getWorldPosition!(node.position.clone());
        found.push([p.x, p.z].map((v) => Math.round(v * 12 * 100) / 100));
      }
      node.children.forEach(walk);
    };
    scenes.forEach(walk);
    return found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  });

describe("the under-cabinet strips follow the room's runs (round 99a)", () => {
  it("light the one wall's run alone at night, and both of the L's again on the way back", async () => {
    const { page, errors } = await open();
    await click(page, "Night");
    const lBefore = await litStrips(page);
    await click(page, "Layout", "tab");
    await click(page, "Single-wall kitchen");
    const oneWall = await litStrips(page);
    await click(page, "L-shaped kitchen");
    const lAfter = await litStrips(page);
    expect({ lBefore: lBefore.length, oneWall: oneWall.length, sameLAgain: JSON.stringify(lAfter) === JSON.stringify(lBefore), errors }).toEqual({
      lBefore: 2,
      oneWall: 1,
      sameLAgain: true,
      errors: [],
    });
    await page.context().close();
  });
});
