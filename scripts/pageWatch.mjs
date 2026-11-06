/**
 * What a page was doing when it did not draw (Leo, 2026-11-05: 「选丙……只加记
 * 录、不改网页」; docs/plans/blank-canvas-plan.md).
 *
 * Now and then a page opened by a browser test or the pixel shots shows no
 * canvas in 60 seconds, and nothing was kept: the wait threw before anybody
 * looked. This watches a page from before it is opened — its console, its
 * errors, the requests that failed, each WebGL context made, lost or not
 * made, when the canvas appeared and when it had a size, the long tasks — and
 * when opening it or waiting for its canvas fails, writes all of it with the
 * page's state and a screenshot to `test-results/blank-canvas/`, then fails
 * as it always did. When the page draws, it writes nothing and changes
 * nothing. The page itself is not touched: what it records is read from
 * outside, or from an init script that only listens.
 *
 *   import { openWatched } from "../scripts/pageWatch.mjs";
 *   await openWatched(page, url, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: "smoke" });
 *
 * `gotoWatched` and `canvasWatched` are its two halves, for a file that opens
 * a page without waiting for the canvas, or waits for it again later. A probe
 * reads `watchOf(page)` and `snapshot(page)` for a page that drew, to time it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BLANK_DIR = process.env.BLANK_CANVAS_DIR ?? join(ROOT, "test-results", "blank-canvas");

/** Kept per page, from the moment it is watched. */
const watches = new WeakMap();

/**
 * Listens in the page, before any of its own scripts: every canvas context
 * asked for and whether it came, a WebGL context lost, restored or never
 * made, when the first canvas is in the document and when it first has a
 * size on screen, and the long tasks. Only listens: no call it wraps behaves
 * differently.
 */
function pageScript() {
  const w = window;
  if (w.__pageWatch) return;
  const start = performance.now();
  const log = { contexts: [], webgl: [], canvasAt: null, canvasSizedAt: null, longTasks: { count: 0, maxMs: 0, totalMs: 0 } };
  w.__pageWatch = log;
  const now = () => Math.round(performance.now() - start);
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const context = getContext.call(this, type, ...rest);
    log.contexts.push({ at: now(), type, made: !!context });
    if (/webgl/.test(String(type)) && !this.__pageWatchListening) {
      this.__pageWatchListening = true;
      for (const name of ["webglcontextlost", "webglcontextrestored", "webglcontextcreationerror"]) {
        this.addEventListener(name, (event) => log.webgl.push({ at: now(), event: name, message: event.statusMessage ?? "" }));
      }
    }
    return context;
  };
  const look = () => {
    const canvas = document.querySelector("canvas");
    if (canvas && log.canvasAt === null) log.canvasAt = now();
    if (canvas && log.canvasSizedAt === null) {
      const box = canvas.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) log.canvasSizedAt = now();
    }
    return log.canvasSizedAt !== null;
  };
  const watchDom = () => {
    if (look()) return;
    new MutationObserver((_, observer) => {
      if (look()) observer.disconnect();
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  };
  if (document.documentElement) watchDom();
  else document.addEventListener("readystatechange", watchDom, { once: true });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        log.longTasks.count += 1;
        log.longTasks.totalMs += Math.round(entry.duration);
        log.longTasks.maxMs = Math.max(log.longTasks.maxMs, Math.round(entry.duration));
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // No long-task timing in this browser: the rest still records.
  }
}

/** Starts watching a page, once; before it is first opened. */
export async function watch(page, label = "") {
  let record = watches.get(page);
  if (record) {
    if (label) record.label = label;
    return record;
  }
  record = { label, startedAt: new Date().toISOString(), console: [], pageErrors: [], failedRequests: [], badResponses: [], crashed: null, closed: false };
  watches.set(page, record);
  const keep = (list, item, max = 200) => {
    list.push(item);
    if (list.length > max) list.shift();
  };
  const at = () => new Date().toISOString();
  page.on("console", (message) => keep(record.console, { at: at(), type: message.type(), text: message.text().slice(0, 500) }));
  page.on("pageerror", (error) => keep(record.pageErrors, { at: at(), message: String(error?.message ?? error).slice(0, 1000) }));
  page.on("requestfailed", (request) =>
    keep(record.failedRequests, { at: at(), url: request.url(), error: request.failure()?.errorText ?? "" }),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) keep(record.badResponses, { at: at(), url: response.url(), status: response.status() });
  });
  page.on("crash", () => (record.crashed = at()));
  page.on("close", () => (record.closed = true));
  await page.addInitScript(pageScript);
  return record;
}

/** What the watch has, and the page's own record, for a page that is still there. */
export async function snapshot(page) {
  const record = watches.get(page) ?? {};
  const inPage = await page
    .evaluate(() => {
      const canvases = [...document.querySelectorAll("canvas")].map((canvas) => {
        const box = canvas.getBoundingClientRect();
        const style = getComputedStyle(canvas);
        return { width: canvas.width, height: canvas.height, box: [box.x, box.y, box.width, box.height].map(Math.round), visibility: style.visibility, display: style.display };
      });
      const resources = performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name.replace(location.origin, ""),
        ms: Math.round(entry.duration),
        bytes: entry.transferSize,
        status: entry.responseStatus ?? null,
      }));
      const navigation = performance.getEntriesByType("navigation")[0];
      return {
        url: location.href,
        readyState: document.readyState,
        sinceNavigationMs: Math.round(performance.now()),
        domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
        loadMs: navigation ? Math.round(navigation.loadEventEnd) : null,
        rootChildren: document.getElementById("root")?.childElementCount ?? null,
        canvases,
        text: (document.body?.innerText ?? "").slice(0, 600),
        resources,
        watch: window.__pageWatch ?? null,
      };
    })
    .catch((error) => ({ unreadable: String(error?.message ?? error) }));
  return { ...record, page: inPage };
}

/** The GPU as the browser has it: on the GPU, or fallen back to software. */
async function gpuOf(page) {
  try {
    // The browser's own target: SystemInfo is not answered by a page's.
    const session = await page.context().browser().newBrowserCDPSession();
    const info = await session.send("SystemInfo.getInfo");
    await session.detach().catch(() => {});
    return {
      devices: (info.gpu?.devices ?? []).map((device) => `${device.vendorString} ${device.deviceString} ${device.driverVersion}`),
      featureStatus: info.gpu?.featureStatus ?? null,
    };
  } catch (error) {
    return { unreadable: String(error?.message ?? error) };
  }
}

const safeName = (text) => text.replace(/[^\w.-]+/g, "_").slice(0, 80);

/** Writes what is known about a page that did not draw, and returns where. */
export async function report(page, step, error, label = "") {
  const record = watches.get(page);
  const when = new Date();
  const name = `${when.toISOString().replace(/[:.]/g, "-")}-${safeName(label || record?.label || "page")}-${step}`;
  mkdirSync(BLANK_DIR, { recursive: true });
  const json = join(BLANK_DIR, `${name}.json`);
  let shot = null;
  try {
    shot = join(BLANK_DIR, `${name}.png`);
    await page.screenshot({ path: shot, timeout: 15_000 });
  } catch (shotError) {
    shot = `not taken: ${String(shotError?.message ?? shotError).split("\n")[0]}`;
  }
  const facts = {
    step,
    label: label || record?.label || "",
    at: when.toISOString(),
    error: String(error?.message ?? error).split("\n").slice(0, 6).join("\n"),
    ...(await snapshot(page)),
    gpu: await gpuOf(page),
    screenshot: shot,
  };
  writeFileSync(json, JSON.stringify(facts, null, 2));
  return { json, facts };
}

/** One line for the failure message: what the record says first. */
function gist(facts) {
  const page = facts.page ?? {};
  const watch = page.watch ?? {};
  const parts = [
    `readyState ${page.readyState ?? "?"}`,
    `canvas at ${watch.canvasAt ?? "never"} ms, sized at ${watch.canvasSizedAt ?? "never"} ms`,
    `webgl ${JSON.stringify(watch.webgl ?? [])}`,
    `page errors ${facts.pageErrors?.length ?? 0}`,
    `failed requests ${facts.failedRequests?.length ?? 0}`,
    `crashed ${facts.crashed ?? "no"}`,
  ];
  return parts.join("; ");
}

async function failWith(page, step, error, label) {
  let where = "";
  try {
    const { json, facts } = await report(page, step, error, label);
    where = `\n  blank-canvas record: ${json}\n  ${gist(facts)}`;
  } catch (reportError) {
    where = `\n  blank-canvas record not written: ${String(reportError?.message ?? reportError)}`;
  }
  if (error instanceof Error) {
    error.message += where;
    throw error;
  }
  throw new Error(String(error) + where);
}

/** `page.goto`, watched: on failure, the record, then the same failure. */
export async function gotoWatched(page, url, { timeout = 90_000, waitUntil = "networkidle", label = "" } = {}) {
  await watch(page, label);
  try {
    return await page.goto(url, { waitUntil, timeout });
  } catch (error) {
    return failWith(page, "goto", error, label);
  }
}

/** Waiting for the canvas, watched: on failure, the record, then the same failure. */
export async function canvasWatched(page, { timeout = 60_000, label = "" } = {}) {
  await watch(page, label);
  try {
    return await page.waitForSelector("canvas", { timeout });
  } catch (error) {
    return failWith(page, "canvas", error, label);
  }
}

/** Opening a page and waiting for its canvas, as every browser test does, watched. */
export async function openWatched(page, url, { gotoTimeout = 90_000, canvasTimeout = 60_000, waitUntil = "networkidle", label = "" } = {}) {
  await gotoWatched(page, url, { timeout: gotoTimeout, waitUntil, label });
  return canvasWatched(page, { timeout: canvasTimeout, label });
}

/** The record kept for a page, if it is watched. */
export const watchOf = (page) => watches.get(page) ?? null;
