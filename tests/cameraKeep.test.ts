import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * Two things the camera does by the user's hand, in every shape (Leo,
 * 2026-11-11 and 2026-11-12; D1):
 *
 * - The zoom buttons step the zoom and nothing else: 「放大、缩小按钮把镜头转回 45°/35°：
 *   这一轮修，三种形状一起，缩放时保持当前的角度」. Until now a step ran the fly-in's
 *   tween without the camera's own angle, so it swung to the L's 45°/35° —
 *   after any fly-in, and from a U's own view.
 * - Another model picked on the card pulls the camera back: 「换了型号以后镜头放远：…角度
 *   和中心不动，远近回到看得见整个厨房，卡片不关」, D1's fifth reason.
 *
 * Real input — the mouse on a desktop, a finger on a phone. The angle and the
 * zoom are read off the camera the page renders with (three.js's devtools hook).
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 8;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} camera tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

interface Session {
  page: Page;
  phone: boolean;
  errors: string[];
}

async function open(phone: boolean, query: string): Promise<Session> {
  const context = await browser.newContext(
    phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.addInitScript(() => {
    const hook = new EventTarget();
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const r = (event as CustomEvent).detail as { isWebGLRenderer?: boolean; render?: (s: unknown, c: unknown) => void };
      if (!r.isWebGLRenderer || !r.render) return;
      const own = r.render.bind(r);
      r.render = (scene: unknown, camera: unknown) => {
        (window as unknown as { __camera: unknown }).__camera = camera;
        own(scene, camera);
      };
    });
  });
  await openWatched(page, `${PREVIEW_URL}${query}`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `cameraKeep · ${expect.getState().currentTestName ?? ""}` });
  await page.waitForTimeout(2500);
  const s = { page, phone, errors };
  // A link without models says so; the notice is closed, as a person would.
  const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await notice.count()) await press(s, notice.first());
  return s;
}

async function press(s: Session, locator: ReturnType<Page["locator"]>, wait = 1800) {
  const box = (await locator.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
  await s.page.waitForTimeout(wait);
}

/** The camera's angle in whole degrees and its zoom, as rendered. */
const pose = (s: Session) =>
  s.page.evaluate(() => {
    const camera = (window as unknown as { __camera: { matrixWorld: { elements: number[] }; zoom: number } }).__camera;
    const e = camera.matrixWorld.elements;
    return {
      azimuth: Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI),
      pitch: Math.round((Math.asin(e[9]) * 180) / Math.PI),
      zoom: camera.zoom,
    };
  });

const zoomButton = (s: Session, which: "in" | "out") =>
  s.page.locator(`button[aria-label="${which === "in" ? "Zoom in" : "Zoom out"}"]`).filter({ visible: true }).first();
const pin = (s: Session, slot: string) => s.page.locator(`[data-pin-label="${slot}"]`).filter({ visible: true }).first();
const otherModel = (s: Session) => s.page.locator("[data-model-card] [data-candidate][aria-pressed=false]").filter({ visible: true }).first();
const near = (a: number, b: number) => Math.abs(a - b) / b < 0.02;

async function zoomKeepsAngle(phone: boolean, query: string, fly: string | null, which: "in" | "out") {
  const s = await open(phone, query);
  if (fly) await press(s, pin(s, fly));
  const before = await pose(s);
  await press(s, zoomButton(s, which), 1200);
  const after = await pose(s);
  await s.page.context().close();
  return {
    angle: [after.azimuth, after.pitch],
    stepped: near(after.zoom, before.zoom * (which === "in" ? 1.3 : 1 / 1.3)),
    errors: s.errors,
    expected: { angle: [before.azimuth, before.pitch], stepped: true, errors: [] },
  };
}

async function swapPullsBack(phone: boolean, query: string, fly: string) {
  const s = await open(phone, query);
  const whole = (await pose(s)).zoom;
  await press(s, pin(s, fly));
  const flown = await pose(s);
  await press(s, otherModel(s), 2600);
  const after = await pose(s);
  const cardOpen = await s.page.locator(`[data-model-card="${fly}"]`).filter({ visible: true }).count();
  await s.page.context().close();
  return {
    flownCloser: flown.zoom > whole * 1.3,
    angle: [after.azimuth, after.pitch],
    backToTheRoom: near(after.zoom, whole),
    cardOpen: cardOpen > 0,
    errors: s.errors,
    expected: { flownCloser: true, angle: [flown.azimuth, flown.pitch], backToTheRoom: true, cardOpen: true, errors: [] },
  };
}

const check = (result: { expected: unknown } & Record<string, unknown>) => {
  const { expected, ...got } = result;
  expect(got).toEqual(expected);
};

describe("the zoom buttons step the zoom and keep the angle (Leo, 2026-11-12)", () => {
  it("package A's L flown to the dishwasher, zoom in, on a desktop by the mouse", async () =>
    check(await zoomKeepsAngle(false, "/?lang=en&quality=low", "slot-dishwasher", "in")));
  it("package A's L flown to the refrigerator, zoom out, on a phone by a finger", async () =>
    check(await zoomKeepsAngle(true, "/?lang=en&quality=low", "slot-fridge", "out")));
  it("package D on one wall flown to the range, zoom in, on a desktop by the mouse", async () =>
    check(await zoomKeepsAngle(false, "/?v=2&pkg=D&shape=one-wall&lang=en&quality=low", "slot-range", "in")));
  it("package D's U at its own view, zoom in, on a desktop by the mouse", async () =>
    check(await zoomKeepsAngle(false, "/?v=2&pkg=D&shape=U&back=132&corner=blind&lang=en&quality=low", null, "in")));
});

describe("another model on the card pulls the camera back to the whole room (D1's fifth reason, Leo, 2026-11-11)", () => {
  it("package A's L, the dishwasher, on a desktop by the mouse", async () =>
    check(await swapPullsBack(false, "/?lang=en&quality=low", "slot-dishwasher")));
  it("package A's L, the dishwasher, on a phone by a finger", async () =>
    check(await swapPullsBack(true, "/?lang=en&quality=low", "slot-dishwasher")));
  it("package E on one wall, the refrigerator, on a desktop by the mouse", async () =>
    check(await swapPullsBack(false, "/?v=2&pkg=E&shape=one-wall&lang=en&quality=low", "slot-fridge")));
  it("package D's U, the hood, on a desktop by the mouse", async () =>
    check(await swapPullsBack(false, "/?v=2&pkg=D&shape=U&back=132&corner=blind&lang=en&quality=low", "slot-hood")));
});
