import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The phone's sheet holds its five tabs on one line — Appliances, Look,
 * Layout, Install, List — at 360, 375, 390 and 414px, in English and in
 * Chinese, each with 10px of padding a side (Leo, round 91: 2px less than the
 * two tabs had). Measured as tests/topBar.test.ts measures the top bar: every
 * tab and the close button by its box; two that share any area overlap, one
 * past an edge is off the screen, tabs on two lines are wrapped. The sheet is
 * opened with a tap, as a customer would. docs/decisions.md D12, round 91.
 */

const WIDTHS = [360, 375, 390, 414] as const;
const LANGS = ["en", "zh"] as const;

const EXPECTED_TESTS = WIDTHS.length * LANGS.length + 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} sheet-tab tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function openPhone(width: number, lang: "en" | "zh"): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`${PREVIEW_URL}?quality=high`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(800);
  if (lang === "zh") await tap(page, page.locator("header button", { hasText: "中" }));
  return page;
}

async function tap(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = (await locator.first().boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
}

const ENTRY = { en: { appliances: "Appliances", config: "Configure" }, zh: { appliances: "家电", config: "配置" } };

/** The sheet's header row: every tab and the close button, by its box. */
const header = (page: Page) =>
  page.$$eval("[data-sheet] button", (buttons) =>
    buttons
      .filter((b) => b.closest("[role=separator]") === null)
      .map((b) => {
        const r = b.getBoundingClientRect();
        const style = getComputedStyle(b);
        return {
          name: b.getAttribute("aria-label") || (b.textContent ?? "").trim(),
          tab: b.hasAttribute("data-sheet-tab"),
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          padding: `${style.paddingLeft} ${style.paddingRight}`,
        };
      })
      .filter((b) => b.tab || b.name === "Close" || b.name === "关闭"),
  );

describe("the phone's sheet", () => {
  for (const lang of LANGS) {
    for (const width of WIDTHS) {
      it(`at ${width}px in ${lang === "en" ? "English" : "Chinese"} holds five tabs on one line, 10px a side, none over another`, async () => {
        const page = await openPhone(width, lang);
        await tap(page, page.getByRole("button", { name: ENTRY[lang].config, exact: true }));
        const boxes = await header(page);
        await page.context().close();
        const tabs = boxes.filter((b) => b.tab);
        const found: string[] = [];
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i];
            const b = boxes[j];
            const across = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
            const down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
            if (across > 0.01 && down > 0.01) found.push(`"${a.name}" over "${b.name}" by ${across.toFixed(1)}px`);
          }
        }
        for (const b of boxes) if (b.x < -0.01 || b.x + b.w > width + 0.01) found.push(`"${b.name}" off the screen`);
        if (new Set(tabs.map((b) => Math.round(b.y))).size > 1) found.push("the tabs wrap onto two lines");
        expect(
          { tabs: tabs.length, padding: [...new Set(tabs.map((b) => b.padding))], found },
          `${width}px ${lang}: ${found.join("; ")}`,
        ).toEqual({ tabs: 5, padding: ["10px 10px"], found: [] });
      });
    }
  }

  it("opens on Appliances from its Appliances button", async () => {
    const page = await openPhone(390, "en");
    await tap(page, page.getByRole("button", { name: "Appliances", exact: true }));
    const showing = await page.$$eval("[data-sheet-tab]", (tabs) =>
      tabs.filter((t) => t.className.includes("bg-accent")).map((t) => t.getAttribute("data-sheet-tab")),
    );
    await page.context().close();
    expect(showing).toEqual(["appliances"]);
  });

  it("opens on the settings tab last shown from Configure: Look at first, then the one chosen", async () => {
    const page = await openPhone(390, "en");
    const showing = () =>
      page.$$eval("[data-sheet-tab]", (tabs) =>
        tabs.filter((t) => t.className.includes("bg-accent")).map((t) => t.getAttribute("data-sheet-tab")),
      );
    await tap(page, page.getByRole("button", { name: "Configure", exact: true }));
    const first = await showing();
    await tap(page, page.locator('[data-sheet-tab="layout"]'));
    await tap(page, page.getByRole("button", { name: "Close" }));
    await tap(page, page.getByRole("button", { name: "Configure", exact: true }));
    const again = await showing();
    await page.context().close();
    expect({ first, again }).toEqual({ first: ["look"], again: ["layout"] });
  });
});
