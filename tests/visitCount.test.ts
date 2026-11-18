import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { build } from "vite";
import { canvasWatched, gotoWatched } from "../scripts/pageWatch.mjs";
import { PREVIEW_URL } from "./globalSetup";

/**
 * Item 12c, the visit count on the page (Leo, 2026-11-17; docs/plans/item12c-plan.md),
 * as a customer sees it: the mouse on a desktop, a finger on a phone (D17).
 *
 * Built here with a counter address, into a folder of its own (never `dist/`),
 * and served as if it were the live site, as `tests/analytics.test.ts` does it;
 * every request to the counter is caught and answered here — the host is
 * made up — so nothing leaves this machine.
 *
 * - On a desktop beside the title (乙); on a phone at 390, where the title gives
 *   way, at the left of the second row (Leo: 「放左上角第二行，照原型」); one place
 *   at a time. 「1,234 次访问」 / "1,234 visits", GoatCounter's figure as it gives it.
 * - Each way it cannot be had — the switch off (403, no CORS header), 404,
 *   blocked, too slow, an answer that is not JSON — and under 100: nothing
 *   shown, the header as it is without the count, no error (Leo: 「取不到时……什么
 *   都不显示，页面和现在一样，不报错」).
 * - No request at all from localhost, or from the suite's own build, which has
 *   no address (D24's gates; the pixel proof shoots that build).
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "test-results", "visitcount-build");
const SITE = "https://geesonchan.github.io/appliance-showcase/";
const COUNTER = "https://counter.test/count";
const READ = "https://counter.test/counter/%2Fappliance-showcase%2F.json";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 11;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} visit-count tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  process.env.VITE_GOATCOUNTER = COUNTER;
  try {
    await build({ root: ROOT, logLevel: "error", build: { outDir: OUT, emptyOutDir: true } });
  } finally {
    delete process.env.VITE_GOATCOUNTER;
  }
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
}, 240_000);
afterAll(async () => {
  await browser?.close();
});

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

/** How the counter answers the read: the live site's answers, and its failures. */
type Answer = (route: Route) => Promise<void>;
const CORS = { "access-control-allow-origin": "*" };
const json = (status: number, body: unknown, headers: Record<string, string> = CORS): Answer => (route) =>
  route.fulfill({ status, headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) });

interface Session {
  context: BrowserContext;
  page: Page;
  phone: boolean;
  /** Every read of the count, as its URL; and every other request to a counter. */
  reads: string[];
  others: string[];
  errors: string[];
}

async function open(
  answer: Answer,
  { phone = false, origin = SITE, dir = OUT }: { phone?: boolean; origin?: string; dir?: string } = {},
): Promise<Session> {
  const context = await browser.newContext(phone ? { viewport: PHONE, isMobile: true, hasTouch: true } : { viewport: DESKTOP });
  const page = await context.newPage();
  const reads: string[] = [];
  const others: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Any counter, the made-up one and the real one: a read is answered as the
  // case says; a count is answered as analytics.test.ts answers it; nothing
  // reaches the real GoatCounter.
  await context.route(/^https:\/\/(counter\.test|[^/]*goatcounter\.com)\//, async (route) => {
    const url = route.request().url();
    if (new URL(url).pathname.startsWith("/counter/")) {
      reads.push(url);
      return answer(route);
    }
    others.push(url);
    return route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") });
  });
  await context.route(`${origin}**`, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(new URL(origin).pathname.length) || "index.html";
    const file = join(dir, path);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
    const ext = path.slice(path.lastIndexOf("."));
    return route.fulfill({ status: 200, contentType: TYPES[ext] ?? "application/octet-stream", body: readFileSync(file) });
  });
  await gotoWatched(page, `${origin}?quality=low`, { timeout: 90_000, label: `visitCount · ${expect.getState().currentTestName ?? ""}` });
  await canvasWatched(page, { timeout: 60_000, label: `visitCount · ${expect.getState().currentTestName ?? ""}` });
  await page.waitForTimeout(2000);
  return { context, page, phone, reads, others, errors };
}

/** The language, pressed as a customer presses it. */
async function language(s: Session, label: "EN" | "中") {
  const button = s.page.getByRole("button", { name: label, exact: true }).filter({ visible: true }).first();
  const box = (await button.boundingBox())!;
  if (s.phone) await s.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await s.page.waitForTimeout(1200);
}

/** The count where it shows: its text and where it sits against the title and the second row. */
async function shown(s: Session) {
  const visible = s.page.locator("[data-visits]").filter({ visible: true });
  const all = await visible.allInnerTexts();
  if (all.length === 0) return { texts: [] as string[], where: null };
  const box = (await visible.first().boundingBox())!;
  const header = (await s.page.locator("header").first().boundingBox())!;
  // Each only where it shows: the second row is not drawn on a desktop, the title not on a 390 phone.
  const boxOf = async (selector: string) => {
    const found = s.page.locator(selector).filter({ visible: true });
    return (await found.count()) > 0 ? found.first().boundingBox() : null;
  };
  const second = await boxOf('[data-shape-row="second"]');
  const title = await boxOf("header span.font-display");
  const where =
    title && Math.abs(box.y + box.height / 2 - (title.y + title.height / 2)) < 6 && box.x > title.x + title.width
      ? "beside the title"
      : second && box.y >= second.y && box.y + box.height <= second.y + second.height && box.x < second.x + 40
        ? "left of the second row"
        : `elsewhere (${Math.round(box.x)}, ${Math.round(box.y)}; header ${Math.round(header.height)} tall)`;
  return { texts: all, where };
}

/** The header as drawn, for "the page as it is". */
const headerShot = async (s: Session) => (await s.page.locator("header").first().screenshot()).toString("base64");

/** The same build on this machine: D24's gates ask nothing, so this is the header without a count. */
let bare: { desktop?: string; phone?: string } = {};
async function bareHeader(phone: boolean) {
  const key = phone ? "phone" : "desktop";
  if (!bare[key]) {
    const s = await open(json(200, { count: "1,234" }), { phone, origin: "http://localhost:4199/" });
    bare = { ...bare, [key]: await headerShot(s) };
    await s.context.close();
  }
  return bare[key]!;
}

describe("on the live site, with a figure", () => {
  it("on a desktop, in English: 1,234 visits beside the title, read once from the showcase's own path", async () => {
    const s = await open(json(200, { count: "1,234" }));
    await language(s, "EN");
    const seen = await shown(s);
    await s.context.close();
    expect({ ...seen, reads: s.reads, errors: s.errors }).toEqual({
      texts: ["1,234 visits"],
      where: "beside the title",
      reads: [READ],
      errors: [],
    });
  });

  it("on a desktop, in Chinese, by the mouse: 1,234 次访问", async () => {
    const s = await open(json(200, { count: "1,234" }));
    await language(s, "中");
    const seen = await shown(s);
    await s.context.close();
    expect({ ...seen, errors: s.errors }).toEqual({ texts: ["1,234 次访问"], where: "beside the title", errors: [] });
  });

  it("on a 390 phone, in Chinese, by a finger: at the left of the second row, and only there", async () => {
    const s = await open(json(200, { count: "12,345" }), { phone: true });
    await language(s, "中");
    const seen = await shown(s);
    await s.context.close();
    expect({ ...seen, reads: s.reads.length, errors: s.errors }).toEqual({
      texts: ["12,345 次访问"],
      where: "left of the second row",
      reads: 1,
      errors: [],
    });
  });
});

describe("on the live site, without one: nothing shown, the header as it is, no error", () => {
  const cases: [string, Answer][] = [
    ["under 100 (Leo: 「少于100就不显示」)", json(200, { count: "99" })],
    // The switch off: GoatCounter's source answers 403 before it adds the CORS header.
    ["the switch off: 403, and no CORS header", json(403, { error: "Need to enable the 'allow using the visitor counter' setting" }, {})],
    ["404: the path not found", json(404, { count: "0" })],
    ["blocked, as an ad blocker blocks it", (route) => route.abort("blockedbyclient")],
    ["too slow: answered after 8 s", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      await route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ count: "1,234" }) }).catch(() => {});
    }],
    ["an answer that is not JSON", (route) => route.fulfill({ status: 200, headers: CORS, contentType: "text/html", body: "<html>" })],
  ];
  it.each(cases)("%s", async (name, answer) => {
    const s = await open(answer);
    if (name.startsWith("too slow")) await s.page.waitForTimeout(7000);
    const seen = await shown(s);
    const header = await headerShot(s);
    const count = await s.page.locator("[data-visits]").count();
    await s.context.close();
    expect({ ...seen, inThePage: count, reads: s.reads.length, errors: s.errors, header: header === (await bareHeader(false)) }).toEqual({
      texts: [],
      where: null,
      inThePage: 0,
      reads: 1,
      errors: [],
      header: true,
    });
  });
});

describe("never asked off the live site", () => {
  it("on localhost, the same build: no read, no count, nothing shown", async () => {
    const s = await open(json(200, { count: "1,234" }), { origin: "http://localhost:4199/" });
    const seen = await shown(s);
    await s.context.close();
    expect({ ...seen, reads: s.reads, others: s.others, errors: s.errors }).toEqual({ texts: [], where: null, reads: [], others: [], errors: [] });
  });

  it("the suite's own build, with no address (what the pixel proof shoots): no read, nothing shown", async () => {
    const s = await open(json(200, { count: "1,234" }), { origin: `${PREVIEW_URL}/`, dir: join(ROOT, "dist") });
    const seen = await shown(s);
    await s.context.close();
    expect({ ...seen, reads: s.reads, others: s.others, errors: s.errors }).toEqual({ texts: [], where: null, reads: [], others: [], errors: [] });
  });
});
