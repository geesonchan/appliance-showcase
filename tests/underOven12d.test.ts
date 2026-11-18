import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type CDPSession, type Locator, type Page } from "playwright";
import { openWatched } from "../scripts/pageWatch.mjs";
import { PREVIEW_URL } from "./globalSetup";
import { launchBrowser } from "./siteBrowser";

/**
 * Item 12d, under the oven in B's and E's towers and D's on one wall (Leo,
 * 2026-11-17: 「12d：B、E、一字型的 D（都照搬 D 的规矩）」; docs/plans/item12d-plan.md),
 * as a customer does it: the package, the shape, the Layout tab and the
 * microwave handle's slider, with the mouse on a desktop and a finger on a
 * phone (D17). Under the opening a fixed panel under 6", one drawer to under
 * 12", two from 12" (12b's rule, in the same place), each drawn as the
 * scene's own `strip-` or `door-` group of the box; until 12d a box of 6" or
 * less here was drawn with no front at all. At the default 54" one 11" drawer,
 * as it always was.
 *
 * The helpers are tests/steamSill.test.ts's (12b), the tower's slot a parameter,
 * and only the tower's own boxes: B's island cabinet opposite its oven carries
 * the oven's slot too (`island-behind-microwave`).
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
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} under-the-oven tests actually ran`).toBe(EXPECTED_TESTS);
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
    label: `underOven12d · ${expect.getState().currentTestName ?? ""}`,
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
const built = (s: Session, slot: string) =>
  s.page.evaluate((slot) => {
    type Box = { id: string; slot?: string; kind: string; position: number[]; size: number[]; module?: { kind?: string } };
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
    const sill = inch(room.slots[slot]?.position?.[1] ?? NaN);
    const under = room.cabinets
      .filter((box) => box.slot === slot && box.kind === "base" && box.module?.kind === "tall")
      .sort((a, b) => a.position[1] - b.position[1])
      .map((box) => ({
        heightIn: inch(box.size[1]),
        front: names.has(`strip-${box.id}`) ? "strip" : names.has(`door-${box.id}`) ? "door" : "none",
      }));
    return { sill, under };
  }, slot);

describe("under the oven in the towers hung from the microwave handle", () => {
  it("on a desktop with the mouse: B's L at both ends of the handle, then E's at its low end", async () => {
    const s = await open(false);
    const w = WORDS.en;
    await choose(s, "package", "package-b");
    await layoutTab(s, "en");
    const start = await slider(s, w.microwave);
    expect(start && { min: start.min, max: start.max, value: start.value }).toEqual({ min: 44, max: 60, value: 54 });
    expect(await built(s, "slot-microwave")).toEqual({ sill: 15, under: [{ heightIn: 11, front: "door" }] });

    await dragToEnd(s, start!.input, "min");
    expect((await slider(s, w.microwave))!.value).toBe(44);
    expect(await built(s, "slot-microwave")).toEqual({ sill: 5, under: [{ heightIn: 1, front: "strip" }] });

    await dragToEnd(s, (await slider(s, w.microwave))!.input, "max");
    expect((await slider(s, w.microwave))!.value).toBe(60);
    expect(await built(s, "slot-microwave")).toEqual({ sill: 18, under: [{ heightIn: 7, front: "door" }, { heightIn: 7, front: "door" }] });

    await choose(s, "package", "package-e");
    await layoutTab(s, "en");
    await dragToEnd(s, (await slider(s, w.microwave))!.input, "min");
    expect(await built(s, "slot-microwave")).toEqual({ sill: 5, under: [{ heightIn: 1, front: "strip" }] });
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });

  it("on a phone with a finger, D on one wall in Chinese: the handle to its low end", async () => {
    const s = await open(true);
    await press(s, button(s, "中"));
    await choose(s, "package", "package-d");
    await choose(s, "shape", "one-wall");
    await layoutTab(s, "zh");
    const start = await slider(s, WORDS.zh.microwave);
    expect(start && { min: start.min, value: start.value }).toEqual({ min: 44, value: 54 });
    expect(await built(s, "slot-oven")).toEqual({ sill: 15, under: [{ heightIn: 11, front: "door" }] });
    await dragToEnd(s, start!.input, "min");
    expect((await slider(s, WORDS.zh.microwave))!.value).toBe(44);
    expect(await built(s, "slot-oven")).toEqual({ sill: 5, under: [{ heightIn: 1, front: "strip" }] });
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });

  it("on a desktop with the mouse: D's L and U, hung from the oven height, not moved by anything here", async () => {
    const s = await open(false);
    await choose(s, "package", "package-d");
    const seen: Record<string, unknown> = {};
    for (const shape of ["L", "U"]) {
      await choose(s, "shape", shape);
      await layoutTab(s, "en");
      seen[shape] = {
        microwave: (await slider(s, WORDS.en.microwave)) !== null,
        oven: (await slider(s, WORDS.en.slider))?.value ?? null,
        room: await built(s, "slot-oven"),
      };
    }
    expect(seen).toEqual({
      L: { microwave: false, oven: 12, room: { sill: 12, under: [{ heightIn: 8, front: "door" }] } },
      U: { microwave: false, oven: 12, room: { sill: 12, under: [{ heightIn: 8, front: "door" }] } },
    });
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });
});
