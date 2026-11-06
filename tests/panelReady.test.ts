import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";

/**
 * Stainless or panel-ready, chosen on the model card (Leo, 2026-10-28): D's
 * wine column opens stainless, written T24IW905SP-SS; the card's switch makes
 * it panel-ready, written T24IW905SP, its doors in the cabinets' colour, and
 * nothing else about it moves — this round changes the colour only (his
 * answer 7). Real input: the mouse on a desktop, a finger on a phone (D17).
 *
 * And A's refrigerator (Leo, 2026-10-29, 2): T36BT120NS and T36IT100NP name
 * each other, so the same switch on its card changes the model itself. Since
 * 2026-11-02 the column is such a pair too, T24IW905SP-SS and T24IW905SP, two
 * rows, and the card's list below names both.
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
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} stainless / panel-ready tests actually ran`).toBe(EXPECTED_TESTS);
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

async function open(phone: boolean, pkg = "D"): Promise<Session> {
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
  // Package D, by the list's package switch's own link: as it opens.
  await openWatched(page, `${PREVIEW_URL}?v=3&pkg=${pkg}&quality=high`, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `panelReady · ${expect.getState().currentTestName ?? ""}` });
  await page.waitForTimeout(2500);
  // A link with only its package says what it filled in; that notice is not
  // this test's, and it stands over the card on a phone.
  const close = page.locator("[data-share-notice-close]");
  if (await close.count()) await press({ page, phone, errors }, close.first());
  await page.waitForTimeout(500);
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

/**
 * The wine column as drawn: the colours of its meshes, whether it is marked
 * cabinetry, how big it is, and the colour of a cabinet door in the room.
 */
const column = (s: Session, slot = "slot-wine") =>
  s.page.evaluate((slot) => {
    type Node = {
      name: string;
      children: Node[];
      isMesh?: boolean;
      visible: boolean;
      userData: Record<string, unknown>;
      material?: { color?: { getHexString(): string } } | { color?: { getHexString(): string } }[];
      geometry?: { boundingBox: { min: Record<"x" | "y" | "z", number>; max: Record<"x" | "y" | "z", number>; clone(): { applyMatrix4(m: unknown): { min: Record<"x" | "y" | "z", number>; max: Record<"x" | "y" | "z", number> } } } | null; computeBoundingBox(): void };
      matrixWorld: unknown;
      getObjectByName?: (n: string) => Node | undefined;
      updateWorldMatrix(parents: boolean, children: boolean): void;
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const scene = [...scenes].reverse().find((candidate) => candidate.getObjectByName?.(`appliance-body-${slot}`));
    if (!scene) return null;
    scene.updateWorldMatrix(true, true);
    const body = scene.getObjectByName!(`appliance-body-${slot}`)!;
    const colours = new Set<string>();
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    const walk = (node: Node) => {
      if (node.isMesh && node.visible) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) if (material?.color) colours.add(material.color.getHexString());
        if (node.geometry) {
          node.geometry.computeBoundingBox();
          const b = node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld);
          for (const axis of ["x", "y", "z"] as const) {
            min[axis] = Math.min(min[axis], b.min[axis]);
            max[axis] = Math.max(max[axis], b.max[axis]);
          }
        }
      }
      node.children.forEach(walk);
    };
    walk(body);
    // The colours the cabinet doors are drawn in: every mesh under a `door-` group.
    const doorColours = new Set<string>();
    const paint = (node: Node) => {
      if (node.isMesh) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) if (material?.color) doorColours.add(material.color.getHexString());
      }
      node.children.forEach(paint);
    };
    const find = (node: Node) => {
      if (/^door-/.test(node.name)) paint(node);
      else node.children.forEach(find);
    };
    find(scene);
    const r = (v: number) => Math.round(v * 12 * 1000) / 1000;
    return {
      cabinetry: body.userData.cabinetRole === true,
      // Lopsided on purpose: the steel and the grey trim are in neither, so
      // only the doors' own paint on the column can make this true.
      wearsTheDoorColour: [...colours].some((colour) => doorColours.has(colour)),
      sizeIn: [r(max.x - min.x), r(max.y - min.y), r(max.z - min.z)],
      atIn: [r(min.x), r(min.y), r(min.z)],
    };
  }, slot);

async function switchIt(s: Session, slot = "slot-wine") {
  await press(s, s.page.locator(`[data-pin-label="${slot}"]`).first());
  await s.page.waitForTimeout(2500);
  const card = s.page.locator("[data-model-card]");
  // The model the card is on: its own line on a phone, its heading on a desktop.
  const modelLine = s.phone ? card.locator("[data-model-line]").first() : card.locator("[data-card-model]");
  const before = { drawn: await column(s, slot), card: await card.innerText(), model: await modelLine.innerText(), pressed: await card.locator('[data-look="stainless"]').getAttribute("aria-pressed") };
  await press(s, card.locator('[data-look="panelReady"]'));
  await s.page.waitForTimeout(2500);
  const after = { drawn: await column(s, slot), card: await card.innerText(), model: await modelLine.innerText(), pressed: await card.locator('[data-look="panelReady"]').getAttribute("aria-pressed") };
  return { before, after };
}

describe("D's wine column, stainless or panel-ready on the model card (Leo, 2026-10-28)", () => {
  for (const phone of [false, true]) {
    it(`opens stainless and turns panel-ready by ${phone ? "a finger on a phone" : "the mouse on a desktop"}, its doors in the cabinets' colour, nothing else moved`, async () => {
      const s = await open(phone);
      const { before, after } = await switchIt(s);
      expect({
        before: {
          cabinetry: before.drawn?.cabinetry,
          wearsTheDoorColour: before.drawn?.wearsTheDoorColour,
          // The model the card is on; its list below names both rows.
          written: before.model.includes("T24IW905SP-SS"),
          pressed: before.pressed,
        },
        after: {
          cabinetry: after.drawn?.cabinetry,
          wearsTheDoorColour: after.drawn?.wearsTheDoorColour,
          written: after.model.includes("T24IW905SP") && !after.model.includes("T24IW905SP-SS"),
          pressed: after.pressed,
        },
        sameSize: JSON.stringify(after.drawn?.sizeIn) === JSON.stringify(before.drawn?.sizeIn),
        samePlace: JSON.stringify(after.drawn?.atIn) === JSON.stringify(before.drawn?.atIn),
        errors: s.errors,
      }).toEqual({
        before: { cabinetry: false, wearsTheDoorColour: false, written: true, pressed: "true" },
        after: { cabinetry: true, wearsTheDoorColour: true, written: true, pressed: "true" },
        sameSize: true,
        samePlace: true,
        errors: [],
      });
      await s.page.context().close();
    });
  }
});

describe("A's refrigerator, T36BT120NS or T36IT100NP on the model card (Leo, 2026-10-29, 2)", () => {
  for (const phone of [false, true]) {
    it(`opens T36BT120NS and turns to T36IT100NP by ${phone ? "a finger on a phone" : "the mouse on a desktop"}, its doors in the cabinets' colour`, async () => {
      const s = await open(phone, "A");
      const { before, after } = await switchIt(s, "slot-fridge");
      expect({
        before: {
          cabinetry: before.drawn?.cabinetry,
          wearsTheDoorColour: before.drawn?.wearsTheDoorColour,
          // The model the card is on; its list below names both.
          written: before.model.includes("T36BT120NS"),
          pressed: before.pressed,
        },
        after: {
          cabinetry: after.drawn?.cabinetry,
          wearsTheDoorColour: after.drawn?.wearsTheDoorColour,
          // Two real models: neither is written -SS.
          written: after.model.includes("T36IT100NP") && !after.model.includes("-SS"),
          pressed: after.pressed,
        },
        errors: s.errors,
      }).toEqual({
        before: { cabinetry: false, wearsTheDoorColour: false, written: true, pressed: "true" },
        after: { cabinetry: true, wearsTheDoorColour: true, written: true, pressed: "true" },
        errors: [],
      });
      await s.page.context().close();
    });
  }
});
