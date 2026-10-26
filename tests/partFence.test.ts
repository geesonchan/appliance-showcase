import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import en from "../src/i18n/en.json";

/**
 * Round 99c, Leo: a part that fails shows its own message and the page goes
 * on — "一块出错只显示那一块的错误提示，页面其余照常". Five fences: the right
 * panel, the 3D scene, the left panel, the quote page and the share link's
 * notice, each failing on purpose through `?fault=<part>` (src/ui/fault.ts).
 * Each: the message in Leo's words where the part was, the rest of the page
 * still there and working, and the part back on Retry — and, for the parts a
 * package switch reaches, back on tapping another package. Real input: the
 * mouse on a 1440 desktop, a finger on a 390 phone (D17).
 */

const DEVICES: Record<"desktop" | "phone", BrowserContextOptions> = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
};
type Device = keyof typeof DEVICES;
const MESSAGE = (en as Record<string, string>)["part.failed"];
/** A's own link with the language left out, so that the notice shows. */
const CUT_LINK = "?v=2&pkg=A";

const EXPECTED_TESTS = 19;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} fence tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function press(page: Page, device: Device, role: "button" | "tab", name: string) {
  const box = await page
    .getByRole(role, { name, exact: true })
    .filter({ visible: true })
    .first()
    .boundingBox({ timeout: 5_000 })
    .catch(() => null);
  if (!box) throw new Error(`no ${role} "${name}" to press on the ${device}`);
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (device === "desktop") await page.mouse.click(x, y);
  else await page.touchscreen.tap(x, y);
  await page.waitForTimeout(1200);
}

/** What stands on the page: the fence's message for a part, the canvas, each panel, the notice, the quote. */
const state = (page: Page) =>
  page.evaluate(() => ({
    // On screen only: a phone keeps the desktop's panels mounted and hidden,
    // and a fence there fails out of sight.
    failed: [...document.querySelectorAll<HTMLElement>("[data-part-failed]")]
      .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed")
      .map((el) => el.getAttribute("data-part-failed")),
    canvas: document.querySelectorAll("canvas").length,
    rightPanel: document.querySelectorAll("[data-right-panel]").length > 0,
    leftPanel: document.querySelectorAll('[data-panel="list"]').length > 0,
    notice: document.querySelectorAll("[data-share-notice-line]").length,
    quote: document.querySelectorAll("[data-quote-page]").length > 0,
    message: [...document.querySelectorAll<HTMLElement>("[data-part-failed]")]
      .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed")
      .map((el) => el.textContent ?? ""),
  }));

/** Opens the page with one part failing, and brings that part on screen. */
async function failing(device: Device, part: string) {
  const context = await browser.newContext(DEVICES[device]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = part === "link-notice" ? `${PREVIEW_URL}${CUT_LINK}&` : `${PREVIEW_URL}?`;
  await page.goto(`${base}quality=low&fault=${part}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2000);
  if (part === "right-panel" && device === "phone") await press(page, device, "button", "Configure");
  if (part === "left-panel") await press(page, device, "button", "Appliances");
  if (part === "quote") await press(page, device, "button", "Quote");
  return { context, page, errors };
}

const shows = (seen: Awaited<ReturnType<typeof state>>, part: string) => ({
  failed: seen.failed,
  message: seen.message.some((text) => text.includes(MESSAGE)),
  part,
});

describe("a part that fails is fenced off, and comes back (round 99c)", () => {
  for (const device of ["desktop", "phone"] as const) {
    for (const part of ["right-panel", "scene", "left-panel", "quote", "link-notice"]) {
      it(`on a ${device}: the ${part} fails, the rest stands, Retry brings it back`, async () => {
        const { context, page, errors } = await failing(device, part);
        const during = await state(page);
        // The rest of the page: the canvas, unless the scene is the part; the
        // package buttons, which every part leaves standing.
        const rest = {
          canvas: part === "scene" ? 0 : 1,
          packageButtons: await page.getByRole("button", { name: "B", exact: true }).filter({ visible: true }).count(),
        };
        await press(page, device, "button", "Retry");
        const after = await state(page);
        await context.close();
        expect({
          during: shows(during, part),
          rest: { canvas: during.canvas, packageButtons: rest.packageButtons > 0 },
          back: {
            failed: after.failed,
            here:
              part === "scene"
                ? after.canvas === 1
                : part === "right-panel"
                  ? after.rightPanel
                  : part === "left-panel"
                    ? after.leftPanel
                    : part === "quote"
                      ? after.quote
                      : after.notice > 0,
          },
          errors,
        }).toEqual({
          during: { failed: [part], message: true, part },
          rest: { canvas: rest.canvas, packageButtons: true },
          back: { failed: [], here: true },
          errors: [],
        });
      });
    }
  }

  for (const part of ["right-panel", "scene"]) {
    it(`on a desktop: the ${part} fails, and tapping another package brings it back`, async () => {
      const { context, page, errors } = await failing("desktop", part);
      const during = await state(page);
      await press(page, "desktop", "button", "B");
      const after = await state(page);
      await context.close();
      expect({
        during: during.failed,
        after: after.failed,
        here: part === "scene" ? after.canvas === 1 : after.rightPanel,
        errors,
      }).toEqual({ during: [part], after: [], here: true, errors: [] });
    });
  }

  it("on a desktop: the quote fails, and its Close puts the room back", async () => {
    const { context, page, errors } = await failing("desktop", "quote");
    const during = await state(page);
    await press(page, "desktop", "button", "Close");
    const after = await state(page);
    await context.close();
    expect({ during: during.failed, after: after.failed, quote: after.quote, canvas: after.canvas, errors }).toEqual({
      during: ["quote"],
      after: [],
      quote: false,
      canvas: 1,
      errors: [],
    });
  });

  it("on a desktop: the left panel fails, and tapping another package brings it back", async () => {
    const { context, page, errors } = await failing("desktop", "left-panel");
    const during = await state(page);
    await press(page, "desktop", "button", "B");
    const after = await state(page);
    await context.close();
    expect({ during: during.failed, after: after.failed, here: after.leftPanel, errors }).toEqual({
      during: ["left-panel"],
      after: [],
      here: true,
      errors: [],
    });
  });
});

/**
 * Round 99d, Leo: "3D 画面每一帧里（useFrame）的报错：要触发 3D 画面那道隔离，
 * 显示出错提示和"重试"，不能停在空画面上". Round 99c's trial of it: the page
 * went on, but the picture stopped on an empty canvas, the error thrown again
 * every frame, and no fence saw it. `?fault=scene-frame` throws in a frame
 * until a retry. After Retry the picture is drawn again, and goes on being
 * drawn: the renderer's count climbs.
 */
describe("an error in a frame reaches the 3D scene's fence (round 99d)", () => {
  for (const device of ["desktop", "phone"] as const) {
    it(`on a ${device}: the scene shows the message and Retry, and Retry draws it again`, async () => {
      const context = await browser.newContext(DEVICES[device]);
      const page = await context.newPage();
      await page.addInitScript(() => {
        const counting = window as unknown as { __renders: number; __THREE_DEVTOOLS__: EventTarget };
        counting.__renders = 0;
        const hook = new EventTarget();
        counting.__THREE_DEVTOOLS__ = hook;
        hook.addEventListener("observe", (event) => {
          const r = (event as CustomEvent).detail;
          if (!r?.isWebGLRenderer || !r.render) return;
          const own = r.render.bind(r);
          r.render = (scene: unknown, camera: unknown) => {
            counting.__renders += 1;
            own(scene, camera);
          };
        });
      });
      await page.goto(`${PREVIEW_URL}?quality=low&fault=scene-frame`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForTimeout(2500);
      const during = await state(page);
      const buttons = await page.getByRole("button", { name: "B", exact: true }).filter({ visible: true }).count();
      await press(page, device, "button", "Retry");
      const renders = () => page.evaluate(() => (window as unknown as { __renders: number }).__renders);
      const first = await renders();
      await page.waitForTimeout(1500);
      const later = await renders();
      const after = await state(page);
      await context.close();
      expect({
        during: shows(during, "scene"),
        rest: buttons > 0,
        after: { failed: after.failed, canvas: after.canvas, drawing: later > first },
      }).toEqual({
        during: { failed: ["scene"], message: true, part: "scene" },
        rest: true,
        after: { failed: [], canvas: 1, drawing: true },
      });
    });
  }
});

/**
 * Round 99d, after Leo's look at the preview: with the 3D scene failed, its
 * pins and their leader lines still floated over the empty place, "02 Range"
 * across the message. While the scene's fence shows its message the pins and
 * the dimensions are hidden with it, and come back when the scene does.
 */
describe("the scene's pins go with the scene (round 99d)", () => {
  for (const [device, fault] of [
    ["desktop", "scene"],
    ["desktop", "scene-frame"],
    ["phone", "scene"],
  ] as const) {
    it(`on a ${device}, ?fault=${fault}: no pin while the message shows, nothing over it; the pins back after Retry`, async () => {
      const context = await browser.newContext(DEVICES[device]);
      const page = await context.newPage();
      await page.goto(`${PREVIEW_URL}?quality=low&fault=${fault}`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForTimeout(2500);
      const look = () =>
        page.evaluate(() => {
          const shown = (el: Element) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            const style = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0;
          };
          const pins = [...document.querySelectorAll("[data-pin-label], [data-pin-dot]")].filter(shown).length;
          const message = document.querySelector("[data-part-failed] p");
          let covered = false;
          if (message) {
            const r = message.getBoundingClientRect();
            for (const [fx, fy] of [[0.25, 0.5], [0.5, 0.5], [0.75, 0.5]]) {
              const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
              if (!hit || !hit.closest("[data-part-failed]")) covered = true;
            }
          }
          return { pins, message: !!message, covered };
        });
      const during = await look();
      await press(page, device, "button", "Retry");
      await page.waitForTimeout(1000);
      const after = await look();
      await context.close();
      expect({ during, afterPins: after.pins > 0, afterMessage: after.message }).toEqual({
        during: { pins: 0, message: true, covered: false },
        afterPins: true,
        afterMessage: false,
      });
    });
  }
});
