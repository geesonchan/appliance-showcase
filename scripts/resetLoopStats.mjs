/**
 * The arithmetic of the server-reset loop (docs/plans/server-reset-plan.md,
 * section 4): what an opening counts as, each own file's time distribution,
 * and typeperf's record of the machine around a moment. No browser, no
 * server: `scripts/serverResetLoop.mjs` writes the rows, this reads them.
 * Held by `scripts/resetLoopStats.test.ts`.
 */

/** An own file slower than this is a stall (Leo's plan, section 4: past 5 s). */
export const STALL_MS = 5_000;
const RESET = /ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED/;

/**
 * How the openings fall into browsers. "pixel": a browser for each `batch`
 * openings, as a pixel run opens 25 in one; "fresh": a new browser for every
 * opening (the Norton experiment, docs/plans/norton-experiment-plan.md: every
 * opening a browser's first).
 */
export function batchSizes({ mode, count, batch }) {
  if (mode !== "pixel" && mode !== "fresh") throw new Error(`MODE is pixel or fresh, not ${mode}`);
  const size = mode === "fresh" ? 1 : batch;
  const sizes = [];
  for (let left = count; left > 0; left -= size) sizes.push(Math.min(size, left));
  return sizes;
}

/**
 * How near a wait is to a whole number of 10 s: the nearest multiple, how far
 * off (ms), and whether within half a second of a multiple of at least one.
 * The stalls of 2026-11-06 came in steps of about 10 s.
 */
export function tenSecondSteps(ms) {
  const steps = Math.round(ms / 10_000);
  const offMs = Math.round(ms - steps * 10_000);
  return { steps, offMs, near: steps >= 1 && Math.abs(offMs) <= 500 };
}

/** How many openings had an event (reset, stall or blank), overall and on a browser's first opening. */
export function eventRate(rows) {
  const hit = (r) => r.reset || r.stall || r.blank;
  const withAnEvent = rows.filter(hit).length;
  const first = rows.filter((r) => r.firstInBrowser);
  const eventsOnFirst = first.filter(hit).length;
  return {
    openings: rows.length,
    withAnEvent,
    rate: rows.length ? withAnEvent / rows.length : null,
    firstOpenings: first.length,
    eventsOnFirst,
    eventsOnOthers: withAnEvent - eventsOnFirst,
  };
}

/**
 * The warm-up's address (docs/plans/warmup-plan.md): WARMUP, a path of the
 * site itself, on the test server's origin; null when WARMUP is empty (no
 * warm-up, the way groups 甲 and 乙 ran).
 */
export function warmupTarget(origin, path) {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error(`WARMUP is a path of the site that starts with /, not ${path}`);
  return new URL(path, origin).href;
}

/**
 * One warm-up: how long the small file took to arrive, its status, whether it
 * arrived (a 2xx and no error), whether it stalled past 5 s (as a page's file
 * would count), and how near a whole number of 10 s it was.
 */
export function warmupOf({ ms, status, error }) {
  return {
    ms,
    status,
    ...(error ? { error } : {}),
    ok: !error && typeof status === "number" && status >= 200 && status < 300,
    stall: ms > STALL_MS,
    ...tenSecondSteps(ms),
  };
}

/** The warm-ups over a run (rows with `warmup`, a browser's first opening), apart from the pages measured. */
export function warmupStats(rows) {
  const w = rows.map((r) => r.warmup).filter(Boolean);
  const ms = w.map((x) => x.ms);
  return {
    browsers: w.length,
    ok: w.filter((x) => x.ok).length,
    failed: w.filter((x) => !x.ok).length,
    stalls: w.filter((x) => x.stall).length,
    nearTen: w.filter((x) => x.near).length,
    median: percentile(ms, 0.5),
    p99: percentile(ms, 0.99),
    max: ms.length ? Math.max(...ms) : null,
  };
}

/* 丁's answers (routeFileOf, contentTypeOf) moved to scripts/siteRoute.mjs, 2026-11-07. */

/**
 * The requests the test server got: the heartbeat's ("/") and any other. With
 * 丁 the browser never reaches the server, so `other` must be 0, or the run
 * did not bypass it.
 */
export function pageRequestsAtServer(log) {
  const reqs = log.filter((r) => r.ev === "req");
  const otherUrls = reqs.filter((r) => r.url !== "/").map((r) => r.url);
  return { heartbeat: reqs.length - otherUrls.length, other: otherUrls.length, otherUrls };
}

/** The value at or above the share `q` of `values` (nearest rank); null for none. */
export function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}

/**
 * What one opening counts as. `row`: { drew, origin, failedRequests: [{ url, error }],
 * resources: [{ path, ms }] } — the page itself (the navigation, path "/" or
 * its query) among the resources.
 */
export function classify(row) {
  const own = (url) => {
    try {
      return new URL(url).origin === row.origin;
    } catch {
      return false;
    }
  };
  const reset = (row.failedRequests ?? []).some((r) => own(r.url) && RESET.test(r.error ?? ""));
  const resources = row.resources ?? [];
  const slowest = resources.reduce((a, b) => (b.ms > (a?.ms ?? -1) ? b : a), null);
  return {
    reset,
    stall: resources.some((r) => r.ms > STALL_MS),
    blank: row.drew === false,
    slowest: slowest ? { path: slowest.path, ms: slowest.ms } : null,
  };
}

/**
 * Every own file's time in one opening, from the page's own timing entries
 * (navigation and resource, as plain objects): the page itself as "/".
 *
 * A file is timed by its entry's duration, request to the end of its
 * response. The page itself by its response's end: its navigation entry's
 * duration runs on to the end of the load event, after every file the page
 * waits for — the trial of 2026-11-06 read 10,618 ms for a page the server
 * sent in 4 ms (Leo: 「改用 responseEnd」).
 */
export function ownTimes(entries, origin) {
  return entries
    .filter((e) => new URL(e.name).origin === origin)
    .map((e) => ({
      path: e.entryType === "navigation" ? "/" : new URL(e.name).pathname,
      ms: Math.round(e.entryType === "navigation" ? e.responseEnd - e.startTime : e.duration),
      startMs: Math.round(e.startTime),
      bytes: e.transferSize ?? null,
    }));
}

/** Each own file's times over every opening: n, median, slowest 1%, slowest; the slowest median first. */
export function distributions(rows) {
  const byPath = new Map();
  for (const row of rows) {
    for (const r of row.resources ?? []) {
      if (typeof r.ms !== "number") continue;
      if (!byPath.has(r.path)) byPath.set(r.path, []);
      byPath.get(r.path).push(r.ms);
    }
  }
  return [...byPath.entries()]
    .map(([path, ms]) => ({ path, n: ms.length, median: percentile(ms, 0.5), p99: percentile(ms, 0.99), max: Math.max(...ms) }))
    .sort((a, b) => b.median - a.median || a.path.localeCompare(b.path));
}

/** A typeperf time, "MM/DD/YYYY HH:MM:SS.mmm", as the machine's local time. */
function typeperfTime(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})\.(\d{1,3})$/.exec(text.trim());
  if (!m) return null;
  const [mo, d, y, h, mi, s] = m.slice(1, 7).map(Number);
  return new Date(y, mo - 1, d, h, mi, s, Number(m[7].padEnd(3, "0"))).getTime();
}

const cells = (line) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'));
const number = (text) => (text != null && text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : null);

/**
 * typeperf's CSV (`-f CSV`) for the four counters the loop asks for, read by
 * the counter's name so the machine's name in the header does not matter.
 */
export function parseTypeperf(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const header = cells(lines[0]);
  const col = (name) => header.findIndex((h) => h.endsWith(name));
  const at = { cpu: col("\\% Processor Time"), diskTime: col("\\% Disk Time"), diskIdle: col("\\% Idle Time"), diskQueue: col("\\Current Disk Queue Length") };
  return lines.slice(1).flatMap((line) => {
    const c = cells(line);
    const t = typeperfTime(c[0] ?? "");
    if (t == null) return [];
    return [{ t, cpu: number(c[at.cpu]), diskTime: number(c[at.diskTime]), diskIdle: number(c[at.diskIdle]), diskQueue: number(c[at.diskQueue]) }];
  });
}

/** The machine in the `seconds` either side of `t` (ms): how many samples, and the busiest of each counter. */
export function around(rows, t, seconds) {
  const near = rows.filter((r) => Math.abs(r.t - t) <= seconds * 1000);
  const pick = (key, f) => {
    const v = near.map((r) => r[key]).filter((x) => x != null);
    return v.length ? f(...v) : null;
  };
  return {
    seconds: near.length,
    cpuMax: pick("cpu", Math.max),
    diskTimeMax: pick("diskTime", Math.max),
    diskIdleMin: pick("diskIdle", Math.min),
    diskQueueMax: pick("diskQueue", Math.max),
  };
}
