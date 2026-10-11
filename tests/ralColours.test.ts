import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 92, Leo: every RAL Classic colour. A code round 33's forty-code table
 * lacked, 5015, said "not in the table"; now every Classic code paints the
 * doors, a number that is not one says so in Leo's words, a line under the
 * input says a screen colour is approximate, and a pearl, metallic or luminous
 * colour on the doors says a screen cannot show it. Real input throughout: the
 * mouse into the field and the keyboard to type and press Enter (D17).
 * docs/decisions.md D15, round 92.
 */

const DESKTOP = { width: 1440, height: 900 };

const EXPECTED_TESTS = 8;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} RAL tests actually ran`).toBe(EXPECTED_TESTS);
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

interface Session {
  page: Page;
  errors: string[];
}

async function open(lang: "EN" | "中" = "EN"): Promise<Session> {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(PREVIEW_URL + "?quality=high&debug=1", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForSelector(`[data-ral-input="cabinet"]`, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  if (lang === "中") await mouse(page, page.getByRole("button", { name: "中", exact: true }).first());
  return { page, errors };
}

async function mouse(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
}

/** Click into the field with the mouse, type the number, press Enter. */
async function typeRal(s: Session, which: "cabinet" | "accent", text: string) {
  await mouse(s.page, s.page.locator(`[data-ral-input="${which}"]`));
  await s.page.keyboard.type(text);
  await s.page.keyboard.press("Enter");
  await s.page.waitForTimeout(700);
}

const panels = (s: Session) =>
  s.page.evaluate(() =>
    (window as unknown as { __cabinetPanels: () => string[] }).__cabinetPanels(),
  );

const text = async (s: Session, selector: string) => {
  const found = s.page.locator(selector);
  return { count: await found.count(), text: (await found.first().textContent().catch(() => null)) ?? null };
};

describe("every RAL Classic colour, typed", () => {
  it("paints the doors RAL 5015, a code round 33's table lacked", async () => {
    const s = await open();
    await typeRal(s, "cabinet", "5015");
    expect({
      panels: await panels(s),
      current: (await text(s, `[data-ral-current="cabinet"]`)).text,
      errors: s.errors,
    }).toEqual({ panels: ["#2874B2"], current: "RAL 5015", errors: [] });
    await s.page.context().close();
  });

  it("says a number that is not a Classic code is not one, in English, and leaves the doors", async () => {
    const s = await open();
    const before = await panels(s);
    await typeRal(s, "cabinet", "RAL 1234");
    expect({ error: (await text(s, `[data-ral-error="cabinet"]`)).text, panels: await panels(s) }).toEqual({
      error: "RAL 1234 is not a RAL Classic colour",
      panels: before,
    });
    await s.page.context().close();
  });

  it("says it in Chinese", async () => {
    const s = await open("中");
    await typeRal(s, "cabinet", "RAL 1234");
    expect((await text(s, `[data-ral-error="cabinet"]`)).text).toBe("RAL 1234 不是 RAL Classic 色号");
    await s.page.context().close();
  });
});

describe("what the RAL input says under it", () => {
  it("says a screen colour is approximate, under the input, before anything is typed", async () => {
    const s = await open();
    expect(await text(s, `[data-ral-approximate="cabinet"]`)).toEqual({
      count: 1,
      text: "Screen colours are approximate — confirm against a physical RAL colour card.",
    });
    await s.page.context().close();
  });

  it("says it in Chinese", async () => {
    const s = await open("中");
    expect(await text(s, `[data-ral-approximate="cabinet"]`)).toEqual({
      count: 1,
      text: "屏幕颜色仅供参考，以实物色卡为准。",
    });
    await s.page.context().close();
  });

  it("says nothing about pearl colours while the doors are an ordinary one", async () => {
    const s = await open();
    await typeRal(s, "cabinet", "RAL 6005");
    expect({
      current: (await text(s, `[data-ral-current="cabinet"]`)).text,
      effect: (await text(s, `[data-ral-effect="cabinet"]`)).count,
    }).toEqual({ current: "RAL 6005", effect: 0 });
    await s.page.context().close();
  });

  it("says a screen cannot show a pearl colour while one is on the doors, and stops once it is not", async () => {
    const s = await open();
    await typeRal(s, "cabinet", "1035");
    const pearl = await text(s, `[data-ral-effect="cabinet"]`);
    await typeRal(s, "cabinet", "9010");
    const after = (await text(s, `[data-ral-effect="cabinet"]`)).count;
    expect({ pearl, after, errors: s.errors }).toEqual({
      pearl: { count: 1, text: "Pearl, metallic and luminous colours cannot be shown on a screen." },
      after: 0,
      errors: [],
    });
    await s.page.context().close();
  });

  it("says it under the accent's input in Chinese, for a luminous accent, and not under the doors'", async () => {
    const s = await open("中");
    await mouse(s.page, s.page.locator(`[data-segment="accent-run"] button[data-value="left"]`));
    await typeRal(s, "accent", "ral 6038");
    expect({
      accent: await text(s, `[data-ral-effect="accent"]`),
      cabinet: (await text(s, `[data-ral-effect="cabinet"]`)).count,
    }).toEqual({ accent: { count: 1, text: "珠光、金属和荧光色无法在屏幕上显示。" }, cabinet: 0 });
    await s.page.context().close();
  });
});
