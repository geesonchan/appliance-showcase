import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * Round 83: what is under a cooking surface follows the machine chosen.
 *
 * Leo, from using package A: changed from its pro range to the PCG366W
 * rangetop on the model card, the rangetop hung at counter height over an
 * empty opening. His rule, from site: a rangetop always has a base cabinet
 * under it, in any package, whichever way the swap goes. And the other way
 * round, a range standing on the floor has nothing under it — package B with
 * its rangetop changed to a pro range drew the range inside B's base cabinet.
 *
 * Read from the scene itself, through three.js's devtools hook: a cabinet box
 * in the range's own segment (`<run>-range-B<width>`) is the swing-door base
 * the run orders under a rangetop or a cooktop (`DB` until 2026-11-07, Leo). Real input — the mouse on a desktop, a finger
 * on a phone (D17).
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 14;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} range-swap tests actually ran`).toBe(EXPECTED_TESTS);
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
  await openWatched(page, PREVIEW_URL + "?quality=high", { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `rangeSwap · ${expect.getState().currentTestName ?? ""}` });
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

/** The cabinet boxes standing in the range's own segment, by id. */
const underTheRange = (s: Session) =>
  s.page.evaluate(() => {
    type Node = { children: Node[]; userData?: { boxId?: string }; getObjectByName?: (n: string) => Node | undefined };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const layer = scenes.map((scene) => scene.getObjectByName?.("cabinet-layer")).find(Boolean);
    const ids: string[] = [];
    const walk = (node: Node) => {
      const id = node.userData?.boxId;
      // The range segment itself, not its landings ("back-range-landing-…").
      if (id && /^(back|left)-range-[A-Z]{1,3}\d/.test(id)) ids.push(id);
      node.children.forEach(walk);
    };
    if (layer) walk(layer);
    return [...new Set(ids)].sort();
  });

/**
 * Meshes the machine draws beside itself to fill its opening (`Filler` in
 * ApplianceModel). Since round 84 a range narrower than its opening has none:
 * the run closes the gap with its own fillers.
 */
const machineFillers = (s: Session) =>
  s.page.evaluate(() => {
    type Node = { children: Node[]; isMesh?: boolean; getObjectByName?: (n: string) => Node | undefined };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const group = scenes.map((scene) => scene.getObjectByName?.("appliance-filler-slot-range")).find(Boolean);
    let meshes = 0;
    const walk = (node: Node) => {
      if (node.isMesh) meshes += 1;
      node.children.forEach(walk);
    };
    if (group) walk(group);
    return meshes;
  });

/**
 * What the sight-line fade has hidden at the range while it is flown to: the
 * countertop (one extruded slab, with no box id of its own) and the run's
 * fillers in the range's segment. Round 84: the fillers and the stone over them
 * stand where the machine's own strips stood, which the fade never counted, so
 * flying to the range must not turn them, or the whole countertop, to glass.
 */
const fadedAtTheRange = (s: Session) =>
  s.page.evaluate(() => {
    type Mat = { transparent: boolean; opacity: number };
    type Node = {
      children: Node[];
      isMesh?: boolean;
      material?: Mat | Mat[];
      geometry?: { type?: string };
      userData?: { boxId?: string };
      getObjectByName?: (n: string) => Node | undefined;
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const layer = scenes.map((scene) => scene.getObjectByName?.("cabinet-layer")).find(Boolean);
    const faded = (m: Node) =>
      !!m.material && !Array.isArray(m.material) && m.material.transparent && m.material.opacity <= 0.2 + 1e-6;
    const out = new Set<string>();
    const walk = (node: Node, box: string | undefined) => {
      const id = node.userData?.boxId ?? box;
      if (node.isMesh && faded(node)) {
        if (!id && node.geometry?.type === "ExtrudeGeometry") out.add("countertop");
        if (id && /^(back|left)-range-BF/.test(id)) out.add(id);
      }
      node.children.forEach((child) => walk(child, id));
    };
    if (layer) walk(layer, undefined);
    return [...out].sort();
  });

/** Which cooking machine the scene is drawing in the range's place. */
const cookingMachine = (s: Session) =>
  s.page.evaluate(() => {
    type Node = { getObjectByName?: (n: string) => Node | undefined };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const has = (name: string) => scenes.some((scene) => scene.getObjectByName?.(name));
    return { cooktop: has("cooktop"), rangetop: has("rangetop") };
  });

/** Package, then the range picked by its label, then a model from the card. */
async function swap(s: Session, pkg: string, ...models: string[]) {
  await press(s, s.page.getByRole("button", { name: pkg, exact: true }).filter({ visible: true }).first());
  await s.page.waitForTimeout(2500);
  await s.page.waitForFunction(() => !document.querySelector('[role="status"]'), null, { timeout: 40_000 }).catch(() => {});
  await press(s, s.page.locator('[data-pin-label="slot-range"]').first());
  await s.page.waitForTimeout(2500);
  const before = await underTheRange(s);
  for (const model of models) {
    await press(s, s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first());
    await s.page.waitForTimeout(2500);
  }
  const named = (await s.page.locator("[data-model-card] [data-model-line]").first().innerText()).replace(/\s+/g, " ");
  return { before, after: await underTheRange(s), named };
}

describe("what stands under the cooking surface follows the machine chosen", () => {
  for (const phone of [false, true]) {
    const device = phone ? "on a phone with touch" : "on a desktop with the mouse";

    it(`gives a rangetop chosen in package A a door base, ${device}`, async () => {
      const s = await open(phone);
      const r = await swap(s, "A", "thermador-pcg366w");
      expect({ ...r, errors: s.errors }).toEqual({
        before: [],
        after: ["back-range-B36-0"],
        named: "Thermador · PCG366W",
        errors: [],
      });
      await s.page.context().close();
    });

    it(`takes the door base away when package B's rangetop becomes a range on the floor, ${device}`, async () => {
      const s = await open(phone);
      const r = await swap(s, "B", "thermador-prg366wh");
      expect({ ...r, errors: s.errors }).toEqual({
        before: ["back-range-B36-0"],
        after: [],
        named: "Thermador · PRG366WH",
        errors: [],
      });
      await s.page.context().close();
    });

    // Round 84, Leo: a range narrower than its opening is closed in by the
    // run — a filler each side, in the cabinets' finish, under the stone.
    // The run's boxes are `<run>-range-BF<width>-0` and `-2`, either side of
    // the machine's own opening.
    it(`closes package B's 36-inch opening round a 30-inch range with the run's own fillers, ${device}`, async () => {
      const s = await open(phone);
      const r = await swap(s, "B", "maytag-mfgs4030rs");
      expect({
        ...r,
        drawnByTheMachine: await machineFillers(s),
        fadedAtTheRange: await fadedAtTheRange(s),
        errors: s.errors,
      }).toEqual({
        before: ["back-range-B36-0"],
        after: ["back-range-BF3.0625-0", "back-range-BF3.0625-2"],
        named: "Maytag · MFGS4030RS",
        drawnByTheMachine: 0,
        fadedAtTheRange: [],
        errors: [],
      });
      await s.page.context().close();
    });

    it(`closes package A's opening round its 30-inch range, a range for a range, ${device}`, async () => {
      const s = await open(phone);
      const r = await swap(s, "A", "thermador-prg304wh");
      expect({
        ...r,
        drawnByTheMachine: await machineFillers(s),
        fadedAtTheRange: await fadedAtTheRange(s),
        errors: s.errors,
      }).toEqual({
        before: [],
        after: ["back-range-BF3-0", "back-range-BF3-2"],
        named: "Thermador · PRG304WH",
        drawnByTheMachine: 0,
        fadedAtTheRange: [],
        errors: [],
      });
      await s.page.context().close();
    });

    // Leo, 2026-11-08: on B's and D's model card, the induction cooktop and
    // back to the rangetop, once each, by mouse and by finger.
    for (const pkg of ["B", "D"]) {
      it(`takes package ${pkg} to the induction cooktop and back to its rangetop, ${device}`, async () => {
        const s = await open(phone);
        const there = await swap(s, pkg, "thermador-cit367yg");
        const machineThere = await cookingMachine(s);
        await press(s, s.page.locator('[data-model-card] [data-candidate="thermador-pcg366w"]').first());
        await s.page.waitForTimeout(2500);
        const backNamed = (await s.page.locator("[data-model-card] [data-model-line]").first().innerText()).replace(/\s+/g, " ");
        expect({
          there,
          machineThere,
          backUnder: await underTheRange(s),
          backNamed,
          machineBack: await cookingMachine(s),
          errors: s.errors,
        }).toEqual({
          there: { before: ["back-range-B36-0"], after: ["back-range-B36-0"], named: "Thermador · CIT367YG" },
          machineThere: { cooktop: true, rangetop: false },
          backUnder: ["back-range-B36-0"],
          backNamed: "Thermador · PCG366W",
          machineBack: { cooktop: false, rangetop: true },
          errors: [],
        });
        await s.page.context().close();
      });
    }

    it(`puts it back when A goes to a rangetop and back to its range, ${device}`, async () => {
      const s = await open(phone);
      const r = await swap(s, "A", "thermador-pcg366w", "thermador-prg366wh");
      expect({ ...r, errors: s.errors }).toEqual({
        before: [],
        after: [],
        named: "Thermador · PRG366WH",
        errors: [],
      });
      await s.page.context().close();
    });
  }
});
