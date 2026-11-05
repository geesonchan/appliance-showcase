import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * A group of columns' doors, in the room as it is drawn (round 101, step
 * two; Leo, 2026-11-04, A-16 and A-17). The cases stand against each other
 * with nothing between them; each door is its own opening less 1/4", an
 * eighth from the board at each end and 1/4" from the door beside it; and
 * every door's face is in the plane of the boards and of the cabinet doors.
 * On a desktop with the mouse, on a phone with a finger (D17).
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
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} column-door tests actually ran`).toBe(EXPECTED_TESTS);
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
  await page.goto(`${PREVIEW_URL}${query}&quality=high`, { waitUntil: "networkidle", timeout: 90_000 });
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

/**
 * The group of columns read off the scene, in inches, in the order it stands
 * along the run: each door's width; the gaps from the end board to the first
 * door, between each two doors, and from the last door to the other end
 * board; how far the doors' faces stand from the end boards' faces and from a
 * base cabinet door's face on the same run (positive is proud).
 */
const bank = (s: Session) =>
  s.page.evaluate(() => {
    type Box = { min: Record<"x" | "y" | "z", number>; max: Record<"x" | "y" | "z", number>; clone(): Box; applyMatrix4(m: unknown): Box };
    type Node = {
      name: string;
      children: Node[];
      isMesh?: boolean;
      visible: boolean;
      matrixWorld: unknown;
      geometry?: { type: string; boundingBox: Box | null; computeBoundingBox(): void };
      getObjectByName?: (n: string) => Node | undefined;
      updateWorldMatrix(parents: boolean, children: boolean): void;
    };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const scene = scenes.find((candidate) => candidate.getObjectByName?.("appliance-body-slot-fridge"));
    if (!scene) return null;
    scene.updateWorldMatrix(true, true);
    type Extent = { x: [number, number]; z: [number, number] };
    const meshes = (root: Node, skip: (node: Node) => boolean = () => false) => {
      const out: { node: Node; e: Extent }[] = [];
      const walk = (node: Node) => {
        if (skip(node)) return;
        if (node.isMesh && node.visible && node.geometry) {
          node.geometry.computeBoundingBox();
          const b = node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld);
          out.push({ node, e: { x: [b.min.x, b.max.x], z: [b.min.z, b.max.z] } });
        }
        node.children.forEach(walk);
      };
      walk(root);
      return out;
    };
    const union = (extents: Extent[]): Extent =>
      extents.reduce((a, b) => ({
        x: [Math.min(a.x[0], b.x[0]), Math.max(a.x[1], b.x[1])],
        z: [Math.min(a.z[0], b.z[0]), Math.max(a.z[1], b.z[1])],
      }));
    const named = (root: Node, test: (name: string) => boolean) => {
      const out: Node[] = [];
      const walk = (node: Node) => {
        if (test(node.name)) out.push(node);
        node.children.forEach(walk);
      };
      walk(root);
      return out;
    };
    // Plus 0, so a gap of minus nothing reads as nothing.
    const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000 + 0;

    // The refrigerator's doors say which way the run goes and which way the
    // fronts face: thin across the run, the handles on the room's side.
    const fridge = scene.getObjectByName!("appliance-slot-fridge")!;
    const fridgeDoors = union(
      named(fridge, (name) => name.startsWith("fridge-panel-")).flatMap((panel) =>
        meshes(panel, (node) => node.name.startsWith("fridge-handle-")).map((m) => m.e),
      ),
    );
    const handle = union(named(fridge, (name) => name.startsWith("fridge-handle-")).flatMap((h) => meshes(h).map((m) => m.e)));
    const across = fridgeDoors.x[1] - fridgeDoors.x[0] < fridgeDoors.z[1] - fridgeDoors.z[0] ? "x" : "z";
    const along = across === "x" ? "z" : "x";
    const middle = (e: Extent, axis: "x" | "z") => (e[axis][0] + e[axis][1]) / 2;
    const sign = Math.sign(middle(handle, across) - middle(fridgeDoors, across));
    const face = (e: Extent) => (sign > 0 ? e[across][1] : -e[across][0]);

    // Each column's doors: a refrigerator or freezer column's panels without
    // their handles; a wine column's frontmost slabs, the door's 3/4" panels,
    // its stiles and its grille (not the vents' lines on the grille, the glass
    // or the case).
    const doorsOf = (slot: string): Extent | null => {
      const group = scene.getObjectByName!(`appliance-${slot}`);
      if (!group) return null;
      const wine = group.getObjectByName?.("wine-column");
      if (wine) {
        const thick = (e: Extent) => (e[across][1] - e[across][0]) * 12;
        const boxes = meshes(wine).filter((m) => m.node.geometry!.type === "BoxGeometry" && thick(m.e) > 0.5 && thick(m.e) < 1);
        const front = Math.max(...boxes.map((m) => face(m.e)));
        return union(boxes.filter((m) => Math.abs(face(m.e) - front) < 0.01 / 12).map((m) => m.e));
      }
      return union(
        named(group, (name) => name.startsWith("fridge-panel-")).flatMap((panel) =>
          meshes(panel, (node) => node.name.startsWith("fridge-handle-")).map((m) => m.e),
        ),
      );
    };
    const doors = ["slot-freezer", "slot-fridge", "slot-wine"]
      .map(doorsOf)
      .filter((e): e is Extent => !!e)
      .sort((a, b) => a[along][0] - b[along][0]);
    const all = union(doors);

    // The end boards: the run's strip nearest the doors at each end, within an
    // inch of them along the run, and within 3" of their face across it.
    const strips = named(scene, (name) => /^strip-.*-(PNL|BF)[\d.]+-\d+$/.test(name))
      .map((strip) => union(meshes(strip).map((m) => m.e)))
      .filter((e) => Math.abs(face(e) - face(all)) < 3 / 12);
    const before = strips.filter((e) => e[along][1] <= all[along][0] + 1e-6).sort((a, b) => b[along][1] - a[along][1])[0];
    const after = strips.filter((e) => e[along][0] >= all[along][1] - 1e-6).sort((a, b) => a[along][0] - b[along][0])[0];
    const boards = [
      ...(before && all[along][0] - before[along][1] < 1 / 12 ? [before] : []),
      ...(after && after[along][0] - all[along][1] < 1 / 12 ? [after] : []),
    ];
    // A base cabinet's door on the same run: thin the same way, facing the
    // same way, within the depth of a run of the doors.
    const cabinetDoor = named(scene, (name) => /^door-.*-(B|DB)\d+-/.test(name))
      .map((door) => union(meshes(door).map((m) => m.e)))
      .find((e) => e[across][1] - e[across][0] < e[along][1] - e[along][0] && Math.abs(face(e) - face(all)) < 3 / 12);

    return {
      doorsIn: doors.map((e) => inches(e[along][1] - e[along][0])),
      gapsIn: boards.length === 2
        ? [
            inches(doors[0][along][0] - boards[0][along][1]),
            ...doors.slice(1).map((e, i) => inches(e[along][0] - doors[i][along][1])),
            inches(boards[1][along][0] - doors[doors.length - 1][along][1]),
          ]
        : null,
      doorsProudOfTheBoardsIn: boards.map((e) => inches(face(all) - face(e))),
      doorsProudOfTheCabinetDoorIn: cabinetDoor ? doors.map((e) => inches(face(e) - face(cabinetDoor))) : null,
    };
  });

describe("a group of columns' doors (round 101, A-16 and A-17)", () => {
  it("hangs B's refrigerator and wine column 35-3/4\" and 17-3/4\", an eighth from each board, a quarter apart, all flush, on a desktop", async () => {
    const s = await open(false, "?v=1&pkg=B");
    const measured = await bank(s);
    expect({
      doorsIn: [...(measured?.doorsIn ?? [])].sort((a, b) => a - b),
      gapsIn: measured?.gapsIn,
      doorsProudOfTheBoardsIn: measured?.doorsProudOfTheBoardsIn,
      doorsProudOfTheCabinetDoorIn: measured?.doorsProudOfTheCabinetDoorIn,
      errors: s.errors,
    }).toEqual({
      doorsIn: [17.75, 35.75],
      gapsIn: [0.125, 0.25, 0.125],
      doorsProudOfTheBoardsIn: [0, 0],
      doorsProudOfTheCabinetDoorIn: [0, 0],
      errors: [],
    });
    await s.page.context().close();
  });

  it("hangs E's freezer and refrigerator 17-3/4\" and 29-3/4\" on a phone", async () => {
    const s = await open(true, "?v=1&pkg=E");
    const measured = await bank(s);
    expect({
      doorsIn: [...(measured?.doorsIn ?? [])].sort((a, b) => a - b),
      gapsIn: measured?.gapsIn,
      doorsProudOfTheBoardsIn: measured?.doorsProudOfTheBoardsIn,
      doorsProudOfTheCabinetDoorIn: measured?.doorsProudOfTheCabinetDoorIn,
      errors: s.errors,
    }).toEqual({
      doorsIn: [17.75, 29.75],
      gapsIn: [0.125, 0.25, 0.125],
      doorsProudOfTheBoardsIn: [0, 0],
      doorsProudOfTheCabinetDoorIn: [0, 0],
      errors: [],
    });
    await s.page.context().close();
  });

  it("hangs D's three, 24 + 30 + 24, an eighth from each board and a quarter apart, all flush", async () => {
    const s = await open(false, "?v=1&pkg=D");
    expect({ bank: await bank(s), errors: s.errors }).toEqual({
      bank: {
        doorsIn: [23.75, 29.75, 23.75],
        gapsIn: [0.125, 0.25, 0.25, 0.125],
        doorsProudOfTheBoardsIn: [0, 0],
        doorsProudOfTheCabinetDoorIn: [0, 0, 0],
      },
      errors: [],
    });
    await s.page.context().close();
  });

  it("keeps them so when a finger turns D to one wall, 18 + 24 + 18", async () => {
    const s = await open(true, "?v=1&pkg=D");
    const button = (name: string) => s.page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
    await press(s, button("Configure"));
    await press(s, button("Layout"));
    await press(s, button("Single-wall kitchen"));
    await press(s, s.page.getByRole("button", { name: "Close", exact: true }).last());
    await s.page.waitForTimeout(3500);
    expect({ bank: await bank(s), errors: s.errors }).toEqual({
      bank: {
        doorsIn: [17.75, 23.75, 17.75],
        gapsIn: [0.125, 0.25, 0.25, 0.125],
        doorsProudOfTheBoardsIn: [0, 0],
        doorsProudOfTheCabinetDoorIn: [0, 0, 0],
      },
      errors: [],
    });
    await s.page.context().close();
  });
});
