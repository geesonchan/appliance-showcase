import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * The model card (round 82): every selected machine's models, in the middle of
 * the scene. Plan and decisions: `docs/plans/round-80-interface-plan.md`.
 *
 * Held to the alternatives list rather than to the catalogue: the card and the
 * list read one function (`candidatesFor`), and what has to be true is that a
 * customer sees the same models, refused for the same reason, whichever one
 * they look at. Real input throughout — the mouse on a desktop, a finger on a
 * phone (D17).
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const PACKAGES = ["A", "B", "C", "D", "E"];

const EXPECTED_TESTS = 16;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} model-card tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({
    args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
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

const button = (s: Session, name: string | RegExp) =>
  s.page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true }).first();

/** The card's models, the folded ones opened: id and whether it fits. */
async function cardModels(s: Session) {
  const toggle = s.page.locator("[data-model-card] [data-card-refused-toggle]");
  if ((await toggle.count()) && (await toggle.getAttribute("aria-expanded")) === "false") {
    await press(s, toggle);
    await s.page.waitForTimeout(200);
  }
  return s.page.$$eval("[data-model-card] [data-candidate]", (els) =>
    els.map((el) => `${el.getAttribute("data-candidate")}:${el.getAttribute("data-fits")}`).sort(),
  );
}

/** The alternatives list's models, wherever it is showing (rail or sheet). */
const listModels = (s: Session) =>
  s.page.$$eval("[data-candidate]", (els) =>
    els
      .filter((el) => !el.closest("[data-model-card]") && (el as HTMLElement).getClientRects().length > 0)
      .map((el) => `${el.getAttribute("data-candidate")}:${el.getAttribute("data-fits")}`)
      .sort(),
  );

const cardVisible = (s: Session) =>
  s.page.evaluate(() => {
    const card = document.querySelector<HTMLElement>("[data-model-card]");
    return !!card && card.getClientRects().length > 0;
  });

describe("the model card", () => {
  const MACHINES: Record<string, number> = { A: 6, B: 6, C: 6, D: 10, E: 8 };

  for (const pkg of PACKAGES) {
    it(`offers what the list offers, for every machine in package ${pkg}, on a desktop`, async () => {
      const s = await open(false);
      await press(s, button(s, "Appliances"));
      await s.page.waitForTimeout(600);
      await press(s, button(s, pkg));
      await s.page.waitForTimeout(2000);
      const mismatches: string[] = [];
      let compared = 0;
      let machines = 0;
      const rows = await s.page.locator('[data-panel="list"] ul li button').count();
      for (let i = 0; i < rows; i += 1) {
        await press(s, s.page.locator('[data-panel="list"] ul li button').nth(i));
        await s.page.waitForTimeout(900);
        const card = await cardModels(s);
        const list = await listModels(s);
        machines += 1;
        compared += list.length;
        if (JSON.stringify(card) !== JSON.stringify(list)) {
          mismatches.push(`#${i + 1}: card ${card.join(",")} / list ${list.join(",")}`);
        }
        await press(s, button(s, /All appliances/));
        await s.page.waitForTimeout(500);
      }
      expect({ machines, compared: compared >= machines, mismatches, errors: s.errors }).toEqual({
        machines: MACHINES[pkg],
        compared: true,
        mismatches: [],
        errors: [],
      });
      await s.page.context().close();
    });

    it(`offers what the list offers on a phone in package ${pkg}, and hides while the sheet is open`, async () => {
      const s = await open(true);
      const mismatches: string[] = [];
      const shownUnderSheet: string[] = [];
      const missingAfterSheet: string[] = [];
      let compared = 0;
      let machines = 0;
      await press(s, button(s, pkg));
      await s.page.waitForTimeout(2000);
      await press(s, button(s, "Appliances"));
      await s.page.waitForTimeout(700);
      const rows = await s.page.locator('[data-sheet] [data-panel="list"] ul li button').count();
      for (let i = 0; i < rows; i += 1) {
        if (i > 0) {
          await press(s, button(s, "Appliances"));
          await s.page.waitForTimeout(700);
          await press(s, button(s, /All appliances/));
          await s.page.waitForTimeout(400);
        }
        await press(s, s.page.locator('[data-sheet] [data-panel="list"] ul li button').nth(i));
        await s.page.waitForTimeout(900);
        const list = await listModels(s);
        if (await cardVisible(s)) shownUnderSheet.push(`#${i + 1}`);
        await press(s, s.page.getByRole("button", { name: "Close", exact: true }).filter({ visible: true }).first());
        await s.page.waitForTimeout(700);
        if (!(await cardVisible(s))) missingAfterSheet.push(`#${i + 1}`);
        const card = await cardModels(s);
        machines += 1;
        compared += list.length;
        if (JSON.stringify(card) !== JSON.stringify(list)) {
          mismatches.push(`#${i + 1}: card ${card.join(",")} / list ${list.join(",")}`);
        }
      }
      expect({
        machines,
        compared: compared >= machines,
        mismatches,
        shownUnderSheet,
        missingAfterSheet,
        errors: s.errors,
      }).toEqual({
        machines: MACHINES[pkg],
        compared: true,
        mismatches: [],
        shownUnderSheet: [],
        missingAfterSheet: [],
        errors: [],
      });
      await s.page.context().close();
    });
  }

  it("keeps a message raised just before off the card", async () => {
    // Round 82: switching to B grows the room and says so for twenty seconds;
    // a card opened inside those seconds had its last row under the message.
    const s = await open(false);
    await press(s, button(s, "B"));
    await s.page.waitForTimeout(1500);
    await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
    await s.page.waitForTimeout(2000);
    const covered = await s.page.evaluate(() => {
      const card = document.querySelector<HTMLElement>("[data-model-card]")!;
      const toast = document.querySelector<HTMLElement>("[data-toast]");
      const c = card.getBoundingClientRect();
      const t = toast?.getBoundingClientRect();
      return {
        toastUp: !!toast,
        overlaps: !!t && t.left < c.right && t.right > c.left && t.top < c.bottom && t.bottom > c.top,
      };
    });
    expect(covered).toEqual({ toastUp: true, overlaps: false });
    await s.page.context().close();
  });

  it("changes the model the way the list does", async () => {
    const s = await open(false);
    await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
    await s.page.waitForTimeout(2500);
    await press(s, s.page.locator('[data-model-card] [data-candidate$="ak7300as"]').first());
    await s.page.waitForTimeout(2500);
    const header = await s.page.locator("[data-model-card] [data-model-line]").first().innerText();
    const pressedInCard = await s.page.$$eval('[data-model-card] [aria-pressed="true"]', (els) =>
      els.map((el) => el.getAttribute("data-candidate")),
    );
    await press(s, button(s, "Appliances"));
    await s.page.waitForTimeout(800);
    const pressedInList = await s.page.$$eval('aside [data-candidate][aria-pressed="true"]', (els) =>
      els.map((el) => el.getAttribute("data-candidate")),
    );
    expect({ header: header.replace(/\s+/g, " "), pressedInCard, pressedInList, errors: s.errors }).toEqual({
      header: "Zephyr · AK7300AS",
      pressedInCard: ["zephyr-ak7300as"],
      pressedInList: ["zephyr-ak7300as"],
      errors: [],
    });
    await s.page.context().close();
  });

  it("says a hood is narrower than the cooking surface in the checklist's own words", async () => {
    const s = await open(false);
    await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
    await s.page.waitForTimeout(2500);
    const before = await s.page.locator("[data-card-narrow]").count();
    await press(s, s.page.locator('[data-model-card] [data-candidate$="ak7300as"]').first());
    await s.page.waitForTimeout(2500);
    const line = (await s.page.locator("[data-card-narrow]").innerText()).trim();
    const panel = await s.page.locator("aside").nth(1).innerText();
    expect({
      before,
      saysNarrower: /hood over a .+ cooking surface\. A hood is normally at least as wide/.test(line),
      inTheChecklist: line.length > 0 && panel.includes(line),
    }).toEqual({ before: 0, saysNarrower: true, inTheChecklist: true });
    await s.page.context().close();
  });

  it("says so when an opening takes one model, and folds nothing", async () => {
    const s = await open(false);
    await press(s, button(s, "E"));
    await s.page.waitForTimeout(2500);
    await press(s, s.page.locator('[data-pin-label="slot-cooktop"]').first());
    await s.page.waitForTimeout(2500);
    const chips = await s.page.locator("[data-model-card] [data-candidate]").count();
    const toggles = await s.page.locator("[data-model-card] [data-card-refused-toggle]").count();
    const text = await s.page.locator("[data-model-card]").innerText();
    expect({ chips, toggles, saysNoOther: text.includes("This is the only model shown for this opening") }).toEqual({
      chips: 1,
      toggles: 0,
      saysNoOther: true,
    });
    await s.page.context().close();
  });

  it("moves no camera: the pins stand where they did when the card closes (D1)", async () => {
    const s = await open(false);
    const dots = () =>
      s.page.$$eval("[data-pin-dot]", (els) => els.map((el) => (el as HTMLElement).style.transform).join("|"));
    await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
    // Until the fly-in has stopped moving the pins.
    let last = "";
    for (let i = 0; i < 30; i += 1) {
      await s.page.waitForTimeout(300);
      const now = await dots();
      if (now === last) break;
      last = now;
    }
    const withCard = await dots();
    await press(s, s.page.getByRole("button", { name: "Close", exact: true }).filter({ visible: true }).first());
    await s.page.waitForTimeout(1200);
    const without = await dots();
    expect({ cardGone: !(await cardVisible(s)), same: withCard === without }).toEqual({ cardGone: true, same: true });
    await s.page.context().close();
  });

  it("keeps every pin label off the card, in every package, at 1440 and 390", async () => {
    const overlaps: string[] = [];
    let checked = 0;
    for (const phone of [false, true]) {
      const s = await open(phone);
      for (const pkg of PACKAGES) {
        await press(s, button(s, pkg));
        await s.page.waitForTimeout(2200);
        await press(s, s.page.locator('[data-pin-label="slot-hood"]').first());
        await s.page.waitForTimeout(2800);
        const hits = await s.page.evaluate(() => {
          const card = document.querySelector("[data-model-card]")!.getBoundingClientRect();
          return [...document.querySelectorAll<HTMLElement>("[data-pin-label]")]
            .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).opacity !== "0")
            .map((el) => ({ slot: el.getAttribute("data-pin-label"), r: el.getBoundingClientRect() }))
            .map(({ slot, r }) => ({
              slot,
              over: r.left < card.right && r.right > card.left && r.top < card.bottom && r.bottom > card.top,
            }));
        });
        checked += hits.length;
        overlaps.push(...hits.filter((hit) => hit.over).map((hit) => `${phone ? "390" : "1440"} ${pkg} ${hit.slot}`));
        await press(s, s.page.getByRole("button", { name: "Close", exact: true }).filter({ visible: true }).first());
        await s.page.waitForTimeout(600);
      }
      await s.page.context().close();
    }
    expect({ enoughChecked: checked > 20, overlaps }).toEqual({ enoughChecked: true, overlaps: [] });
  });
});
