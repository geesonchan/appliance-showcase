import { describe, expect, it } from "vitest";
import { around, batchSizes, classify, distributions, eventRate, ownTimes, parseTypeperf, percentile, tenSecondSteps, warmupOf, warmupStats, warmupTarget } from "./resetLoopStats.mjs";

/**
 * The arithmetic of the server-reset loop (docs/plans/server-reset-plan.md,
 * section 4; Leo, 2026-11-06: 「报告里写出每个本站文件的用时分布（一般用多久、最慢
 * 1% 用多久）」). Fixtures are lopsided on purpose: a median and a slowest 1%
 * that a symmetric sample would give the same either way.
 */

describe("percentile, nearest rank", () => {
  it("gives the value at or above the share asked for, from unsorted values", () => {
    // 1..99 then one far-off value: the median is 50, the slowest 1% is the far one.
    const values = [...Array.from({ length: 99 }, (_, i) => 99 - i), 10_000];
    expect(percentile(values, 0.5)).toBe(50);
    expect(percentile(values, 0.99)).toBe(99);
    expect(percentile(values, 1)).toBe(10_000);
    expect(percentile([7], 0.99)).toBe(7);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("classify an opening", () => {
  const own = "http://localhost:4176";
  const base = { drew: true, origin: own, failedRequests: [], resources: [{ path: "/assets/index-A.js", ms: 120 }] };

  it("is clean when the page drew and every own file came within 5 s", () => {
    expect(classify(base)).toEqual({ reset: false, stall: false, blank: false, slowest: { path: "/assets/index-A.js", ms: 120 } });
  });

  it("is a reset when an own file failed with ERR_CONNECTION_RESET or ERR_CONNECTION_CLOSED, not when another host's did", () => {
    const reset = { ...base, failedRequests: [{ url: `${own}/assets/index-A.js`, error: "net::ERR_CONNECTION_RESET" }] };
    const closed = { ...base, failedRequests: [{ url: `${own}/assets/three-B.js`, error: "net::ERR_CONNECTION_CLOSED" }] };
    const elsewhere = { ...base, failedRequests: [{ url: "https://geesonchan.goatcounter.com/count", error: "net::ERR_CONNECTION_RESET" }] };
    expect(classify(reset).reset).toBe(true);
    expect(classify(closed).reset).toBe(true);
    expect(classify(elsewhere).reset).toBe(false);
  });

  it("is a stall when an own file took more than 5 s, the navigation itself included", () => {
    const slow = { ...base, resources: [{ path: "/assets/react-C.js", ms: 10_147 }, { path: "/assets/index-A.js", ms: 300 }] };
    expect(classify(slow)).toMatchObject({ stall: true, slowest: { path: "/assets/react-C.js", ms: 10_147 } });
    expect(classify({ ...base, resources: [{ path: "/", ms: 5_001 }] }).stall).toBe(true);
    expect(classify({ ...base, resources: [{ path: "/", ms: 5_000 }] }).stall).toBe(false);
  });

  it("is blank when the page did not draw", () => {
    expect(classify({ ...base, drew: false }).blank).toBe(true);
  });
});

describe("each own file's time in one opening", () => {
  // The trial of 2026-11-06, opening 1, as the page's timing gave it: the page
  // itself left the server in 4 ms (server.jsonl, n 2) and its response ended
  // at 140 ms, but its navigation entry's duration runs to the end of the load
  // event, 10,618 ms, every file's wait in it. A file's own entry is its own.
  const origin = "http://localhost:4176";
  const entries = [
    { entryType: "navigation", name: `${origin}/?quality=high&qualityLock=1`, startTime: 0, duration: 10_618.4, responseEnd: 139.6, transferSize: 879 },
    { entryType: "resource", name: `${origin}/assets/index-DXl3ZdsD.js`, startTime: 145.2, duration: 10_106.3, responseEnd: 10_251.5, transferSize: 209_815 },
    { entryType: "resource", name: "https://geesonchan.goatcounter.com/count.js", startTime: 150, duration: 30, responseEnd: 180, transferSize: 0 },
  ];

  it("times the page itself to the end of its response, not to the end of its load event", () => {
    expect(ownTimes(entries, origin)[0]).toEqual({ path: "/", ms: 140, startMs: 0, bytes: 879 });
  });

  it("times a file by its own entry, and leaves out another host's", () => {
    expect(ownTimes(entries, origin).slice(1)).toEqual([{ path: "/assets/index-DXl3ZdsD.js", ms: 10_106, startMs: 145, bytes: 209_815 }]);
  });
});

describe("distributions, a file at a time", () => {
  it("groups by the file, gives n, median, slowest 1% and slowest, slowest median first", () => {
    const rows = [
      ...Array.from({ length: 100 }, (_, i) => ({ path: "/assets/index-A.js", ms: i < 99 ? 100 + i : 29_079 })),
      ...Array.from({ length: 3 }, (_, i) => ({ path: "/assets/index-C.css", ms: 10 + i })),
    ];
    const d = distributions(rows.map((r) => ({ resources: [r] })));
    expect(d).toEqual([
      { path: "/assets/index-A.js", n: 100, median: 149, p99: 198, max: 29_079 },
      { path: "/assets/index-C.css", n: 3, median: 11, p99: 12, max: 12 },
    ]);
  });
});

describe("typeperf's CSV", () => {
  // As typeperf wrote it on this machine, 2026-11-06 17:04, with one row where
  // a counter could not be read (typeperf writes a blank).
  const csv = [
    '"(PDH-CSV 4.0)","\\\\LEO_THINKPAD\\Processor(_Total)\\% Processor Time","\\\\LEO_THINKPAD\\PhysicalDisk(_Total)\\% Disk Time","\\\\LEO_THINKPAD\\PhysicalDisk(_Total)\\% Idle Time","\\\\LEO_THINKPAD\\PhysicalDisk(_Total)\\Current Disk Queue Length"',
    '"11/06/2026 17:04:15.101","6.461506","3.113898","98.999014","0.000000"',
    '"11/06/2026 17:04:16.115","92.5","0.386289","99.344648","2.000000"',
    '"11/06/2026 17:04:17.120"," ","1.5","97.0","0.000000"',
    "",
  ].join("\r\n");

  it("reads each second's CPU and disk by the counter's name, whatever the machine is called", () => {
    const rows = parseTypeperf(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual({ t: new Date(2026, 10, 6, 17, 4, 16, 115).getTime(), cpu: 92.5, diskTime: 0.386289, diskIdle: 99.344648, diskQueue: 2 });
    expect(rows[2].cpu).toBeNull();
  });

  it("gives the seconds around a moment, with the busiest of each", () => {
    const rows = parseTypeperf(csv);
    const at = new Date(2026, 10, 6, 17, 4, 16, 0).getTime();
    expect(around(rows, at, 1)).toEqual({ seconds: 2, cpuMax: 92.5, diskTimeMax: 3.113898, diskIdleMin: 98.999014, diskQueueMax: 2 });
    expect(around(rows, at + 60_000, 1)).toEqual({ seconds: 0, cpuMax: null, diskTimeMax: null, diskIdleMin: null, diskQueueMax: null });
  });
});

describe("the two ways of opening (the Norton experiment, 2026-11-07)", () => {
  it("pixel: a browser for each 25 openings, the last browser the rest; fresh: a browser for every opening", () => {
    expect(batchSizes({ mode: "pixel", count: 60, batch: 25 })).toEqual([25, 25, 10]);
    expect(batchSizes({ mode: "fresh", count: 3, batch: 25 })).toEqual([1, 1, 1]);
    expect(batchSizes({ mode: "pixel", count: 0, batch: 25 })).toEqual([]);
    expect(() => batchSizes({ mode: "tabs", count: 5, batch: 25 })).toThrow(/pixel or fresh/);
  });
});

describe("how near a wait is to a whole number of 10 s", () => {
  // The night of 2026-11-06: three files at 30,116 and 50,188 ms, heartbeat
  // beats failing at 9,796 and 19,869 ms; the server's thread held 14,136 ms.
  it("gives the nearest multiple of 10 s, how far off, and whether within half a second of it", () => {
    expect(tenSecondSteps(30_116)).toEqual({ steps: 3, offMs: 116, near: true });
    expect(tenSecondSteps(50_188)).toEqual({ steps: 5, offMs: 188, near: true });
    expect(tenSecondSteps(9_796)).toEqual({ steps: 1, offMs: -204, near: true });
    expect(tenSecondSteps(19_869)).toEqual({ steps: 2, offMs: -131, near: true });
    expect(tenSecondSteps(14_136)).toEqual({ steps: 1, offMs: 4_136, near: false });
    expect(tenSecondSteps(327)).toEqual({ steps: 0, offMs: 327, near: false });
  });
});

describe("how often an opening goes wrong", () => {
  it("counts the openings with an event, overall and on a browser's first opening", () => {
    const row = (firstInBrowser: boolean, event = false) => ({ firstInBrowser, reset: false, stall: event, blank: false });
    const pixel = [row(true, true), ...Array.from({ length: 24 }, () => row(false)), row(true), ...Array.from({ length: 24 }, (_, i) => row(false, i === 3))];
    expect(eventRate(pixel)).toEqual({ openings: 50, withAnEvent: 2, rate: 0.04, firstOpenings: 2, eventsOnFirst: 1, eventsOnOthers: 1 });
    const fresh = [row(true), row(true, true), row(true), row(true)];
    expect(eventRate(fresh)).toEqual({ openings: 4, withAnEvent: 1, rate: 0.25, firstOpenings: 4, eventsOnFirst: 1, eventsOnOthers: 0 });
    expect(eventRate([])).toEqual({ openings: 0, withAnEvent: 0, rate: null, firstOpenings: 0, eventsOnFirst: 0, eventsOnOthers: 0 });
  });
});

describe("the warm-up: every new browser opens a small file first (2026-11-07)", () => {
  it("makes the warm-up's address from the server's origin and WARMUP; none when WARMUP is empty", () => {
    expect(warmupTarget("http://localhost:4176", "/fonts/Inter-OFL.txt")).toBe("http://localhost:4176/fonts/Inter-OFL.txt");
    expect(warmupTarget("http://localhost:4176", undefined)).toBeNull();
    expect(warmupTarget("http://localhost:4176", "")).toBeNull();
    // Only a path of the site itself: never another host, never a bare name.
    expect(() => warmupTarget("http://localhost:4176", "fonts/Inter-OFL.txt")).toThrow("starts with /");
    expect(() => warmupTarget("http://localhost:4176", "//example.com/x.txt")).toThrow("starts with /");
  });

  it("says what one warm-up was: arrived or not, stalled past 5 s or not, and how near a multiple of 10 s", () => {
    expect(warmupOf({ ms: 38, status: 200 })).toEqual({ ms: 38, status: 200, ok: true, stall: false, steps: 0, offMs: 38, near: false });
    expect(warmupOf({ ms: 20_117, status: 200 })).toEqual({ ms: 20_117, status: 200, ok: true, stall: true, steps: 2, offMs: 117, near: true });
    expect(warmupOf({ ms: 120_004, status: null, error: "page.goto: Timeout 120000ms exceeded." })).toEqual({
      ms: 120_004,
      status: null,
      error: "page.goto: Timeout 120000ms exceeded.",
      ok: false,
      stall: true,
      steps: 12,
      offMs: 4,
      near: true,
    });
    expect(warmupOf({ ms: 41, status: 404 })).toMatchObject({ ok: false, stall: false });
  });

  it("counts the warm-ups over a run, apart from the pages measured", () => {
    const row = (warmup?: object, stall = false) => ({ firstInBrowser: true, reset: false, stall, blank: false, ...(warmup ? { warmup } : {}) });
    const rows = [
      row(warmupOf({ ms: 30, status: 200 })),
      row(warmupOf({ ms: 10_090, status: 200 })),
      row(warmupOf({ ms: 52, status: 200 }), true),
      row(warmupOf({ ms: 120_010, status: null, error: "timeout" })),
      row(),
    ];
    expect(warmupStats(rows)).toEqual({ browsers: 4, ok: 3, failed: 1, stalls: 2, nearTen: 2, median: 52, p99: 120_010, max: 120_010 });
    expect(warmupStats([row()])).toEqual({ browsers: 0, ok: 0, failed: 0, stalls: 0, nearTen: 0, median: null, p99: null, max: null });
    // The measured page's stall is the page's, not the warm-up's.
    expect(eventRate(rows).withAnEvent).toBe(1);
  });
});
