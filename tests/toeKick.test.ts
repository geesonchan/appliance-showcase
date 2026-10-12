import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 92b, Leo: the cabinets stand on a toe kick that shows, 4" high and
 * 3-3/4" behind the door face, in the doors' finish. Under an oven tower the
 * black slot round 92a showed is now that kick, in the door colour. A
 * dishwasher's door starts where the cabinets' do, on its own kick panel, which
 * goes with the door: the cabinet's finish on a panel-ready machine, its own
 * steel on a steel one.
 *
 * Read from the scene through three.js's devtools hook, in the machine's own
 * frame. The mouse on a desktop (D17). docs/decisions.md D22, round 92b.
 */

const DESKTOP = { width: 1440, height: 900 };

const EXPECTED_TESTS = 6;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} toe-kick tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

async function open(): Promise<Page> {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
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
  return page;
}

async function mouse(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function packageOf(page: Page, pkg: string) {
  if (pkg === "A") return;
  await mouse(page, page.getByRole("button", { name: pkg, exact: true }).filter({ visible: true }).first());
  await page.waitForTimeout(3000);
}

/**
 * Under the machine in `slot`, in its frame, at its middle: the frontmost of
 * the cabinet layer at 2" (inside the kick) and at 8" (the drawer under the
 * oven), how far apart they are in inches, and the colour of the kick there.
 */
const underTower = (page: Page, slot: string) =>
  page.evaluate((slot) => {
    type V3 = { x: number; y: number; z: number };
    type Box = { min: V3; max: V3; clone(): Box; applyMatrix4(m: unknown): Box };
    type Mat4 = { clone(): Mat4; invert(): Mat4 };
    type Node = {
      children: Node[];
      isMesh?: boolean;
      visible: boolean;
      matrixWorld: Mat4;
      material?: { color?: { getHexString(): string } };
      geometry?: { boundingBox: Box | null; computeBoundingBox(): void };
      userData?: { boxId?: string };
      getObjectByName?: (n: string) => Node | undefined;
      updateWorldMatrix(parents: boolean, children: boolean): void;
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const scene = scenes.find((sc) => sc.getObjectByName?.(`appliance-${slot}`));
    if (!scene) return null;
    scene.updateWorldMatrix(true, true);
    const machine = scene.getObjectByName!(`appliance-${slot}`)!;
    const toLocal = machine.matrixWorld.clone().invert();
    // The machine's frame starts at its opening's sill; heights here are from
    // the floor, so they are taken down by the sill.
    const sill = (machine.matrixWorld as unknown as { elements: number[] }).elements[13];
    const meshes: Node[] = [];
    const walk = (node: Node) => {
      if (node.isMesh && node.visible) meshes.push(node);
      node.children.forEach(walk);
    };
    walk(scene.getObjectByName!("cabinet-layer")!);
    const local = (mesh: Node): Box => {
      mesh.geometry!.computeBoundingBox();
      return mesh.geometry!.boundingBox!.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(toLocal);
    };
    const at = (inches: number) => {
      const y = inches / 12 - sill;
      return meshes
        .map((mesh) => ({ mesh, box: local(mesh) }))
        // Only the tower's own depth: in B the island stands in front of it.
        .filter(({ box }) => box.min.x <= 0 && 0 <= box.max.x && box.min.y <= y && y <= box.max.y && box.max.z < 2)
        .sort((p, q) => q.box.max.z - p.box.max.z)[0];
    };
    const kick = at(2);
    const drawer = at(8);
    if (!kick || !drawer) return null;
    return {
      behindIn: Math.round((drawer.box.max.z - kick.box.max.z) * 12 * 100) / 100,
      kickIsKick: (kick.mesh.userData?.boxId ?? "").includes("-toe"),
      kickColour: "#" + kick.mesh.material!.color!.getHexString().toUpperCase(),
    };
  }, slot);

describe("the toe kick under an oven tower", () => {
  for (const [pkg, slot] of [["B", "slot-microwave"], ["D", "slot-oven"], ["E", "slot-microwave"]] as const) {
    it(`shows under ${pkg}'s oven tower, 3-3/4" behind the drawer's face, in the door colour`, async () => {
      const page = await open();
      await packageOf(page, pkg);
      expect(await underTower(page, slot)).toEqual({ behindIn: 3.75, kickIsKick: true, kickColour: "#2874B2" });
      await page.context().close();
    });
  }

  it("follows the door colour when the doors change, with the mouse", async () => {
    const page = await open();
    await packageOf(page, "B");
    await mouse(page, page.locator(`[data-swatch="#2B3A4A"]`).first());
    await page.waitForTimeout(1500);
    expect((await underTower(page, "slot-microwave"))?.kickColour).toBe("#2B3A4A");
    await page.context().close();
  });
});

/** The dishwasher's door and its kick panel, in its own frame, in inches. */
const dishwasher = (page: Page) =>
  page.evaluate(() => {
    type V3 = { x: number; y: number; z: number };
    type Box = { min: V3; max: V3; clone(): Box; applyMatrix4(m: unknown): Box };
    type Mat4 = { clone(): Mat4; invert(): Mat4 };
    type Node = {
      name?: string;
      children: Node[];
      isMesh?: boolean;
      matrixWorld: Mat4;
      material?: { color?: { getHexString(): string } };
      geometry?: { type?: string; boundingBox: Box | null; computeBoundingBox(): void };
      getObjectByName?: (n: string) => Node | undefined;
      updateWorldMatrix(parents: boolean, children: boolean): void;
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const scene = scenes.find((sc) => sc.getObjectByName?.("appliance-body-slot-dishwasher"));
    if (!scene) return null;
    scene.updateWorldMatrix(true, true);
    const toLocal = scene.getObjectByName!("appliance-slot-dishwasher")!.matrixWorld.clone().invert();
    const local = (mesh: Node): Box => {
      mesh.geometry!.computeBoundingBox();
      return mesh.geometry!.boundingBox!.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(toLocal);
    };
    const meshes: Node[] = [];
    const walk = (node: Node) => {
      if (node.isMesh) meshes.push(node);
      node.children.forEach(walk);
    };
    walk(scene.getObjectByName!("appliance-body-slot-dishwasher")!);
    const kick = meshes.find((m) => m.name === "dishwasher-kick");
    // The door: the thin slab on the front, a quarter inch thick.
    const door = meshes
      .filter((m) => m !== kick && m.geometry?.type === "BoxGeometry")
      .map((m) => ({ m, b: local(m) }))
      .filter(({ b }) => (b.max.z - b.min.z) * 12 < 0.3)[0];
    if (!kick || !door) return { kick: Boolean(kick), door: Boolean(door) };
    const k = local(kick);
    const inch = (feet: number) => Math.round(feet * 12 * 100) / 100;
    return {
      // 4" and the door's own margin, which it has always had: within the inch.
      doorFromIn: Math.floor(inch(door.b.min.y)),
      kickHighIn: inch(k.max.y - k.min.y),
      kickBehindIn: inch(door.b.max.z - k.max.z),
      kickColour: "#" + kick.material!.color!.getHexString().toUpperCase(),
      doorColour: "#" + door.m.material!.color!.getHexString().toUpperCase(),
    };
  });

describe("the dishwasher on the toe kick", () => {
  it("starts a panel-ready door at 4\", on a kick panel 3-3/4\" behind it in the door's finish (A)", async () => {
    const page = await open();
    const found = await dishwasher(page);
    expect(found).toEqual({
      doorFromIn: 4,
      kickHighIn: 4,
      kickBehindIn: 3.75,
      kickColour: "#2874B2",
      doorColour: "#2874B2",
    });
    await page.context().close();
  });

  it("gives a steel dishwasher a kick panel in its own steel, not the door colour (C)", async () => {
    const page = await open();
    await packageOf(page, "C");
    const found = (await dishwasher(page)) as { kickColour?: string; doorColour?: string } | null;
    // Found first: with no kick at all, "the same as the door" held on round
    // 92a's build, both sides undefined (D22, round 72: count what is filtered).
    expect({
      kick: typeof found?.kickColour === "string",
      same: found?.kickColour === found?.doorColour,
      notDoors: found?.kickColour !== "#2874B2",
    }).toEqual({ kick: true, same: true, notDoors: true });
    await page.context().close();
  });
});
