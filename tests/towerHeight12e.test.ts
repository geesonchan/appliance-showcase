import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type CDPSession, type Locator, type Page } from "playwright";
import { openWatched } from "../scripts/pageWatch.mjs";
import { PREVIEW_URL } from "./globalSetup";
import { launchBrowser } from "./siteBrowser";
import { swipeIntoRow } from "./swipeIntoRow";

/**
 * Item 12e, one rule for every oven tower (Leo, 2026-11-18: 「烤箱有微波门就调微波把手，没有微波门就调切口底」;
 * docs/plans/item12e-plan.md), as a customer does it: the four ovens chosen in turn from the model card,
 * by the mouse on a desktop and a finger on a phone (D17), and the slider in Layout read after each —
 * which one, its figure, its ends, its caption, bold when held. The height is handed over (Leo, 1):
 * B's oven stays at 15" whichever oven goes in, PO302W held at 14" by its own sheet. D's L with
 * MEM301WS shows the microwave handle (Leo, 4).
 *
 * The helpers are tests/underOven12d.test.ts's (12b's), with the card added.
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
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} tower-height tests actually ran`).toBe(EXPECTED_TESTS);
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
    label: `towerHeight12e · ${expect.getState().currentTestName ?? ""}`,
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

/** An oven from the model card: on a desktop its label pressed; on a phone from the Appliances list, the cell swiped into the card. */
async function chooseOven(s: Session, slot: string, id: string, lang: "en" | "zh") {
  if (s.phone) {
    const list = lang === "zh" ? "家电" : "Appliances";
    const close = lang === "zh" ? "关闭" : "Close";
    await press(s, button(s, list));
    const rows = s.page.locator("[data-sheet] ul").first().locator("li > button");
    const n = await rows.count();
    for (let i = 0; i < n; i += 1) {
      if (/烤箱|[Oo]ven/.test(await rows.nth(i).innerText())) {
        await press(s, rows.nth(i));
        break;
      }
    }
    await press(s, s.page.locator("[data-sheet]").getByRole("button", { name: close, exact: true }).filter({ visible: true }).first());
    await s.page.waitForTimeout(1500);
    const cell = s.page.locator(`[data-model-card] [data-candidate="${id}"]`).first();
    await swipeIntoRow(s.page, cell);
    await press(s, cell);
  } else {
    if ((await s.page.locator("[data-model-card]").filter({ visible: true }).count()) === 0) {
      await press(s, s.page.locator(`[data-pin-label="${slot}"]`).filter({ visible: true }).first());
    }
    await press(s, s.page.locator(`[data-model-card] [data-candidate="${id}"]`).first());
  }
  await s.page.waitForTimeout(2500);
}

/** Which slider the tower has in Layout, read as a customer reads it. */
async function towerSlider(s: Session, lang: "en" | "zh") {
  await layoutTab(s, lang);
  const w = WORDS[lang];
  const handle = await slider(s, w.microwave);
  const height = await slider(s, w.slider);
  const one = handle ?? height;
  const out = one && { slider: handle ? w.microwave : w.slider, value: one.value, min: one.min, max: one.max, caption: one.caption, bold: one.bold, both: !!handle && !!height };
  if (s.phone) await press(s, button(s, w.close));
  return out;
}

const CYCLE = [
  ["thermador-po302w", { slider: "Oven height", value: 14, min: 5, max: 14, caption: 'Opening starts 14″ off the floor; lower handle at 36″', bold: true, both: false }, 14],
  ["thermador-me301yp", { slider: "Oven height", value: 15, min: 5, max: 18, caption: 'Opening starts 15″ off the floor', bold: false, both: false }, 15],
  ["thermador-pods302b", { slider: "Oven height", value: 15, min: 5, max: 18, caption: 'Opening starts 15″ off the floor; lower handle at 37″', bold: false, both: false }, 15],
  ["thermador-mem301ws", { slider: "Microwave handle", value: 54, min: 44, max: 60, caption: 'Opening starts 15″ off the floor; handle at 54″', bold: false, both: false }, 15],
] as const;
const ZH: Record<string, string> = {
  "Oven height": "烤箱离地高度",
  "Microwave handle": "微波把手高度",
  'Opening starts 14″ off the floor; lower handle at 36″': "切口底离地 14″，下门把手在 36″",
  'Opening starts 15″ off the floor': "切口底离地 15″",
  'Opening starts 15″ off the floor; lower handle at 37″': "切口底离地 15″，下门把手在 37″",
  'Opening starts 15″ off the floor; handle at 54″': "切口底离地 15″，把手在 54″",
};

describe("the four ovens in turn: the height handed over, the slider by the oven", () => {
  for (const phone of [false, true]) {
    it(phone ? "on a phone with a finger, B's L in Chinese" : "on a desktop with the mouse, B's L in English", async () => {
      const s = await open(phone);
      const lang = phone ? "zh" : "en";
      if (phone) await press(s, button(s, "中"));
      await choose(s, "package", "package-b");
      const seen: unknown[] = [{ start: await towerSlider(s, lang), sill: (await built(s, "slot-microwave")).sill }];
      for (const [id] of CYCLE) {
        await chooseOven(s, "slot-microwave", id, lang);
        seen.push({ oven: id, slider: await towerSlider(s, lang), sill: (await built(s, "slot-microwave")).sill });
      }
      const say = (x: { slider: string; caption: string }) => (phone ? { ...x, slider: ZH[x.slider], caption: ZH[x.caption] } : x);
      expect(seen).toEqual([
        { start: say(CYCLE[3][1]), sill: 15 },
        ...CYCLE.map(([id, slider, sill]) => ({ oven: id, slider: say(slider), sill })),
      ]);
      expect(s.errors).toEqual([]);
      await s.page.context().close();
    });
  }

  it("on a desktop with the mouse, D's L: MEM301WS on its microwave handle, PODS302B back on the oven height", async () => {
    const s = await open(false);
    await choose(s, "package", "package-d");
    await chooseOven(s, "slot-oven", "thermador-mem301ws", "en");
    const mem = await towerSlider(s, "en");
    const memSill = (await built(s, "slot-oven")).sill;
    await chooseOven(s, "slot-oven", "thermador-pods302b", "en");
    const pods = await towerSlider(s, "en");
    expect({ mem, memSill, pods, podsSill: (await built(s, "slot-oven")).sill }).toEqual({
      mem: { slider: "Microwave handle", value: 51, min: 44, max: 60, caption: 'Opening starts 12″ off the floor; handle at 51″', bold: false, both: false },
      memSill: 12,
      pods: { slider: "Oven height", value: 12, min: 5, max: 18, caption: 'Opening starts 12″ off the floor; lower handle at 34″', bold: false, both: false },
      podsSill: 12,
    });
    expect(s.errors).toEqual([]);
    await s.page.context().close();
  });
});
