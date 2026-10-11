import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 89, Leo, from package C: its counter-depth T36FT820NS changed on the
 * model card to the built-in T36BT120NS, and the cabinets round it stayed as
 * they were — the 84" machine ran up behind the cabinet over C's 72" opening.
 * What stands round a refrigerator is the chosen model's to say: an enclosure
 * with a bridge from the head of its 84" opening for a built-in or a column,
 * D11 rule 11's parts and a cabinet an inch over its own top for a
 * counter-depth machine; and a counter-depth machine is refused in a bank of
 * columns. Real input throughout — the mouse on a desktop, a finger on a phone
 * (D17). docs/decisions.md D16, round 89.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 5;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} refrigerator-surround tests actually ran`).toBe(EXPECTED_TESTS);
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
  await page.goto(PREVIEW_URL + "?quality=high", { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2000);
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
 * The cabinet the room draws over the refrigerator, read off the scene: a
 * bridge over an enclosure or rule 11's cabinet over the machine, and the
 * height its underside stands at, in inches.
 */
const over = (s: Session) =>
  s.page.evaluate(() => {
    type Box = { min: { y: number }; clone(): Box; applyMatrix4(m: unknown): Box };
    type Node = {
      children: Node[];
      isMesh?: boolean;
      visible: boolean;
      matrixWorld: unknown;
      userData?: { slot?: string; boxId?: string };
      geometry?: { boundingBox: Box | null; computeBoundingBox(): void };
      getObjectByName?: (n: string) => Node | undefined;
      updateWorldMatrix(parents: boolean, children: boolean): void;
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const layer = scenes.map((scene) => scene.getObjectByName?.("cabinet-layer")).find(Boolean);
    if (!layer) return { kinds: [] as string[], fromIn: null as number | null };
    layer.updateWorldMatrix(true, true);
    const kinds = new Set<string>();
    let lowest = Infinity;
    const walk = (node: Node, box: { slot?: string; boxId?: string } | undefined) => {
      const own = node.userData?.boxId ? node.userData : box;
      const kind = own?.slot === "slot-fridge" ? own.boxId?.match(/-(over|bridge)$/)?.[1] : undefined;
      if (kind && node.isMesh && node.visible && node.geometry) {
        kinds.add(kind);
        node.geometry.computeBoundingBox();
        lowest = Math.min(lowest, node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld).min.y);
      }
      node.children.forEach((child) => walk(child, own));
    };
    walk(layer, undefined);
    return { kinds: [...kinds].sort(), fromIn: Number.isFinite(lowest) ? Math.round(lowest * 12 * 100) / 100 : null };
  });

async function pick(s: Session, pkg: string, model: string) {
  if (pkg !== "A") {
    await press(s, s.page.getByRole("button", { name: pkg, exact: true }).filter({ visible: true }).first());
    await s.page.waitForTimeout(2500);
  }
  await press(s, s.page.locator('[data-pin-label="slot-fridge"]').first());
  await s.page.waitForTimeout(2500);
  await press(s, s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first());
  await s.page.waitForTimeout(3000);
}

describe("what stands round a refrigerator follows the model chosen (round 89)", () => {
  it("builds C's opening into an enclosure for the built-in T36BT120NS on the card, on a desktop", async () => {
    const s = await open(false);
    await s.page.getByRole("button", { name: "C", exact: true }).first().click();
    await s.page.waitForTimeout(2500);
    const before = await over(s);
    await press(s, s.page.locator('[data-pin-label="slot-fridge"]').first());
    await s.page.waitForTimeout(2500);
    await press(s, s.page.locator('[data-model-card] [data-candidate="thermador-t36bt120ns"]').first());
    await s.page.waitForTimeout(3000);
    const after = await over(s);
    expect({ before, after, errors: s.errors }).toEqual({
      before: { kinds: ["over"], fromIn: 73 },
      after: { kinds: ["bridge"], fromIn: 84 },
      errors: [],
    });
    await s.page.context().close();
  });

  it("builds it by touch on a phone", async () => {
    const s = await open(true);
    await pick(s, "C", "thermador-t36bt120ns");
    expect(await over(s)).toEqual({ kinds: ["bridge"], fromIn: 84 });
    await s.page.context().close();
  });

  it("puts C's own counter-depth surround back when T36FT820NS is picked again", async () => {
    const s = await open(false);
    await pick(s, "C", "thermador-t36bt120ns");
    await press(s, s.page.locator('[data-model-card] [data-candidate="thermador-t36ft820ns"]').first());
    await s.page.waitForTimeout(3000);
    expect({ over: await over(s), errors: s.errors }).toEqual({ over: { kinds: ["over"], fromIn: 73 }, errors: [] });
    await s.page.context().close();
  });

  it("gives the counter-depth T36FT820NS rule 11's cabinet an inch over its own top in A, not A's bridge", async () => {
    const s = await open(false);
    await pick(s, "A", "thermador-t36ft820ns");
    expect(await over(s)).toEqual({ kinds: ["over"], fromIn: 73 });
    await s.page.context().close();
  });

  it("refuses the counter-depth T36FT820NS in B's bank of columns, and says why", async () => {
    const s = await open(false);
    await s.page.getByRole("button", { name: "B", exact: true }).first().click();
    await s.page.waitForTimeout(2500);
    await press(s, s.page.locator('[data-pin-label="slot-fridge"]').first());
    await s.page.waitForTimeout(2500);
    const toggle = s.page.locator("[data-model-card] [data-card-refused-toggle]");
    if (await toggle.count()) await press(s, toggle);
    await s.page.waitForTimeout(400);
    const chip = s.page.locator('[data-model-card] [data-candidate="thermador-t36ft820ns"]').first();
    expect({
      disabled: await chip.isDisabled(),
      reason: (await chip.locator('[data-refused="column-bank"]').innerText()).trim(),
      errors: s.errors,
    }).toEqual({
      disabled: true,
      reason: "This opening is part of a column set; a freestanding refrigerator isn't used here.",
      errors: [],
    });
    await s.page.context().close();
  });
});
