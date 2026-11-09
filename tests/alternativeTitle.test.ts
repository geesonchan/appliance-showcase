import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * An alternative's main title on the page (Leo, 2026-11-08). What it says is
 * `src/data/alternativeTitle.test.ts`; what is held here needs a browser: the
 * title first, brand · model under it, on the card and in the list, and the
 * longest title on a 360 phone's 168px card neither cut nor pushing the model
 * number out. Real input: a finger on a phone, the mouse on a desktop (D17).
 */

const EXPECTED_TESTS = 3;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} alternative-title tests actually ran`).toBe(EXPECTED_TESTS);
});

const E = JSON.parse(readFileSync("src/store/shareLink.round98b1.json", "utf8")).links["E one-wall"].link as string;

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function open(phone: boolean, query: string) {
  const context = await browser.newContext(
    phone
      ? { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1440, height: 900 } },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openWatched(page, `${PREVIEW_URL}${query}&quality=low&qualityLock=1`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: "alternativeTitle" });
  await page.waitForTimeout(2500);
  const press = async (locator: ReturnType<Page["locator"]>) => {
    await locator.scrollIntoViewIfNeeded();
    const box = (await locator.boundingBox())!;
    if (phone) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1200);
  };
  return { page, press, errors };
}

/** Each row's title and model, and whether either is cut or leaves its row. */
const readRows = (page: Page, scope: string) =>
  page.$$eval(`${scope} [data-candidate]`, (rows) =>
    rows.map((row) => {
      const title = row.querySelector("[data-alt-title]") as HTMLElement | null;
      const model = row.querySelector("[data-model-model]") as HTMLElement | null;
      const box = row.getBoundingClientRect();
      const out = (el: HTMLElement | null) => {
        if (!el) return true;
        const b = el.getBoundingClientRect();
        return el.scrollWidth > el.clientWidth + 1 || b.right > box.right + 0.5 || b.left < box.left - 0.5;
      };
      return {
        title: title?.textContent ?? null,
        model: model?.textContent ?? null,
        titleAboveModel: !!title && !!model && title.getBoundingClientRect().bottom <= model.getBoundingClientRect().top + 1,
        cut: out(title) || out(model),
      };
    }),
  );

describe("an alternative's main title, laid out", () => {
  it.each([
    ["English", E, '30" Refrigerator Column · Stainless', "· Panel-Ready"],
    ["Chinese", E.replace("lang=en", "lang=zh"), '30" 冷藏柱 · 不锈钢', "· 可装门板"],
  ])("fits a 360 phone's card in %s, the title over the model, neither cut", async (_lang, query, current, other) => {
    const s = await open(true, query);
    await s.press(s.page.locator('[data-pin-label="slot-fridge"]').first());
    const toggle = s.page.locator("[data-model-card] [data-card-refused-toggle]");
    if ((await toggle.count()) && (await toggle.getAttribute("aria-expanded")) === "false") await s.press(toggle);
    const rows = await readRows(s.page, "[data-model-card]");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.map((r) => r.title)).toContain(current);
    expect(rows.some((r) => r.title?.endsWith(other))).toBe(true);
    expect(rows.filter((r) => r.cut || !r.titleAboveModel || !r.title || !r.model)).toEqual([]);
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });

  it("reads the same in the list rail, on a desktop", async () => {
    const s = await open(false, E);
    await s.press(s.page.locator('[data-pin-label="slot-fridge"]').first());
    const onCard = (await readRows(s.page, "[data-model-card]")).map((r) => r.title);
    await s.press(s.page.locator('button[data-rail="left"]').first());
    const rows = await readRows(s.page, "aside");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.filter((r) => r.cut || !r.titleAboveModel)).toEqual([]);
    for (const title of onCard) expect(rows.map((r) => r.title)).toContain(title);
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });
});
