import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { build } from "vite";

/**
 * The visit counter: what the live site sends, and that nothing else changes.
 * D24, round 96, Leo.
 *
 * The page is built here with a counter address, into a folder of its own
 * (never `dist/`, which the rest of the suite serves), and served to the
 * browser as if it were the live site, https://geesonchan.github.io — the
 * counter counts only off localhost (D24). Every request to the counter is
 * caught and kept; none leaves this machine: the address is a made-up host,
 * and the route answers it.
 *
 * Held: one page view, its path the page's and nothing of the address's
 * query; each of the four events once for one action, and only then; on a
 * phone a share and no QR box; nothing at all on localhost, with skipgc set,
 * or with no link; #toggle-goatcounter's two messages, word for word, as
 * count.js says them; and with every request to the counter blocked, the page
 * as it is — the link's kitchen, the box, the quote, no error. The mouse on a
 * desktop and a finger on a phone (D17).
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "test-results", "analytics-build");
const SITE = "https://geesonchan.github.io/appliance-showcase/";
const COUNTER = "https://counter.test/count";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const EXPECTED_TESTS = 12;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} visit-counter tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  // The working tree, built with a counter address, as the workflow builds it.
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
};

interface Session {
  context: BrowserContext;
  page: Page;
  /** Every request made to the counter, as its URL. */
  hits: string[];
  errors: string[];
  dialogs: string[];
}

/**
 * Open the built page at `origin` (the live site's by default), with the
 * counter's requests caught, or blocked as an ad blocker blocks them.
 */
async function open(
  query = "",
  { phone = false, block = false, origin = SITE, init }: { phone?: boolean; block?: boolean; origin?: string; init?: string } = {},
): Promise<Session> {
  const context = await browser.newContext(
    phone
      ? { viewport: PHONE, isMobile: true, hasTouch: true }
      : { viewport: DESKTOP, permissions: ["clipboard-read", "clipboard-write"] },
  );
  const page = await context.newPage();
  const hits: string[] = [];
  const errors: string[] = [];
  const dialogs: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });
  await context.route(`${COUNTER}**`, async (route) => {
    if (block) return route.abort("blockedbyclient");
    hits.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") });
  });
  await context.route(`${origin}**`, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(new URL(origin).pathname.length) || "index.html";
    const file = join(OUT, path);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
    const ext = path.slice(path.lastIndexOf("."));
    return route.fulfill({ status: 200, contentType: TYPES[ext] ?? "application/octet-stream", body: readFileSync(file) });
  });
  if (phone) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: async () => {} });
    });
  }
  if (init) await page.addInitScript(init);
  await page.goto(`${origin}${query}`, { waitUntil: "networkidle", timeout: 90_000 });
  // A page that never draws says why: the errors it threw (D17, the blocked
  // case broken on purpose in round 96).
  await page.waitForSelector("canvas", { timeout: 60_000 }).catch((error: Error) => {
    const first = error.message.split(/\r?\n/)[0];
    throw new Error(`the page never drew; it threw: ${JSON.stringify(errors)} (${first})`);
  });
  await page.waitForTimeout(1500);
  return { context, page, hits, errors, dialogs };
}

async function press(s: Session, selector: string, phone = false) {
  const box = (await s.page.locator(selector).first().boundingBox())!;
  if (phone) await s.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await s.page.waitForTimeout(800);
}

/** The counter's requests as the fields they carry. */
const sent = (s: Session) => s.hits.map((url) => Object.fromEntries(new URL(url).searchParams));
const paths = (s: Session) => sent(s).map((hit) => hit.p);

/** A share link to package D, written by the page's own table. */
async function linkToD(): Promise<string> {
  const s = await open("?debug=1");
  await press(s, '[data-segment="package"] button:has-text("D")');
  await s.page.waitForTimeout(1500);
  const url = await s.page.evaluate(() => (window as unknown as { __shareUrl: () => string }).__shareUrl());
  await s.context.close();
  return new URL(url).search;
}

describe("on the live site", () => {
  it("sends one page view, its path the page's own, nothing of the address's query", async () => {
    const link = await linkToD();
    const s = await open(link);
    const views = sent(s).filter((hit) => !hit.e);
    await s.context.close();
    expect({
      views: views.length,
      path: views[0]?.p,
      q: views.some((hit) => "q" in hit),
      linkInAnyRequest: s.hits.some((url) => /pkg=|v%3D1|v=1&/.test(url)),
    }).toEqual({ views: 1, path: "/appliance-showcase/", q: false, linkInAnyRequest: false });
  });

  it("sends the fields count.js sends, but q: title, screen, referrer", async () => {
    const s = await open("", { init: "Object.defineProperty(document, 'referrer', { get: () => 'https://weixin.qq.com/' })" });
    const view = sent(s).find((hit) => !hit.e)!;
    await s.context.close();
    expect({ t: view.t, s: view.s, r: view.r, rnd: /^[0-9a-z]{1,5}$/.test(view.rnd ?? "") }).toEqual({
      t: "Appliance Showcase",
      s: "1440",
      r: "https://weixin.qq.com/",
      rnd: true,
    });
  });

  it("counts a page opened from a share link once, with its package's letter", async () => {
    const s = await open(await linkToD());
    const events = paths(s).filter((p) => p.startsWith("appliance-showcase/"));
    await s.context.close();
    expect(events).toEqual(["appliance-showcase/open-link-D"]);
  });

  it("counts no link for a page with none, or with one that cannot be read", async () => {
    const plain = await open("");
    const broken = await open("?v=1&pkg=Q");
    const events = [...paths(plain), ...paths(broken)].filter((p) => p.startsWith("appliance-showcase/"));
    await plain.context.close();
    await broken.context.close();
    expect(events).toEqual([]);
  });

  it("counts Share once and the QR box once for one press on a desktop", async () => {
    const s = await open("");
    await press(s, "header [data-share]");
    const events = paths(s).filter((p) => p.startsWith("appliance-showcase/"));
    await s.context.close();
    expect(events.sort()).toEqual(["appliance-showcase/qr-box", "appliance-showcase/share"]);
  });

  it("counts Share and no QR box for one tap on a phone", async () => {
    const s = await open("", { phone: true });
    await press(s, "header [data-share]", true);
    const events = paths(s).filter((p) => p.startsWith("appliance-showcase/"));
    await s.context.close();
    expect(events).toEqual(["appliance-showcase/share"]);
  });

  it("counts the quote once for one press", async () => {
    const s = await open("");
    await press(s, 'header button:has-text("Quote")');
    const events = paths(s).filter((p) => p.startsWith("appliance-showcase/"));
    await s.context.close();
    expect(events).toEqual(["appliance-showcase/quote"]);
  });

  it("sends every event with e, and every name under appliance-showcase/", async () => {
    const s = await open("");
    await press(s, 'header button:has-text("Quote")');
    const events = sent(s).filter((hit) => hit.e);
    await s.context.close();
    expect({ events: events.length, flagged: events.every((hit) => hit.e === "true"), named: events.every((hit) => hit.p.startsWith("appliance-showcase/")) }).toEqual({
      events: 1,
      flagged: true,
      named: true,
    });
  });
});

describe("where it sends nothing", () => {
  it("sends nothing on localhost", async () => {
    const s = await open("", { origin: "http://localhost:4199/" });
    await press(s, "header [data-share]");
    await s.context.close();
    expect(s.hits).toEqual([]);
  });

  it("sends nothing from a browser where #toggle-goatcounter switched it off", async () => {
    const s = await open("", { init: "localStorage.setItem('skipgc', 't')" });
    await press(s, "header [data-share]");
    await s.context.close();
    expect(s.hits).toEqual([]);
  });

  it("switches itself off and on with #toggle-goatcounter, saying so in count.js's words", async () => {
    const s = await open("#toggle-goatcounter");
    const off = await s.page.evaluate(() => localStorage.getItem("skipgc"));
    await s.page.goto(`${SITE}#toggle-goatcounter`, { waitUntil: "networkidle" });
    await s.page.reload({ waitUntil: "networkidle" });
    await s.page.waitForTimeout(1000);
    const on = await s.page.evaluate(() => localStorage.getItem("skipgc"));
    await s.context.close();
    expect({ off, on, dialogs: s.dialogs }).toEqual({
      off: "t",
      on: null,
      dialogs: [
        `GoatCounter tracking is now DISABLED in this browser until ${SITE}#toggle-goatcounter is loaded again.`,
        "GoatCounter tracking is now ENABLED in this browser.",
      ],
    });
  });
});

describe("with the counter blocked", () => {
  it("opens a share link's kitchen, the box and the quote as ever, with no error", async () => {
    const link = await linkToD();
    const allowed = await open(`${link}&debug=1`);
    const kitchen = await allowed.page.evaluate(() => (window as unknown as { __kitchen: () => unknown }).__kitchen());
    await allowed.context.close();
    const s = await open(`${link}&debug=1`, { block: true });
    const blockedKitchen = await s.page.evaluate(() => (window as unknown as { __kitchen: () => unknown }).__kitchen());
    await press(s, "header [data-share]");
    const box = await s.page.locator("[data-share-box]").count();
    await press(s, "[data-share-box-close]");
    await press(s, 'header button:has-text("Quote")');
    const quote = await s.page.getByRole("button", { name: "Readable summary" }).count();
    await s.context.close();
    expect({ same: JSON.stringify(blockedKitchen) === JSON.stringify(kitchen), box, quote, errors: s.errors, hits: s.hits }).toEqual({
      same: true,
      box: 1,
      quote: 1,
      errors: [],
      hits: [],
    });
  });
});
