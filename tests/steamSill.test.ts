import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type CDPSession, type Locator, type Page } from "playwright";
import { openWatched } from "../scripts/pageWatch.mjs";
import { PREVIEW_URL } from "./globalSetup";
import { launchBrowser } from "./siteBrowser";

/**
 * Item 12b, D's oven height in Layout (Leo, 2026-11-16, his answers to the
 * plan's two drafts, docs/plans/item12b-plan.md), as a customer does it: the
 * package, the Layout tab, the slider and the model card pressed with the mouse
 * on a desktop and a finger on a phone (D17).
 *
 * - The slider 「烤箱离地高度」 / "Oven height", 5" to 18"; under the opening a
 *   fixed panel, one drawer or two (A, B), each drawn as the scene's own
 *   `strip-` or `door-` group of the box.
 * - The four models from the card: the slider stays, its range follows the
 *   model (PO302W to 14", held there and the caption in bold as B's microwave
 *   handle does), the caption says the handle the model has (C, section 6).
 * - B's and E's Layout: the microwave handle and no oven height.
 *
 * The room read is the page's own (`__room()`, under ?debug=1), the drawn fronts
 * the scene's (`__THREE_DEVTOOLS__`).
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 3;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} oven-height tests actually ran`).toBe(EXPECTED_TESTS);
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
  en: { slider: "Oven height", microwave: "Microwave handle", configure: "Configure", layout: "Layout", close: "Close" },
  zh: { slider: "烤箱离地高度", microwave: "微波把手高度", configure: "配置", layout: "布局", close: "关闭" },
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
  await page.addInitScript(() => {
    const hook = new EventTarget();
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const detail = (event as CustomEvent).detail as { isScene?: boolean };
      if (!detail.isScene) return;
      const w = window as unknown as { __scenes?: unknown[] };
      w.__scenes = [...(w.__scenes ?? []), detail];
    });
  });
  await openWatched(page, `${PREVIEW_URL}?debug=1&quality=low`, {
    gotoTimeout: 90_000,
    canvasTimeout: 60_000,
    label: `steamSill · ${expect.getState().currentTestName ?? ""}`,
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

const visible = (s: Session, selector: string) => s.page.locator(selector).filter({ visible: true }).first();
const button = (s: Session, name: string) => s.page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

async function choose(s: Session, segment: "package" | "shape", value: string) {
  await press(s, visible(s, `[data-segment="${segment}"] [data-value="${value}"]`));
  await s.page.waitForTimeout(2500);
}

/** The Layout tab: the right panel's on a desktop, the sheet's on a phone. */
async function layoutTab(s: Session, lang: "en" | "zh") {
  if (s.phone) {
    await press(s, button(s, WORDS[lang].configure));
    await press(s, visible(s, '[data-sheet-tab="layout"]'));
  } else {
    await press(s, visible(s, '[data-right-tab="layout"]'));
  }
}

/** A slider by its own label: whether it shows, its ends and value, the figure and the caption. */
async function slider(s: Session, name: string) {
  const label = s.page.locator("label").filter({ visible: true }).filter({ has: s.page.locator("span", { hasText: new RegExp(`^${name}$`) }) }).first();
  if ((await label.count()) === 0) return null;
  const input = label.locator('input[type="range"]');
  const caption = label.locator("span.mt-1");
  return {
    label,
    input,
    min: Number(await input.getAttribute("min")),
    max: Number(await input.getAttribute("max")),
    value: Number(await input.inputValue()),
    figure: (await label.locator("span.tabular-nums").first().innerText()).trim(),
    caption: (await caption.count()) > 0 ? (await caption.innerText()).trim() : null,
    bold: (await caption.count()) > 0 ? await caption.locator(".font-medium").count() > 0 : false,
  };
}

/** Drag the slider's thumb past one end of its track, by the mouse or one finger. */
async function dragToEnd(s: Session, input: Locator, end: "min" | "max") {
  await input.scrollIntoViewIfNeeded();
  const box = (await input.boundingBox())!;
  const value = Number(await input.inputValue());
  const min = Number(await input.getAttribute("min"));
  const max = Number(await input.getAttribute("max"));
  const y = box.y + box.height / 2;
  const x0 = box.x + 8 + ((box.width - 16) * (value - min)) / (max - min);
  const x1 = end === "min" ? box.x - 30 : box.x + box.width + 30;
  if (!s.phone) {
    await s.page.mouse.move(x0, y);
    await s.page.mouse.down();
    for (let i = 1; i <= 12; i += 1) await s.page.mouse.move(x0 + ((x1 - x0) * i) / 12, y);
    await s.page.mouse.up();
  } else {
    const at = (x: number) => [{ x, y, id: 1 }];
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(x0) });
    for (let i = 1; i <= 12; i += 1) {
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(x0 + ((x1 - x0) * i) / 12) });
      await s.page.waitForTimeout(16);
    }
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await s.page.waitForTimeout(2500);
}

/**
 * The oven's opening as the page built it, and under it each box and the front
 * the scene draws on it: "strip" (a fixed panel), "door" (a drawer front), or
 * none.
 */
const built = (s: Session) =>
  s.page.evaluate(() => {
    type Box = { id: string; slot?: string; kind: string; position: number[]; size: number[] };
    type Node = { children: Node[]; name?: string; getObjectByName?: (n: string) => Node | undefined };
    const w = window as unknown as {
      __room: () => { slots: Record<string, { position: number[] }>; cabinets: Box[] };
      __scenes?: Node[];
    };
    const room = w.__room();
    const names = new Set<string>();
    const walk = (node: Node) => {
      if (node.name) names.add(node.name);
      node.children.forEach(walk);
    };
    for (const scene of w.__scenes ?? []) walk(scene);
    const inch = (feet: number) => Math.round(feet * 12 * 1000) / 1000;
    const sill = inch(room.slots["slot-oven"]?.position?.[1] ?? NaN);
    const under = room.cabinets
      .filter((box) => box.slot === "slot-oven" && box.kind === "base")
      .sort((a, b) => a.position[1] - b.position[1])
      .map((box) => ({
        heightIn: inch(box.size[1]),
        front: names.has(`strip-${box.id}`) ? "strip" : names.has(`door-${box.id}`) ? "door" : "none",
      }));
    return { sill, under };
  });

describe("D's oven height in Layout", () => {
  it("on a desktop with the mouse, D's L: both ends, then the four ovens from the card", async () => {
    const s = await open(false);
    await choose(s, "package", "package-d");
    await layoutTab(s, "en");
    const w = WORDS.en;

    const start = await slider(s, w.slider);
    expect(start && { min: start.min, max: start.max, value: start.value, caption: start.caption }).toEqual({
      min: 5,
      max: 18,
      value: 12,
      caption: 'Opening starts 12" off the floor; lower handle at 34"',
    });
    expect(await built(s)).toEqual({ sill: 12, under: [{ heightIn: 8, front: "door" }] });
    expect(await slider(s, w.microwave)).toBeNull();

    await dragToEnd(s, start!.input, "min");
    const low = await slider(s, w.slider);
    expect({ value: low!.value, figure: low!.figure, caption: low!.caption }).toEqual({
      value: 5,
      figure: '5"',
      caption: 'Opening starts 5" off the floor; lower handle at 27"',
    });
    expect(await built(s)).toEqual({ sill: 5, under: [{ heightIn: 1, front: "strip" }] });

    await dragToEnd(s, low!.input, "max");
    const high = await slider(s, w.slider);
    expect({ value: high!.value, caption: high!.caption }).toEqual({
      value: 18,
      caption: 'Opening starts 18" off the floor; lower handle at 40"',
    });
    expect(await built(s)).toEqual({ sill: 18, under: [{ heightIn: 7, front: "door" }, { heightIn: 7, front: "door" }] });

    // The four ovens from the model card, the oven's label pressed to open it.
    const seen: Record<string, unknown> = {};
    for (const [model, name] of [
      ["thermador-po302w", "PO302W"],
      ["thermador-me301yp", "ME301YP"],
      ["thermador-mem301ws", "MEM301WS"],
      ["thermador-pods302b", "PODS302B"],
    ] as const) {
      if ((await s.page.locator("[data-model-card]").filter({ visible: true }).count()) === 0) {
        await press(s, s.page.locator('[data-pin-label="slot-oven"]').first());
      }
      await press(s, s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first());
      await s.page.waitForTimeout(1500);
      await layoutTab(s, "en");
      const now = await slider(s, w.slider);
      seen[name] = now && {
        max: now.max,
        value: now.value,
        caption: now.caption,
        bold: now.bold,
        microwaveSlider: (await slider(s, w.microwave)) !== null,
        room: await built(s),
      };
    }
    expect(seen).toEqual({
      PO302W: {
        max: 14,
        value: 14,
        caption: 'Opening starts 14" off the floor; lower handle at 36"',
        bold: true,
        microwaveSlider: false,
        room: { sill: 14, under: [{ heightIn: 10, front: "door" }] },
      },
      ME301YP: {
        max: 18,
        value: 18,
        caption: 'Opening starts 18" off the floor',
        bold: false,
        microwaveSlider: false,
        room: { sill: 18, under: [{ heightIn: 7, front: "door" }, { heightIn: 7, front: "door" }] },
      },
      MEM301WS: {
        max: 18,
        value: 18,
        caption: 'Opening starts 18" off the floor; microwave handle at 57"',
        bold: false,
        microwaveSlider: false,
        room: { sill: 18, under: [{ heightIn: 7, front: "door" }, { heightIn: 7, front: "door" }] },
      },
      PODS302B: {
        max: 18,
        value: 18,
        caption: 'Opening starts 18" off the floor; lower handle at 40"',
        bold: false,
        microwaveSlider: false,
        room: { sill: 18, under: [{ heightIn: 7, front: "door" }, { heightIn: 7, front: "door" }] },
      },
    });
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });

  it("on a phone with a finger, D's U in Chinese: the slider to its low end", async () => {
    const s = await open(true);
    await press(s, button(s, "中"));
    await choose(s, "package", "package-d");
    await choose(s, "shape", "U");
    await layoutTab(s, "zh");
    const w = WORDS.zh;
    const start = await slider(s, w.slider);
    expect(start && { min: start.min, max: start.max, value: start.value, caption: start.caption }).toEqual({
      min: 5,
      max: 18,
      value: 12,
      caption: "切口底离地 12″，下门把手在 34″",
    });
    // One line each, the name and the caption, at 390 (the plan's section 6).
    const lineHeight = async (locator: Locator) =>
      locator.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    expect(await lineHeight(start!.label.locator("span.mt-1"))).toBe(1);

    await dragToEnd(s, start!.input, "min");
    const low = await slider(s, w.slider);
    expect({ value: low!.value, caption: low!.caption }).toEqual({ value: 5, caption: "切口底离地 5″，下门把手在 27″" });
    expect(await built(s)).toEqual({ sill: 5, under: [{ heightIn: 1, front: "strip" }] });
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });
});

describe("B and E keep their microwave handle", () => {
  it("on a desktop with the mouse: B and E show the microwave handle and no oven height", async () => {
    const s = await open(false);
    const seen: Record<string, unknown> = {};
    for (const pkg of ["package-b", "package-e"]) {
      await choose(s, "package", pkg);
      await layoutTab(s, "en");
      seen[pkg] = {
        microwave: (await slider(s, WORDS.en.microwave))?.caption ?? null,
        oven: (await slider(s, WORDS.en.slider)) !== null,
      };
    }
    expect(seen).toEqual({
      "package-b": { microwave: 'Opening starts 15" off the floor; handle at 54"', oven: false },
      "package-e": { microwave: 'Opening starts 15" off the floor; handle at 54"', oven: false },
    });
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });
});
