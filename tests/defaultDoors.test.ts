import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 92a, Leo: every package opens with its doors in RAL 5015, the first
 * cabinet chip, where they were forest green. The mouse on a desktop (D17).
 * docs/decisions.md D15, round 92a.
 */

const DESKTOP = { width: 1440, height: 900 };

const EXPECTED_TESTS = 9;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} default-door tests actually ran`).toBe(EXPECTED_TESTS);
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

async function open(query = ""): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${PREVIEW_URL}?quality=high&debug=1${query}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForSelector(`[data-ral-input="cabinet"]`, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  return { page, errors };
}

async function mouse(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Whether the code beside the RAL input is cut. Measured as drawn, to the
 * fraction of a pixel: the width the text takes against the box it is shown
 * in. `scrollWidth` and `clientWidth` are whole pixels, and a text 0.4px too
 * wide reads as fitting there while the browser draws it with "…".
 */
const codeBesideInput = (page: Page) =>
  page.$eval(`[data-ral-current="cabinet"] .truncate`, (e) => {
    const range = document.createRange();
    range.selectNodeContents(e);
    return {
      text: e.textContent,
      cut: range.getBoundingClientRect().width > e.getBoundingClientRect().width + 0.01,
    };
  });

const panels = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cabinetPanels: () => string[] }).__cabinetPanels());

describe("the doors every package opens with", () => {
  it("paints every package's doors RAL 5015, A to E", async () => {
    const { page, errors } = await open();
    const seen: Record<string, string[]> = {};
    for (const pkg of ["A", "B", "C", "D", "E"]) {
      if (pkg !== "A") {
        await mouse(page, page.getByRole("button", { name: pkg, exact: true }).filter({ visible: true }).first());
        await page.waitForTimeout(2500);
      }
      seen[pkg] = await panels(page);
    }
    // #C7C7C7 is not a door: it is the oak finish's tint (`FINISHES["wood-oak"]`),
    // the band of B's and D's insert housing, there on round 92 as well.
    expect({ seen, errors }).toEqual({
      seen: {
        A: ["#2874B2"],
        B: ["#2874B2", "#C7C7C7"],
        C: ["#2874B2"],
        D: ["#2874B2", "#C7C7C7"],
        E: ["#2874B2"],
      },
      errors: [],
    });
    await page.context().close();
  });

  it("marks the sky blue chip chosen, says RAL 5015 beside the input, and names it in English", async () => {
    const { page } = await open();
    const pressed = page.locator(`[data-swatch][aria-pressed="true"]`).first();
    expect({
      chosen: await page.locator(`[data-swatch][aria-pressed="true"]`).count(),
      value: await pressed.getAttribute("data-swatch"),
      name: await pressed.getAttribute("title"),
      code: await page.textContent(`[data-ral-current="cabinet"]`),
    }).toEqual({ chosen: 1, value: "#2874B2", name: "Sky blue", code: "RAL 5015" });
    await page.context().close();
  });

  it("names it in Chinese", async () => {
    const { page } = await open();
    await mouse(page, page.getByRole("button", { name: "中", exact: true }).first());
    await page.waitForTimeout(500);
    expect(await page.locator(`[data-swatch][aria-pressed="true"]`).first().getAttribute("title")).toBe("天蓝");
    await page.context().close();
  });

  for (const lang of ["EN", "中"] as const) {
    for (const wider of [false, true]) {
      it(`shows the whole code beside the input as the page opens, ${lang}${wider ? ", its text drawn wider" : ""}`, async () => {
        const { page } = await open();
        if (lang === "中") {
          await mouse(page, page.getByRole("button", { name: "中", exact: true }).first());
          await page.waitForTimeout(500);
        }
        // Leo's machine draws the panel's text a little wider than this
        // browser does, and cut "RAL 5015" in English where this one did not
        // (round 92a, his screenshot). Spacing the letters out stands in for
        // that: the code must still show whole however wide its font draws.
        if (wider) await page.addStyleTag({ content: `[data-ral-current] { letter-spacing: 1.5px; }` });
        await page.waitForTimeout(200);
        expect(await codeBesideInput(page)).toEqual({ text: "RAL 5015", cut: false });
        await page.context().close();
      });
    }
  }

  it("shows RAL 5015 among the scheme's dots under the package summary, and no green", async () => {
    const { page } = await open();
    expect({
      blue: await page.locator(`span[title="#2874B2"]`).count(),
      green: await page.locator(`span[title="#2E5C45"]`).count(),
    }).toEqual({ blue: 1, green: 0 });
    await page.context().close();
  });

  it("opens an old link asking for the green on the chip in its place", async () => {
    const { page } = await open("&cabinet=green");
    expect(await panels(page)).toEqual(["#2874B2"]);
    await page.context().close();
  });
});
