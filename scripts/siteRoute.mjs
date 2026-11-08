/**
 * 丁: the site's files answered from the build by Playwright, never through a
 * connection on this machine (docs/plans/route-plan.md: 600 openings, none
 * held, the local server reached by the heartbeat only; the wiring,
 * docs/plans/route-wiring-plan.md; Leo, 2026-11-07: 「第 7 节五条都同意，现在开始做」).
 *
 * The answers are vite preview's, without the server: the page for the
 * site's root, each file with its type, the page again for a path with no
 * file (written down: the suite opens only the root, so any is a fault), and
 * the live site's prefix, /appliance-showcase/, read as the root. A path that
 * would leave the build is refused. No compression, no cache headers: the
 * live check covers what the server sends (the plan's section 4).
 *
 *   launchSiteBrowser(options, { origin, dir, onMiss })  a browser whose every
 *     context, and every page opened straight on it, is routed;
 *   routeSite(context, { origin, dir, onMiss })          one context routed;
 *   realServerContext(browser, options)                  a context left on the
 *     real server, marked by the header x-real-server: 1 for the server's
 *     record — only where the plan keeps one (the guard in siteRoute.test.ts).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { chromium } from "playwright";

/** The live site's path, read as the root. */
export const SITE_PREFIX = "/appliance-showcase";

const CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  woff2: "font/woff2",
  woff: "font/woff",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
};

/** The content type a file is answered with, by its extension, as the preview server would. */
export function contentTypeOf(file) {
  const ext = /\.([^./\\]+)$/.exec(file)?.[1]?.toLowerCase();
  return (ext && CONTENT_TYPES[ext]) || "application/octet-stream";
}

/**
 * The file in the build a request of the site names: "index.html" for the
 * root, the path for a file, `{ refused: true }` for a path that would leave
 * the build, null for anything not of `origin`. The address parser has
 * already folded "..", "%2e%2e" and the like; what it does not fold — an
 * encoded slash or backslash, a NUL — is refused here.
 */
function fileOf(url, origin) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== new URL(origin).origin) return null;
  let path = parsed.pathname;
  if (path === SITE_PREFIX || path.startsWith(`${SITE_PREFIX}/`)) path = path.slice(SITE_PREFIX.length);
  try {
    path = decodeURIComponent(path);
  } catch {
    return { refused: true };
  }
  const rel = path.replace(/^\/+/, "");
  if (rel.includes("\0") || rel.split(/[\\/]/).some((part) => part === ".." || part === ".")) return { refused: true };
  return { rel: rel === "" ? "index.html" : rel };
}

const cache = new Map();
const read = (file) => {
  if (!cache.has(file)) cache.set(file, readFileSync(file));
  return cache.get(file);
};

/**
 * What 丁 answers `url` with, from the build in `dir`: `{ status, contentType,
 * body, file, fallback, refused }`; null for a request not of `origin`.
 */
export function answerFor(url, { origin, dir }) {
  const found = fileOf(url, origin);
  if (found === null) return null;
  const root = resolve(dir);
  if (found.refused) {
    return { status: 404, contentType: "text/plain; charset=utf-8", body: Buffer.from("not in the build"), file: null, fallback: false, refused: true };
  }
  const full = resolve(root, found.rel);
  const inside = full === root || full.startsWith(root + sep);
  if (inside && existsSync(full) && statSync(full).isFile()) {
    return { status: 200, contentType: contentTypeOf(full), body: read(full), file: full, fallback: false, refused: false };
  }
  const page = resolve(root, "index.html");
  return { status: 200, contentType: contentTypeOf(page), body: read(page), file: page, fallback: true, refused: false };
}

/** Route one context: every request of `origin` answered from `dir`; a fallback or a refusal handed to `onMiss`. */
export async function routeSite(context, { origin, dir, onMiss }) {
  const own = new URL(origin).origin;
  await context.route(
    (u) => u.origin === own,
    async (route) => {
      const url = route.request().url();
      const answer = answerFor(url, { origin, dir });
      if (!answer) return route.continue();
      if ((answer.fallback || answer.refused) && onMiss) onMiss({ t: new Date().toISOString(), url, status: answer.status, refused: answer.refused });
      return route.fulfill({ status: answer.status, headers: { "content-type": answer.contentType }, body: answer.body });
    },
  );
  return context;
}

const REAL = Symbol("newContext on the real server");

/**
 * Launch a browser (Playwright's chromium, `options` as for `chromium.launch`)
 * whose every context is routed by 丁 — one opened with `newContext`, and the
 * one `newPage` opens for itself. `site` null: a plain browser on the real
 * server, for a tool's own switch back to it (the probe's REAL_SERVER=1).
 */
export async function launchSiteBrowser(options, site) {
  const browser = await chromium.launch(options);
  if (!site) return browser;
  const newContext = browser.newContext.bind(browser);
  browser[REAL] = newContext;
  browser.newContext = async (contextOptions) => routeSite(await newContext(contextOptions), site);
  browser.newPage = async (pageOptions) => {
    const context = await browser.newContext(pageOptions);
    const page = await context.newPage();
    // As Playwright's own newPage: closing the page closes its context.
    page.once("close", () => void context.close().catch(() => {}));
    return page;
  };
  return browser;
}

/**
 * A context on the real local server, not routed: only for the tests the plan
 * keeps there (section 3). Its requests carry x-real-server: 1, which the
 * server writes in its record, so the suite's end can tell them from a test
 * that should have been routed and was not.
 */
export async function realServerContext(browser, options = {}) {
  const newContext = browser[REAL] ?? browser.newContext.bind(browser);
  return newContext({ ...options, extraHTTPHeaders: { ...(options.extraHTTPHeaders ?? {}), "x-real-server": "1" } });
}

/**
 * The page requests in a server's record, after `after` (an ISO time: when
 * the suite's own setup — waiting for the server, then `warm()`, both with
 * Node's fetch — was done), that were not marked as kept on the real server:
 * the page, bare or with its query, at the root or under the site's prefix.
 */
export function unroutedPageRequests(log, { after = "" } = {}) {
  const page = (url) => /^\/(appliance-showcase\/)?(\?|$)/.test(url ?? "");
  return log
    .filter((r) => r.ev === "req" && !r.realServer && String(r.t ?? "") > after && page(r.url))
    .map((r) => ({ t: r.t, url: r.url }));
}

/** A file of misses, a JSON line each, written by `missWriter`; none when there is no file. */
export function readMisses(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/** An `onMiss` that appends to `file`, a JSON line each, from whichever process the test runs in. */
export function missWriter(file) {
  return (miss) => {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(miss)}\n`);
  };
}
