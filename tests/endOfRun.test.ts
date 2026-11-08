import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { openWatched } from "../scripts/pageWatch.mjs";
import { PREVIEW_URL } from "./globalSetup";
import { launchBrowser } from "./siteBrowser";

/**
 * The end of a run, in the room as it is drawn (Leo, 2026-11-05: a tall unit
 * at a wall, his site practice 甲; the open end, A-9 to A-13). Read off the
 * scene: the 3" between D's and B's oven tower and the wall is one board
 * floor to top in the doors' colour, and no stone reaches into it; the open
 * end's board stops under the countertop, the stone stands 1" past it, and
 * the wall cabinets end on a 3/4" board of their own. The mouse on a
 * desktop, a finger on a phone (D17).
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
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} end-of-run tests actually ran`).toBe(EXPECTED_TESTS);
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

async function open(phone: boolean, query: string): Promise<Session> {
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
  await openWatched(page, `${PREVIEW_URL}${query}`, {
    gotoTimeout: 90_000,
    canvasTimeout: 60_000,
    label: `endOfRun · ${expect.getState().currentTestName ?? ""}`,
  });
  await page.waitForTimeout(2500);
  return { page, phone, errors };
}

async function press(s: Session, name: string) {
  const locator = s.page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  if (s.phone) await s.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await s.page.waitForTimeout(3000);
}

/**
 * A board read off the scene by the start of its name, and the countertop
 * against it: the board's floor and top in inches, its width along the run,
 * whether its face is in a cabinet door's colour, and how far the stone on
 * that run stands past the board's outer end (negative: it stops short).
 */
const board = (s: Session, prefix: string, wallPrefix?: string) =>
  s.page.evaluate(
    ({ prefix, wallPrefix }) => {
      type Box = { min: Record<"x" | "y" | "z", number>; max: Record<"x" | "y" | "z", number>; clone(): Box; applyMatrix4(m: unknown): Box; isEmpty?(): boolean };
      type Node = {
        name: string;
        children: Node[];
        isMesh?: boolean;
        visible: boolean;
        matrixWorld: unknown;
        material?: { color?: { getHexString(): string } };
        geometry?: { boundingBox: Box | null; computeBoundingBox(): void; attributes: { position?: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } } };
        getObjectByName?: (n: string) => Node | undefined;
        updateWorldMatrix(parents: boolean, children: boolean): void;
      };
      const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
      const scene = scenes.find((candidate) => candidate.getObjectByName?.("cabinet-layer"));
      if (!scene) return null;
      scene.updateWorldMatrix(true, true);
      const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000 + 0;
      // Heights to the quarter inch: a board's face is drawn 1/16" inside its box.
      const quarter = (ft: number) => Math.round(ft * 12 * 4) / 4 + 0;
      const meshes: Node[] = [];
      const walk = (node: Node, inGroup: string | null) => {
        const group = node.name || inGroup;
        if (node.isMesh && node.visible && node.geometry) meshes.push(Object.assign(node, { __group: group }));
        node.children.forEach((child) => walk(child, group));
      };
      walk(scene, null);
      const extentOf = (list: Node[]) => {
        let e: Record<"x" | "y" | "z", [number, number]> | null = null;
        for (const m of list) {
          m.geometry!.computeBoundingBox();
          const b = m.geometry!.boundingBox!.clone().applyMatrix4(m.matrixWorld);
          e = e
            ? { x: [Math.min(e.x[0], b.min.x), Math.max(e.x[1], b.max.x)], y: [Math.min(e.y[0], b.min.y), Math.max(e.y[1], b.max.y)], z: [Math.min(e.z[0], b.min.z), Math.max(e.z[1], b.max.z)] }
            : { x: [b.min.x, b.max.x], y: [b.min.y, b.max.y], z: [b.min.z, b.max.z] };
        }
        return e;
      };
      const groupOf = (m: Node) => (m as unknown as { __group: string | null }).__group ?? "";
      const own = meshes.filter((m) => groupOf(m).startsWith(`strip-${prefix}`) && !groupOf(m).endsWith("-stack"));
      const stack = meshes.filter((m) => groupOf(m).startsWith(`strip-${prefix}`) && groupOf(m).endsWith("-stack"));
      const e = extentOf(own);
      if (!e) return { found: false };
      const top = stack.length ? extentOf(stack)!.y[1] : e.y[1];
      // A board is drawn as its face, so on the floor plan it is its width
      // along the run and its thickness across it: the longer way is along.
      const along = e.x[1] - e.x[0] > e.z[1] - e.z[0] ? "x" : "z";
      const across = along === "x" ? "z" : "x";
      // The countertop: the one mesh at counter height, wide.
      const counter = meshes.find((m) => {
        const c = extentOf([m])!;
        return c.y[0] > 34 / 12 && c.y[1] < 36.2 / 12 && c.x[1] - c.x[0] > 5 && !groupOf(m).startsWith("strip-") && !groupOf(m).startsWith("door-");
      });
      let past: number | null = null;
      if (counter) {
        const p = counter.geometry!.attributes.position!;
        const V = (scene as unknown as { position: { constructor: new () => { set(x: number, y: number, z: number): unknown; applyMatrix4(m: unknown): { x: number; y: number; z: number } } } }).position.constructor;
        const hi = e[along][1];
        let reach = -Infinity;
        for (let i = 0; i < p.count; i += 1) {
          const v = new V();
          v.set(p.getX(i), p.getY(i), p.getZ(i));
          const w = v.applyMatrix4(counter.matrixWorld);
          const a = along === "x" ? w.x : w.z;
          const c = across === "x" ? w.x : w.z;
          // On this run: within its depth and an inch.
          if (c < e[across][0] - 1 / 12 || c > e[across][1] + 2 / 12) continue;
          reach = Math.max(reach, a);
        }
        past = Number.isFinite(reach) ? inches(reach - hi) : null;
      }
      const doorColour = meshes.find((m) => groupOf(m).startsWith("door-") && /-B\d+-/.test(groupOf(m)))?.material?.color?.getHexString() ?? null;
      const colour = own[0]?.material?.color?.getHexString() ?? null;
      // The wall cabinets' own end board, WEP, on that run.
      const wall = wallPrefix ? extentOf(meshes.filter((m) => groupOf(m).startsWith(`strip-${wallPrefix}`) && groupOf(m).includes("-WEP") && !groupOf(m).endsWith("-stack"))) : null;
      return {
        found: true,
        floorIn: quarter(e.y[0]),
        topIn: quarter(top),
        widthIn: inches(e[along][1] - e[along][0]),
        doorColour: colour !== null && colour === doorColour,
        stonePastIn: past,
        wallCabinetBoard: wall ? { widthIn: inches(wall[along][1] - wall[along][0]), topIn: quarter(wall.y[1]), endsWithBoard: Math.abs(wall[along][1] - e[along][1]) < 1e-4 || Math.abs(wall[along][0] - e[along][0]) < 1e-4 } : null,
      };
    },
    { prefix, wallPrefix },
  );

describe("the end of a run, as drawn (Leo, 2026-11-05)", () => {
  it("stands D's 3 inches beside its oven tower as one board floor to top in the doors' colour, no stone in it, on a desktop", async () => {
    const s = await open(false, "?quality=low");
    await press(s, "D");
    expect({ board: await board(s, "back-back-end-BF3-"), errors: s.errors }).toEqual({
      // The stone stops at the tower's inner side: its 30" and the 3" short.
      board: { found: true, floorIn: 0, topIn: 108, widthIn: 3, doorColour: true, stonePastIn: -33, wallCabinetBoard: null },
      errors: [],
    });
    await s.page.context().close();
  });

  it("does so for B, its refrigerator's end at a wall, by a finger on a phone", async () => {
    const s = await open(true, "?v=2&pkg=B&corner=blind&towerSide=right&fridgeLeg=left&sinkLeg=back&coffeeLeg=left&fridgeAbuts=wall&quality=low");
    expect({ board: await board(s, "back-back-end-BF3-"), errors: s.errors }).toEqual({
      // The stone stops at the tower's inner side: its 30" and the 3" short.
      board: { found: true, floorIn: 0, topIn: 108, widthIn: 3, doorColour: true, stonePastIn: -33, wallCabinetBoard: null },
      errors: [],
    });
    await s.page.context().close();
  });

  it("ends A's open left leg on a 3/4-inch board under the top, the stone 1 inch past it, the wall cabinets on a 3/4-inch board", async () => {
    const s = await open(false, "?v=2&pkg=A&fridgeLeg=back&sinkLeg=left&quality=low");
    expect({ board: await board(s, "left-left-end-panel-BEP0.75-", "upper-left"), errors: s.errors }).toEqual({
      board: {
        found: true,
        floorIn: 0,
        topIn: 34.5,
        widthIn: 0.75,
        doorColour: true,
        stonePastIn: 1,
        // Its own box, to 96" as the wall cabinets' are; the 12" stacked over it
        // is a box of its own.
        wallCabinetBoard: { widthIn: 0.75, topIn: 96, endsWithBoard: true },
      },
      errors: [],
    });
    await s.page.context().close();
  });
});
