import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLog, startPreviewServer } from "../scripts/previewServer.mjs";
import { readMisses, unroutedPageRequests } from "../scripts/siteRoute.mjs";

/** Kept off 4173 so a preview server you already have open is left alone. */
export const PREVIEW_PORT = 4174;
export const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

/**
 * Where a test's 丁 writes a path it answered with the page for want of a file
 * (tests/siteBrowser.ts); read when the suite ends.
 */
export const ROUTE_MISSES = fileURLToPath(new URL("../test-results/site-route/misses.jsonl", import.meta.url));

async function waitForServer(url: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not come up at ${url} within ${timeoutMs}ms`);
}

/**
 * Fetch the page and everything it pulls, once, before any test runs.
 *
 * The first navigation otherwise pays for the server's first serve of a
 * megabyte and a half of JavaScript, and Playwright's `networkidle` gives it
 * thirty seconds to go quiet. On a busy machine that is not always enough, and
 * the suite fails on whichever test happened to be first rather than on
 * anything about the app.
 */
async function warm(url: string) {
  const html = await (await fetch(url)).text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => href.startsWith("/") || href.startsWith("./"));
  await Promise.all(
    assets.map((href) => fetch(new URL(href, url)).then((r) => r.arrayBuffer()).catch(() => {})),
  );
}

/** Vite's own command-line script, run with this node rather than through a shell. */
const VITE = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

/** The build the suite serves, and where its server's record is kept. */
const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const SERVER_LOGS = fileURLToPath(new URL("../test-results/preview-server", import.meta.url));

/**
 * Serve the production build on `port`, and give back what stops it.
 *
 * Round 89: this was `npx vite preview` with `shell: true`, and stopping it
 * killed the shell, not Vite — so after every run of the browser suite Vite
 * was still listening on 4174, serving a `dist/` the next build rewrote under
 * it (docs/decisions.md, Open items, round 88). Stopping waits until the
 * server has exited; `tests/previewServer.test.ts` holds the port free
 * afterwards.
 *
 * The server-reset round (2026-11-06, 甲; Leo: 「globalSetup.ts 和拍照脚本都改用这个
 * 启动脚本」): started through `scripts/previewServer.mjs` — the same
 * `preview()` that `vite preview` runs, in a process of its own as before,
 * but with its record kept: every connection, request and error, and its
 * main thread's delay, in `test-results/preview-server/<time>-<port>.jsonl`
 * (`logDir` to put it elsewhere). Until then the server's output was thrown
 * away, and when it stalled and reset the main chunk nothing of its side was
 * kept (decisions.md, "A browser test that times out…").
 * `scripts/previewServer.test.ts` holds this path.
 */
export async function startPreview(
  port: number,
  { outDir = DIST, logDir = SERVER_LOGS }: { outDir?: string; logDir?: string } = {},
): Promise<(() => Promise<void>) & { log: string; ready: string }> {
  const log = join(logDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${port}.jsonl`);
  const server = await startPreviewServer({ port, outDir, log });
  await waitForServer(server.url);
  await warm(server.url);
  // When the setup's own requests were done: the run-time guard looks only after it.
  const ready = new Date().toISOString();
  return Object.assign(() => server.stop(), { log, ready });
}

/**
 * The run-time guard on 丁's wiring (docs/plans/route-wiring-plan.md, section
 * 5), at the suite's end: every page the server was asked for came from a
 * test kept on the real server (marked x-real-server: 1), and 丁 never had to
 * answer a path with the page for want of a file. What it found is written to
 * test-results/site-route/summary.json; anything wrong fails the suite.
 */
function checkRouting(serverLog: string, ready: string) {
  const records = readLog(serverLog);
  const unrouted = unroutedPageRequests(records, { after: ready });
  const misses = readMisses(ROUTE_MISSES);
  const kept = records.filter((r) => r.ev === "req" && r.realServer && /^\/(appliance-showcase\/)?(\?|$)/.test(String(r.url)));
  const summary = {
    serverLog,
    keptPageRequests: kept.map((r) => ({ t: r.t, url: r.url, ms: r.ms, status: r.status })),
    unrouted,
    misses,
  };
  const out = fileURLToPath(new URL("../test-results/site-route/summary.json", import.meta.url));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`丁's wiring: ${kept.length} page requests from the tests kept on the real server, ${unrouted.length} not routed, ${misses.length} paths answered with the page for want of a file`);
  if (unrouted.length || misses.length) {
    throw new Error(
      `丁's wiring: ${unrouted.length} page requests reached the server unrouted, ${misses.length} paths had no file — ${JSON.stringify({ unrouted, misses })}`,
    );
  }
}

/**
 * Serve the working tree through Vite's development server on `port`, and give
 * back what stops it. Round 91.
 *
 * For the one thing the production build cannot show: React's development
 * warnings, which its production build leaves out (the `Slider` style warning,
 * `tests/sliderWarning.test.ts`). Started and stopped as `startPreview` is —
 * Vite's own script with this node, no shell, stopping waits for the exit —
 * and only by that file, which the suite runs on its own (fileParallelism off).
 */
export async function startDev(port: number): Promise<() => Promise<void>> {
  const server: ChildProcess = spawn(process.execPath, [VITE, "--port", String(port), "--strictPort"], {
    stdio: "ignore",
  });
  const exited = new Promise<void>((resolve) => server.once("exit", () => resolve()));
  await waitForServer(`http://localhost:${port}`, 60_000);
  return async () => {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await exited;
  };
}

/**
 * Serves the production build for the smoke suite.
 *
 * Run `npm run build` first, or use `npm test`, which does it for you. Testing
 * the built output rather than the dev server is deliberate: the bugs worth
 * catching here (shader variants, dependency pre-bundling) only show up in one
 * of the two.
 */
export default async function setup() {
  rmSync(ROUTE_MISSES, { force: true });
  const stop = await startPreview(PREVIEW_PORT);
  return async () => {
    await stop();
    checkRouting(stop.log, stop.ready);
  };
}
