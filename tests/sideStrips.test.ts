import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 85: the strips a machine draws beside itself, where it is narrower
 * than its opening, are faced like the cabinets beside them.
 *
 * Found in round 84 on the strips beside a range (D16): they cast shadows and
 * took none, so their fronts were lit where every cabinet front beside them is
 * in shadow, and they had no face — their front was the carcass line, 3/4"
 * behind the doors. The range's are the run's own fillers since round 84. The
 * rest — beside a wall hood narrower than its slot (round 79) and inside a tall
 * unit's opening when a column is narrower than it — are still the machine's,
 * and now carry the same face the run's boards do (`BoardFace`), in the plane
 * of the doors, and take shadows.
 *
 * Read from the scene through three.js's devtools hook, in the machine's own
 * frame: the front of the strips against the front of the cabinet faces just
 * outside them, at the strips' own height; and that no part of the machine
 * stands in a strip's stretch — a column's door used to reach over it toward
 * the kit beside it (`doorOverhang`). Real input — the mouse on a desktop, a
 * finger on a phone (D17).
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 8;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} side-strip tests actually ran`).toBe(EXPECTED_TESTS);
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

/** Package, then the machine picked by its label, then a model from the card. */
async function choose(s: Session, pkg: string, slot: string, model: string) {
  if (pkg !== "A") {
    await press(s, s.page.getByRole("button", { name: pkg, exact: true }).filter({ visible: true }).first());
    await s.page.waitForTimeout(2500);
    await s.page.waitForFunction(() => !document.querySelector('[role="status"]'), null, { timeout: 40_000 }).catch(() => {});
  }
  await press(s, s.page.locator(`[data-pin-label="${slot}"]`).first());
  await s.page.waitForTimeout(2500);
  await press(s, s.page.locator(`[data-model-card] [data-candidate="${model}"]`).first());
  await s.page.waitForTimeout(2500);
}

/**
 * The strips the machine in `slot` draws beside itself, in its own frame:
 * how many meshes, whether every one takes shadows, and how far the cabinet
 * faces just outside them stand in front of the strips' own front, in inches.
 */
const strips = (s: Session, slot: string) =>
  s.page.evaluate((slot) => {
    type V3 = { x: number; y: number; z: number; applyMatrix4(m: unknown): V3; clone(): V3 };
    type Box = { min: V3; max: V3; clone(): Box; applyMatrix4(m: unknown): Box };
    type Mat4 = { clone(): Mat4; invert(): Mat4 };
    type Node = {
      name?: string;
      children: Node[];
      isMesh?: boolean;
      visible: boolean;
      receiveShadow?: boolean;
      matrixWorld: Mat4;
      geometry?: { boundingBox: Box | null; computeBoundingBox(): void };
      userData?: { boxId?: string };
      getObjectByName?: (n: string) => Node | undefined;
      updateWorldMatrix(parents: boolean, children: boolean): void;
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const scene = scenes.find((sc) => sc.getObjectByName?.(`appliance-filler-${slot}`));
    if (!scene) return { meshes: 0, allTakeShadows: false, frontGapIn: null as number | null, machineInStrips: -1 };
    scene.updateWorldMatrix(true, true);
    const machine = scene.getObjectByName!(`appliance-${slot}`)!;
    const toLocal = machine.matrixWorld.clone().invert();
    const local = (mesh: Node): Box => {
      mesh.geometry!.computeBoundingBox();
      return mesh.geometry!.boundingBox!.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(toLocal);
    };
    const meshes: Node[] = [];
    const walk = (node: Node, into: Node[]) => {
      if (node.isMesh && node.visible) into.push(node);
      node.children.forEach((child) => walk(child, into));
    };
    walk(scene.getObjectByName!(`appliance-filler-${slot}`)!, meshes);
    const boxes = meshes.map(local);
    const front = Math.max(...boxes.map((b) => b.max.z));
    const left = Math.min(...boxes.map((b) => b.min.x));
    const right = Math.max(...boxes.map((b) => b.max.x));
    const y = (Math.min(...boxes.map((b) => b.min.y)) + Math.max(...boxes.map((b) => b.max.y))) / 2;
    // The cabinet faces just outside each strip, at the strips' height: the
    // frontmost joinery there is the door, or the board's face, beside them.
    const joinery: Node[] = [];
    walk(scene.getObjectByName!("cabinet-layer")!, joinery);
    const faceAt = (x: number) =>
      Math.max(
        ...joinery
          .map(local)
          .filter((b) => b.min.x <= x && x <= b.max.x && b.min.y <= y && y <= b.max.y)
          .map((b) => b.max.z),
      );
    const outside = 0.5 / 12;
    // The frontmost of the two: in a column bank one side of an opening is the
    // 5/8" COMBIKIT, which stands back behind the doors that close over it
    // (D11, round 30), and the plane is the bank's end board's on the other.
    const cabinets = Math.max(faceAt(left - outside), faceAt(right + outside));
    // And nothing of the machine stands in a strip's stretch: a column's door
    // reached over the strip toward the kit beside it until round 85
    // (`doorOverhang`), and the strip's face then hid its edge and handle.
    const body: Node[] = [];
    walk(scene.getObjectByName!(`appliance-body-${slot}`)!, body);
    const stretches = boxes.map((b) => [b.min.x, b.max.x] as const);
    const slack = 1 / 16 / 12;
    const machineInStrips = body
      .map(local)
      .filter((b) => stretches.some(([a, c]) => b.max.x > a + slack && b.min.x < c - slack)).length;
    return {
      meshes: meshes.length,
      allTakeShadows: meshes.every((m) => m.receiveShadow === true),
      frontGapIn: Math.round((cabinets - front) * 12 * 1000) / 1000 + 0,
      machineInStrips,
    };
  }, slot);

describe("the strips a machine draws beside itself", () => {
  const cases: [string, string, string, string, boolean][] = [
    ["a 30-inch hood in package A's 36-inch slot", "A", "slot-hood", "zephyr-ak7300as", false],
    ["a 30-inch hood in package A's 36-inch slot", "A", "slot-hood", "zephyr-ak7300as", true],
    ["a 30-inch hood in package B's 42-inch housing slot", "B", "slot-hood", "zephyr-ak7300as", false],
    ["a 30-inch column in package A's 36-inch refrigerator opening", "A", "slot-fridge", "thermador-t30ir905sp", false],
    ["a 30-inch column in package A's 36-inch refrigerator opening", "A", "slot-fridge", "thermador-t30ir905sp", true],
    ["an 18-inch freezer column in package D's 24-inch opening", "D", "slot-freezer", "thermador-t18if900sp", false],
    ["an 18-inch wine column in package D's 24-inch opening", "D", "slot-wine", "thermador-t18iw100sp", false],
    ["a 30-inch column in package B's 36-inch refrigerator opening, beside its wine column", "B", "slot-fridge", "thermador-t30ir905sp", false],
  ];
  for (const [what, pkg, slot, model, phone] of cases) {
    it(`face ${what} in the doors' plane and take shadows, ${phone ? "on a phone with touch" : "on a desktop with the mouse"}`, async () => {
      const s = await open(phone);
      await choose(s, pkg, slot, model);
      const got = await strips(s, slot);
      expect({ ...got, errors: s.errors }).toEqual({
        meshes: got.meshes > 0 ? got.meshes : -1,
        allTakeShadows: true,
        frontGapIn: 0,
        machineInStrips: 0,
        errors: [],
      });
      await s.page.context().close();
    });
  }
});
