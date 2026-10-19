import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The over-the-range microwave JVM3160RFSS picked on package C's hood card
 * (round 97, Leo, from his shop), and the hood put back: the drawer leaves the
 * room and comes back, the room is the one it was, the duct and the list say
 * what its documents say. And package D with no island, whose install list
 * named an omitted drawer's outlet on the live site. Real input throughout —
 * the mouse on a desktop, a finger on a phone (D17). docs/decisions.md D16,
 * round 97.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const OTR = "ge-jvm3160rfss";
const CHIMNEY = "thermador-hmcb30ws";

const EXPECTED_TESTS = 8;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} over-the-range microwave tests actually ran`).toBe(EXPECTED_TESTS);
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
  await page.goto(PREVIEW_URL + "?quality=high&debug=1", { waitUntil: "networkidle", timeout: 90_000 });
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

const button = (s: Session, name: string) =>
  s.page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

/** Package C, its hood flown to, so its card shows the models. */
async function cHoodCard(s: Session) {
  await press(s, button(s, "C"));
  await s.page.waitForTimeout(2500);
  await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
  await s.page.waitForTimeout(2500);
}

async function pick(s: Session, model: string) {
  const chip = s.page.locator(`[data-model-card] [data-candidate="${model}"]`);
  // Said, rather than left to time out, on a build that does not offer it.
  if ((await chip.count()) === 0) throw new Error(`${model} is not on the hood's card`);
  await press(s, chip.first());
  await s.page.waitForTimeout(3000);
}

/** The room as the page built it: runs, island, placements and cabinets (`__room`, D23). */
const roomNow = (s: Session) =>
  s.page.evaluate(() => JSON.stringify((window as unknown as { __room: () => unknown }).__room()));

/** Which machines have a pin: what is in the room. */
const pinned = (s: Session) =>
  s.page.evaluate(() =>
    [...document.querySelectorAll("[data-pin-label]")].map((el) => el.getAttribute("data-pin-label")).sort(),
  );

/** Whether the scene has a visible object by this name. */
const drawn = (s: Session, name: string) =>
  s.page.evaluate((wanted) => {
    type Node = { name?: string; visible: boolean; children: Node[]; parent?: Node | null };
    const scenes = (window as unknown as { __scenes?: Node[] }).__scenes ?? [];
    const shown = (node: Node) => {
      for (let at: Node | null | undefined = node; at; at = at.parent) if (!at.visible) return false;
      return true;
    };
    let found = false;
    const walk = (node: Node) => {
      if (node.name === wanted && shown(node)) found = true;
      node.children.forEach(walk);
    };
    scenes.forEach(walk);
    return found;
  }, name);

describe("the OTR in package C's hood opening (round 97)", () => {
  it("takes the microwave drawer out of the room, on a desktop, and puts the room back with the hood", async () => {
    const s = await open(false);
    await cHoodCard(s);
    const before = { room: await roomNow(s), pins: await pinned(s) };
    await pick(s, OTR);
    const withOtr = await pinned(s);
    await pick(s, CHIMNEY);
    const after = { room: await roomNow(s), pins: await pinned(s) };
    expect({
      drawerBefore: before.pins.includes("slot-microwave"),
      drawerWithOtr: withOtr.includes("slot-microwave"),
      sameRoom: after.room === before.room,
      samePins: JSON.stringify(after.pins) === JSON.stringify(before.pins),
      errors: s.errors,
    }).toEqual({ drawerBefore: true, drawerWithOtr: false, sameRoom: true, samePins: true, errors: [] });
    await s.page.context().close();
  });

  it("does the same by touch on a phone", async () => {
    const s = await open(true);
    await cHoodCard(s);
    const before = await roomNow(s);
    await pick(s, OTR);
    const withOtr = await pinned(s);
    await pick(s, CHIMNEY);
    expect({ drawerWithOtr: withOtr.includes("slot-microwave"), sameRoom: (await roomNow(s)) === before, errors: s.errors }).toEqual({
      drawerWithOtr: false,
      sameRoom: true,
      errors: [],
    });
    await s.page.context().close();
  });

  it("gives its duct on its spec card as 3-1/4\" × 10\", up through the cabinet, 300 CFM", async () => {
    const s = await open(false);
    await cHoodCard(s);
    await pick(s, OTR);
    await press(s, s.page.locator("[data-model-card]").getByRole("button", { name: /View specs/ }).first());
    await s.page.waitForTimeout(1200);
    const card = await s.page.locator('[role="dialog"]').filter({ visible: true }).first().innerText();
    expect(card.includes('3-1/4" × 10" · Up through cabinet · 300 CFM')).toBe(true);
    await s.page.context().close();
  });

  it("draws its outlet, the cut for it and the cord's hole in the install view", async () => {
    const s = await open(false);
    await cHoodCard(s);
    await pick(s, OTR);
    await press(s, button(s, "Install"));
    await s.page.waitForTimeout(2500);
    expect({
      outlet: await drawn(s, "otr-outlet"),
      cut: await drawn(s, "otr-cabinet-cutout"),
      cord: await drawn(s, "otr-cord-hole"),
    }).toEqual({ outlet: true, cut: true, cord: true });
    await s.page.context().close();
  });

  it("numbers the pins by what is in the room: the wine cabinet is 05, as in the list", async () => {
    const s = await open(false);
    await cHoodCard(s);
    await pick(s, OTR);
    const pin = (await s.page.locator('[data-pin-label="slot-wine"] span').first().innerText()).trim();
    expect(pin).toBe("05");
    await s.page.context().close();
  });

  it("puts the range's BTU on the install list as a blocker, in the manual's words", async () => {
    const s = await open(false);
    await cHoodCard(s);
    await pick(s, OTR);
    await press(s, s.page.locator('[data-right-tab="list"]').first());
    await s.page.waitForTimeout(800);
    // Open on the selected machine already, the hood; opened only if shut.
    const group = s.page.locator('[data-checklist-group="slot-hood"] button').first();
    if ((await group.getAttribute("aria-expanded")) !== "true") await press(s, group);
    await s.page.waitForTimeout(600);
    const text = await s.page.locator('[data-checklist-group="slot-hood"]').innerText();
    expect(
      text.includes(
        'JVM3160RFSS is for cooking appliances of 63,000 BTU or less combined — GE installation instructions, p. 6: "suitable for installation over electric or gas cooking appliances with a combined BTU of 63,000 BTU or less". This Maytag MFGS4030RS is 69,000 BTU in all.',
      ),
    ).toBe(true);
    await s.page.context().close();
  });
});

describe("package D with no island (round 97)", () => {
  /** D, the island switched off on the Layout tab, the list open on its Microwave group. */
  async function dWithoutIsland(s: Session) {
    await press(s, button(s, "D"));
    await s.page.waitForTimeout(2500);
    await press(s, s.page.locator('[data-right-tab="layout"]').first());
    await s.page.waitForTimeout(600);
    await press(s, s.page.getByRole("switch", { name: "Island" }).first());
    await s.page.waitForTimeout(3000);
    await press(s, s.page.locator('[data-right-tab="list"]').first());
    await s.page.waitForTimeout(800);
    const group = s.page.locator('[data-checklist-group="slot-microwave"] button').first();
    if ((await group.getAttribute("aria-expanded")) !== "true") await press(s, group);
    await s.page.waitForTimeout(600);
  }

  it("lists nothing for the drawer it left out but the line saying so", async () => {
    const s = await open(false);
    await dWithoutIsland(s);
    const lines = await s.page.locator('[data-checklist-group="slot-microwave"] ul li').count();
    expect({ drawerPinned: (await pinned(s)).includes("slot-microwave"), lines }).toEqual({ drawerPinned: false, lines: 1 });
    await s.page.context().close();
  });

  it("says it left out the microwave drawer, and not the wine column standing in the room", async () => {
    const s = await open(false);
    await dWithoutIsland(s);
    const text = await s.page.locator('[data-checklist-group="slot-microwave"]').innerText();
    expect(
      text.includes("No island: microwave drawer omitted; add an island or lengthen the left wall to include it."),
    ).toBe(true);
    await s.page.context().close();
  });
});
