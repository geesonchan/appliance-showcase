import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";
import * as room from "../src/data/room";
import { CABINETS } from "../src/data/cabinets";
import { legBackBoards } from "../src/data/backBoards";
import { resetRoom } from "../src/data/testRoom";
import { openSharedLink } from "../src/store/openLink";
import { useAppStore } from "../src/store/useAppStore";

/**
 * 12a, on the page (Leo, 2026-11-15: 「改法用甲：背板朝里那一面用墙色，朝外不变」; 「瓷砖挪到
 * 炉头所在的那一段、炉头后面……后墙上那块不再画」; 「浏览器测试用真鼠标飞近右段读像素」).
 *
 * A U opened by a link with navy doors and taupe walls, so the door's colour and
 * the wall's cannot be taken for each other: navy is blue over red, taupe red
 * over blue, and the tile is white. The mouse clicks the hood's label, the camera
 * flies to the right leg, and the pixels are read where three points of the room
 * land on the screen — projected through the camera the page renders with (three.js's
 * devtools hook), the room's figures worked out here from the same link:
 *
 * - the strip: the right leg's back board, between the countertop and the wall
 *   cabinets, beside the cooking surface — the wall's taupe, not the door's navy;
 * - the tile: behind the cooking surface, on the right leg — the tile's white,
 *   brighter than the strip and neither warm nor blue;
 * - and, the room turned level with the back wall by the mouse (dragged up, six
 *   notches of the wheel), the back wall where the tile stood until 12a, beside the
 *   window — the wall, as the wall mirrored across the window is.
 *
 * Red first on 479f19e, where the strip is navy, the right leg has no tile and the
 * back wall has one.
 */

const DESKTOP = { width: 1440, height: 900 };
const EXPECTED_TESTS = 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} U back board tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

type Point = [number, number, number];
const ft = room.ft;

/** The three points, from the room the link builds (the page builds the same one). */
function pointsOf(link: string) {
  const opened = useAppStore.getState();
  resetRoom();
  openSharedLink(link);
  try {
    const right = room.RUN_BY_ID.right;
    const board = legBackBoards(CABINETS, "U").find((b) => b.run === "right")!;
    // The board's face toward the room, before 12a as after: the leg's back line.
    const face = board.position[0] - board.size[0] / 2;
    const into = right.facing.sign; // the room is the way the leg faces
    const cooking = right.segments.find((s) => s.slot === "slot-range" || s.slot === "slot-cooktop")!;
    // Beside the cooking surface toward the leg's open end (the side the hood's view looks along),
    // the first stretch with nothing between the counter and the wall cabinets.
    const lowAt = (z: number) =>
      CABINETS.filter((box) => box.run === "right" && Math.abs(box.position[2] - z) < box.size[2] / 2).every(
        (box) => box.position[1] + box.size[1] / 2 <= room.ROOM.counterHeight + ft(0.5) || box.position[1] - box.size[1] / 2 >= room.ROOM.upperBottom - ft(0.5),
      );
    const beside = right.segments.slice(right.segments.indexOf(cooking) + 1).find((s) => lowAt((s.from + s.to) / 2))!;
    const back = room.RUN_BY_ID.back;
    const wallZ = back.centre - back.facing.sign * (room.ROOM.counterDepth / 2) + back.facing.sign * ft(1);
    // Where 479f19e put the tile: the cooking segment's span read along the back wall. Its part
    // clear of the window (the tile stood half an inch proud of the wall, over the window's corner).
    const window = room.WINDOWS.find((w) => w.wall === "back")!;
    const [w0, w1] = window.along;
    const clear = [
      [cooking.from, Math.min(cooking.to, w0)],
      [Math.max(cooking.from, w1), cooking.to],
    ].sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    const oldTileX = (clear[0] + clear[1]) / 2;
    // And the same wall on the window's other side, mirrored across it: a wall in both builds.
    return {
      strip: [face + into * ft(0.1), ft(45), (beside.from + beside.to) / 2] as Point,
      tile: [face + into * ft(0.6), ft(50), (cooking.from + cooking.to) / 2] as Point,
      oldTile: [oldTileX, ft(45), wallZ] as Point,
      wallBeside: [w0 + w1 - oldTileX, ft(45), wallZ] as Point,
      beside: beside.slot,
    };
  } finally {
    resetRoom();
    useAppStore.setState(opened, true);
  }
}

async function open(link: string) {
  const context = await browser.newContext({ viewport: DESKTOP });
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
        own(scene, camera);
      };
    });
  });
  await openWatched(page, `${PREVIEW_URL}/${link}`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `uBackBoardTile · ${expect.getState().currentTestName ?? ""}` });
  await page.waitForTimeout(2500);
  const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await notice.count()) await click(page, notice.first());
  return { page, errors };
}

async function click(page: Page, locator: ReturnType<Page["locator"]>, wait = 1800) {
  const box = (await locator.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(wait);
}

/** Each point's pixel: the mean colour of the 5 x 5 round where it lands, with what is laid over the room hidden. */
async function pixelsAt(page: Page, points: Record<string, Point>) {
  const at = await page.evaluate((pts) => {
    const camera = (window as unknown as { __camera: { matrixWorldInverse: { elements: number[] }; projectionMatrix: { elements: number[] } } }).__camera;
    const canvas = document.querySelector("canvas")!.getBoundingClientRect();
    const mul = (m: number[], v: number[]) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
    return Object.fromEntries(
      Object.entries(pts).map(([name, p]) => {
        const clip = mul(camera.projectionMatrix.elements, mul(camera.matrixWorldInverse.elements, [...p, 1]));
        const [x, y] = [clip[0] / clip[3], clip[1] / clip[3]];
        return [name, { x: Math.round(canvas.left + ((x + 1) / 2) * canvas.width), y: Math.round(canvas.top + ((1 - y) / 2) * canvas.height), front: clip[3] > 0 }];
      }),
    );
  }, points);
  await page.addStyleTag({ content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }" });
  await page.waitForTimeout(400);
  const png = (await page.screenshot()).toString("base64");
  const rgb = await page.evaluate(
    async ([data, spots]) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const g = c.getContext("2d")!;
      g.drawImage(image, 0, 0);
      return Object.fromEntries(
        Object.entries(spots as Record<string, { x: number; y: number }>).map(([name, { x, y }]) => {
          const d = g.getImageData(x - 2, y - 2, 5, 5).data;
          const sum = [0, 0, 0];
          for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k += 1) sum[k] += d[i + k];
          return [name, sum.map((s) => Math.round(s / 25))];
        }),
      );
    },
    [png, at] as const,
  );
  return { at, rgb: rgb as Record<string, number[]> };
}

const luminance = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const LINK = "?v=2&pkg=D&shape=U&back=132&left=177&corner=blind&lang=en&quality=low&cabinet=navy&wall=taupe";
const onScreen = (at: Record<string, { x: number; y: number; front: boolean }>) =>
  Object.values(at).every((p) => p.front && p.x > 2 && p.x < DESKTOP.width - 2 && p.y > 2 && p.y < DESKTOP.height - 2);

describe("a U's right leg: the wall's colour on the strip, the tile behind the cooking surface, none on the back wall (12a)", () => {
  it("flown to the hood by the mouse: the strip is the wall's taupe, the tile white behind the cooktop", async () => {
    const points = pointsOf(LINK);
    const { page, errors } = await open(LINK);
    await click(page, page.locator('[data-pin-label="slot-hood"]').filter({ visible: true }).first(), 2600);
    const { at, rgb } = await pixelsAt(page, { strip: points.strip, tile: points.tile });
    await page.context().close();
    const [sr, , sb] = rgb.strip;
    const [tr, , tb] = rgb.tile;
    // Measured 2026-11-15 on the 1440 desktop: the strip 189/182/173 (479f19e: the door's 36/47/60),
    // the tile 208/207/203 (479f19e: the board's 36/47/60).
    expect(
      {
        onScreen: onScreen(at),
        stripWarm: sr - sb >= 8,
        stripLight: luminance(rgb.strip) >= 120,
        tileBrighter: luminance(rgb.tile) >= luminance(rgb.strip) + 10,
        tileLessWarm: tr - tb <= sr - sb - 6,
        errors,
      },
      JSON.stringify({ at, rgb, beside: points.beside }),
    ).toEqual({ onScreen: true, stripWarm: true, stripLight: true, tileBrighter: true, tileLessWarm: true, errors: [] });
  });

  it("turned level with the back wall by the mouse: the wall beside the window where the tile stood", async () => {
    const points = pointsOf(LINK);
    const { page, errors } = await open(LINK);
    // Level with the back wall and nearer it, as a person turns the room by the mouse: dragged up, then six notches of the wheel.
    const canvas = (await page.locator("canvas").first().boundingBox())!;
    const [cx, cy] = [canvas.x + canvas.width / 2, canvas.y + canvas.height / 2];
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 150, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(1800);
    for (let notch = 0; notch < 6; notch += 1) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(3000);
    const { at, rgb } = await pixelsAt(page, { oldTile: points.oldTile, wallBeside: points.wallBeside });
    await page.context().close();
    const apart = Math.max(...[0, 1, 2].map((k) => Math.abs(rgb.oldTile[k] - rgb.wallBeside[k])));
    // Measured 2026-11-15: 228/224/219 against the wall's 223/219/214, 5 apart (479f19e: the tile's
    // 236/235/233, 19 apart).
    expect({ onScreen: onScreen(at), theWall: apart <= 8, errors }, JSON.stringify({ at, rgb, apart })).toEqual({
      onScreen: true,
      theWall: true,
      errors: [],
    });
  });
});
