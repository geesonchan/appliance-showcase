import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";
import { openWatched } from "../scripts/pageWatch.mjs";
import { launchBrowser } from "./siteBrowser";

/**
 * Item 11 (docs/plans/item11-plan-final.md; Leo, 2026-11-13: 「烤箱塔离转角：12″」,
 * 「咖啡机在左段那 16 间的插座：下面那一格」), with real input: the mouse on a desktop,
 * a finger on a phone (D17).
 *
 * Two of E's L rooms with the sink on the left leg and the refrigerator on the back leg,
 * opened by their links, chosen lopsided (the coffee tower on either leg, the oven tower turned
 * either way, either corner box, the refrigerator against the wall or a cabinet, the island
 * either way round):
 *  - the coffee tower on the back leg: 12" of counter between the corner and the oven tower, and
 *    the oven's socket in that counter;
 *  - the coffee tower on the left leg: the oven's socket in the drawer under its opening.
 * In each: Install mode, the oven's label pressed (the camera flies to it), the install list's
 * row for its power read and pressed (the point lights and its callout shows), then the List
 * tab's checklist for the oven read. The room built is the page's own (`__room()`, ?debug=1).
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
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} oven-socket tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

/** E's L, sink on the left leg, refrigerator on the back leg; the rest per room. */
const LINK =
  "v=3&pkg=E&shape=L&back=180&fridgeLeg=back&sinkLeg=left&housing=box&coffeeSill=37.4375&handle=54&island=72&islandDepth=24&aisle=48" +
  "&freezer=T18IF900SP-SS&fridge=T30IR905SP-SS&microwave=MEM301WS&coffee=TCM24PS&wine-2=PRW24C01CG&dishwasher=SHV78CM3N&cooktop=CIT367YG" +
  "&hood=HMIB42WS&blower=none&cabinet=ral5015&accentRun=none&accent=oak&counter=quartz&floor=oak&tile=24x48&wall=warm-grey";
const ROOMS = {
  coffeeBack: "&coffeeLeg=back&left=168&corner=lazy-susan&fridgeAbuts=wall&towerSide=right&islandTurn=perpendicular",
  coffeeLeft: "&coffeeLeg=left&left=179.25&corner=blind&fridgeAbuts=cabinet&towerSide=left&islandTurn=parallel",
};

const WORDS = {
  zh: {
    configure: "配置",
    close: "关闭",
    row: { coffeeBack: "组合烤箱 · 电源 高柜旁的地柜内（打开柜门可见）", coffeeLeft: "组合烤箱 · 电源 开口下方抽屉的后部" },
    callout: {
      coffeeBack: "电源：高柜旁的地柜内（打开柜门可见），距右侧 3\"、靠顶部。出处尚未审核。",
      coffeeLeft: "电源：开口下方抽屉的后部，靠顶部。出处尚未审核。",
    },
    line: { coffeeBack: "电源：高柜旁的地柜内（打开柜门可见），距右侧 3\"、靠顶部", coffeeLeft: "电源：开口下方抽屉的后部，靠顶部" },
    why: "高柜两侧都没有橱柜，因此该接点设在开口下方的抽屉内。",
  },
  en: {
    configure: "Configure",
    close: "Close",
    row: {
      coffeeBack: "Combination oven · power in the base cabinet beside the tower — open its door to see it",
      coffeeLeft: "Combination oven · power at the back of the drawer under the opening",
    },
    callout: {
      coffeeBack: "power: in the base cabinet beside the tower — open its door to see it, 3\" from the right side, at the top. Not yet reviewed.",
      coffeeLeft: "power: at the back of the drawer under the opening, at the top. Not yet reviewed.",
    },
    line: {
      coffeeBack: "power — in the base cabinet beside the tower — open its door to see it, 3\" from the right side, at the top",
      coffeeLeft: "power — at the back of the drawer under the opening, at the top",
    },
    why: "No cabinet on either side of the tower, so this connection goes in the drawer under the opening.",
  },
};

interface Session {
  page: Page;
  phone: boolean;
  lang: "zh" | "en";
  errors: string[];
}

async function open(room: keyof typeof ROOMS, phone: boolean, lang: "zh" | "en"): Promise<Session> {
  const context = await browser.newContext(
    phone ? { viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: DESKTOP },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openWatched(page, `${PREVIEW_URL}?${LINK}${ROOMS[room]}&lang=${lang}&debug=1&quality=high`, {
    gotoTimeout: 90_000,
    canvasTimeout: 60_000,
    label: `eLOvenSocket · ${expect.getState().currentTestName ?? ""}`,
  });
  await page.waitForTimeout(2500);
  return { page, phone, lang, errors };
}

async function press(s: Session, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (s.phone) await s.page.touchscreen.tap(x, y);
  else await s.page.mouse.click(x, y);
}

const visible = (s: Session, selector: string) => s.page.locator(selector).filter({ visible: true }).first();
const flat = (text: string) => text.replace(/\s+/g, " ").trim();

/** The back leg from the corner, as built: kind and inches, boards left out. */
const backLeg = (s: Session) =>
  s.page.evaluate(() => {
    const runs = (window as unknown as { __room: () => { runs: { id: string; segments: { kind: string; slot?: string; from: number; to: number }[] }[] } }).__room().runs;
    return runs
      .find((r) => r.id === "back")!
      .segments.filter((g) => (g.to - g.from) * 12 > 1)
      .slice(0, 3)
      .map((g) => `${g.slot ?? g.kind} ${Math.round((g.to - g.from) * 1200) / 100}`);
  });

/** On a phone the panels are in the sheet: open it on a tab. On a desktop, the right panel's tab. */
async function tab(s: Session, name: "install" | "list") {
  if (s.phone) {
    const sheetOpen = await s.page.locator("[data-sheet]").filter({ visible: true }).count();
    if (!sheetOpen) {
      await press(s, s.page.getByRole("button", { name: WORDS[s.lang].configure, exact: true }).filter({ visible: true }).first());
      await s.page.waitForTimeout(1200);
    }
    await press(s, visible(s, `[data-sheet-tab="${name}"]`));
  } else {
    await press(s, visible(s, `[data-right-tab="${name}"]`));
  }
  await s.page.waitForTimeout(800);
}

async function closeSheet(s: Session) {
  if (!s.phone) return;
  await press(s, s.page.locator("[data-sheet]").getByRole("button", { name: WORDS[s.lang].close, exact: true }).filter({ visible: true }).first());
  await s.page.waitForTimeout(1000);
}

async function walk(room: keyof typeof ROOMS, phone: boolean, lang: "zh" | "en") {
  const s = await open(room, phone, lang);
  const leg = await backLeg(s);
  // Install mode, then the oven's label: the camera flies to the oven tower.
  await press(s, visible(s, '[data-segment="mode"] button[data-value="install"]'));
  await s.page.waitForTimeout(2000);
  await press(s, visible(s, '[data-pin-label="slot-microwave"]'));
  await s.page.waitForTimeout(2600);
  // The install list's rows for the oven, and the callout its power row shows when pressed.
  await tab(s, "install");
  const rows = s.page.locator("[data-rough-in]").filter({ visible: true }).filter({ hasText: lang === "zh" ? "组合烤箱" : "Combination oven" });
  const rowTexts = (await rows.allInnerTexts()).map(flat);
  let callout = "";
  if (rowTexts.length > 0) {
    await press(s, rows.first());
    await s.page.waitForTimeout(1500);
    callout = flat(await s.page.locator("[data-toast]").filter({ visible: true }).first().innerText().catch(() => ""));
  }
  // The checklist on the List tab, the oven's group (open it if it is folded).
  await tab(s, "list");
  const group = visible(s, '[data-checklist-group="slot-microwave"]');
  const button = group.locator("button").first();
  if ((await button.getAttribute("aria-expanded")) !== "true") {
    await press(s, button);
    await s.page.waitForTimeout(600);
  }
  // Each line as the customer reads it: under ?debug=1 the list adds the rule's id after it, which is left out.
  const checklist = (
    await group.locator("li").evaluateAll((items) =>
      items.map((li) => {
        const copy = li.cloneNode(true) as HTMLElement;
        copy.querySelectorAll(".font-mono").forEach((debugId) => debugId.remove());
        return copy.textContent ?? "";
      }),
    )
  ).map(flat);
  await closeSheet(s);
  await s.page.context().close();
  return { leg, rowTexts, callout, checklist, errors: s.errors };
}

describe("E's L, sink on the left leg, refrigerator on the back leg: the combination oven's socket", () => {
  it("coffee on the back leg, desktop, Chinese: 12\" of counter off the corner, the socket in it", async () => {
    const got = await walk("coffeeBack", false, "zh");
    const w = WORDS.zh;
    expect(got.leg).toEqual(["counter 12", "slot-microwave 30", "slot-coffee 24"]);
    expect(got.rowTexts).toEqual([w.row.coffeeBack]);
    expect(got.callout).toContain(w.callout.coffeeBack);
    expect(got.checklist).toContain(w.line.coffeeBack);
    expect(got.checklist).not.toContain(w.why);
    expect(got.errors).toEqual([]);
  });

  it("coffee on the back leg, phone, English: the same, with a finger", async () => {
    const got = await walk("coffeeBack", true, "en");
    const w = WORDS.en;
    expect(got.leg).toEqual(["counter 12", "slot-microwave 30", "slot-coffee 24"]);
    expect(got.rowTexts).toEqual([w.row.coffeeBack]);
    expect(got.callout).toContain(w.callout.coffeeBack);
    expect(got.checklist).toContain(w.line.coffeeBack);
    expect(got.checklist).not.toContain(w.why);
    expect(got.errors).toEqual([]);
  });

  it("coffee on the left leg, desktop, English: the socket in the drawer under the opening, and why", async () => {
    const got = await walk("coffeeLeft", false, "en");
    const w = WORDS.en;
    expect(got.rowTexts).toEqual([w.row.coffeeLeft]);
    expect(got.callout).toContain(w.callout.coffeeLeft);
    expect(got.checklist).toContain(w.line.coffeeLeft);
    expect(got.checklist).toContain(w.why);
    expect(got.errors).toEqual([]);
  });

  it("coffee on the left leg, phone, Chinese: the same, with a finger", async () => {
    const got = await walk("coffeeLeft", true, "zh");
    const w = WORDS.zh;
    expect(got.rowTexts).toEqual([w.row.coffeeLeft]);
    expect(got.callout).toContain(w.callout.coffeeLeft);
    expect(got.checklist).toContain(w.line.coffeeLeft);
    expect(got.checklist).toContain(w.why);
    expect(got.errors).toEqual([]);
  });
});
