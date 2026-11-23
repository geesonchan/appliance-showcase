import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";
import { swipeIntoRow } from "./swipeIntoRow";

/**
 * Two things the camera does by the user's hand, in every shape (Leo,
 * 2026-11-11 and 2026-11-12; D1):
 *
 * - The zoom buttons step the zoom and nothing else: 「放大、缩小按钮把镜头转回 45°/35°：
 *   这一轮修，三种形状一起，缩放时保持当前的角度」. Until now a step ran the fly-in's
 *   tween without the camera's own angle, so it swung to the L's 45°/35° —
 *   after any fly-in, and from a U's own view.
 * - Another model picked on the card pulls the camera back: 「换了型号以后镜头放远：…角度
 *   和中心不动，远近回到看得见整个厨房，卡片不关」, D1's fifth reason.
 *   *Replaced by D1's sixth (item 12e-2; Leo, 2026-11-20: 「换型号以后的镜头选
 *   bingjia3」): the shape's default angle, the whole room centred in the part of
 *   the scene the card leaves free, the card left open; closing the card then
 *   takes the camera to the reset view, unless it was moved in between (Leo,
 *   2026-11-20: 「换型号以后我自己拖动、缩放、按重置或飞到别的机器，再关卡片：镜头不回」).*
 *   Each swap is read at 1440, 767 and 390 wide: the angle, the room's centre
 *   within 10 pixels of the free part's, every pin label seen whole at nine
 *   points, none laid over another, none off the screen, the model really
 *   changed, and the card closed landing on the reset button's own view.
 * - The pin labels stand clear of the mode buttons at the top of the scene and
 *   of the toast, as of the card (D12, amended with item 12e-2).
 * - Nothing is faded while the camera stands where a swap put it, and the fade
 *   is back once the camera is dragged (Leo, 2026-11-22: 「镜头还停在换型号放的位置
 *   时，不做视线淡化；拖动、缩放、关卡片以后淡化照旧」).
 *
 * Real input — the mouse on a desktop, a finger on a phone. The angle and the
 * zoom are read off the camera the page renders with (three.js's devtools hook).
 * Where a machine is picked from the Appliances list (767 and 390 wide), the
 * camera is let stop before the list is closed (Leo, 2026-11-20: 「点清单行以后先
 * 等镜头停了再关清单」): closing it mid-flight leaves the camera elsewhere, an
 * open item of its own.
 */

const DESKTOP = { width: 1440, height: 900 };
const NARROW = { width: 767, height: 900 };
const PHONE = { width: 390, height: 844 };

// 8 until item 12e-2. Since: 4 zoom steps, 8 swaps (the 4 there were, with D1's
// sixth reason replacing the fifth, and 2 at 767 and 2 at 390), the labels clear
// of the mode buttons, and a swap closed as it is and closed after a drag (Leo,
// 2026-11-20: 「加两条测试」), and closed by a click on the bare scene, as it is and
// after a press that went past a click (Leo, 2026-11-21: 「加测试：点空白关卡片会回；
// 按下以后拖动了再关不回」), and the labels clear of the toast (Leo, 2026-11-21: 「试 390 宽、
// A 套餐换冰箱让墙加长、提示条出现的那种情况。找得到就加进 cameraKeep」), and nothing faded
// after a swap at 1440, 767 and 390, and the fade back after a drag (Leo, 2026-11-22:
// 「cameraKeep 加"换型号拉远以后画面里没有东西被淡化"和"拖动以后淡化恢复"」).
const EXPECTED_TESTS = 22;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} camera tests actually ran`).toBe(EXPECTED_TESTS);
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
  errors: string[];
}

type Device = "desktop" | "narrow" | "phone";

async function open(device: Device | boolean, query: string): Promise<Session> {
  const kind: Device = device === true ? "phone" : device === false ? "desktop" : device;
  const phone = kind === "phone";
  const context = await browser.newContext(
    phone
      ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: kind === "narrow" ? NARROW : DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.addInitScript(() => {
    const hook = new EventTarget();
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const r = (event as CustomEvent).detail as { isWebGLRenderer?: boolean; render?: (s: unknown, c: unknown) => void };
      if (!r.isWebGLRenderer || !r.render) return;
      const own = r.render.bind(r);
      r.render = (scene: unknown, camera: unknown) => {
        (window as unknown as { __camera: unknown }).__camera = camera;
        (window as unknown as { __scene: unknown }).__scene = scene;
        own(scene, camera);
      };
    });
  });
  await openWatched(page, `${PREVIEW_URL}${query}`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `cameraKeep · ${expect.getState().currentTestName ?? ""}` });
  await page.waitForTimeout(2500);
  const s = { page, phone, errors };
  // A link without models says so; the notice is closed, as a person would.
  const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await notice.count()) await press(s, notice.first());
  return s;
}

async function press(s: Session, locator: ReturnType<Page["locator"]>, wait = 1800) {
  // On a phone a model's cell is swiped into the card first, then tapped at its centre:
  // since item 12's 丁 (cells 228px wide) the second cell stands half outside the card and
  // its centre is the card's frame. Leo, 2026-11-15: 「点另一个型号之前，先把那个格子横着滑进
  // 画面（人会这样做），再点正中。」 The whole why in tests/swipeIntoRow.ts.
  if (s.phone) await swipeIntoRow(s.page, locator);
  const box = (await locator.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
  await s.page.waitForTimeout(wait);
}

/** The camera's angle in whole degrees and its zoom, as rendered. */
const pose = (s: Session) =>
  s.page.evaluate(() => {
    const camera = (window as unknown as { __camera: { matrixWorld: { elements: number[] }; zoom: number } }).__camera;
    const e = camera.matrixWorld.elements;
    return {
      azimuth: Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI),
      pitch: Math.round((Math.asin(e[9]) * 180) / Math.PI),
      zoom: camera.zoom,
    };
  });

/** The camera's whole pose, to compare two views: its matrix and its zoom. */
const exactPose = (s: Session) =>
  s.page.evaluate(() => {
    const camera = (window as unknown as { __camera: { matrixWorld: { elements: number[] }; zoom: number } }).__camera;
    return [...camera.matrixWorld.elements, camera.zoom];
  });

/**
 * Until the camera has stopped: its matrix and zoom read every 250 ms, two
 * reads alike. Ten seconds at most, then the test fails rather than reads a
 * camera still moving. The labels are then given 800 ms to settle on it.
 */
async function still(s: Session) {
  let last = "";
  for (let i = 0; i < 40; i += 1) {
    await s.page.waitForTimeout(250);
    const now = (await exactPose(s)).map((n) => n.toFixed(5)).join(",");
    if (now === last) {
      await s.page.waitForTimeout(800);
      return;
    }
    last = now;
  }
  throw new Error("the camera had not stopped after 10 seconds");
}

const samePose = (a: number[], b: number[]) => a.every((n, i) => Math.abs(n - b[i]) < 1e-3);

/**
 * What the scene shows now. The room's centre is the middle of the box round
 * every mesh on show, put through the camera; the free part is the canvas
 * less the card (right of it on a desktop, above it up to 767 wide). Each pin
 * label is tried at nine points (`elementFromPoint`), each one to land on the
 * label itself; two labels are laid over each other where their boxes cross by
 * more than 2 pixels each way; a label is off the screen where any of it is
 * outside the canvas or the window.
 */
const look = (s: Session) =>
  s.page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    const cam = w.__camera;
    const scene = w.__scene;
    cam.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    const V = cam.position.constructor;
    const r = document.querySelector("canvas")!.getBoundingClientRect();
    const toScreen = (p: any) => {
      const v = p.clone().project(cam);
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
    };
    const shown = (o: any) => {
      for (let n = o; n; n = n.parent) if (n.visible === false) return false;
      return true;
    };
    const min = new V(Infinity, Infinity, Infinity);
    const max = new V(-Infinity, -Infinity, -Infinity);
    scene.traverse((o: any) => {
      if (!o.isMesh || !shown(o) || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      if (!b || !isFinite(b.min.x)) return;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        const p = new V(x, y, z).applyMatrix4(o.matrixWorld);
        min.min(p);
        max.max(p);
      }
    });
    const [cx, cy] = toScreen(min.clone().add(max).multiplyScalar(0.5));
    const cardEl = [...document.querySelectorAll<HTMLElement>("[data-model-card]")].find((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden";
    });
    const card = cardEl?.getBoundingClientRect();
    let part = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    if (card) {
      part = innerWidth < 768 ? { ...part, bottom: Math.min(part.bottom, card.top) } : { ...part, left: Math.max(part.left, card.right) };
    }
    const centreOff = Math.round(Math.hypot(cx - (part.left + part.right) / 2, cy - (part.top + part.bottom) / 2));

    const labels = [...document.querySelectorAll<HTMLElement>("[data-pin-label]")].filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.getBoundingClientRect().width > 0;
    });
    const what = (hit: Element | null) => {
      if (!hit) return "off-screen";
      if (hit.closest('[data-segment="mode"]')) return "mode-buttons";
      if (hit.closest("[data-model-card]")) return "card";
      if (hit.closest("[data-pin-label]")) return "another-label";
      if (hit.closest("[data-toast]")) return "toast";
      if (hit.tagName === "CANVAS") return "canvas";
      return hit.tagName.toLowerCase();
    };
    const notSeen: string[] = [];
    const offScreen: string[] = [];
    const at: Record<string, [number, number]> = {};
    for (const el of labels) {
      const id = el.getAttribute("data-pin-label")!;
      const b = el.getBoundingClientRect();
      at[id] = [Math.round(b.left), Math.round(b.top)];
      if (!(b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight)) offScreen.push(id);
      const misses: string[] = [];
      for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.2, 0.5, 0.8]) {
        const x = b.left + b.width * fx;
        const y = b.top + b.height * fy;
        const hit = x < 0 || y < 0 || x >= innerWidth || y >= innerHeight ? null : document.elementFromPoint(x, y);
        if (!(hit && (hit === el || el.contains(hit)))) misses.push(what(hit));
      }
      if (misses.length) notSeen.push(`${id} ${9 - misses.length}/9 under ${[...new Set(misses)].join("+")}`);
    }
    const overlaps: string[] = [];
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const a = labels[i].getBoundingClientRect();
        const c = labels[j].getBoundingClientRect();
        const ow = Math.min(a.right, c.right) - Math.max(a.left, c.left);
        const oh = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (ow > 2 && oh > 2) overlaps.push(`${labels[i].getAttribute("data-pin-label")}+${labels[j].getAttribute("data-pin-label")}`);
      }
    }
    const e = cam.matrixWorld.elements;
    return {
      // `+ 0`: a camera straight in front reads -0, which is 0.
      angle: [Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI) + 0, Math.round((Math.asin(e[9]) * 180) / Math.PI) + 0],
      centreOff,
      labels: labels.length,
      at,
      notSeen,
      overlaps,
      offScreen,
      card: cardEl?.getAttribute("data-model-card") ?? null,
    };
  });

const zoomButton = (s: Session, which: "in" | "out") =>
  s.page.locator(`button[aria-label="${which === "in" ? "Zoom in" : "Zoom out"}"]`).filter({ visible: true }).first();
const resetButton = (s: Session) => s.page.getByRole("button", { name: "Reset view", exact: true }).filter({ visible: true }).first();
const pin = (s: Session, slot: string) => s.page.locator(`[data-pin-label="${slot}"]`).filter({ visible: true }).first();
const otherModel = (s: Session) => s.page.locator("[data-model-card] [data-candidate][aria-pressed=false]").filter({ visible: true }).first();
const closeCard = (s: Session) => s.page.locator("[data-model-card]").getByRole("button", { name: "Close", exact: true }).filter({ visible: true }).first();
const near = (a: number, b: number) => Math.abs(a - b) / b < 0.02;

async function zoomKeepsAngle(phone: boolean, query: string, fly: string | null, which: "in" | "out") {
  const s = await open(phone, query);
  if (fly) await press(s, pin(s, fly));
  const before = await pose(s);
  await press(s, zoomButton(s, which), 1200);
  const after = await pose(s);
  await s.page.context().close();
  return {
    angle: [after.azimuth, after.pitch],
    stepped: near(after.zoom, before.zoom * (which === "in" ? 1.3 : 1 / 1.3)),
    errors: s.errors,
    expected: { angle: [before.azimuth, before.pitch], stepped: true, errors: [] },
  };
}

/** A machine flown to: by its pin label on a desktop, or from the Appliances list, the camera let stop before the list closes. */
async function flyTo(s: Session, slot: string, from: "pin" | RegExp) {
  if (from === "pin") {
    await press(s, pin(s, slot));
    await still(s);
    return;
  }
  await press(s, s.page.getByRole("button", { name: "Appliances", exact: true }).filter({ visible: true }).first(), 1200);
  // The row scrolled into the list's view first: a machine low in the list stands below the
  // screen's foot until the list is scrolled, as a person scrolls it.
  const row = s.page.locator("[data-sheet] ul").first().locator("li > button", { hasText: from }).first();
  await row.scrollIntoViewIfNeeded();
  await press(s, row, 300);
  await still(s);
  await press(s, s.page.locator("[data-sheet]").getByRole("button", { name: "Close", exact: true }).filter({ visible: true }).first(), 600);
  await still(s);
}

/** The model shown: the card's 「已选」 / "Specified" cell. */
const chosen = (s: Session) =>
  s.page.locator("[data-model-card] [data-candidate][aria-pressed=true]").filter({ visible: true }).first().getAttribute("data-candidate");

/** Another model picked on the card; whether it really is the one shown now (its cell and the card's heading). */
async function swapModel(s: Session) {
  const heading = () => s.page.locator("[data-model-card]").filter({ visible: true }).first().locator('[class*="text-[14px]"]').first().innerText();
  const before = { cell: await chosen(s), heading: await heading() };
  const asked = await otherModel(s).getAttribute("data-candidate");
  await press(s, otherModel(s), 300);
  await still(s);
  const after = { cell: await chosen(s), heading: await heading() };
  return after.cell === asked && before.cell !== after.cell && before.heading !== after.heading;
}

const DEFAULT_ANGLE = { L: [45, 35], "one-wall": [45, 35], U: [0, 50] } as const;

/**
 * A model swapped and the card then closed (D1's sixth reason). The swap is
 * read with the card open, the close with it shut; the close is then set
 * against the reset button's own view, pressed after it.
 */
async function swapFramesTheRoom(device: Device, query: string, shape: keyof typeof DEFAULT_ANGLE, slot: string, from: "pin" | RegExp) {
  const s = await open(device, query);
  const whole = (await pose(s)).zoom;
  await flyTo(s, slot, from);
  const flown = await pose(s);
  const changed = await swapModel(s);
  const swapped = await look(s);
  await press(s, closeCard(s), 300);
  await still(s);
  const closed = await look(s);
  const closedPose = await exactPose(s);
  await press(s, resetButton(s), 300);
  await still(s);
  const reset = await look(s);
  const resetPose = await exactPose(s);
  await s.page.context().close();
  const moved = Object.keys(reset.at).filter((id) => {
    const [a, b] = [closed.at[id], reset.at[id]];
    return !a || Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1;
  });
  const raw = { flown, swapped, closed: { ...closed, at: undefined }, reset: { ...reset, at: undefined } };
  return {
    raw,
    flownCloser: flown.zoom > whole * 1.3,
    swap: {
      modelChanged: changed,
      cardOpen: swapped.card === slot,
      // D1's sixth reason replaces the fifth: the default angle, not the fly-in's.
      angle: swapped.angle,
      // D1's sixth reason replaces the fifth: the room centred in the free part, not the zoom alone.
      centred: swapped.centreOff <= 10,
      notSeen: swapped.notSeen,
      overlaps: swapped.overlaps,
      offScreen: swapped.offScreen,
    },
    closed: {
      cardOpen: closed.card !== null,
      asTheResetView: samePose(closedPose, resetPose),
      labelsAsAfterReset: moved,
      notSeen: closed.notSeen,
      overlaps: closed.overlaps,
      offScreen: closed.offScreen,
    },
    errors: s.errors,
    expected: {
      flownCloser: true,
      swap: { modelChanged: true, cardOpen: true, angle: [...DEFAULT_ANGLE[shape]], centred: true, notSeen: [], overlaps: [], offScreen: [] },
      closed: { cardOpen: false, asTheResetView: true, labelsAsAfterReset: [], notSeen: [], overlaps: [], offScreen: [] },
      errors: [],
    },
  };
}

/** A model swapped, then the camera dragged by the mouse, then the card closed: the camera stays (Leo, 2026-11-20). */
async function dragThenClose(drag: boolean) {
  const s = await open("desktop", "/?v=2&pkg=C&shape=L&lang=en&quality=low");
  await flyTo(s, "slot-range", "pin");
  const changed = await swapModel(s);
  const afterSwap = await exactPose(s);
  if (drag) {
    // From a point of bare scene, right of the card and clear of every label.
    const start = await s.page.evaluate(() => {
      for (let y = 300; y <= 700; y += 40) for (let x = 1300; x >= 700; x -= 40) {
        if (document.elementFromPoint(x, y)?.tagName === "CANVAS") return [x, y];
      }
      return null;
    });
    if (!start) throw new Error("no bare scene to drag from");
    await s.page.mouse.move(start[0], start[1]);
    await s.page.mouse.down();
    for (let i = 1; i <= 12; i += 1) await s.page.mouse.move(start[0] - i * 10, start[1] + i * 2);
    await s.page.mouse.up();
    await still(s);
  }
  const beforeClose = await exactPose(s);
  await press(s, closeCard(s), 300);
  await still(s);
  const afterClose = await exactPose(s);
  await press(s, resetButton(s), 300);
  await still(s);
  const resetView = await exactPose(s);
  await s.page.context().close();
  return {
    modelChanged: changed,
    dragged: !samePose(afterSwap, beforeClose),
    closeMovedTheCamera: !samePose(beforeClose, afterClose),
    closedAtTheResetView: samePose(afterClose, resetView),
    errors: s.errors,
    expected: drag
      ? { modelChanged: true, dragged: true, closeMovedTheCamera: false, closedAtTheResetView: false, errors: [] }
      : { modelChanged: true, dragged: false, closeMovedTheCamera: true, closedAtTheResetView: true, errors: [] },
  };
}

/**
 * A point of bare scene: inside the canvas, outside the box round every mesh on
 * show as the camera projects it (so no machine, cabinet or wall is under it),
 * with nothing over it but the canvas. From the right edge in, top to bottom.
 */
const bareScene = (s: Session) =>
  s.page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    const cam = w.__camera;
    const scene = w.__scene;
    cam.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    const V = cam.position.constructor;
    const r = document.querySelector("canvas")!.getBoundingClientRect();
    const shown = (o: any) => {
      for (let n = o; n; n = n.parent) if (n.visible === false) return false;
      return true;
    };
    let [l, t, rr, b] = [Infinity, Infinity, -Infinity, -Infinity];
    scene.traverse((o: any) => {
      if (!o.isMesh || !shown(o) || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const g = o.geometry.boundingBox;
      if (!g || !isFinite(g.min.x)) return;
      for (const x of [g.min.x, g.max.x]) for (const y of [g.min.y, g.max.y]) for (const z of [g.min.z, g.max.z]) {
        const v = new V(x, y, z).applyMatrix4(o.matrixWorld).project(cam);
        const sx = r.left + ((v.x + 1) / 2) * r.width;
        const sy = r.top + ((1 - v.y) / 2) * r.height;
        [l, t, rr, b] = [Math.min(l, sx), Math.min(t, sy), Math.max(rr, sx), Math.max(b, sy)];
      }
    });
    for (let x = Math.floor(r.right) - 12; x > r.left; x -= 12) {
      for (let y = Math.ceil(r.top) + 12; y < r.bottom; y += 12) {
        if (x >= l - 8 && x <= rr + 8 && y >= t - 8 && y <= b + 8) continue;
        if (document.elementFromPoint(x, y)?.tagName === "CANVAS" && document.elementFromPoint(x + 4, y)?.tagName === "CANVAS") return [x, y] as [number, number];
      }
    }
    return null;
  });

/**
 * A model swapped, then the bare scene pressed with the mouse and let go after
 * `travel` pixels: 0 is a click, which closes the card; 3 is past a click
 * (react-three-fiber's `delta <= 2`), a drag, which leaves the card open, and
 * the card is then closed by a click on the bare scene. "The camera really
 * moved" (Leo, 2026-11-21: 「标记改成镜头真的动了才清」) is a press past a click
 * that turned the camera.
 *
 * Not 1 or 2: a press that travels a pixel or two is still a click and the camera
 * goes back, but the controls' own easing (damping) carries those pixels' turn on
 * after it, 0.024° for 2 px (measured 2026-11-21), so the pose is not the reset
 * view's to the thousandth. Reported to Leo, not changed.
 */
async function clickTheScene(travel: 0 | 3) {
  const s = await open("desktop", "/?v=2&pkg=C&shape=L&lang=en&quality=low");
  await flyTo(s, "slot-range", "pin");
  const changed = await swapModel(s);
  const afterSwap = await exactPose(s);
  const at = await bareScene(s);
  if (!at) throw new Error("no bare scene to press");
  await s.page.mouse.move(at[0], at[1]);
  await s.page.mouse.down();
  if (travel) await s.page.mouse.move(at[0] - travel, at[1]);
  await s.page.mouse.up();
  await s.page.waitForTimeout(300);
  const openAfterPress = (await s.page.locator("[data-model-card]").filter({ visible: true }).count()) > 0;
  await still(s);
  const beforeClose = await exactPose(s);
  if (openAfterPress) {
    // The card closed by a click on the bare scene, the press going nowhere.
    const again = await bareScene(s);
    if (!again) throw new Error("no bare scene to click");
    await s.page.mouse.click(again[0], again[1]);
    await s.page.waitForTimeout(300);
  }
  const cardOpen = (await s.page.locator("[data-model-card]").filter({ visible: true }).count()) > 0;
  await still(s);
  const afterClose = await exactPose(s);
  await press(s, resetButton(s), 300);
  await still(s);
  const resetView = await exactPose(s);
  await s.page.context().close();
  // After a click the camera is on its way to the reset view before it can be read,
  // so whether the press turned it is asked of the drag only.
  return travel === 0
    ? {
        modelChanged: changed,
        closedByThePress: !openAfterPress,
        cardOpen,
        closedAtTheResetView: samePose(afterClose, resetView),
        errors: s.errors,
        expected: { modelChanged: true, closedByThePress: true, cardOpen: false, closedAtTheResetView: true, errors: [] },
      }
    : {
        modelChanged: changed,
        closedByThePress: !openAfterPress,
        dragMovedTheCamera: !samePose(afterSwap, beforeClose),
        cardOpen,
        closeMovedTheCamera: !samePose(beforeClose, afterClose),
        closedAtTheResetView: samePose(afterClose, resetView),
        errors: s.errors,
        expected: { modelChanged: true, closedByThePress: false, dragMovedTheCamera: true, cardOpen: false, closeMovedTheCamera: false, closedAtTheResetView: false, errors: [] },
      };
}

/**
 * What the sight-line fade has drawn see-through now: every mesh on show whose
 * material is transparent at 0.2 or under with depthWrite off, as the fade
 * leaves it (Leo, 2026-11-21: 「量数脚本以后固定加一项"画面里有没有东西被淡化"」).
 * Named by its cabinet box, "countertop", or the nearest name above it.
 */
const fadedNow = (s: Session) =>
  s.page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const scene = (window as any).__scene;
    const shown = (o: any) => {
      for (let n = o; n; n = n.parent) if (n.visible === false) return false;
      return true;
    };
    const nameOf = (o: any) => {
      for (let n = o; n; n = n.parent) if (n.userData?.boxId) return String(n.userData.boxId);
      if (o.geometry?.type === "ExtrudeGeometry") return "countertop";
      for (let n = o; n; n = n.parent) if (n.name) return String(n.name);
      return String(o.geometry?.type ?? "?");
    };
    const faded = new Set<string>();
    scene.traverse((o: any) => {
      if (!o.isMesh || !shown(o)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m && m.transparent && m.opacity <= 0.2 + 1e-6 && m.depthWrite === false) faded.add(nameOf(o));
      }
    });
    return [...faded].sort();
  });

const cardShown = async (s: Session) => (await s.page.locator("[data-model-card]").filter({ visible: true }).count()) > 0;

/**
 * Flown to a machine and another model picked on the card: once the camera
 * has stopped where the swap put it, nothing is faded (Leo, 2026-11-22). What
 * the page shows see-through before anything is picked is set aside; at the
 * fly-in the fade is read too, for the record.
 */
async function swapFadesNothing(device: Device, query: string, slot: string, from: "pin" | RegExp) {
  const s = await open(device, query);
  const atOpen = await fadedNow(s);
  await flyTo(s, slot, from);
  const atFlyIn = (await fadedNow(s)).filter((name) => !atOpen.includes(name));
  const changed = await swapModel(s);
  const atSwap = (await fadedNow(s)).filter((name) => !atOpen.includes(name));
  const cardOpen = (await look(s)).card === slot;
  await s.page.context().close();
  return {
    raw: { atOpen, atFlyIn },
    modelChanged: changed,
    cardOpen,
    fadedAtSwap: atSwap,
    errors: s.errors,
    expected: { modelChanged: true, cardOpen: true, fadedAtSwap: [], errors: [] },
  };
}

/**
 * The same, then the camera dragged by the mouse from the bare scene, the card
 * left open: the fade is back (Leo, 2026-11-22: 「拖动、缩放、关卡片以后淡化照旧」).
 * Package A's L, the dishwasher: at the swap's view, with the fade as it was
 * until 2026-11-22, the countertop and the end cabinet's back went see-through.
 */
async function dragBringsTheFadeBack() {
  const s = await open("desktop", "/?v=2&pkg=A&shape=L&lang=en&quality=low");
  const atOpen = await fadedNow(s);
  await flyTo(s, "slot-dishwasher", "pin");
  const changed = await swapModel(s);
  const atSwap = (await fadedNow(s)).filter((name) => !atOpen.includes(name));
  const afterSwap = await exactPose(s);
  const at = await bareScene(s);
  if (!at) throw new Error("no bare scene to drag from");
  await s.page.mouse.move(at[0], at[1]);
  await s.page.mouse.down();
  for (let i = 1; i <= 12; i += 1) await s.page.mouse.move(at[0] - i * 4, at[1]);
  await s.page.mouse.up();
  await still(s);
  const dragged = !samePose(afterSwap, await exactPose(s));
  const afterDrag = (await fadedNow(s)).filter((name) => !atOpen.includes(name));
  const cardOpen = await cardShown(s);
  await s.page.context().close();
  return {
    raw: { atOpen, afterDrag },
    modelChanged: changed,
    fadedAtSwap: atSwap,
    dragged,
    cardOpen,
    fadedAfterDrag: afterDrag.length > 0,
    errors: s.errors,
    expected: { modelChanged: true, fadedAtSwap: [], dragged: true, cardOpen: true, fadedAfterDrag: true, errors: [] },
  };
}

const check = (result: { expected: unknown; raw?: unknown } & Record<string, unknown>) => {
  const { expected, raw, ...got } = result;
  expect(got, raw ? JSON.stringify(raw) : undefined).toEqual(expected);
};

describe("the zoom buttons step the zoom and keep the angle (Leo, 2026-11-12)", () => {
  it("package A's L flown to the dishwasher, zoom in, on a desktop by the mouse", async () =>
    check(await zoomKeepsAngle(false, "/?lang=en&quality=low", "slot-dishwasher", "in")));
  it("package A's L flown to the refrigerator, zoom out, on a phone by a finger", async () =>
    check(await zoomKeepsAngle(true, "/?lang=en&quality=low", "slot-fridge", "out")));
  it("package D on one wall flown to the range, zoom in, on a desktop by the mouse", async () =>
    check(await zoomKeepsAngle(false, "/?v=2&pkg=D&shape=one-wall&lang=en&quality=low", "slot-range", "in")));
  it("package D's U at its own view, zoom in, on a desktop by the mouse", async () =>
    check(await zoomKeepsAngle(false, "/?v=2&pkg=D&shape=U&back=132&corner=blind&lang=en&quality=low", null, "in")));
});

// The four that held D1's fifth reason (angle and centre kept, the zoom back to the
// room's), their expectations changed: D1 新一条取代第五条 (D1's sixth reason; item
// 12e-2, Leo, 2026-11-20). Four more where the live code (769657a) left labels under
// the card or the mode buttons, or off the screen, at 767 and 390 wide.
describe("another model on the card frames the whole room clear of the card, at the default angle (D1's sixth reason, Leo, 2026-11-20)", () => {
  it("package A's L, the dishwasher, on a desktop by the mouse", async () =>
    check(await swapFramesTheRoom("desktop", "/?lang=en&quality=low", "L", "slot-dishwasher", "pin")));
  it("package A's L, the dishwasher, on a phone by a finger", async () =>
    check(await swapFramesTheRoom("phone", "/?lang=en&quality=low", "L", "slot-dishwasher", "pin")));
  it("package E on one wall, the refrigerator, on a desktop by the mouse", async () =>
    check(await swapFramesTheRoom("desktop", "/?v=2&pkg=E&shape=one-wall&lang=en&quality=low", "one-wall", "slot-fridge", "pin")));
  it("package D's U, the hood, on a desktop by the mouse", async () =>
    check(await swapFramesTheRoom("desktop", "/?v=2&pkg=D&shape=U&back=132&corner=blind&lang=en&quality=low", "U", "slot-hood", "pin")));
  it("package A on one wall, the dishwasher from the list, 767 wide by the mouse", async () =>
    check(await swapFramesTheRoom("narrow", "/?v=2&pkg=A&shape=one-wall&lang=en&quality=low", "one-wall", "slot-dishwasher", /Dishwasher/)));
  it("package E's U, the hood from the list, 767 wide by the mouse", async () =>
    check(await swapFramesTheRoom("narrow", "/?v=2&pkg=E&shape=U&lang=en&quality=low", "U", "slot-hood", /hood/i)));
  it("package B's U, the refrigerator from the list, on a 390 phone by a finger", async () =>
    check(await swapFramesTheRoom("phone", "/?v=2&pkg=B&shape=U&lang=en&quality=low", "U", "slot-fridge", /Refrigerator/)));
  it("package D's L, the oven from the list, on a 390 phone by a finger", async () =>
    check(await swapFramesTheRoom("phone", "/?v=2&pkg=D&shape=L&lang=en&quality=low", "L", "slot-oven", /oven/i)));
});

describe("closing the card after a swap (D1's sixth reason; Leo, 2026-11-20: 「加两条测试」)", () => {
  it("package C's L, the range: nothing between the swap and the close, the camera goes to the reset view", async () =>
    check(await dragThenClose(false)));
  it("package C's L, the range: a drag between the swap and the close, the camera stays where it was dragged", async () =>
    check(await dragThenClose(true)));
  // Leo, 2026-11-21: 「点空白画面关卡片也回重置视角…加测试：点空白关卡片会回；按下以后拖动了再关不回」.
  it("package C's L, the range: a click on the bare scene closes the card, the camera goes to the reset view", async () =>
    check(await clickTheScene(0)));
  it("package C's L, the range: a press moved 3 px (past a click, a drag), then a click on the bare scene closes the card, the camera stays", async () =>
    check(await clickTheScene(3)));
});

// Leo, 2026-11-22: 「镜头还停在换型号放的位置时，不做视线淡化；拖动、缩放、关卡片以后淡化照旧。
// 就是 ?p12e2nofade=1 那个对照的做法」. Each case faded something at the swap's view
// with the fade as it was until then (the 107 swaps of 2026-11-21).
describe("no sight-line fade while the camera is where a swap put it (D1's third and sixth reasons; Leo, 2026-11-22)", () => {
  it("package A's L, the dishwasher, on a desktop by the mouse: nothing faded", async () =>
    check(await swapFadesNothing("desktop", "/?v=2&pkg=A&shape=L&lang=en&quality=low", "slot-dishwasher", "pin")));
  it("package B's L, the wine column from the list, 767 wide by the mouse: nothing faded", async () =>
    check(await swapFadesNothing("narrow", "/?v=2&pkg=B&shape=L&lang=en&quality=low", "slot-wine", /Wine column/)));
  it("package B's U, the wine column from the list, on a 390 phone by a finger: nothing faded", async () =>
    check(await swapFadesNothing("phone", "/?v=2&pkg=B&shape=U&lang=en&quality=low", "slot-wine", /Wine column/)));
  it("package A's L, the dishwasher, on a desktop: a drag after the swap brings the fade back, the card open", async () =>
    check(await dragBringsTheFadeBack()));
});

describe("the pin labels stand clear of the mode buttons and the toast (D12, amended with item 12e-2)", () => {
  // Found 2026-11-21: with the toast's mark taken off, the refrigerator's and the microwave's
  // labels stood wholly under 「The new model needs more room: Back wall is now 236″.」, the
  // hood's touching it.
  it("the toast: package A on one wall, the refrigerator from the list, T36FT820NS growing the wall, on a 390 phone by a finger", async () => {
    const s = await open("phone", "/?v=2&pkg=A&lang=en&shape=one-wall&back=233.75&quality=low");
    await flyTo(s, "slot-fridge", /Refrigerator/);
    await press(s, s.page.locator('[data-model-card] [data-candidate="thermador-t36ft820ns"]').first(), 300);
    await still(s);
    const shown = await s.page.evaluate(() => {
      const toast = document.querySelector<HTMLElement>('[data-toast="toast.modelGrew"]');
      const t = toast?.getBoundingClientRect();
      const touching = !t
        ? []
        : [...document.querySelectorAll<HTMLElement>("[data-pin-label]")]
            .filter((el) => {
              const b = el.getBoundingClientRect();
              return b.width > 0 && getComputedStyle(el).visibility !== "hidden" && b.right > t.left && b.left < t.right && b.bottom > t.top && b.top < t.bottom;
            })
            .map((el) => el.getAttribute("data-pin-label"));
      return { toastShown: !!t && t.width > 0 && getComputedStyle(toast!).opacity === "1", touching };
    });
    const seen = await look(s);
    await s.page.context().close();
    check({
      ...shown,
      underTheToast: seen.notSeen.filter((line) => line.includes("toast")),
      errors: s.errors,
      expected: { toastShown: true, touching: [], underTheToast: [], errors: [] },
    });
  });
  it("package B's L flown to the refrigerator from the list rail, on a desktop by the mouse", async () => {
    const s = await open("desktop", "/?v=2&pkg=B&shape=L&lang=en&quality=low");
    await press(s, s.page.locator('button[data-rail="left"]').first(), 700);
    await press(s, s.page.locator('[data-panel="list"] ul li button', { hasText: "Refrigerator" }).first(), 700);
    await press(s, s.page.locator('button[data-rail="left"]').first(), 300);
    await still(s);
    const touching = await s.page.evaluate(() => {
      const row = document.querySelector('[data-segment="mode"]')!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>("[data-pin-label]")]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.right > row.left && b.left < row.right && b.bottom > row.top && b.top < row.bottom;
        })
        .map((el) => el.getAttribute("data-pin-label"));
    });
    const seen = await look(s);
    await s.page.context().close();
    check({
      touching,
      underTheModeButtons: seen.notSeen.filter((line) => line.includes("mode-buttons")),
      errors: s.errors,
      expected: { touching: [], underTheModeButtons: [], errors: [] },
    });
  });
});
