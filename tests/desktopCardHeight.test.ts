import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import appliancesFile from "../data/appliances.json";
import { alternativeTitle } from "../src/data/machineLabel";
import { translate } from "../src/i18n";
import type { Appliance } from "../src/types";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * The desktop model card keeps the height it had before an alternative's main
 * title, and the pin labels keep their places (Leo, 2026-11-09, 乙: the card
 * 260 wide, the title in 11px on one line, "Specified" at the right of the
 * second line). `tests/fixtures/desktopCardLive.json` is the live layout, read
 * from the build of a2a8646. `docs/plans/alternative-title-card-height-plan.md`.
 *
 * All 44 titles cannot all be offered at once, so each is put in a real
 * selected and a real unselected row of the real card, and the row read.
 */

const WIDTHS = [1440, 1280];
const LIVE = JSON.parse(readFileSync("tests/fixtures/desktopCardLive.json", "utf8")).states as Record<string, { cardHeight: number; labels: Record<string, [number, number]> }>;
const E = JSON.parse(readFileSync("src/store/shareLink.round98b1.json", "utf8")).links["E one-wall"].link as string;
const all = appliancesFile.appliances as unknown as Appliance[];

const STATES: [string, string | null, string | null, string][] = [];
for (const p of ["A", "B", "C", "D", "E"]) STATES.push([`${p} slot-hood`, p, null, "slot-hood"], [`${p} slot-fridge`, p, null, "slot-fridge"]);
STATES.push(["E-JVM slot-hood", null, E.replace("hood=HMCB36WS", "hood=JVM3160RFSS"), "slot-hood"]);

const EXPECTED_TESTS = WIDTHS.length * 2 + WIDTHS.length * STATES.length;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} desktop-card tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function open(width: number, query: string, pkg: string | null, slot: string) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openWatched(page, `${PREVIEW_URL}${query}&quality=low&qualityLock=1`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: "desktopCardHeight" });
  await page.waitForTimeout(2200);
  const press = async (locator: ReturnType<Page["locator"]>) => {
    const box = (await locator.boundingBox({ timeout: 8000 }))!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  if (pkg) {
    await press(page.getByRole("button", { name: pkg, exact: true }).filter({ visible: true }).first());
    await page.waitForTimeout(2500);
  }
  await press(page.locator(`[data-pin-label="${slot}"]`).first());
  await page.waitForFunction(() => document.querySelector("[data-model-card]"), null, { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector("[data-toast]"), null, { timeout: 25_000 }).catch(() => {});
  return { page, errors };
}

const read = (page: Page) =>
  page.evaluate(() => {
    const card = document.querySelector("[data-model-card]")!.getBoundingClientRect();
    const labels = Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>("[data-pin-label]")]
        .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).opacity !== "0")
        .map((el) => {
          const r = el.getBoundingClientRect();
          return [el.getAttribute("data-pin-label")!, [Math.round(r.left), Math.round(r.top)] as [number, number]];
        }),
    );
    return { cardHeight: Math.round(card.height * 10) / 10, labels };
  });

/** Once the camera and the labels have stopped. */
async function settled(page: Page) {
  let last = "";
  let now = await read(page);
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(350);
    now = await read(page);
    const text = JSON.stringify(now);
    if (text === last) break;
    last = text;
  }
  await page.waitForTimeout(800);
  return read(page);
}

describe("every main title on one line of the desktop card", () => {
  for (const width of WIDTHS) {
    for (const lang of ["en", "zh"] as const) {
      it(`at ${width} in ${lang}, selected and not`, async () => {
        const query = E.replace("lang=en", `lang=${lang}`);
        const { page, errors } = await open(width, query, null, "slot-fridge");
        const rows = all.map((a) => ({
          model: a.model,
          brand: a.brand,
          title: alternativeTitle(a, (key, vars) => translate(lang, key, vars)),
        }));
        expect(rows.length).toBe(44);
        const wrong = await page.evaluate((list) => {
          const out: string[] = [];
          const card = document.querySelector("[data-model-card]")!;
          const rowsOf = {
            selected: card.querySelector<HTMLElement>('[data-candidate][aria-pressed="true"]')!,
            other: card.querySelector<HTMLElement>('[data-candidate][aria-pressed="false"][data-fits="true"]')!,
          };
          for (const [which, row] of Object.entries(rowsOf)) {
            const title = row.querySelector<HTMLElement>("[data-alt-title]")!;
            const brand = row.querySelector<HTMLElement>("[data-model-brand]")!;
            const model = row.querySelector<HTMLElement>("[data-model-model]")!;
            const saved = [title.textContent, brand.textContent, model.textContent];
            title.textContent = "X";
            const oneLine = row.getBoundingClientRect().height;
            const style = getComputedStyle(row);
            const right = row.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
            for (const item of list) {
              title.textContent = item.title;
              brand.textContent = item.brand;
              model.textContent = item.model;
              const h = row.getBoundingClientRect().height;
              const range = document.createRange();
              range.selectNodeContents(title);
              const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
              const end = Math.max(...[...range.getClientRects()].map((r) => r.right));
              const badge = which === "selected" ? [...row.querySelectorAll("span")].find((s) => s.children.length === 0 && /^(Specified|已选)$/.test(s.textContent ?? "")) : null;
              const modelBox = model.getBoundingClientRect();
              const trouble = [
                h > oneLine + 0.5 ? `row ${h} against ${oneLine}` : "",
                tops.size > 1 ? `${tops.size} lines` : "",
                end > right + 0.5 ? `past the row by ${end - right}` : "",
                model.scrollWidth > model.clientWidth + 1 ? "model cut" : "",
                modelBox.right > right + 0.5 ? "model past the row" : "",
                badge && (() => { const b = badge.getBoundingClientRect(); return b.left < modelBox.right - 0.5 && b.right > modelBox.left + 0.5 && b.top < modelBox.bottom - 0.5 && b.bottom > modelBox.top + 0.5; })() ? "badge over the model" : "",
              ].filter(Boolean);
              if (trouble.length) out.push(`${which} ${item.model}: ${trouble.join(", ")}`);
            }
            title.textContent = saved[0];
            brand.textContent = saved[1];
            model.textContent = saved[2];
          }
          return out;
        }, rows);
        expect(wrong).toEqual([]);
        expect(errors).toEqual([]);
        await page.context().close();
      });
    }
  }
});

describe("the desktop card's height and the pin labels, as they are live", () => {
  for (const width of WIDTHS) {
    it.each(STATES)(`at ${width}: %s`, async (name, pkg, link, slot) => {
      const live = LIVE[`${width} ${name}`];
      expect(live, "the live figure was read").toBeTruthy();
      const { page, errors } = await open(width, link ?? "?lang=en", pkg, slot);
      const now = await settled(page);
      const moved = Object.keys({ ...live.labels, ...now.labels }).filter((key) => {
        const [a, b] = [live.labels[key], now.labels[key]];
        return !a || !b || Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1;
      });
      expect({ height: now.cardHeight, moved: moved.map((key) => `${key}: ${live.labels[key]} -> ${now.labels[key]}`), errors }).toEqual({
        height: live.cardHeight,
        moved: [],
        errors: [],
      });
      await page.context().close();
    });
  }
});
