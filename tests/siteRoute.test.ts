import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchSiteBrowser, realServerContext } from "../scripts/siteRoute.mjs";

/**
 * 丁 in a real browser (docs/plans/route-wiring-plan.md, section 9; Leo,
 * 2026-11-07: 「siteRoute 的测试要和 previewServer 的一样严」). What
 * `scripts/siteRoute.test.ts` holds of the answers, held here where it
 * matters: a browser launched through 丁, on an address where nothing
 * listens (4198), so any request that slipped past 丁 would fail outright —
 *
 * - the page, and its module script run (a module is refused unless it comes
 *   as JavaScript);
 * - a woff2 font loaded from the site's own file;
 * - the same under the live site's prefix, /appliance-showcase/;
 * - every context the browser opens routed, and a page opened straight on
 *   the browser too;
 * - a path with no file answered with the page, and written down;
 * - no way of writing a path reads the file beside the build;
 * - a context opened on the real server is not routed.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SITE = join(ROOT, "test-results", "site-route-check");
const DIR = join(SITE, "dist");
const ORIGIN = "http://localhost:4198";
const SECRET = "the secret beside the build";
const FONT = readdirSync(join(ROOT, "src", "assets", "fonts")).find((f) => f.endsWith(".woff2"))!;

let browser: Browser;
const misses: string[] = [];

beforeAll(async () => {
  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(join(DIR, "assets"), { recursive: true });
  writeFileSync(
    join(DIR, "index.html"),
    '<!doctype html><html><head><script type="module" crossorigin src="./assets/app-X1.js"></script></head><body><div id="root"></div></body></html>',
  );
  writeFileSync(
    join(DIR, "assets", "app-X1.js"),
    [
      'document.body.dataset.ran = "yes";',
      'const face = new FontFace("Probe", "url(./assets/font-X1.woff2)");',
      'face.load().then(() => { document.body.dataset.font = "loaded"; }, (e) => { document.body.dataset.font = "failed " + e; });',
      "",
    ].join("\n"),
  );
  copyFileSync(join(ROOT, "src", "assets", "fonts", FONT), join(DIR, "assets", "font-X1.woff2"));
  writeFileSync(join(SITE, "secret.txt"), SECRET);
  browser = await launchSiteBrowser({}, { origin: ORIGIN, dir: DIR, onMiss: (miss) => misses.push(miss.url) });
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

async function opened(path: string, how: "context" | "page" = "context") {
  const page = how === "page" ? await browser.newPage() : await (await browser.newContext()).newPage();
  await page.goto(`${ORIGIN}${path}`, { timeout: 30_000 });
  await page.waitForFunction(() => document.body.dataset.font, undefined, { timeout: 30_000 });
  const state = await page.evaluate(() => ({ ran: document.body.dataset.ran, font: document.body.dataset.font, root: !!document.getElementById("root") }));
  return { page, state };
}

describe("丁 in a real browser, with nothing listening on its address", () => {
  it("opens the page, runs its module script and loads its woff2 font from the build", async () => {
    const { page, state } = await opened("/?quality=high");
    expect(state).toEqual({ ran: "yes", font: "loaded", root: true });
    await page.context().close();
  });

  it("does the same under the live site's prefix, /appliance-showcase/", async () => {
    const { page, state } = await opened("/appliance-showcase/?quality=high");
    expect(state).toEqual({ ran: "yes", font: "loaded", root: true });
    await page.context().close();
  });

  it("routes a page opened straight on the browser as well as one in a context of its own", async () => {
    const { page, state } = await opened("/", "page");
    expect(state).toEqual({ ran: "yes", font: "loaded", root: true });
    await page.context().close();
  });

  it("answers the page for a path with no file, and writes it down", async () => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${ORIGIN}/`);
    const html = await page.evaluate(async () => (await fetch("/a/page/with/no/file")).text());
    expect(html).toContain('<div id="root"></div>');
    expect(misses).toContain(`${ORIGIN}/a/page/with/no/file`);
    await page.context().close();
  });

  it("never reads the file beside the build, however the path is written", async () => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${ORIGIN}/`);
    const answers = await page.evaluate(async (paths) => {
      const out: string[] = [];
      for (const p of paths) out.push(await (await fetch(p)).text());
      return out;
    }, ["/../secret.txt", "/assets/%2e%2e/%2e%2e/secret.txt", "/..%2fsecret.txt", "/assets/..%5c..%5csecret.txt", "/appliance-showcase/..%2f..%2fsecret.txt"]);
    for (const a of answers) expect(a).not.toContain(SECRET);
    await page.context().close();
  });

  it("leaves a context opened on the real server unrouted: nothing listens on 4198, so it cannot load", async () => {
    const context = await realServerContext(browser);
    const page = await context.newPage();
    const error = await page.goto(`${ORIGIN}/`, { timeout: 15_000 }).then(
      () => null,
      (e: Error) => e.message,
    );
    expect(error).toMatch(/ERR_CONNECTION_REFUSED/);
    await context.close();
  });
});
