import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type CDPSession, type Locator, type Page } from "playwright";
import { openWatched } from "../scripts/pageWatch.mjs";
import { PREVIEW_URL } from "./globalSetup";
import { launchBrowser } from "./siteBrowser";

/**
 * D11 rule 12's counter at the slider's end, in the room as it is drawn (the
 * 9" round; Leo, 2026-11-05, 乙, and the plan's four answers). B with a lazy
 * susan and its refrigerator's end at a wall opens that switch at 199-1/4",
 * 9" beside its oven tower; the back wall dragged as short as it goes leaves
 * 6", and the note under the slider says so in Leo's words; turning the
 * island across the room is the page building the room again, so the wall
 * grows back to 199-1/4", says so, and the note goes. The mouse on a desktop
 * in Chinese, a finger on a phone in English (D17).
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} rule-12 note tests actually ran`).toBe(EXPECTED_TESTS);
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
  cdp: CDPSession;
  errors: string[];
}

const WORDS = {
  en: {
    note: 'Only 6" of counter left here — not practical.',
    backWall: "Back wall",
    lazySusan: "Lazy susan",
    wall: "Wall",
    across: "Across the room",
  },
  zh: {
    note: '台面只剩 6"，实际不建议',
    backWall: "后墙长度",
    lazySusan: "转盘",
    wall: "墙身",
    across: "垂直后墙",
  },
};

async function open(phone: boolean): Promise<Session> {
  const context = await browser.newContext(
    phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openWatched(page, `${PREVIEW_URL}?quality=low`, {
    gotoTimeout: 90_000,
    canvasTimeout: 60_000,
    label: `rule12Note · ${expect.getState().currentTestName ?? ""}`,
  });
  await page.waitForTimeout(2000);
  return { page, phone, cdp: await context.newCDPSession(page), errors };
}

async function press(s: Session, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
  await s.page.waitForTimeout(1500);
}

const button = (s: Session, name: string) => s.page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

/** The Layout tab: the right panel's on a desktop, the sheet's on a phone. */
async function layoutTab(s: Session) {
  if (s.phone) {
    await press(s, button(s, "Configure"));
    await press(s, button(s, "Layout"));
  } else {
    await press(s, s.page.locator('[data-right-tab="layout"]').filter({ visible: true }).first());
  }
}

/** A horizontal drag, by the mouse or by one finger. */
async function drag(s: Session, x0: number, y0: number, x1: number) {
  if (!s.phone) {
    await s.page.mouse.move(x0, y0);
    await s.page.mouse.down();
    for (let i = 1; i <= 12; i += 1) await s.page.mouse.move(x0 + ((x1 - x0) * i) / 12, y0);
    await s.page.mouse.up();
  } else {
    const at = (x: number) => [{ x, y: y0, id: 1 }];
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(x0) });
    for (let i = 1; i <= 12; i += 1) {
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(x0 + ((x1 - x0) * i) / 12) });
      await s.page.waitForTimeout(16);
    }
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await s.page.waitForTimeout(2500);
}

/** The back wall's slider, what it reads, and the note under it if there is one. */
async function backWall(s: Session, lang: "en" | "zh") {
  const label = s.page.locator("label", { hasText: WORDS[lang].backWall }).filter({ visible: true }).first();
  const slider = label.locator('input[type="range"]');
  // The figure printed beside the slider: the wall as built. The input's own
  // value is on the slider's 6" steps, which 199-1/4" is not.
  const value = (await label.locator("span.tabular-nums").first().innerText()).trim();
  const raw = Number(await slider.inputValue());
  const note = label.locator("[data-narrow-counter]");
  return { label, slider, value, raw, note: (await note.count()) > 0 ? (await note.innerText()).trim() : null };
}

async function story(phone: boolean, lang: "en" | "zh") {
  const s = await open(phone);
  const w = WORDS[lang];
  // Chinese by the language switch, as a customer picks it (the address
  // alone does not set it outside a link).
  if (lang === "zh") await press(s, button(s, "中"));
  await press(s, button(s, "B"));
  await layoutTab(s);
  await press(s, button(s, w.lazySusan));
  await press(s, button(s, w.wall));
  const opened = await backWall(s, lang);

  // As short as the slider goes: the thumb dragged past the band's left end.
  await opened.slider.scrollIntoViewIfNeeded();
  const box = (await opened.slider.boundingBox())!;
  const { min, max } = await opened.slider.evaluate((el: HTMLInputElement) => ({ min: Number(el.min), max: Number(el.max) }));
  const x0 = box.x + ((opened.raw - min) / (max - min)) * box.width;
  await drag(s, x0, box.y + box.height / 2, box.x + 2);
  const dragged = await backWall(s, lang);

  await press(s, button(s, w.across));
  const after = await backWall(s, lang);
  const toast = await s.page.locator('[data-toast="toast.wallGrew"]').count();
  await s.page.context().close();
  return {
    opened: { value: opened.value, note: opened.note },
    dragged: { value: dragged.value, note: dragged.note },
    after: { value: after.value, note: after.note, grewToast: toast > 0 },
    errors: s.errors,
  };
}

describe("rule 12's 6 inches only where a wall slider is dragged (the 9-inch round)", () => {
  it("says so under the back wall's slider by the mouse on a desktop, in Chinese, and grows back when the island is turned", async () => {
    expect(await story(false, "zh")).toEqual({
      opened: { value: "199.25\"", note: null },
      dragged: { value: "197\"", note: WORDS.zh.note },
      after: { value: "199.25\"", note: null, grewToast: true },
      errors: [],
    });
  });

  it("says so by a finger on a phone, in English", async () => {
    expect(await story(true, "en")).toEqual({
      opened: { value: "199.25\"", note: null },
      dragged: { value: "197\"", note: WORDS.en.note },
      after: { value: "199.25\"", note: null, grewToast: true },
      errors: [],
    });
  });
});
