import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The model card at the left of the scene, on a desktop (round 88).
 *
 * Leo, round 87, from use: on a desktop the card filled the lower half of the
 * scene, over the machine it is about, so a model changed on it could not be
 * seen changing. From 768px up it now sits over the scene's top left corner,
 * 16px in from the left and the top, 260px wide — the list rail's width — and
 * takes no column, so the canvas and the camera are as they were and D1 is not
 * changed. It is as tall as what it holds and never past the scene's bottom
 * less 16px; past that it scrolls inside itself. With the list rail open it
 * does not show, so the models are in one place at a time. docs/decisions.md
 * D12, round 88.
 *
 * Desktop only, the mouse throughout (D17). The phone is unchanged and
 * `modelCard.test.ts` holds it.
 *
 * Where a machine stands on screen is read from the scene itself: a hook
 * installed before the page's own scripts (three.js's devtools announcement)
 * keeps the scene and the camera of the last render, and the machine's meshes
 * are projected through that camera — the same projection the pins use.
 */

const DESKTOP = { width: 1440, height: 900 };
const PACKAGES = ["A", "B", "C", "D", "E"];
const MACHINES: Record<string, number> = { A: 6, B: 6, C: 6, D: 10, E: 8 };
/** Leo, round 88: 16px in from the scene's left and top, 260px wide. */
const INSET = 16;
const CARD_WIDTH = 260;

const EXPECTED_TESTS = 13;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} side-card tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

interface Session {
  page: Page;
  errors: string[];
}

async function open(viewport = DESKTOP): Promise<Session> {
  const context = await browser.newContext({ viewport });
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
      const renderer = (event as CustomEvent).detail as {
        isWebGLRenderer?: boolean;
        domElement?: HTMLCanvasElement;
        render?: (scene: unknown, camera: unknown) => void;
      };
      if (!renderer.isWebGLRenderer || !renderer.render) return;
      const own = renderer.render.bind(renderer);
      renderer.render = (scene, camera) => {
        (window as unknown as { __view: unknown }).__view = { scene, camera, canvas: renderer.domElement };
        own(scene, camera);
      };
    });
  });
  await page.goto(PREVIEW_URL + "?quality=high", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2000);
  return { page, errors };
}

async function press(s: Session, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

const button = (s: Session, name: string | RegExp) =>
  s.page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true }).first();

/** The list rail's handle: the folded rail, or the strip at the foot of the open one. */
const rail = (s: Session) => s.page.locator('button[data-rail="left"]').first();

async function toggleRail(s: Session) {
  await press(s, rail(s));
  await s.page.waitForTimeout(600);
}

async function switchTo(s: Session, pkg: string) {
  if (pkg === "A") return;
  await press(s, button(s, pkg));
  await s.page.waitForTimeout(2500);
}

/** The list rail's row for a machine, by its name in the list. */
const row = (s: Session, name: string) => s.page.locator('[data-panel="list"] ul li button', { hasText: name }).first();

/** Until the camera has stopped moving: its pose read twice the same. */
async function settle(s: Session) {
  const pose = () =>
    s.page.evaluate(() => {
      const view = (window as unknown as { __view?: { camera: { matrixWorld: { elements: number[] }; zoom: number } } })
        .__view;
      return view ? [...view.camera.matrixWorld.elements, view.camera.zoom].map((n) => n.toFixed(4)).join(",") : "";
    });
  let last = "";
  for (let i = 0; i < 40; i += 1) {
    await s.page.waitForTimeout(250);
    const now = await pose();
    if (now && now === last) return;
    last = now;
  }
}

const cardVisible = (s: Session) =>
  s.page.evaluate(() => {
    const card = document.querySelector<HTMLElement>("[data-model-card]");
    return !!card && card.getClientRects().length > 0;
  });

interface Placement {
  slot: string | null;
  /** The card against the scene (the `main` the canvas fills), in px. */
  left: number;
  top: number;
  width: number;
  /** From the card's foot to the scene's. */
  belowFoot: number;
  height: number;
  sceneHeight: number;
  cardRight: number;
  /** The machine's left edge on screen, in the page's px; null if no mesh was found. */
  machineLeft: number | null;
}

/** Where the card is, and where the selected machine stands on screen. */
const placement = (s: Session) =>
  s.page.evaluate((): Placement | null => {
    type V3 = { clone(): V3; set(x: number, y: number, z: number): V3; applyMatrix4(m: unknown): V3; project(c: unknown): V3; x: number };
    type Node = {
      visible: boolean;
      isMesh?: boolean;
      children: Node[];
      matrixWorld: unknown;
      geometry?: { boundingBox: { min: V3 & { y: number; z: number }; max: V3 & { y: number; z: number } } | null; computeBoundingBox(): void };
      getObjectByName?: (name: string) => Node | undefined;
    };
    const card = document.querySelector<HTMLElement>("[data-model-card]");
    if (!card || card.getClientRects().length === 0) return null;
    const slot = card.getAttribute("data-model-card");
    const scene = document.querySelector("main")!.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const view = (window as unknown as { __view?: { scene: Node; camera: unknown; canvas: HTMLCanvasElement } }).__view;
    let machineLeft: number | null = null;
    const body = view?.scene.getObjectByName?.(`appliance-body-${slot}`);
    if (view && body) {
      const canvas = view.canvas.getBoundingClientRect();
      const walk = (node: Node) => {
        if (!node.visible) return;
        if (node.isMesh && node.geometry) {
          node.geometry.computeBoundingBox();
          const b = node.geometry.boundingBox!;
          for (const x of [b.min.x, b.max.x]) {
            for (const y of [b.min.y, b.max.y]) {
              for (const z of [b.min.z, b.max.z]) {
                const p = b.min.clone().set(x, y, z).applyMatrix4(node.matrixWorld).project(view.camera);
                const px = canvas.left + (p.x * 0.5 + 0.5) * canvas.width;
                machineLeft = machineLeft === null ? px : Math.min(machineLeft, px);
              }
            }
          }
        }
        node.children.forEach(walk);
      };
      walk(body);
    }
    return {
      slot,
      left: c.left - scene.left,
      top: c.top - scene.top,
      width: c.width,
      belowFoot: scene.bottom - c.bottom,
      height: c.height,
      sceneHeight: scene.height,
      cardRight: c.right,
      machineLeft,
    };
  });

const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;

describe("the model card at the left of the scene, on a desktop", () => {
  for (const pkg of PACKAGES) {
    it(`sits 16px in at the top left, 260px wide, inside the scene and clear of the machine, for every machine in package ${pkg}`, async () => {
      const s = await open();
      await switchTo(s, pkg);
      await toggleRail(s);
      const rows = await s.page.locator('[data-panel="list"] ul li button').count();
      const misplaced: string[] = [];
      const pastFoot: string[] = [];
      const covered: string[] = [];
      let measured = 0;
      for (let i = 0; i < rows; i += 1) {
        await press(s, s.page.locator('[data-panel="list"] ul li button').nth(i));
        await s.page.waitForTimeout(400);
        await toggleRail(s);
        await settle(s);
        const p = await placement(s);
        if (!p) {
          misplaced.push(`#${i + 1}: no card`);
        } else {
          measured += 1;
          const at = `#${i + 1} ${p.slot}`;
          if (!near(p.left, INSET) || !near(p.top, INSET) || !near(p.width, CARD_WIDTH)) {
            misplaced.push(`${at}: left ${p.left.toFixed(1)}, top ${p.top.toFixed(1)}, width ${p.width.toFixed(1)}`);
          }
          if (p.belowFoot < INSET - 0.5) pastFoot.push(`${at}: ${p.belowFoot.toFixed(1)}px above the foot`);
          if (p.machineLeft === null || p.machineLeft <= p.cardRight) {
            covered.push(`${at}: machine's left edge ${p.machineLeft?.toFixed(1) ?? "not found"}, card's right ${p.cardRight.toFixed(1)}`);
          }
        }
        await toggleRail(s);
        await press(s, button(s, /All appliances/));
        await s.page.waitForTimeout(400);
      }
      expect({ measured, misplaced, pastFoot, covered, errors: s.errors }).toEqual({
        measured: MACHINES[pkg],
        misplaced: [],
        pastFoot: [],
        covered: [],
        errors: [],
      });
      await s.page.context().close();
    });
  }

  it("is as tall as what it holds: E's coffee machine, one model, below B's hood, six, and well clear of the foot", async () => {
    const s = await open();
    const read = async (pkg: string, machine: string) => {
      await switchTo(s, pkg);
      await toggleRail(s);
      await press(s, row(s, machine));
      await s.page.waitForTimeout(400);
      await toggleRail(s);
      await settle(s);
      const p = (await placement(s))!;
      const models = await s.page.locator('[data-model-card] [data-candidate][data-fits="true"]').count();
      await toggleRail(s);
      await press(s, button(s, /All appliances/));
      await toggleRail(s);
      return { ...p, models };
    };
    const hood = await read("B", "Ventilation hood");
    const coffee = await read("E", "Coffee machine");
    expect({
      hoodModels: hood.models,
      coffeeModels: coffee.models,
      coffeeShorter: coffee.height < hood.height,
      // "Clearly above the foot": at least a third of the scene left under it.
      coffeeWellClear: coffee.belowFoot > coffee.sceneHeight / 3,
      errors: s.errors,
    }).toEqual({ hoodModels: 6, coffeeModels: 1, coffeeShorter: true, coffeeWellClear: true, errors: [] });
    await s.page.context().close();
  });

  // A's microwave drawer with its five refused models open is the tallest card
  // there is: 756-1/2px, measured in round 88 at 1440 x 900, where the scene is
  // 844px and the card ends 71px above its foot, so there it has nothing to
  // scroll. On a 1366 x 768 laptop the scene is 712px and the card is held at
  // 680px and scrolls. Both are held.
  it("stays inside the scene with A's microwave drawer's refused models open, at 1440 x 900", async () => {
    const s = await open();
    await toggleRail(s);
    await press(s, row(s, "Microwave"));
    await s.page.waitForTimeout(400);
    await toggleRail(s);
    await settle(s);
    await press(s, s.page.locator("[data-model-card] [data-card-refused-toggle]"));
    await s.page.waitForTimeout(400);
    const refused = await s.page.locator('[data-model-card] [data-candidate][data-fits="false"]').count();
    const p = (await placement(s))!;
    expect({ refused, top: p.top, insideScene: p.belowFoot >= INSET - 0.5, errors: s.errors }).toEqual({
      refused: 5,
      top: INSET,
      insideScene: true,
      errors: [],
    });
    await s.page.context().close();
  });

  it("stops 16px above the scene's foot and scrolls inside itself when that is not room enough, at 1366 x 768", async () => {
    const s = await open({ width: 1366, height: 768 });
    await toggleRail(s);
    await press(s, row(s, "Microwave"));
    await s.page.waitForTimeout(400);
    await toggleRail(s);
    await settle(s);
    await press(s, s.page.locator("[data-model-card] [data-card-refused-toggle]"));
    await s.page.waitForTimeout(400);
    const refused = await s.page.locator('[data-model-card] [data-candidate][data-fits="false"]').count();
    const p = (await placement(s))!;
    const scroller = await s.page.evaluate(() => {
      const list = document.querySelector<HTMLElement>("[data-model-card] [data-card-scroll]");
      if (!list) return null;
      const overflows = list.scrollHeight > list.clientHeight + 1;
      list.scrollTop = list.scrollHeight;
      const chips = [...list.querySelectorAll<HTMLElement>("[data-candidate]")];
      const last = chips[chips.length - 1].getBoundingClientRect();
      const box = list.getBoundingClientRect();
      return { overflows, lastInView: last.bottom <= box.bottom + 0.5 && last.top >= box.top - 0.5 };
    });
    expect({ refused, belowFoot: Math.round(p.belowFoot), scroller, errors: s.errors }).toEqual({
      refused: 5,
      belowFoot: INSET,
      scroller: { overflows: true, lastInView: true },
      errors: [],
    });
    await s.page.context().close();
  });

  it("goes while the list rail is open, and comes back with the same machine when it folds", async () => {
    const s = await open();
    await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
    await settle(s);
    const before = await s.page.getAttribute("[data-model-card]", "data-model-card");
    const named = () => s.page.locator("[data-model-card] [data-model-line]").first().innerText();
    const nameBefore = await named();
    await press(s, button(s, "Appliances"));
    await s.page.waitForTimeout(800);
    const whileOpen = await cardVisible(s);
    const listShowsIt = await s.page.locator("aside [data-candidate]").count();
    await toggleRail(s);
    await s.page.waitForTimeout(400);
    const after = await s.page.getAttribute("[data-model-card]", "data-model-card");
    expect({
      before,
      whileOpen,
      listShowsIt: listShowsIt > 0,
      after,
      sameModel: (await named()) === nameBefore,
      errors: s.errors,
    }).toEqual({ before: "slot-hood", whileOpen: false, listShowsIt: true, after: "slot-hood", sameModel: true, errors: [] });
    await s.page.context().close();
  });

  it("opens the list rail from Details in the list ›, and the card goes", async () => {
    const s = await open();
    await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
    await settle(s);
    await press(s, s.page.locator("[data-model-card]").getByRole("button", { name: /Details in the list/ }));
    await s.page.waitForTimeout(800);
    expect({
      railOpen: (await s.page.locator('aside [data-candidate]').count()) > 0,
      cardShown: await cardVisible(s),
      errors: s.errors,
    }).toEqual({ railOpen: true, cardShown: false, errors: [] });
    await s.page.context().close();
  });

  for (const lang of ["EN", "中"]) {
    it(`keeps every row of the card on its own line, and brand · model to round 82's rule, every machine, ${lang}`, async () => {
      const s = await open();
      await press(s, button(s, lang));
      await s.page.waitForTimeout(500);
      const broken: string[] = [];
      let read = 0;
      for (const pkg of PACKAGES) {
        await switchTo(s, pkg);
        await toggleRail(s);
        const rows = await s.page.locator('[data-panel="list"] ul li button').count();
        for (let i = 0; i < rows; i += 1) {
          await press(s, s.page.locator('[data-panel="list"] ul li button').nth(i));
          await s.page.waitForTimeout(300);
          await toggleRail(s);
          broken.push(...(await rowFaults(s)).map((fault) => `${pkg} #${i + 1}: ${fault}`));
          read += 1;
          await toggleRail(s);
          await press(s, button(s, /All appliances|全部家电/));
          await s.page.waitForTimeout(300);
        }
        await toggleRail(s);
      }
      // And with the card narrowed, in the test only, until the brand has to
      // give way: the model is still whole and the width drops to a line of its own.
      await toggleRail(s);
      await press(s, s.page.locator('[data-panel="list"] ul li button').first());
      await s.page.waitForTimeout(300);
      await toggleRail(s);
      const narrowed = await s.page.evaluate(() => {
        const card = document.querySelector<HTMLElement>("[data-model-card]")!;
        card.style.width = "170px";
        const line = card.querySelector<HTMLElement>("[data-card-model] [data-model-line]")!;
        const brand = line.querySelector<HTMLElement>("[data-model-brand]")!;
        const model = line.querySelector<HTMLElement>("[data-model-model]")!;
        const width = card.querySelector<HTMLElement>("[data-card-width]")!;
        return {
          modelCut: model.scrollWidth > model.clientWidth + 0.5 || model.getBoundingClientRect().right > card.getBoundingClientRect().right,
          brandGaveWay: brand.scrollWidth > brand.clientWidth + 0.5,
          widthOwnLine: width.getBoundingClientRect().top >= model.getBoundingClientRect().bottom - 0.5,
        };
      });
      expect({ read, broken, narrowed, errors: s.errors }).toEqual({
        read: 36,
        broken: [],
        narrowed: { modelCut: false, brandGaveWay: true, widthOwnLine: true },
        errors: [],
      });
      await s.page.context().close();
    });
  }

  it("moves no camera when it goes and comes back (D1): the pins stand where they did", async () => {
    const s = await open();
    const dots = () =>
      s.page.$$eval("[data-pin-dot]", (els) => els.map((el) => (el as HTMLElement).style.transform).join("|"));
    const labels = () =>
      s.page.$$eval("[data-pin-label]", (els) => els.map((el) => (el as HTMLElement).style.transform).join("|"));
    await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
    await settle(s);
    await s.page.waitForTimeout(800);
    const dots0 = await dots();
    const labels0 = await labels();
    // The list rail: the card goes, and comes back when the rail folds.
    await press(s, button(s, "Appliances"));
    await s.page.waitForTimeout(800);
    const goneWithRail = !(await cardVisible(s));
    await toggleRail(s);
    await s.page.waitForTimeout(1200);
    const backAfterRail = await cardVisible(s);
    const dots1 = await dots();
    const labels1 = await labels();
    // Closed: the card goes and nothing else.
    await press(s, s.page.locator("[data-model-card]").getByRole("button", { name: "Close", exact: true }));
    await s.page.waitForTimeout(1200);
    const dots2 = await dots();
    // eslint-disable-next-line no-console
    console.log(`labels after the rail round trip: ${labels0 === labels1 ? "byte-identical" : "moved"}`);
    expect({
      goneWithRail,
      backAfterRail,
      sameAfterRail: dots1 === dots0,
      sameAfterClose: dots2 === dots0,
      dotsRead: dots0.split("|").length > 4,
      errors: s.errors,
    }).toEqual({ goneWithRail: true, backAfterRail: true, sameAfterRail: true, sameAfterClose: true, dotsRead: true, errors: [] });
    await s.page.context().close();
  });
});

/**
 * What is wrong with the card's rows as laid out: each row on one line, the
 * close button on the title's line, the model whole, the width beside it or on
 * a line of its own and whole.
 */
async function rowFaults(s: Session): Promise<string[]> {
  return s.page.evaluate(() => {
    const card = document.querySelector<HTMLElement>("[data-model-card]");
    if (!card || card.getClientRects().length === 0) return ["no card"];
    /**
     * How many lines the text in `el` takes: its boxes grouped by where they
     * overlap down the page. Not by their tops — in a flex row the arrow after
     * "View specs" sits a few px off the text on the same line, and the first
     * version of this counted it as a second line (round 88). With a wrap
     * forced on purpose in the browser, this counted 3 and 4 lines.
     */
    const lines = (el: HTMLElement | null) => {
      if (!el) return 0;
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5).sort((a, b) => a.top - b.top);
      let count = 0;
      let bottom = -Infinity;
      for (const r of rects) {
        if (r.top >= bottom - 1) {
          count += 1;
          bottom = r.bottom;
        } else bottom = Math.max(bottom, r.bottom);
      }
      return count;
    };
    const faults: string[] = [];
    const one = (selector: string, what: string) => {
      const el = card.querySelector<HTMLElement>(selector);
      if (!el) faults.push(`no ${what}`);
      else if (lines(el) !== 1) faults.push(`${what} on ${lines(el)} lines: ${el.innerText.replace(/\s+/g, " ")}`);
    };
    one("[data-card-title]", "title");
    one("[data-card-specs]", "View specs");
    one("[data-card-models-label]", "models label");
    one("[data-card-details]", "Details");
    const title = card.querySelector<HTMLElement>("[data-card-title]");
    const close = card.querySelector<HTMLElement>("[data-card-close]");
    if (title && close) {
      const t = title.getBoundingClientRect();
      const c = close.getBoundingClientRect();
      if (c.bottom < t.top || c.top > t.bottom) faults.push("close not on the title's line");
    }
    const line = card.querySelector<HTMLElement>("[data-card-model] [data-model-line]");
    const model = line?.querySelector<HTMLElement>("[data-model-model]");
    const width = card.querySelector<HTMLElement>("[data-card-width]");
    if (!line || !model || !width) faults.push("no brand · model or width");
    else {
      if (model.scrollWidth > model.clientWidth + 0.5 || lines(model) !== 1) faults.push(`model cut: ${line.innerText}`);
      if (width.scrollWidth > width.clientWidth + 0.5 || lines(width) !== 1) faults.push(`width cut: ${width.innerText}`);
      const m = model.getBoundingClientRect();
      const w = width.getBoundingClientRect();
      const besideIt = Math.abs(w.top - m.top) < m.height && w.left >= m.right - 0.5;
      const ownLine = w.top >= m.bottom - 0.5;
      if (!besideIt && !ownLine) faults.push(`width neither beside the model nor on its own line: ${width.innerText}`);
    }
    return faults;
  });
}
