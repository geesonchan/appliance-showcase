import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The refrigerator's front, in the room as it is drawn (the fridge-front
 * plan; Leo, 2026-10-24 and 2026-10-27). A built-in stands between a plain
 * 3/4" side panel on the counter's side and, at its end, a 3/4" panel against
 * cabinetry or 3-1/2" of filler against a wall; its doors are 35-3/4", so an
 * eighth shows each side; and their face is in the plane of the boards and
 * the cabinet doors. A model that needs more wall grows it and says so in
 * Leo's words, with an Undo. Real input throughout — the mouse on a desktop,
 * a finger on a phone (D17).
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
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} refrigerator-front tests actually ran`).toBe(EXPECTED_TESTS);
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
  phone: boolean;
  errors: string[];
}

async function open(phone: boolean, query = ""): Promise<Session> {
  const context = await browser.newContext(
    phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  // Three.js announces each scene to its devtools hook; keep them to look in.
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
  const url = PREVIEW_URL + (query ? `${query}&quality=high` : "?quality=high");
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);
  return { page, phone, errors };
}

async function press(s: Session, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
}

async function pick(s: Session, model: string) {
  await press(s, s.page.locator('[data-pin-label="slot-fridge"]').first());
  await s.page.waitForTimeout(2500);
  await press(s, s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first());
  await s.page.waitForTimeout(3000);
}

/**
 * Either side of the refrigerator, read off the scene, in inches: the boards'
 * widths in the order they stand along the run, the gap between each and the
 * doors, and how far the doors' face stands from the boards' faces and from
 * the face of the base cabinet's door beside them (positive is proud).
 */
const sides = (s: Session) =>
  s.page.evaluate(() => {
    type Box = { min: Record<"x" | "y" | "z", number>; max: Record<"x" | "y" | "z", number>; clone(): Box; applyMatrix4(m: unknown): Box };
    type Node = {
      name: string;
      children: Node[];
      isMesh?: boolean;
      visible: boolean;
      matrixWorld: unknown;
      geometry?: { boundingBox: Box | null; computeBoundingBox(): void };
      getObjectByName?: (n: string) => Node | undefined;
      updateWorldMatrix(parents: boolean, children: boolean): void;
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const scene = scenes.find((candidate) => candidate.getObjectByName?.("appliance-body-slot-fridge"));
    if (!scene) return null;
    scene.updateWorldMatrix(true, true);
    type Extent = { x: [number, number]; z: [number, number] };
    const extent = (root: Node, skip: (node: Node) => boolean = () => false): Extent | null => {
      let found: Extent | null = null;
      const walk = (node: Node) => {
        if (skip(node)) return;
        if (node.isMesh && node.visible && node.geometry) {
          node.geometry.computeBoundingBox();
          const b = node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld);
          found = found
            ? { x: [Math.min(found.x[0], b.min.x), Math.max(found.x[1], b.max.x)], z: [Math.min(found.z[0], b.min.z), Math.max(found.z[1], b.max.z)] }
            : { x: [b.min.x, b.max.x], z: [b.min.z, b.max.z] };
        }
        node.children.forEach(walk);
      };
      walk(root);
      return found;
    };
    const named = (test: (name: string) => boolean) => {
      const out: Node[] = [];
      const walk = (node: Node) => {
        if (test(node.name)) out.push(node);
        node.children.forEach(walk);
      };
      walk(scene);
      return out;
    };
    const body = scene.getObjectByName!("appliance-body-slot-fridge")!;
    const fronts = named((name) => name.startsWith("fridge-panel-")).map((panel) =>
      extent(panel, (node) => node.name.startsWith("fridge-handle-")),
    );
    const handles = named((name) => name.startsWith("fridge-handle-")).map((handle) => extent(handle)!);
    const doors = fronts.reduce((a, b) => ({
      x: [Math.min(a!.x[0], b!.x[0]), Math.max(a!.x[1], b!.x[1])],
      z: [Math.min(a!.z[0], b!.z[0]), Math.max(a!.z[1], b!.z[1])],
    }))!;
    // Across the run is the axis the doors are thin on; the face is on the
    // side the handles stand out to.
    const across = doors.x[1] - doors.x[0] < doors.z[1] - doors.z[0] ? "x" : "z";
    const along = across === "x" ? "z" : "x";
    const middle = (e: Extent, axis: "x" | "z") => (e[axis][0] + e[axis][1]) / 2;
    const sign = Math.sign(middle(handles[0], across) - middle(doors, across));
    const face = (e: Extent) => (sign > 0 ? e[across][1] : -e[across][0]);
    const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000;
    // The boards round the machine: the run's strip nearest the doors on each
    // side, within an inch of them. Only the nearest — the filler beyond the
    // side panel (A's BF1.5, BF1.75 at a wall) also stands within an inch.
    const strips = named((name) => /^strip-.*-(PNL|BF)[\d.]+-\d+$/.test(name))
      .map((strip) => extent(strip)!)
      .filter((e) => e[across][0] < doors[across][1] && e[across][1] > doors[across][0]);
    const before = strips
      .filter((e) => e[along][1] <= doors[along][0] + 1e-6)
      .sort((a, b) => b[along][1] - a[along][1])[0];
    const after = strips
      .filter((e) => e[along][0] >= doors[along][1] - 1e-6)
      .sort((a, b) => a[along][0] - b[along][0])[0];
    const boards = [
      ...(before && doors[along][0] - before[along][1] < 1 / 12 ? [before] : []),
      ...(after && after[along][0] - doors[along][1] < 1 / 12 ? [after] : []),
    ];
    const cabinetDoor = named((name) => /^door-.*-B3\d-/.test(name)).map((door) => extent(door)!)[0];
    void body;
    return {
      boardsIn: boards.map((e) => inches(e[along][1] - e[along][0])),
      gapsIn: boards.length === 2 ? [inches(doors[along][0] - boards[0][along][1]), inches(boards[1][along][0] - doors[along][1])] : null,
      doorsProudOfTheBoardsIn: boards.map((e) => inches(face(doors) - face(e))),
      doorsProudOfTheCabinetDoorIn: cabinetDoor ? inches(face(doors) - face(cabinetDoor)) : null,
    };
  });

describe("a built-in refrigerator's front (Leo, 2026-10-24 and 2026-10-27)", () => {
  it("stands A's T36BT120NS between two 3/4\" panels, an eighth each side, its doors flush, on a desktop", async () => {
    const s = await open(false);
    expect({ sides: await sides(s), errors: s.errors }).toEqual({
      sides: { boardsIn: [0.75, 0.75], gapsIn: [0.125, 0.125], doorsProudOfTheBoardsIn: [0, 0], doorsProudOfTheCabinetDoorIn: 0 },
      errors: [],
    });
    await s.page.context().close();
  });

  it("stands T36IT100NP, picked by touch on a phone, between the side panel and 3-1/2\" of filler at a wall", async () => {
    const s = await open(true, "?v=1&pkg=A&fridgeAbuts=wall");
    await pick(s, "thermador-t36it100np");
    const measured = await sides(s);
    expect({
      boardsIn: [...(measured?.boardsIn ?? [])].sort((a, b) => a - b),
      gapsIn: measured?.gapsIn,
      doorsProudOfTheBoardsIn: measured?.doorsProudOfTheBoardsIn,
      errors: s.errors,
    }).toEqual({ boardsIn: [0.75, 3.5], gapsIn: [0.125, 0.125], doorsProudOfTheBoardsIn: [0, 0], errors: [] });
    await s.page.context().close();
  });
});

describe("a refrigerator that needs more wall (Leo, 2026-10-24, 5; 2026-10-27, 6)", () => {
  const toast = (s: Session) => s.page.locator('[data-toast="toast.modelGrew"]');

  it("grows A's one wall for T36FT820NS and says so in Chinese; the mouse on Undo takes it back", async () => {
    const s = await open(false, "?v=2&pkg=A&lang=zh&shape=one-wall&back=236");
    await pick(s, "thermador-t36ft820ns");
    const said = (await toast(s).locator("span").first().innerText()).trim();
    await press(s, toast(s).locator("[data-toast-undo]"));
    await s.page.waitForTimeout(2500);
    expect({ said, gone: await toast(s).count(), errors: s.errors }).toEqual({
      said: "换了型号，后墙不够长，已加长到 238¼″。",
      gone: 0,
      errors: [],
    });
    await s.page.context().close();
  });

  it("says it in English on a phone, and a finger on Undo takes it back", async () => {
    const s = await open(true, "?v=2&pkg=A&lang=en&shape=one-wall&back=236");
    await pick(s, "thermador-t36ft820ns");
    const said = (await toast(s).locator("span").first().innerText()).trim();
    await press(s, toast(s).locator("[data-toast-undo]"));
    await s.page.waitForTimeout(2500);
    expect({ said, gone: await toast(s).count(), errors: s.errors }).toEqual({
      said: "The new model needs more room: Back wall is now 238¼″.",
      gone: 0,
      errors: [],
    });
    await s.page.context().close();
  });
});
