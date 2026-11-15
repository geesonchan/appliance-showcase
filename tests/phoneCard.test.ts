import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";
import appliancesFile from "../data/appliances.json";
import { alternativeTitle } from "../src/data/machineLabel";
import { translate } from "../src/i18n";
import type { Appliance } from "../src/types";

/**
 * Item 12, 8: the phone's model card (Leo, 2026-11-14: 「手机卡片：照丁的原型做」, 「目标是和主标题之前
 * 一样高」, and its tests: 「390 宽，中英文，每个套餐每台机器，卡高等于主标题之前量到的数；标题一行放得下、
 * 没有被截断」).
 *
 * At 390 x 844 with a finger, each package's own L room, in English and Chinese: every machine
 * chosen from the Appliances list (家电), the sheet closed, the card read: its height against the
 * one measured on a2a8646, the build before the main title (tests/fixtures/phoneCardPretitle.json),
 * and each row's title on one line, inside its cell, not cut. Then every one of the 44 titles put
 * into a real selected row and a real unselected one, each language.
 *
 * Seven English states come out 16.5px SHORTER than before the main title, not the same: with
 * cells 228px wide a row's second line no longer wraps. Leo accepted them, 2026-11-14: 「手机卡那 7 个
 * 状态矮 16.5 像素：接受。测试里保留量到的确切数，旁边写明原因和我这句话」. So SHORTER keeps the
 * heights 丁 measured, exactly.
 */

const PHONE = { width: 390, height: 844 };
const PRETITLE = JSON.parse(readFileSync("tests/fixtures/phoneCardPretitle.json", "utf8")).heights as Record<string, number>;
// The seven 16.5px shorter than before the main title: in 丁's 228px cells a row's second line,
// which wrapped before, fits on one. Leo, 2026-11-14: 「手机卡那 7 个状态矮 16.5 像素：接受。测试里保留量到的
// 确切数，旁边写明原因和我这句话。」 The figures are the ones measured on 丁's build.
const SHORTER: Record<string, number> = {
  "A en slot-range": 216.3,
  "B en slot-range": 216.3,
  "B en slot-microwave": 221.8,
  "C en slot-range": 221.8,
  "D en slot-range": 216.3,
  "D en slot-oven": 195.8,
  "E en slot-microwave": 221.8,
};
const WORDS = { en: { list: "Appliances", close: "Close" }, zh: { list: "家电", close: "关闭" } };
const PKGS = ["A", "B", "C", "D", "E"] as const;

const EXPECTED_TESTS = PKGS.length * 2 + 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} phone-card tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function openPhone(pkg: string, lang: "en" | "zh") {
  const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openWatched(page, `${PREVIEW_URL}?v=3&pkg=${pkg}&shape=L&lang=${lang}&quality=low&qualityLock=1`, {
    gotoTimeout: 90_000,
    canvasTimeout: 60_000,
    label: `phoneCard · ${expect.getState().currentTestName ?? ""}`,
  });
  await page.waitForTimeout(2500);
  return { page, errors };
}

async function tap(page: Page, locator: ReturnType<Page["locator"]>, wait = 900) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox({ timeout: 8000 }))!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(wait);
}

/** Each title in the card: how many lines, past its cell, cut. */
const readCard = (page: Page) =>
  page.evaluate(() => {
    const card = document.querySelector("[data-model-card]");
    if (!card) return null;
    const rows = [...card.querySelectorAll<HTMLElement>("[data-candidate]")].map((row) => {
      const title = row.querySelector<HTMLElement>("[data-alt-title]")!;
      const range = document.createRange();
      range.selectNodeContents(title);
      const rects = [...range.getClientRects()];
      const style = getComputedStyle(row);
      const right = row.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      return {
        title: title.textContent ?? "",
        lines: new Set(rects.map((r) => Math.round(r.top))).size,
        past: Math.max(...rects.map((r) => r.right)) > right + 0.5,
        cut: title.scrollWidth > title.clientWidth + 1,
      };
    });
    return {
      slot: card.getAttribute("data-model-card")!,
      height: Math.round(card.getBoundingClientRect().height * 10) / 10,
      rows,
    };
  });

describe("the phone card: as tall as before the main title, every title on one line (item 12)", () => {
  for (const pkg of PKGS) {
    for (const lang of ["en", "zh"] as const) {
      it(`${pkg}'s own L, ${lang === "en" ? "English" : "Chinese"}, every machine by finger`, async () => {
        const { page, errors } = await openPhone(pkg, lang);
        const w = WORDS[lang];
        const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
        if (await notice.count()) await tap(page, notice.first());
        const openList = () => tap(page, page.getByRole("button", { name: w.list, exact: true }).filter({ visible: true }).first(), 1200);
        const closeSheet = (wait: number) =>
          tap(page, page.locator("[data-sheet]").getByRole("button", { name: w.close, exact: true }).filter({ visible: true }).first(), wait);
        await openList();
        const count = await page.locator("[data-sheet] ul").first().locator("li > button").count();
        await closeSheet(1000);
        const heights: Record<string, number> = {};
        const titles: string[] = [];
        for (let i = 0; i < count; i += 1) {
          await openList();
          await tap(page, page.locator("[data-sheet] ul").first().locator("li > button").nth(i));
          await closeSheet(2400);
          const card = await readCard(page);
          expect(card, `row ${i}: no card`).not.toBeNull();
          heights[`${pkg} ${lang} ${card!.slot}`] = card!.height;
          for (const row of card!.rows) {
            if (row.lines !== 1 || row.past || row.cut) titles.push(`${card!.slot} 「${row.title}」: ${row.lines} lines${row.past ? ", past its cell" : ""}${row.cut ? ", cut" : ""}`);
          }
          // With a machine chosen the Appliances tab is its alternatives: the card closed first.
          await tap(page, page.locator("[data-model-card]").getByRole("button", { name: w.close, exact: true }).first(), 1000);
        }
        const wanted = Object.fromEntries(
          Object.entries(PRETITLE)
            .filter(([key]) => key.startsWith(`${pkg} ${lang} `))
            .map(([key, height]) => [key, SHORTER[key] ?? height]),
        );
        expect(heights).toEqual(wanted);
        expect(titles).toEqual([]);
        expect(errors).toEqual([]);
        await page.context().close();
      });
    }
  }

  for (const lang of ["en", "zh"] as const) {
    it(`fits all 44 titles in a cell, selected and not, ${lang === "en" ? "English" : "Chinese"}`, async () => {
      const { page, errors } = await openPhone("E", lang);
      const w = WORDS[lang];
      const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
      if (await notice.count()) await tap(page, notice.first());
      // The refrigerator's card has a selected row and others.
      await tap(page, page.getByRole("button", { name: w.list, exact: true }).filter({ visible: true }).first(), 1200);
      const rows = page.locator("[data-sheet] ul").first().locator("li > button");
      await tap(page, rows.filter({ hasText: lang === "en" ? "Refrigerator" : "冰箱" }).first());
      await tap(page, page.locator("[data-sheet]").getByRole("button", { name: w.close, exact: true }).filter({ visible: true }).first(), 2400);
      const all = (appliancesFile.appliances as unknown as Appliance[]).map((a) => ({
        model: a.model,
        title: alternativeTitle(a, (key, vars) => translate(lang, key, vars)),
      }));
      expect(all.length).toBe(44);
      const wrong = await page.evaluate((list) => {
        const out: string[] = [];
        const card = document.querySelector("[data-model-card]")!;
        const cells = {
          selected: card.querySelector<HTMLElement>('[data-candidate][aria-pressed="true"]'),
          other: card.querySelector<HTMLElement>('[data-candidate][aria-pressed="false"]'),
        };
        for (const [which, row] of Object.entries(cells)) {
          if (!row) {
            out.push(`no ${which} row`);
            continue;
          }
          const title = row.querySelector<HTMLElement>("[data-alt-title]")!;
          const saved = title.textContent;
          const style = getComputedStyle(row);
          const right = row.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
          for (const item of list) {
            title.textContent = item.title;
            const range = document.createRange();
            range.selectNodeContents(title);
            const rects = [...range.getClientRects()];
            const lines = new Set(rects.map((r) => Math.round(r.top))).size;
            const by = Math.max(...rects.map((r) => r.right)) - right;
            if (lines > 1 || by > 0.5 || title.scrollWidth > title.clientWidth + 1) out.push(`${which} ${item.model} 「${item.title}」: ${lines} lines, past by ${Math.round(by)}px`);
          }
          title.textContent = saved;
        }
        return out;
      }, all);
      expect(wrong).toEqual([]);
      expect(errors).toEqual([]);
      await page.context().close();
    });
  }
});
