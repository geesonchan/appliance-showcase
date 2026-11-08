/**
 * The server-reset loop (the server-reset round, 甲; docs/plans/server-reset-plan.md,
 * sections 4, 7 and 8): opens the page COUNT times the way the pixel shots do,
 * against the test server started the way the suite starts it, and keeps
 * everything that can say who stalled when a file is slow or a connection is
 * reset.
 *
 *   node scripts/serverResetLoop.mjs <build folder> <out folder>
 *
 * MODE (pixel: a browser for each BATCH openings, as the pixel shots; fresh: a
 * new browser for every opening, only that one page, then closed — the
 * Norton experiment, docs/plans/norton-experiment-plan.md; each browser's
 * launch is timed, `launchMs`, on its first opening's row),
 * COUNT (1000; Leo, 2026-11-06: 「改前 1,000 次可以，不到 3 次就照计划加到 2,000 次」),
 * BATCH (25, a pixel run's openings: one browser for each 25), PORT (4176),
 * NETLOG (1: Chromium's network log for each batch, kept only for a batch
 * with a reset, a stall or a blank page; 0 for none), WAIT_MS (2500, as the
 * pixel shots wait after the canvas), WARMUP (empty: none; a path of the
 * site, such as /fonts/Inter-OFL.txt: every browser, once launched, first
 * opens that file in a context of its own, waits up to 120 s for it, and
 * closes the context — the warm-up of docs/plans/warmup-plan.md; it runs no
 * page code and is no retry: the page measured is opened once, as before,
 * and the warm-up's own time is kept on the browser's first row, `warmup`),
 * ROUTE (1: 丁, docs/plans/route-plan.md — every request of the site from the
 * page measured is answered by Playwright from the build folder, through
 * `context.route`, so the page and its files never go through a connection
 * on this machine; the address stays the same; a path with no file is
 * answered with the page, as vite preview does, and kept on the row as
 * `routeMisses` (scripts/siteRoute.mjs); the server and the
 * heartbeat run as before, the heartbeat as the control, and the summary
 * says how many requests other than the heartbeat's reached the server —
 * 0, or 丁 did not bypass it).
 *
 * Each opening: a new context in the batch's browser, a 1440 desktop and a
 * 390 phone in turn, the page at `?quality=high&qualityLock=1` opened through
 * `scripts/pageWatch.mjs` (a page that does not draw leaves its record in
 * `test-results/blank-canvas/`), WAIT_MS more, then every own file's time
 * from the page's own timing — the page itself as "/" — and every failed
 * request. Written to the out folder as it goes:
 *   openings.jsonl  — a line an opening, with what it counts as
 *                     (`scripts/resetLoopStats.mjs`: reset, stall past 5 s, blank);
 *   server.jsonl    — the server's record (`scripts/previewServer.mjs`);
 *   heartbeat.jsonl — a beat every 250 ms from a process of its own (`scripts/heartbeat.mjs`);
 *   typeperf.csv    — the machine's CPU and disk each second (Leo: 「用 Windows 的
 *                     typeperf 每秒记一次 CPU 和硬盘的忙闲」);
 *   netlog/         — the kept batches' network logs;
 *   summary.json    — the counts, each own file's distribution (median, the
 *                     slowest 1%, the slowest; Leo: 「一般用多久、最慢 1% 用多久」),
 *                     and for each event the machine, the heartbeat and the
 *                     server in the seconds around it.
 * It reads no power state: the power plan before and the system log after
 * are read by hand, as for a full suite — a run with sleep or standby in it
 * is void.
 */
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { openWatched, watchOf } from "./pageWatch.mjs";
import { readLog, startPreviewServer } from "./previewServer.mjs";
import {
  around,
  batchSizes,
  classify,
  distributions,
  eventRate,
  ownTimes,
  pageRequestsAtServer,
  parseTypeperf,
  tenSecondSteps,
  warmupOf,
  warmupStats,
  warmupTarget,
} from "./resetLoopStats.mjs";
import { routeSite } from "./siteRoute.mjs";

const [distArg, outArg] = process.argv.slice(2);
if (!distArg || !outArg) throw new Error("node scripts/serverResetLoop.mjs <build folder> <out folder>");
const dist = resolve(distArg);
const out = resolve(outArg);
const MODE = process.env.MODE ?? "pixel";
const COUNT = Number(process.env.COUNT ?? 1000);
const BATCH = Number(process.env.BATCH ?? 25);
const PORT = Number(process.env.PORT ?? 4176);
const NETLOG = process.env.NETLOG !== "0";
const WAIT_MS = Number(process.env.WAIT_MS ?? 2500);
const WARMUP = process.env.WARMUP ?? "";
const WARMUP_TIMEOUT_MS = 120_000;
const ROUTE = process.env.ROUTE === "1";
warmupTarget("http://localhost", WARMUP); // a WARMUP that is not a path of the site stops the run before anything starts
const ARGS = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
};
const HEARTBEAT = fileURLToPath(new URL("./heartbeat.mjs", import.meta.url));
if (existsSync(join(out, "openings.jsonl"))) throw new Error(`${out} already has a run; give a new folder`);
mkdirSync(join(out, "netlog"), { recursive: true });

const mainChunk = readFileSync(join(dist, "index.html"), "utf8").match(/assets\/(index-[\w-]+\.js)/)?.[1] ?? null;
const meta = {
  started: new Date().toISOString(),
  dist,
  mainChunk,
  mode: MODE,
  count: COUNT,
  batch: BATCH,
  port: PORT,
  waitMs: WAIT_MS,
  warmup: WARMUP || null,
  route: ROUTE,
  netlog: NETLOG,
  node: process.version,
  head: (() => {
    try {
      return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
      return null;
    }
  })(),
};
writeFileSync(join(out, "meta.json"), JSON.stringify(meta, null, 2));

// The machine, each second.
const COUNTERS = [
  "\\Processor(_Total)\\% Processor Time",
  "\\PhysicalDisk(_Total)\\% Disk Time",
  "\\PhysicalDisk(_Total)\\% Idle Time",
  "\\PhysicalDisk(_Total)\\Current Disk Queue Length",
];
const typeperf =
  process.platform === "win32"
    ? spawn("typeperf", [...COUNTERS, "-si", "1", "-o", join(out, "typeperf.csv"), "-f", "CSV", "-y"], { stdio: "ignore", windowsHide: true })
    : null;

const server = await startPreviewServer({ port: PORT, outDir: dist, log: join(out, "server.jsonl") });
const heartbeat = spawn(process.execPath, [HEARTBEAT, `${server.url}/`, join(out, "heartbeat.jsonl"), "250"], { stdio: "ignore" });
const url = `${server.url}/?quality=high&qualityLock=1`;
const origin = new URL(server.url).origin;
const warmupUrl = warmupTarget(origin, WARMUP);

/** 丁: the build's files answered to the page by Playwright (scripts/siteRoute.mjs); a fallback or refusal kept on the row. */
const routeTo = (context, misses) => routeSite(context, { origin, dir: dist, onMiss: (miss) => misses.push(miss.url) });

/** The warm-up: the small file in a context of its own, up to 120 s, then the context closed. */
const warmUp = async (browser) => {
  const at = new Date().toISOString();
  const context = await browser.newContext();
  const page = await context.newPage();
  const started = Date.now();
  let status = null;
  let error;
  try {
    const response = await page.goto(warmupUrl, { timeout: WARMUP_TIMEOUT_MS, waitUntil: "load" });
    status = response?.status() ?? null;
  } catch (e) {
    error = String(e?.message ?? e).split("\n")[0];
  }
  const ms = Date.now() - started;
  await context.close().catch(() => {});
  return { at, ...warmupOf({ ms, status, error }) };
};

/** Every own file's time from the page's own timing: the page itself as "/", and its resources. */
const ownTimesOf = async (page) =>
  ownTimes(
    await page.evaluate(() =>
      [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")].map((e) => ({
        entryType: e.entryType,
        name: e.name,
        startTime: e.startTime,
        duration: e.duration,
        responseEnd: e.responseEnd,
        transferSize: e.transferSize,
      })),
    ),
    origin,
  );

let n = 0;
const events = [];
const sizes = batchSizes({ mode: MODE, count: COUNT, batch: BATCH });
for (let b = 0; b < sizes.length; b += 1) {
  const netlog = join(out, "netlog", `batch-${String(b + 1).padStart(4, "0")}.json`);
  const launchStarted = Date.now();
  const browser = await chromium.launch({ args: [...ARGS, ...(NETLOG ? [`--log-net-log=${netlog}`, "--net-log-capture-mode=Default"] : [])] });
  const launchMs = Date.now() - launchStarted;
  const warmup = warmupUrl ? await warmUp(browser) : null;
  let batchHadEvent = Boolean(warmup && (warmup.stall || !warmup.ok));
  if (warmup && (warmup.stall || !warmup.ok)) {
    console.log(`${warmup.at} warm-up of browser ${b + 1}: ${warmup.ok ? "arrived" : "FAILED"} in ${warmup.ms} ms${warmup.stall ? " — WARM-UP STALL" : ""}${warmup.error ? `; ${warmup.error}` : ""}`);
  }
  for (let i = 0; i < sizes[b]; i += 1) {
    n += 1;
    const device = n % 2 === 1 ? "desktop" : "phone";
    const context = await browser.newContext(DEVICES[device]);
    const routeMisses = [];
    if (ROUTE) await routeTo(context, routeMisses);
    const page = await context.newPage();
    const row = { n, batch: b + 1, firstInBrowser: i === 0, ...(i === 0 ? { launchMs } : {}), ...(i === 0 && warmup ? { warmup } : {}), device, at: new Date().toISOString(), origin };
    const started = Date.now();
    try {
      await openWatched(page, url, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `resetLoop-${n}-${device}` });
      await page.waitForTimeout(WAIT_MS);
      row.drew = true;
    } catch (error) {
      const message = String(error?.message ?? error);
      row.drew = false;
      row.error = message.split("\n")[0];
      row.record = message.match(/blank-canvas record: (.+)/)?.[1] ?? null;
    }
    row.openMs = Date.now() - started;
    row.resources = await ownTimesOf(page).catch(() => []);
    row.failedRequests = (watchOf(page)?.failedRequests ?? []).map((r) => ({ at: r.at, url: r.url, error: r.error }));
    if (ROUTE) row.routeMisses = routeMisses;
    Object.assign(row, classify(row));
    appendFileSync(join(out, "openings.jsonl"), `${JSON.stringify(row)}\n`);
    if (row.reset || row.stall || row.blank) {
      batchHadEvent = true;
      events.push(row);
      console.log(
        `${row.at} #${n} ${device}: ${[row.reset && "RESET", row.stall && "STALL", row.blank && "BLANK"].filter(Boolean).join(" ")}` +
          ` — slowest ${row.slowest?.path} ${row.slowest?.ms} ms${row.error ? `; ${row.error}` : ""}`,
      );
    }
    if (n % 100 === 0) console.log(`${new Date().toISOString()} ${n} of ${COUNT} opened (${MODE}), ${events.length} with an event`);
    await context.close().catch(() => {});
  }
  await browser.close();
  if (NETLOG && !batchHadEvent) rmSync(netlog, { force: true });
}

heartbeat.kill();
await server.stop();
typeperf?.kill();
await new Promise((r) => setTimeout(r, 1_500));

// What happened around each event.
const rows = readFileSync(join(out, "openings.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
const machine = existsSync(join(out, "typeperf.csv")) ? parseTypeperf(readFileSync(join(out, "typeperf.csv"), "utf8")) : [];
const beats = existsSync(join(out, "heartbeat.jsonl")) ? readLog(join(out, "heartbeat.jsonl")) : [];
const serverLog = readLog(join(out, "server.jsonl"));
const within = (list, from, to) => list.filter((r) => Date.parse(r.t) >= from && Date.parse(r.t) <= to);
const eventDetail = events.map((row) => {
  const from = Date.parse(row.at);
  const to = from + row.openMs;
  const beatsThen = within(beats, from - 5_000, to + 5_000);
  const serverThen = within(serverLog, from - 5_000, to + 5_000);
  return {
    n: row.n,
    at: row.at,
    firstInBrowser: row.firstInBrowser,
    launchMs: row.launchMs ?? null,
    device: row.device,
    reset: row.reset,
    stall: row.stall,
    blank: row.blank,
    slowest: row.slowest,
    slowestSteps: row.slowest ? tenSecondSteps(row.slowest.ms) : null,
    files: (row.resources ?? []).filter((r) => r.ms > 1_000).map((r) => ({ path: r.path, ms: r.ms, ...tenSecondSteps(r.ms) })),
    failedRequests: row.failedRequests,
    machine: around(machine, (from + to) / 2, Math.ceil((to - from) / 2000) + 5),
    heartbeat: {
      beats: beatsThen.length,
      slowestMs: beatsThen.length ? Math.max(...beatsThen.map((r) => r.ms)) : null,
      errors: beatsThen.filter((r) => r.error).map((r) => r.error),
      failed: beatsThen.filter((r) => r.error).map((r) => ({ t: r.t, ms: r.ms, ...tenSecondSteps(r.ms) })),
    },
    server: {
      requestsPast5s: serverThen.filter((r) => r.ev === "req" && r.ms > 5_000).map((r) => ({ url: r.url, ms: r.ms, ended: r.ended, bytes: r.bytes })),
      endedByClose: serverThen.filter((r) => r.ev === "req" && r.ended === "close").map((r) => ({ url: r.url, ms: r.ms, bytes: r.bytes })),
      connErrors: serverThen.filter((r) => r.ev === "conn-error").map((r) => r.code),
      stalls: serverThen.filter((r) => r.ev === "stall").map((r) => r.ms),
      loopMaxMs: Math.max(0, ...serverThen.filter((r) => r.ev === "loop").map((r) => r.max)),
    },
  };
});
// Each warm-up that stalled or failed, with the heartbeat and the server around it.
const warmupDetail = rows
  .filter((r) => r.warmup && (r.warmup.stall || !r.warmup.ok))
  .map((r) => {
    const from = Date.parse(r.warmup.at);
    const to = from + r.warmup.ms;
    const beatsThen = within(beats, from - 5_000, to + 5_000);
    return {
      batch: r.batch,
      firstOpening: r.n,
      ...r.warmup,
      machine: around(machine, (from + to) / 2, Math.ceil((to - from) / 2000) + 5),
      heartbeatFailed: beatsThen.filter((b) => b.error).map((b) => ({ t: b.t, ms: b.ms, ...tenSecondSteps(b.ms) })),
      serverStalls: within(serverLog, from - 5_000, to + 5_000).filter((x) => x.ev === "stall").map((x) => x.ms),
    };
  });
const summary = {
  ...meta,
  ended: new Date().toISOString(),
  openings: rows.length,
  resets: rows.filter((r) => r.reset).length,
  stalls: rows.filter((r) => r.stall).length,
  blank: rows.filter((r) => r.blank).length,
  anyEvent: rows.filter((r) => r.reset || r.stall || r.blank).length,
  rate: eventRate(rows),
  launchMs: (() => {
    const l = rows.filter((r) => typeof r.launchMs === "number").map((r) => r.launchMs).sort((a, b) => a - b);
    return l.length ? { n: l.length, median: l[Math.ceil(l.length / 2) - 1], slowest: l[l.length - 1] } : null;
  })(),
  files: distributions(rows),
  heartbeat: { beats: beats.length, slowestMs: beats.length ? Math.max(...beats.map((r) => r.ms)) : null, errors: beats.filter((r) => r.error).length },
  serverStalls: serverLog.filter((r) => r.ev === "stall").length,
  netlogsKept: readdirSync(join(out, "netlog")),
  events: eventDetail,
  warmups: warmupStats(rows),
  warmupEvents: warmupDetail,
  routeMisses: rows.reduce((sum, r) => sum + (r.routeMisses?.length ?? 0), 0),
  serverRequests: (({ heartbeat, other, otherUrls }) => ({ heartbeat, other, otherUrls: otherUrls.slice(0, 20) }))(pageRequestsAtServer(serverLog)),
};
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
console.log(`${summary.openings} openings (${MODE}): ${summary.resets} reset, ${summary.stalls} stalled past 5 s, ${summary.blank} blank; ${summary.rate.withAnEvent} with an event (${summary.rate.eventsOnFirst} on a browser's first opening)`);
if (ROUTE) console.log(`丁: ${summary.routeMisses} requests not in the build; the server got ${summary.serverRequests.heartbeat} heartbeat requests and ${summary.serverRequests.other} others`);
if (WARMUP) {
  const w = summary.warmups;
  console.log(`warm-ups (${WARMUP}): ${w.browsers} browsers, ${w.ok} arrived, ${w.failed} failed, ${w.stalls} stalled past 5 s; median ${w.median} ms, slowest 1% ${w.p99} ms, slowest ${w.max} ms`);
}
for (const f of summary.files) console.log(`  ${f.path}: n ${f.n}, median ${f.median} ms, slowest 1% ${f.p99} ms, slowest ${f.max} ms`);
console.log(`written to ${out}`);
