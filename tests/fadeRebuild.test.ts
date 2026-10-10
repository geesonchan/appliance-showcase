import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 81: a room rebuilt while cabinets are faded draws none of them solid.
 *
 * Round 80 measured it (Open items): with the hood selected, flown to and the
 * camera turned until cabinets stand on the sight line, changing the hood drew
 * those cabinets solid for the new room's first three renders. Round 81 proved
 * the two causes by experiment — the fade waited for its fourth frame, and on
 * the first frame the new room's positions had not been worked out yet — and
 * this file is the round-80 probe turned into a test.
 *
 * How it looks, from outside the app: three.js announces its renderer and its
 * scenes to a devtools hook, and the hook installed here wraps them. After
 * every render it records which cabinet boxes were drawn faded, so what is
 * counted is what was drawn, frame by frame; and it counts every
 * `scene.updateMatrixWorld()` called from outside a render, which is the fix's
 * one extra call (the renderer makes its own inside every render).
 *
 * Three paths that rebuild the room (Leo, round 80): changing the hood,
 * dragging a wall slider, turning the island. Each on a desktop with the
 * mouse, on a phone with touch, and on a phone with the CPU slowed four times.
 * Real input throughout (D17: a click from script is not a click). And the
 * same three in install mode, desktop and phone (round 82), where what can
 * flash is the machines rather than the cabinets.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** Same guard as the smoke suite: a run that tested nothing fails. */
const EXPECTED_TESTS = 21;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} fade-rebuild tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  // On the GPU when there is one. What is asserted is a count of frames, not
  // a time, but the phone slowed four times would not finish in the budget on
  // software rendering.
  browser = await chromium.launch({
    args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
});
afterAll(async () => {
  await browser?.close();
});

interface Render {
  layer: string;
  faded: string[];
  /** The most opaque see-through machine surface drawn, or -1 for none. */
  machines: number;
}

/** Installed before the page's own scripts run. */
function installHook() {
  const trace = { renders: [] as { layer: string; faded: string[]; machines: number }[], worldUpdates: 0, on: false };
  (window as unknown as { __rebuildTrace: typeof trace }).__rebuildTrace = trace;
  let inRender = false;
  const hook = new EventTarget();
  (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;

  type Obj = {
    uuid: string;
    name?: string;
    userData?: Record<string, unknown>;
    children: Obj[];
    isMesh?: boolean;
    visible: boolean;
    material?: { transparent: boolean; opacity: number } | unknown[];
    getObjectByName?: (name: string) => Obj | undefined;
  };

  /** Each box, by id, and whether every mesh it owns is drawn faded. */
  const fadedBoxes = (layer: Obj) => {
    const state = new Map<string, boolean>();
    const walk = (node: Obj, box: string | undefined) => {
      const id = (node.userData?.boxId as string | undefined) ?? box;
      if (node.isMesh && node.visible && id && node.material && !Array.isArray(node.material)) {
        const m = node.material as { transparent: boolean; opacity: number };
        const faded = m.transparent && m.opacity <= 0.2 + 1e-6;
        state.set(id, (state.get(id) ?? true) && faded);
      }
      for (const child of node.children) walk(child, id);
    };
    walk(layer, undefined);
    return [...state].filter(([, faded]) => faded).map(([id]) => id);
  };

  /**
   * Install mode draws the machines see-through (0.22) and the fade steps them
   * back further (0.12, round 42). The most opaque of them, per render.
   */
  const machineOpacity = (layer: Obj | undefined) => {
    let most = -1;
    const walk = (node: Obj) => {
      if (!node.visible) return;
      if (node.isMesh && node.material && !Array.isArray(node.material)) {
        const m = node.material as { transparent: boolean; opacity: number };
        if (m.transparent) most = Math.max(most, m.opacity);
      }
      for (const child of node.children) walk(child);
    };
    if (layer) walk(layer);
    return most;
  };

  hook.addEventListener("observe", (event) => {
    const detail = (event as CustomEvent).detail as {
      isWebGLRenderer?: boolean;
      isScene?: boolean;
      render?: (scene: Obj, camera: unknown) => void;
      updateMatrixWorld?: (force?: boolean) => void;
    };
    if (detail.isScene && detail.updateMatrixWorld) {
      const own = detail.updateMatrixWorld.bind(detail);
      detail.updateMatrixWorld = (force?: boolean) => {
        if (!inRender && trace.on) trace.worldUpdates += 1;
        own(force);
      };
    }
    if (detail.isWebGLRenderer && detail.render) {
      const render = detail.render.bind(detail);
      detail.render = (scene: Obj, camera: unknown) => {
        inRender = true;
        try {
          render(scene, camera);
        } finally {
          inRender = false;
        }
        const layer = scene.getObjectByName?.("cabinet-layer");
        if (trace.on && layer) {
          trace.renders.push({
            layer: layer.uuid,
            faded: fadedBoxes(layer),
            machines: machineOpacity(scene.getObjectByName?.("appliance-layer")),
          });
        }
      };
    }
  });
}

interface Session {
  page: Page;
  cdp: CDPSession;
  phone: boolean;
  errors: string[];
}

async function open(phone: boolean): Promise<Session> {
  const context = await browser.newContext(
    phone
      ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(installHook);
  await page.goto(PREVIEW_URL + "?debug=1&quality=high", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);
  return { page, cdp: await context.newCDPSession(page), phone, errors };
}

/** A mouse click on a desktop, a tap on a phone, at the element's middle. */
async function press(s: Session, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
}

/** A horizontal drag, by the mouse or by one finger. */
async function drag(s: Session, x0: number, y0: number, dx: number) {
  if (!s.phone) {
    await s.page.mouse.move(x0, y0);
    await s.page.mouse.down();
    for (let i = 1; i <= 10; i += 1) await s.page.mouse.move(x0 + (dx * i) / 10, y0);
    await s.page.mouse.up();
    return;
  }
  const at = (x: number) => [{ x, y: y0, id: 1 }];
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(x0) });
  for (let i = 1; i <= 10; i += 1) {
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(x0 + (dx * i) / 10) });
    await s.page.waitForTimeout(16);
  }
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const faded = (s: Session) =>
  s.page.evaluate(() => (window as unknown as { __faded?: string[] }).__faded ?? []);

/** Until what the fade hides stops changing. */
async function steady(s: Session) {
  let last = "";
  for (let i = 0; i < 20; i += 1) {
    await s.page.waitForTimeout(400);
    const now = (await faded(s)).join("|");
    if (now === last) return;
    last = now;
  }
}

/**
 * The hood selected by its label and flown to, the list or the sheet opened
 * the way the path needs it, and then the camera turned by hand until cabinets
 * stand on the sight line and fade.
 */
async function fadedWithHood(s: Session, panel: "list" | "config" | "card", slot = "slot-hood") {
  await press(s, s.page.locator(`[data-pin-label="${slot}"]`).first());
  await s.page.waitForTimeout(2500);
  if (panel === "card") {
    // The model card: nothing to open, and on a phone a sheet would cover it.
  } else if (s.phone) {
    await press(s, s.page.getByRole("button", { name: panel === "list" ? "Appliances" : "Configure", exact: true }).first());
  } else if (panel === "list") {
    await press(s, s.page.getByRole("button", { name: "Appliances", exact: true }).first());
  }
  await s.page.waitForTimeout(1500);
  const canvas = (await s.page.locator("canvas").boundingBox())!;
  const x0 = canvas.x + canvas.width / 2;
  const y0 = canvas.y + canvas.height * (s.phone ? 0.25 : 0.5);
  for (let i = 0; i < 14 && (await faded(s)).length === 0; i += 1) {
    await drag(s, x0, y0, s.phone ? 40 : 90);
    await s.page.waitForTimeout(500);
  }
  await steady(s);
}

/**
 * Do one thing that rebuilds the room, and read back every render from the
 * moment before it until the room has settled.
 */
async function rebuild(s: Session, cpu: number, action: () => Promise<void>) {
  await s.page.evaluate(() => {
    const t = (window as unknown as { __rebuildTrace: { renders: unknown[]; worldUpdates: number; on: boolean } }).__rebuildTrace;
    t.renders = [];
    t.worldUpdates = 0;
    t.on = true;
  });
  if (cpu > 1) await s.cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await action();
  await s.page.waitForTimeout(cpu > 1 ? 6000 : 2500);
  if (cpu > 1) await s.cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await steady(s);
  const during = await s.page.evaluate(() => {
    const t = (window as unknown as { __rebuildTrace: { renders: Render[]; worldUpdates: number; on: boolean } }).__rebuildTrace;
    return { renders: t.renders.slice(), worldUpdates: t.worldUpdates };
  });
  // And a quiet second with the hood still selected: the positions are brought
  // up to date once per rebuild, never on every frame.
  await s.page.evaluate(() => {
    (window as unknown as { __rebuildTrace: { worldUpdates: number } }).__rebuildTrace.worldUpdates = 0;
  });
  await s.page.waitForTimeout(1000);
  const idle = await s.page.evaluate(
    () => (window as unknown as { __rebuildTrace: { worldUpdates: number } }).__rebuildTrace.worldUpdates,
  );
  return { ...during, idleWorldUpdates: idle };
}

/**
 * What a customer would have seen, per room drawn after the action.
 *
 * A room's settled faded set is what it fades at its last render; any earlier
 * render of that room that drew one of those boxes solid is a flash. Rooms
 * drawn for fewer than eight renders are passed over — a slider step replaced
 * before it settled has no settled set to hold it to — and how many rooms were
 * checked, and how many boxes, is part of the result (D22: an assertion about
 * a filtered set says how many went in).
 */
function flashes(renders: Render[]) {
  const rooms: Render[][] = [];
  for (const render of renders) {
    const last = rooms[rooms.length - 1];
    if (last && last[0].layer === render.layer) last.push(render);
    else rooms.push([render]);
  }
  const rebuilt = rooms.slice(1);
  let solidRenders = 0;
  let checked = 0;
  let fadedBoxesChecked = 0;
  for (const room of rebuilt) {
    if (room.length < 8) continue;
    const settled = room[room.length - 1].faded;
    if (settled.length === 0) continue;
    checked += 1;
    fadedBoxesChecked += settled.length;
    for (const render of room) {
      if (settled.some((id) => !render.faded.includes(id))) solidRenders += 1;
    }
  }
  return { rebuilds: rebuilt.length, checked, fadedBoxesChecked, solidRenders };
}

/**
 * The same per room, for the machines in install mode: a room's settled
 * opacity is its last render's, and any earlier render drawing a machine more
 * opaque than that is a flash.
 */
function machineFlashes(renders: Render[]) {
  const rooms: Render[][] = [];
  for (const render of renders) {
    const last = rooms[rooms.length - 1];
    if (last && last[0].layer === render.layer) last.push(render);
    else rooms.push([render]);
  }
  const rebuilt = rooms.slice(1);
  let checked = 0;
  let above = 0;
  const settled: number[] = [];
  for (const room of rebuilt) {
    if (room.length < 8) continue;
    const end = room[room.length - 1].machines;
    if (end < 0) continue;
    checked += 1;
    settled.push(end);
    for (const render of room) if (render.machines > end + 1e-6) above += 1;
  }
  return { rebuilds: rebuilt.length, checked, settled, rendersAboveSettled: above };
}

/** Changing the hood from the list (desktop) or the sheet (phone). */
async function swapHood(s: Session) {
  await fadedWithHood(s, "list");
  return () => press(s, s.page.getByRole("button", { name: /AK7300AS/ }).filter({ visible: true }).first());
}

/** Dragging the back wall slider by hand, a step and a half. */
async function dragBackWall(s: Session) {
  await fadedWithHood(s, "config");
  const slider = s.page.locator("label", { hasText: "Back wall" }).first().locator('input[type="range"]');
  await slider.scrollIntoViewIfNeeded();
  await steady(s);
  return async () => {
    const box = (await slider.boundingBox())!;
    const { value, min, max, step } = await slider.evaluate((el: HTMLInputElement) => ({
      value: Number(el.value),
      min: Number(el.min),
      max: Number(el.max),
      step: Number(el.step) || 1,
    }));
    const x0 = box.x + ((value - min) / (max - min)) * box.width;
    // A step and a half: enough to rebuild the room, not so much that the
    // wall moves the faded cabinets off the sight line and leaves nothing to
    // check (round 81's first desktop run dragged 40px, five steps, and did).
    await drag(s, x0, box.y + box.height / 2, (1.5 * step * box.width) / (max - min));
  };
}

/** Turning the island across the room. */
async function turnIsland(s: Session) {
  await fadedWithHood(s, "config");
  const across = s.page.getByRole("button", { name: "Across the room", exact: true }).filter({ visible: true }).first();
  await across.scrollIntoViewIfNeeded();
  await steady(s);
  return () => press(s, across);
}

/**
 * Changing the range from the model card (round 83): A's pro range for the
 * PCG366W rangetop, which puts a drawer base under it, so the room is
 * generated again. Its own rebuild path, so its own case.
 */
async function swapRange(s: Session) {
  await fadedWithHood(s, "card", "slot-range");
  const chip = s.page.locator('[data-model-card] [data-candidate="thermador-pcg366w"]').first();
  return () => press(s, chip);
}

/**
 * Changing the hood from the model card to one that hangs differently (round
 * 87): A's under-cabinet hood for the VCIN36GWS liner, which comes with its
 * housing, so the room is generated again where it stands, not only re-cut.
 * Its own rebuild path, so its own case.
 */
async function swapToInsert(s: Session) {
  await fadedWithHood(s, "card", "slot-hood");
  const chip = s.page.locator('[data-model-card] [data-candidate="thermador-vcin36gws"]').first();
  return () => press(s, chip);
}

const PATHS = [
  ["changing the hood", swapHood],
  ["dragging the back wall slider", dragBackWall],
  ["turning the island", turnIsland],
  ["changing the range", swapRange],
  ["changing the hood to an insert with its housing", swapToInsert],
] as const;

const DEVICES = [
  ["on a desktop with the mouse", false, 1],
  ["on a phone with touch", true, 1],
  ["on a phone with touch, the CPU slowed four times", true, 4],
] as const;

/**
 * Install mode, then the hood selected by its label (its pins stay clickable
 * there) and the list or the sheet opened as the path needs. No camera turn:
 * the machines step back whatever is on the sight line.
 */
async function inInstall(s: Session, panel: "list" | "config") {
  await press(s, s.page.getByRole("button", { name: "Install", exact: true }).first());
  await s.page.waitForTimeout(1500);
  await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
  await s.page.waitForTimeout(2500);
  if (s.phone) {
    await press(s, s.page.getByRole("button", { name: panel === "list" ? "Appliances" : "Configure", exact: true }).first());
  } else if (panel === "list") {
    await press(s, s.page.getByRole("button", { name: "Appliances", exact: true }).first());
  }
  await s.page.waitForTimeout(1500);
}

const INSTALL_PATHS = [
  [
    "changing the hood",
    async (s: Session) => {
      await inInstall(s, "list");
      return () => press(s, s.page.getByRole("button", { name: /AK7300AS/ }).filter({ visible: true }).first());
    },
  ],
  [
    "dragging the back wall slider",
    async (s: Session) => {
      await inInstall(s, "config");
      const slider = s.page.locator("label", { hasText: "Back wall" }).first().locator('input[type="range"]');
      await slider.scrollIntoViewIfNeeded();
      return async () => {
        const box = (await slider.boundingBox())!;
        const { value, min, max, step } = await slider.evaluate((el: HTMLInputElement) => ({
          value: Number(el.value),
          min: Number(el.min),
          max: Number(el.max),
          step: Number(el.step) || 1,
        }));
        const x0 = box.x + ((value - min) / (max - min)) * box.width;
        await drag(s, x0, box.y + box.height / 2, (1.5 * step * box.width) / (max - min));
      };
    },
  ],
  [
    "turning the island",
    async (s: Session) => {
      await inInstall(s, "config");
      const across = s.page.getByRole("button", { name: "Across the room", exact: true }).filter({ visible: true }).first();
      await across.scrollIntoViewIfNeeded();
      return () => press(s, across);
    },
  ],
] as const;

/**
 * Round 82, Leo: the same in install mode. There the cabinets are ghosted at
 * 0.06, already under the fade's 0.2, so the fade cannot make one visibly
 * fainter and a cabinet has nothing to flash; what can flash is the machines,
 * drawn at 0.22 until the fade steps them back to 0.12.
 */
describe("a room rebuilt in install mode", () => {
  for (const [path, setUp] of INSTALL_PATHS) {
    for (const [device, phone] of [
      ["on a desktop with the mouse", false],
      ["on a phone with touch", true],
    ] as const) {
      it(`draws no machine more solid than install mode leaves it, ${path}, ${device}`, async () => {
        const s = await open(phone);
        const action = await setUp(s);
        const trace = await rebuild(s, 1, action);
        const result = machineFlashes(trace.renders);
        // eslint-disable-next-line no-console
        console.log(`install, ${path}, ${device}:`, JSON.stringify(result));
        expect({
          rebuilt: result.rebuilds > 0,
          roomsChecked: result.checked > 0,
          settledAtTheFade: result.settled.every((opacity) => Math.abs(opacity - 0.12) < 1e-6),
          rendersAboveSettled: result.rendersAboveSettled,
          errors: s.errors,
        }).toEqual({
          rebuilt: true,
          roomsChecked: true,
          settledAtTheFade: true,
          rendersAboveSettled: 0,
          errors: [],
        });
        await s.page.context().close();
      });
    }
  }
});

describe("a room rebuilt while cabinets are faded", () => {
  for (const [path, setUp] of PATHS) {
    for (const [device, phone, cpu] of DEVICES) {
      it(`draws no faded cabinet solid, ${path}, ${device}`, async () => {
        const s = await open(phone);
        await s.page.getByRole("button", { name: "A", exact: true }).first().waitFor();
        const action = await setUp(s);
        const before = (await faded(s)).length;
        const trace = await rebuild(s, cpu, action);
        const result = flashes(trace.renders);

        // Printed before the expectation, so a red run keeps its numbers.
        // eslint-disable-next-line no-console
        console.log(`${path}, ${device}:`, JSON.stringify({ before, ...result, worldUpdates: trace.worldUpdates, idle: trace.idleWorldUpdates }));
        // One expectation, so a red run shows every part of it at once.
        expect({
          fadedBeforeTheRebuild: before > 0,
          rebuilt: result.rebuilds > 0,
          roomsChecked: result.checked > 0,
          boxesChecked: result.fadedBoxesChecked > 0,
          solidRenders: result.solidRenders,
          positionsUpdatedOncePerRebuild: trace.worldUpdates === result.rebuilds,
          positionsUpdatedWhileIdle: trace.idleWorldUpdates,
          errors: s.errors,
        }).toEqual({
          fadedBeforeTheRebuild: true,
          rebuilt: true,
          roomsChecked: true,
          boxesChecked: true,
          solidRenders: 0,
          positionsUpdatedOncePerRebuild: true,
          positionsUpdatedWhileIdle: 0,
          errors: [],
        });
        await s.page.context().close();
      });
    }
  }
});
