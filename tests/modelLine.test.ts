import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The model line's rule, held on what the browser actually laid out.
 *
 * D12, round 79 (Leo): the line is brand · model, and the opening beside them
 * where it differs from the machine's width. **The model number is never
 * cut**; where the line is too narrow the brand gives way first, and the
 * opening drops to a line of its own. It is all CSS, so it is checked here,
 * in a real browser, and not in a unit test: every `[data-model-line]` on the
 * page, read for which of its three parts is wider than the box it was given.
 *
 * Round 82 wrote this before touching the line, to lock the rule as it
 * stands. At the list rail's own 260px no row cuts its brand today (measured
 * in round 82: every package, both languages), so the rail is also narrowed
 * here — in the test only — until brands do give way; otherwise the one level
 * of the rule that matters would pass without ever being reached. How many
 * lines were read, and how many had their brand cut, is part of the result.
 */

const DESKTOP = { width: 1440, height: 900 };

const EXPECTED_TESTS = 11;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} model-line tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({
    args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
});
afterAll(async () => {
  await browser?.close();
});

interface Line {
  text: string;
  brandCut: boolean;
  modelCut: boolean;
  openingCut: boolean;
}

/** Every model line on screen, and which of its parts did not fit. */
async function readLines(page: Page): Promise<Line[]> {
  return page.$$eval("[data-model-line]", (lines) =>
    lines
      .filter((line) => (line as HTMLElement).getClientRects().length > 0)
      .map((line) => {
        const cut = (selector: string) => {
          const part = line.querySelector<HTMLElement>(selector);
          return part ? part.scrollWidth > part.clientWidth + 0.5 : false;
        };
        return {
          text: (line as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
          brandCut: cut("[data-model-brand]"),
          modelCut: cut("[data-model-model]"),
          openingCut: cut("[data-model-opening]"),
        };
      }),
  );
}

async function click(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
  const box = (await button.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

describe("the model line", () => {
  it("never cuts the model or the opening, and only ever the brand, in the appliance list", async () => {
    const context = await browser.newContext({ viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto(PREVIEW_URL + "?quality=high", { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(2000);
    await click(page, "Appliances");
    await page.waitForTimeout(600);

    const all: (Line & { at: string })[] = [];
    let brandsCutNarrow = 0;
    for (const lang of ["EN", "中"]) {
      await click(page, lang);
      await page.waitForTimeout(500);
      for (const pkg of ["A", "B", "C", "D", "E"]) {
        await click(page, pkg);
        await page.waitForTimeout(1800);
        for (const width of [260, 200, 160]) {
          // Narrowed in the test only: the rail itself stays 260px wide.
          await page.evaluate((w) => {
            const panel = document.querySelector<HTMLElement>('[data-panel="list"]')!;
            panel.style.width = `${w}px`;
          }, width);
          await page.waitForTimeout(150);
          const lines = await readLines(page);
          all.push(...lines.map((line) => ({ ...line, at: `${lang} ${pkg} ${width}px` })));
          if (width < 260) brandsCutNarrow += lines.filter((line) => line.brandCut).length;
        }
        await page.evaluate(() => {
          document.querySelector<HTMLElement>('[data-panel="list"]')!.style.width = "";
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`model lines read: ${all.length}; brands cut at the narrowed widths: ${brandsCutNarrow}`);
    expect({
      linesRead: all.length,
      modelsCut: all.filter((line) => line.modelCut).map((line) => `${line.at}: ${line.text}`),
      openingsCut: all.filter((line) => line.openingCut).map((line) => `${line.at}: ${line.text}`),
      brandsGaveWay: brandsCutNarrow > 0,
    }).toEqual({
      // 2 languages x (6 + 6 + 6 + 10 + 8 rows) x 3 widths.
      linesRead: 2 * 36 * 3,
      modelsCut: [],
      openingsCut: [],
      brandsGaveWay: true,
    });
    await context.close();
  });

  for (const lang of ["EN", "中"]) {
    for (const pkg of ["A", "B", "C", "D", "E"]) {
      it(`never cuts the model or the opening on the model card and in the alternatives, ${lang}, package ${pkg}`, async () => {
        const context = await browser.newContext({ viewport: DESKTOP });
        const page = await context.newPage();
        await page.goto(PREVIEW_URL + "?quality=high", { waitUntil: "networkidle", timeout: 90_000 });
        await page.waitForSelector("canvas", { timeout: 60_000 });
        await page.waitForTimeout(2000);
        await click(page, "Appliances");
        await page.waitForTimeout(600);
        await click(page, lang);
        await page.waitForTimeout(500);
        await click(page, pkg);
        await page.waitForTimeout(1800);
        const row = (i: number) => page.locator('[data-panel="list"] ul li button').nth(i);

        const all: (Line & { at: string })[] = [];
        let onCard = 0;
        const rows = await page.locator('[data-panel="list"] ul li button').count();
        for (let i = 0; i < rows; i += 1) {
          await row(i).scrollIntoViewIfNeeded();
          const box = (await row(i).boundingBox())!;
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(700);
          // The folded models too: they are laid out only when opened.
          const toggle = page.locator("[data-model-card] [data-card-refused-toggle]");
          if (await toggle.count()) {
            const t = (await toggle.boundingBox())!;
            await page.mouse.click(t.x + t.width / 2, t.y + t.height / 2);
            await page.waitForTimeout(200);
          }
          onCard += await page.locator("[data-model-card] [data-model-line]").count();
          const lines = await readLines(page);
          all.push(...lines.map((line) => ({ ...line, at: `#${i + 1}` })));
          const back = page.getByRole("button", { name: /All appliances|全部家电/ }).filter({ visible: true }).first();
          const b = (await back.boundingBox())!;
          await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
          await page.waitForTimeout(400);
        }

        // eslint-disable-next-line no-console
        console.log(
          `${lang} ${pkg}: model lines read ${all.length}, on the card ${onCard}; brands cut ${all.filter((l) => l.brandCut).length}`,
        );
        expect({
          readOnTheCard: onCard >= rows * 2,
          modelsCut: all.filter((line) => line.modelCut).map((line) => `${line.at}: ${line.text}`),
          openingsCut: all.filter((line) => line.openingCut).map((line) => `${line.at}: ${line.text}`),
        }).toEqual({ readOnTheCard: true, modelsCut: [], openingsCut: [] });
        await context.close();
      });
    }
  }
});
