import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Round 86, Leo, from package A: a wine column picked on the model card for
 * the island's wine opening was drawn standing up through the countertop.
 * A machine that cannot physically go into an opening is now among those that
 * "don't fit", with the reason in Leo's words, on the card and in the list
 * alike; and B's and E's combination-oven tower no longer takes a microwave
 * drawer or an over-the-range microwave. Real input throughout — the mouse on
 * a desktop, a finger on a phone (D17). docs/decisions.md D20, round 86.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 6;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} too-tall tests actually ran`).toBe(EXPECTED_TESTS);
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

/** Select a machine by its pin label, as a customer does, and open what is folded. */
async function selectOnCard(s: Session, pkg: string, slotId: string) {
  if (pkg !== "A") {
    await press(s, button(s, pkg));
    await s.page.waitForTimeout(2500);
  }
  await press(s, s.page.locator(`[data-pin-label="${slotId}"]`).first());
  await s.page.waitForTimeout(2500);
  const toggle = s.page.locator("[data-model-card] [data-card-refused-toggle]");
  if ((await toggle.count()) && (await toggle.getAttribute("aria-expanded")) === "false") {
    await press(s, toggle);
    await s.page.waitForTimeout(300);
  }
}

/** Each model on the card: whether it fits, and the reason it is refused, if any. */
const cardRows = (s: Session) =>
  s.page.$$eval("[data-model-card] [data-candidate]", (els) =>
    els
      .map((el) => {
        const reason = el.querySelector("[data-refused]") as HTMLElement | null;
        return `${el.getAttribute("data-candidate")}:${el.getAttribute("data-fits")}${reason ? ` ${reason.innerText.trim()}` : ""}`;
      })
      .sort(),
  );

/** The model the card says is in the opening. */
const specified = (s: Session) =>
  s.page.$$eval("[data-model-card] [data-candidate]", (els) =>
    els.filter((el) => (el as HTMLElement).innerText.includes("Specified") || (el as HTMLElement).innerText.includes("已选")).map((el) => el.getAttribute("data-candidate")),
  );

describe("a machine that cannot go into an opening (round 86)", () => {
  it("lists package A's two wine columns as too tall under the island's top, on a desktop", async () => {
    const s = await open(false);
    await selectOnCard(s, "A", "slot-wine");
    expect({ rows: await cardRows(s), errors: s.errors }).toEqual({
      rows: [
        "thermador-t18iw100sp:false 50\" too tall — the countertop is above this opening",
        "thermador-t24iw905sp:false 50\" too tall — the countertop is above this opening",
        "zephyr-prw24c01cg:true",
      ],
      errors: [],
    });
    await s.page.context().close();
  });

  it("does not change the model when a too-tall one is pressed", async () => {
    const s = await open(false);
    await selectOnCard(s, "A", "slot-wine");
    const before = await s.page.locator("canvas").screenshot();
    await press(s, s.page.locator('[data-model-card] [data-candidate="thermador-t24iw905sp"]').first());
    await s.page.waitForTimeout(2500);
    expect({
      specified: await specified(s),
      sameRoom: Buffer.compare(before, await s.page.locator("canvas").screenshot()) === 0,
    }).toEqual({ specified: ["zephyr-prw24c01cg"], sameRoom: true });
    await s.page.context().close();
  });

  it("says the same on a phone, by touch", async () => {
    const s = await open(true);
    await selectOnCard(s, "A", "slot-wine");
    expect(await cardRows(s)).toEqual([
      "thermador-t18iw100sp:false 50\" too tall — the countertop is above this opening",
      "thermador-t24iw905sp:false 50\" too tall — the countertop is above this opening",
      "zephyr-prw24c01cg:true",
    ]);
    await s.page.context().close();
  });

  it("names the coffee machine above E's wine cooler", async () => {
    const s = await open(false);
    await selectOnCard(s, "E", "slot-wine-2");
    expect(await cardRows(s)).toEqual([
      "thermador-t18iw100sp:false 50\" too tall — the coffee machine is above this opening",
      "thermador-t24iw905sp:false 50\" too tall — the coffee machine is above this opening",
      "zephyr-prw24c01cg:true",
    ]);
    await s.page.context().close();
  });

  it("keeps a microwave drawer and an over-the-range microwave out of B's combination-oven tower", async () => {
    const s = await open(false);
    await selectOnCard(s, "B", "slot-microwave");
    const rows = await cardRows(s);
    expect(rows.filter((row) => /jvm3160rfss|md24bs/.test(row))).toEqual([
      "ge-jvm3160rfss:false The manufacturer has not confirmed it can go in a tall cabinet",
      "thermador-md24bs:false The manufacturer has not confirmed it can go in a tall cabinet",
    ]);
    await s.page.context().close();
  });

  it("says it in Leo's Chinese", async () => {
    const s = await open(false);
    await press(s, button(s, "中"));
    await s.page.waitForTimeout(800);
    await selectOnCard(s, "A", "slot-wine");
    const reasons = await s.page.$$eval("[data-model-card] [data-refused]", (els) =>
      els.map((el) => (el as HTMLElement).innerText.trim()),
    );
    expect(reasons).toEqual(["高出 50\"，开口上方是台面", "高出 50\"，开口上方是台面"]);
    await s.page.context().close();
  });
});
