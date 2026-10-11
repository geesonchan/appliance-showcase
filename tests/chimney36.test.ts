import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The 36" chimney hood HMCB36WS, picked on the model card in A's, B's and D's
 * 36" hood openings (round 90). Picked after the 30" HMCB30WS, so the same page
 * shows the 30" saying it is narrower than the cooking surface and printing 3"
 * each side, and then the 36" saying neither, with nothing drawn beside it.
 * Real input — the mouse on a desktop, a finger on a phone (D17).
 * docs/decisions.md D16, round 90.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 3;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} 36-inch chimney hood tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
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

/** How many visible meshes the hood draws beside itself (`Filler`, "appliance-filler-slot-hood"). */
const strips = (s: Session) =>
  s.page.evaluate(() => {
    type Node = { visible: boolean; isMesh?: boolean; children: Node[]; getObjectByName?: (n: string) => Node | undefined };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const filler = scenes.map((scene) => scene.getObjectByName?.("appliance-filler-slot-hood")).find(Boolean);
    let count = 0;
    const walk = (node: Node) => {
      if (!node.visible) return;
      if (node.isMesh) count += 1;
      node.children.forEach(walk);
    };
    if (filler) walk(filler);
    return count;
  });

/** What the card says about the hood chosen: the narrower line, and the chosen chip's filler note. */
async function card(s: Session, model: string) {
  const chip = s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first();
  return {
    pressed: await chip.getAttribute("aria-pressed"),
    narrower: await s.page.locator("[data-card-narrow]").count(),
    fillerNote: /filler each side/.test(await chip.innerText()),
  };
}

async function pick(s: Session, model: string) {
  await press(s, s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first());
  await s.page.waitForTimeout(3000);
}

describe("the 36-inch chimney hood HMCB36WS (round 90)", () => {
  for (const [pkg, phone] of [["A", false], ["B", true], ["D", false]] as const) {
    it(`fills package ${pkg}'s 36-inch opening: no narrower line, no filler, no strips, ${phone ? "by touch on a phone" : "with the mouse"}`, async () => {
      const s = await open(phone);
      if (pkg !== "A") {
        await press(s, s.page.getByRole("button", { name: pkg, exact: true }).filter({ visible: true }).first());
        await s.page.waitForTimeout(2500);
      }
      await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
      await s.page.waitForTimeout(2500);
      await pick(s, "thermador-hmcb30ws");
      const thirty = { ...(await card(s, "thermador-hmcb30ws")), strips: await strips(s) };
      await pick(s, "thermador-hmcb36ws");
      const thirtySix = { ...(await card(s, "thermador-hmcb36ws")), strips: await strips(s) };
      expect({ thirty, thirtySix, errors: s.errors }).toEqual({
        // The 30": a narrower line, 3" each side printed, and the gap left
        // open with no strips (round 87, Leo's site practice).
        thirty: { pressed: "true", narrower: 1, fillerNote: true, strips: 0 },
        thirtySix: { pressed: "true", narrower: 0, fillerNote: false, strips: 0 },
        errors: [],
      });
      await s.page.context().close();
    });
  }
});
