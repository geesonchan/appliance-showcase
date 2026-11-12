import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * The U's default view shows every machine's label (Leo, 2026-11-12: 「默认画面里，每台机器
 * 的标签都要看得见、点得到」; and, choosing 0° and 50° down by it: 「加一条守门的测试：五个套餐的 U，
 * 默认画面里每台机器的标签都在画面里、没被挡住。以后谁改视角或排法把标签挡住了，它会变红」).
 *
 * Each package's U opened by a link at the walls it opens at (D23), the mouse's
 * 1440 x 900 and a phone's 390 x 844, nothing selected, the link's notice closed as a
 * person would. For every machine's pin label: the page has not hidden it (its own
 * occlusion test, D1 reason 3's pins), it is on screen, and the point at its middle is
 * the label itself — not the room, another label, the toolbar or a panel. Proved red
 * first on the view from the left at 25° (2026-11-12's first pick), where the left leg
 * hides most of them.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
/** The walls each package's U opens at (the U's new order, 2026-11-12), and its machines. */
const U: Record<string, { side: number; machines: number }> = {
  A: { side: 155.25, machines: 6 },
  B: { side: 141, machines: 6 },
  C: { side: 159.75, machines: 6 },
  D: { side: 177, machines: 10 },
  E: { side: 147, machines: 8 },
};

const EXPECTED_TESTS = 10;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} U label tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function labelsInTheDefaultView(code: string, phone: boolean) {
  const context = await browser.newContext(
    phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  const query = `/?v=2&pkg=${code}&shape=U&back=132&left=${U[code].side}&corner=blind&lang=zh`;
  await openWatched(page, `${PREVIEW_URL}${query}`, {
    gotoTimeout: 90_000,
    canvasTimeout: 60_000,
    label: `uLabels · ${expect.getState().currentTestName ?? ""}`,
  });
  await page.waitForTimeout(2500);
  const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await notice.count()) {
    const box = (await notice.first().boundingBox())!;
    if (phone) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  // The pins' occlusion test runs every fourth frame; a second is many.
  await page.waitForTimeout(1500);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-pin-label]")].map((label) => {
      const rect = label.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const onScreen = rect.width > 0 && rect.height > 0 && x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
      const hit = onScreen ? document.elementFromPoint(x, y) : null;
      return {
        slot: label.getAttribute("data-pin-label")!,
        shown: Number(getComputedStyle(label).opacity) > 0.5,
        onScreen,
        clickable: !!hit && (hit === label || label.contains(hit)),
      };
    }),
  );
  await context.close();
  return {
    labels: labels.length,
    notSeen: labels
      .filter((l) => !(l.shown && l.onScreen && l.clickable))
      .map((l) => `${l.slot}${!l.shown ? " hidden" : !l.onScreen ? " off screen" : " covered"}`),
    errors,
  };
}

describe("the U's default view shows every machine's label (Leo, 2026-11-12)", () => {
  for (const code of Object.keys(U)) {
    for (const phone of [false, true]) {
      it(`${code}'s U, ${phone ? "a finger at 390" : "the mouse at 1440"}`, { timeout: 180_000 }, async () => {
        expect(await labelsInTheDefaultView(code, phone)).toEqual({ labels: U[code].machines, notSeen: [], errors: [] });
      });
    }
  }
});
