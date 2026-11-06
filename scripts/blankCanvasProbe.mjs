/**
 * Opens the page 200 times and keeps what each opening did (Leo, 2026-11-05:
 * 「选丙……反复打开 200 次的脚本……先写好给我看结果」;
 * docs/plans/blank-canvas-plan.md, section 3). Recording only: the page is
 * the build as it is.
 *
 *   node scripts/blankCanvasProbe.mjs <url> <out.json>
 *
 * Three conditions, half on a 1440 desktop and half on a 390 phone each:
 *   甲 quiet   — one browser, one page at a time, 80 openings;
 *   乙 fresh   — a new browser for every opening, 60;
 *   丙 loaded  — three browsers opening at once, 20 rounds, 60.
 * Each opening is watched by scripts/pageWatch.mjs: whether the canvas came
 * within 60 s, the time the opening took, when the canvas was in the page
 * and when it had a size, the long tasks, any WebGL context not made or lost,
 * failed requests and page errors. A page that does not draw leaves its
 * record in test-results/blank-canvas/ as in the tests. COUNTS=a,b,c changes
 * the three counts.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { openWatched, snapshot, watchOf } from "./pageWatch.mjs";

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error("node scripts/blankCanvasProbe.mjs <url> <out.json>");
const [QUIET, FRESH, LOADED] = (process.env.COUNTS ?? "80,60,60").split(",").map(Number);
const ARGS = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const url = `${base}${base.includes("?") ? "&" : "?"}quality=high`;

/** One opening, in a browser already running. */
async function openOnce(browser, condition, n, device) {
  const context = await browser.newContext(DEVICES[device]);
  const page = await context.newPage();
  const started = Date.now();
  const row = { condition, n, device, at: new Date().toISOString() };
  try {
    await openWatched(page, url, { gotoTimeout: 90_000, canvasTimeout: 60_000, label: `probe-${condition}-${n}-${device}` });
    const facts = await snapshot(page);
    const watch = facts.page?.watch ?? {};
    Object.assign(row, {
      drew: true,
      openMs: Date.now() - started,
      canvasAtMs: watch.canvasAt ?? null,
      canvasSizedAtMs: watch.canvasSizedAt ?? null,
      loadMs: facts.page?.loadMs ?? null,
      longTasks: watch.longTasks ?? null,
      webgl: watch.webgl ?? [],
      contexts: (watch.contexts ?? []).length,
      failedRequests: watchOf(page)?.failedRequests ?? [],
      pageErrors: watchOf(page)?.pageErrors ?? [],
    });
  } catch (error) {
    const message = String(error?.message ?? error);
    Object.assign(row, {
      drew: false,
      openMs: Date.now() - started,
      error: message.split("\n")[0],
      record: message.match(/blank-canvas record: (.+)/)?.[1] ?? null,
    });
  }
  await context.close().catch(() => {});
  return row;
}

const rows = [];
const say = (row) =>
  console.log(
    `${row.condition} ${String(row.n).padStart(3)} ${row.device.padEnd(7)} ${row.drew ? "drew" : "BLANK"} open ${row.openMs} ms` +
      (row.drew ? `, canvas sized at ${row.canvasSizedAtMs} ms, long tasks ${row.longTasks?.count}/${row.longTasks?.maxMs} ms` : `, ${row.error}`),
  );
const deviceOf = (i) => (i % 2 === 0 ? "desktop" : "phone");

// 甲: one browser, one page at a time.
{
  const browser = await chromium.launch({ args: ARGS });
  for (let i = 0; i < QUIET; i += 1) {
    const row = await openOnce(browser, "quiet", i + 1, deviceOf(i));
    rows.push(row);
    say(row);
  }
  await browser.close();
}

// 乙: a new browser every time.
for (let i = 0; i < FRESH; i += 1) {
  const browser = await chromium.launch({ args: ARGS });
  const row = await openOnce(browser, "fresh", i + 1, deviceOf(i));
  rows.push(row);
  say(row);
  await browser.close();
}

// 丙: three browsers opening at once.
{
  const browsers = await Promise.all([0, 1, 2].map(() => chromium.launch({ args: ARGS })));
  for (let round = 0; round < LOADED / 3; round += 1) {
    const three = await Promise.all(browsers.map((browser, k) => openOnce(browser, "loaded", round * 3 + k + 1, deviceOf(round + k))));
    for (const row of three) {
      rows.push(row);
      say(row);
    }
  }
  await Promise.all(browsers.map((browser) => browser.close()));
}

/** Minimum, median, 95th percentile and maximum. */
function spread(values) {
  const v = values.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (v.length === 0) return null;
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))];
  return { n: v.length, min: v[0], median: q(0.5), p95: q(0.95), max: v[v.length - 1] };
}
const summary = {};
for (const condition of ["quiet", "fresh", "loaded"]) {
  for (const device of ["desktop", "phone"]) {
    const set = rows.filter((row) => row.condition === condition && row.device === device);
    summary[`${condition} ${device}`] = {
      openings: set.length,
      blank: set.filter((row) => !row.drew).length,
      openMs: spread(set.map((row) => row.openMs)),
      canvasSizedAtMs: spread(set.map((row) => row.canvasSizedAtMs)),
      longTaskMaxMs: spread(set.map((row) => row.longTasks?.maxMs)),
      webglEvents: set.reduce((sum, row) => sum + (row.webgl?.length ?? 0), 0),
      failedRequests: set.reduce((sum, row) => sum + (row.failedRequests?.length ?? 0), 0),
      pageErrors: set.reduce((sum, row) => sum + (row.pageErrors?.length ?? 0), 0),
    };
  }
}
writeFileSync(out, JSON.stringify({ url, started: rows[0]?.at, ended: new Date().toISOString(), summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 1));
console.log(`${rows.length} openings, ${rows.filter((row) => !row.drew).length} blank; written to ${out}`);
