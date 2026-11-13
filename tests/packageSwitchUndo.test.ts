import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * Item 10 (Leo, 2026-11-13): 「另加一条测试，先红：换套餐后点"退回"，滑杆的数和实际建成的
 * 房间都回到换之前，三种形状都查。」 And what the switch says on the way, in his
 * answers' words: the first line 「已切换为套餐 B，墙长已调整：」, a line for each
 * wall that changed, in fractions.
 *
 * Real input throughout — the package and shape buttons, the Layout tab and
 * 退回 pressed with the mouse on a desktop and a finger on a phone (D17). The
 * sliders are read where the customer reads them, on the Layout tab that shows;
 * the room built is the page's own (`__room()`, under ?debug=1).
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 4;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} package-switch Undo tests actually ran`).toBe(EXPECTED_TESTS);
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
  lang: "zh" | "en";
  errors: string[];
}

async function open(phone: boolean, lang: "zh" | "en"): Promise<Session> {
  const context = await browser.newContext(
    phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openWatched(page, `${PREVIEW_URL}?v=2&pkg=A&lang=${lang}&debug=1&quality=high`, {
    gotoTimeout: 90_000,
    canvasTimeout: 60_000,
    label: `packageSwitchUndo · ${expect.getState().currentTestName ?? ""}`,
  });
  await page.waitForTimeout(2500);
  return { page, phone, lang, errors };
}

async function press(s: Session, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
}

const visible = (s: Session, selector: string) => s.page.locator(selector).filter({ visible: true }).first();

async function choosePackage(s: Session, code: string) {
  await press(s, visible(s, `[data-segment="package"] [data-value="package-${code.toLowerCase()}"]`));
  await s.page.waitForTimeout(3000);
}

async function chooseShape(s: Session, shape: "L" | "one-wall" | "U") {
  await press(s, visible(s, `[data-segment="shape"] [data-value="${shape}"]`));
  await s.page.waitForTimeout(3000);
}

const LABELS = {
  zh: { backWallIn: "后墙", leftWallIn: "左墙", sides: "左右墙长度", configure: "配置", close: "关闭" },
  en: { backWallIn: "Back wall", leftWallIn: "Left wall", sides: "Side walls", configure: "Configure", close: "Close" },
};

/**
 * The wall sliders the Layout tab shows, by their own label (the desktop's
 * panel says 「后墙长度」, the phone's sheet 「后墙」), and the figure each shows. On a phone the sheet is opened for it and closed again, so the
 * toast and its button stand as the customer left them.
 */
async function sliders(s: Session): Promise<Record<string, string>> {
  const words = LABELS[s.lang];
  if (s.phone) {
    await press(s, s.page.getByRole("button", { name: words.configure, exact: true }).filter({ visible: true }).first());
    await s.page.waitForTimeout(1200);
  }
  await press(s, visible(s, '[data-right-tab="layout"], [data-sheet-tab="layout"]'));
  await s.page.waitForTimeout(800);
  const read = await s.page.evaluate((names) => {
    const out: Record<string, string> = {};
    for (const label of document.querySelectorAll("label")) {
      const input = label.querySelector('input[type="range"]');
      if (!input || input.getClientRects().length === 0) continue;
      const [name, figure] = [...(label.querySelector("span")?.children ?? [])].map((el) => (el.textContent ?? "").trim());
      for (const [key, wanted] of Object.entries(names)) {
        if (name.startsWith(wanted)) out[key] = figure;
      }
    }
    return out;
  }, { backWallIn: words.backWallIn, leftWallIn: words.leftWallIn, sides: words.sides });
  if (s.phone) {
    // The sheet's own close: a fresh page's hint card has a 「关闭」 / "Close" of its own.
    await press(s, s.page.locator("[data-sheet]").getByRole("button", { name: words.close, exact: true }).filter({ visible: true }).first());
    await s.page.waitForTimeout(1200);
  }
  return read;
}

/** The room the page built, its walls in inches: the back, and the left (the side walls in a U). */
const built = (s: Session) =>
  s.page.evaluate(() => {
    const p = (window as unknown as { __room: () => { params: { shape: string; backWallIn: number; leftWallIn: number } } }).__room().params;
    return p.shape === "one-wall" ? { backWallIn: p.backWallIn } : { backWallIn: p.backWallIn, leftWallIn: p.leftWallIn };
  });

/** The sliders under the built room's names: one wall has its back wall; a U one slider for both sides. */
const asBuilt = (read: Record<string, string>) => {
  const out: Record<string, string> = {};
  if (read.backWallIn !== undefined) out.backWallIn = read.backWallIn;
  if (read.leftWallIn !== undefined) out.leftWallIn = read.leftWallIn;
  if (read.sides !== undefined) out.leftWallIn = read.sides;
  return out;
};

const toastLines = (s: Session) =>
  s.page.locator("[data-toast]").count().then(async (n) =>
    n === 0 ? null : (await s.page.locator("[data-toast] span.block").allInnerTexts()).map((line) => line.trim()),
  );

/**
 * A switch and its Undo: the room before, the switch's words, the sliders
 * against the room built after it, 退回 pressed, and the sliders and the room
 * after that against the room before.
 */
async function switchAndUndo(s: Session, to: string) {
  const before = { sliders: asBuilt(await sliders(s)), room: await built(s) };
  await choosePackage(s, to);
  const after = { said: await toastLines(s), sliders: asBuilt(await sliders(s)), room: await built(s) };
  const undo = s.page.locator("[data-toast] [data-toast-undo]");
  const button = (await undo.count()) > 0 ? (await undo.innerText()).trim() : null;
  if (button) {
    await press(s, undo);
    await s.page.waitForTimeout(3000);
  }
  const back = { toast: await s.page.locator("[data-toast]").count(), sliders: asBuilt(await sliders(s)), room: await built(s) };
  return { before, after, button, back };
}

describe("item 10: a package switch's Undo puts back the sliders and the room (Leo, 2026-11-13)", () => {
  it("the L, A to D, on a desktop in Chinese: both walls said, 退回套餐 A by the mouse", async () => {
    const s = await open(false, "zh");
    const r = await switchAndUndo(s, "D");
    expect({ ...r, errors: s.errors }).toEqual({
      before: { sliders: { backWallIn: '168"', leftWallIn: '144"' }, room: { backWallIn: 168, leftWallIn: 144 } },
      after: {
        said: ["已切换为套餐 D，墙长已调整：", "后墙从 168″ 改为 224¼″", "左墙从 144″ 改为 178¾″"],
        sliders: { backWallIn: '224.25"', leftWallIn: '178.75"' },
        room: { backWallIn: 224.25, leftWallIn: 178.75 },
      },
      button: "退回套餐 A",
      back: { toast: 0, sliders: { backWallIn: '168"', leftWallIn: '144"' }, room: { backWallIn: 168, leftWallIn: 144 } },
      errors: [],
    });
    await s.page.context().close();
  });

  it("one wall, C to A, on a desktop in Chinese: the 3¾″ that grew in silence is said, and undone", async () => {
    const s = await open(false, "zh");
    await choosePackage(s, "C");
    await chooseShape(s, "one-wall");
    const r = await switchAndUndo(s, "A");
    expect({ ...r, errors: s.errors }).toEqual({
      before: { sliders: { backWallIn: '230"' }, room: { backWallIn: 230 } },
      after: {
        said: ["已切换为套餐 A，墙长已调整：", "后墙从 230″ 改为 233¾″"],
        sliders: { backWallIn: '233.75"' },
        room: { backWallIn: 233.75 },
      },
      button: "退回套餐 C",
      back: { toast: 0, sliders: { backWallIn: '230"' }, room: { backWallIn: 230 } },
      errors: [],
    });
    await s.page.context().close();
  });

  it("one wall, A to B, on a phone in English: the slider at 239″, and a finger on Undo takes it back to 233¾″", async () => {
    const s = await open(true, "en");
    await chooseShape(s, "one-wall");
    const r = await switchAndUndo(s, "B");
    expect({ ...r, errors: s.errors }).toEqual({
      before: { sliders: { backWallIn: '233.75"' }, room: { backWallIn: 233.75 } },
      after: {
        said: ["Switched to Package B; the walls were adjusted:", "Back wall: 233¾″ → 239″"],
        sliders: { backWallIn: '239"' },
        room: { backWallIn: 239 },
      },
      button: "Back to Package A",
      back: { toast: 0, sliders: { backWallIn: '233.75"' }, room: { backWallIn: 233.75 } },
      errors: [],
    });
    await s.page.context().close();
  });

  it("the U, B to A, on a phone in English: the side walls said and on the slider, and Undo back to B's U", async () => {
    const s = await open(true, "en");
    await choosePackage(s, "B");
    await chooseShape(s, "U");
    const r = await switchAndUndo(s, "A");
    expect({ ...r, errors: s.errors }).toEqual({
      before: { sliders: { backWallIn: '196.5"', leftWallIn: '144"' }, room: { backWallIn: 196.5, leftWallIn: 144 } },
      after: {
        said: ["Switched to Package A; the walls were adjusted:", "Side walls: 144″ → 155¼″"],
        sliders: { backWallIn: '196.5"', leftWallIn: '155.25"' },
        room: { backWallIn: 196.5, leftWallIn: 155.25 },
      },
      button: "Back to Package B",
      back: { toast: 0, sliders: { backWallIn: '196.5"', leftWallIn: '144"' }, room: { backWallIn: 196.5, leftWallIn: 144 } },
      errors: [],
    });
    await s.page.context().close();
  });
});
