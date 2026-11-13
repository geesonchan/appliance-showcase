import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readLog, startPreviewServer, watchMainThread } from "./previewServer.mjs";
import { startPreview } from "../tests/globalSetup";

/**
 * The test servers' own launcher, with its record (the server-reset round,
 * 甲; Leo, 2026-11-06: 「写一个独立的启动脚本……里面调用同样的 preview()，挂上请求、
 * 连接、出错和主线程卡顿的记录，仍然作为单独的进程启动，输出写进文件。」).
 *
 * Until this round the browser suite started `vite preview` with its output
 * thrown away, and the pixel shots' servers were started by hand: when the
 * local server stalled and reset the main chunk (decisions.md, "A browser
 * test that times out…"), nothing on the server's side was kept. Held here,
 * on a small build of its own made in a temporary folder (no `npm run build`
 * needed, so CI's unit run has it):
 *
 * - it serves as `vite preview` does — the page, its files with their types,
 *   a large file compressed, the page again for a path with no file;
 * - it is its own process, and stopping it ends it and frees its port;
 * - its record: the start, each connection opened and closed, each request
 *   with its status, bytes and time, a connection reset by the client, the
 *   main thread's delay each second, and the stop;
 * - the main-thread watch writes a stall when its thread is held;
 * - `tests/globalSetup.ts` starts the suite's server through it, and keeps
 *   its record in a file.
 */

const PORT = 4196;
const SETUP_PORT = 4197;

let dist: string;
let logs: string;
beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "preview-server-"));
  dist = join(root, "dist");
  logs = join(root, "logs");
  mkdirSync(join(dist, "assets"), { recursive: true });
  mkdirSync(logs);
  writeFileSync(
    join(dist, "index.html"),
    '<!doctype html><html><head><script type="module" crossorigin src="./assets/app-X1.js"></script><link rel="stylesheet" href="./assets/app-X1.css"></head><body><div id="root"></div></body></html>',
  );
  // Large enough to be compressed (compression's threshold is 1 KB).
  writeFileSync(join(dist, "assets", "app-X1.js"), `export const words = ${JSON.stringify("kitchen ".repeat(4_000))};\n`);
  writeFileSync(join(dist, "assets", "app-X1.css"), "body{margin:0}\n");
});

/** Whether nothing is listening on `port`, on either loopback address. */
async function portFree(port: number): Promise<boolean> {
  const tryListen = (host: string) =>
    new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen(port, host, () => server.close(() => resolve(true)));
    });
  return (await tryListen("127.0.0.1")) && (await tryListen("::1"));
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("scripts/previewServer.mjs: the preview server, recorded (2026-11-06)", () => {
  let server: Awaited<ReturnType<typeof startPreviewServer>>;
  let log: string;
  let served: Record<string, { status: number; type: string | null; encoding: string | null; text: string }>;
  let records: ReturnType<typeof readLog>;
  let freeAfter: boolean;

  beforeAll(async () => {
    log = join(logs, "server.jsonl");
    server = await startPreviewServer({ port: PORT, outDir: dist, log });
    served = {};
    for (const path of ["/", "/assets/app-X1.js", "/assets/app-X1.css", "/a/page/with/no/file"]) {
      const response = await fetch(`${server.url}${path}`, { headers: { "accept-encoding": "gzip" } });
      served[path] = {
        status: response.status,
        type: response.headers.get("content-type"),
        encoding: response.headers.get("content-encoding"),
        text: await response.text(),
      };
    }
    // A client that sends half a request and then resets the connection.
    await new Promise<void>((resolve) => {
      const socket = createConnection({ port: PORT, host: "localhost" }, () => {
        socket.write("GET /assets/app-X1.js HTTP/1.1\r\nHost: localhost\r\n");
        setTimeout(() => {
          socket.resetAndDestroy();
          resolve();
        }, 100);
      });
      socket.on("error", () => {});
    });
    // At least one of the main thread's once-a-second samples.
    await new Promise((resolve) => setTimeout(resolve, 1_300));
    await server.stop();
    freeAfter = await portFree(PORT);
    records = readLog(log);
  }, 60_000);

  it("serves as vite preview does: the page, its files and types, the large one compressed, the page for a path with no file", () => {
    expect(served["/"]).toMatchObject({ status: 200, type: expect.stringMatching(/^text\/html/) });
    expect(served["/"].text).toContain('<div id="root"></div>');
    expect(served["/assets/app-X1.js"]).toMatchObject({ status: 200, type: expect.stringMatching(/^(text|application)\/javascript/), encoding: "gzip" });
    expect(served["/assets/app-X1.js"].text).toContain("kitchen kitchen");
    expect(served["/assets/app-X1.css"]).toMatchObject({ status: 200, type: expect.stringMatching(/^text\/css/) });
    expect(served["/a/page/with/no/file"]).toMatchObject({ status: 200, type: expect.stringMatching(/^text\/html/) });
  });

  it("is its own process, and stopping it ends that process and frees its port", () => {
    expect(server.pid).not.toBe(process.pid);
    expect(alive(server.pid)).toBe(false);
    expect(freeAfter).toBe(true);
  });

  it("records its start, every request with status, bytes and time, its connections, a reset, the main thread each second, and its stop", () => {
    const kinds = records.map((r) => r.ev);
    expect(kinds[0]).toBe("start");
    expect(kinds).toContain("listening");
    expect(kinds[kinds.length - 1]).toBe("stop");

    const requests = records.filter((r) => r.ev === "req");
    expect(requests.map((r) => r.url)).toEqual(expect.arrayContaining(["/", "/assets/app-X1.js", "/assets/app-X1.css", "/a/page/with/no/file"]));
    const js = requests.find((r) => r.url === "/assets/app-X1.js")!;
    expect(js).toMatchObject({ status: 200, ended: "finish" });
    expect(js.bytes).toBeGreaterThan(100);
    expect(js.bytes).toBeLessThan(32_000); // compressed: the file is 32 KB
    expect(typeof js.ms).toBe("number");
    expect(typeof js.conn).toBe("number");

    expect(records.filter((r) => r.ev === "conn").length).toBeGreaterThanOrEqual(2);
    expect(records.some((r) => r.ev === "conn-close")).toBe(true);
    // The half request reset by its client is written as an error on its connection.
    expect(records.some((r) => (r.ev === "conn-error" || r.ev === "client-error") && r.code === "ECONNRESET")).toBe(true);

    const loop = records.filter((r) => r.ev === "loop");
    expect(loop.length).toBeGreaterThanOrEqual(1);
    expect(loop[0]).toEqual(expect.objectContaining({ p50: expect.any(Number), p99: expect.any(Number), max: expect.any(Number) }));
    for (const r of records) expect(typeof r.t).toBe("string");
  });
});

describe("the record marks a request from a test kept on the real server (丁's wiring, 2026-11-07)", () => {
  it("writes realServer on a request that carries x-real-server: 1, and nothing on one that does not", async () => {
    const root = mkdtempSync(join(tmpdir(), "preview-server-real-"));
    const log = join(root, "server.jsonl");
    const server = await startPreviewServer({ port: PORT + 10, outDir: dist, log });
    await fetch(`${server.url}/?kept=1`, { headers: { "x-real-server": "1" } });
    await fetch(`${server.url}/?routed=0`);
    await server.stop();
    const requests = readLog(log).filter((r) => r.ev === "req");
    expect(requests.find((r) => r.url === "/?kept=1")).toMatchObject({ realServer: true });
    expect(requests.find((r) => r.url === "/?routed=0")).not.toHaveProperty("realServer");
  }, 60_000);
});

/**
 * The watch, split in two (Leo, 2026-11-12, `docs/plans/flaky-tests-plan.md`: 「previewServer
 * 拆成假钟一条、真线程一条：同意。4 种改坏都必须变红。」). It failed twice in a busy suite
 * (2026-11-11 and 2026-11-12): a stall written while the thread was "free", the process held
 * off the CPU by something else on the machine — a real stall, which the watch is there to
 * write. "Free" is only free on a clock the test keeps itself.
 */
describe("the main-thread watch", () => {
  /** A clock and a timer the test drives: `tick` moves the clock and fires the timer; `hold` moves the clock alone. */
  function testClock() {
    let t = 0;
    let fire: (() => void) | null = null;
    return {
      now: () => t,
      every: (fn: () => void) => {
        fire = fn;
        return 1;
      },
      cancel: () => {
        fire = null;
      },
      tick(ms: number) {
        t += ms;
        fire?.();
      },
      hold(ms: number) {
        t += ms;
      },
      get running() {
        return fire !== null;
      },
    };
  }

  it("writes nothing while its thread is free, one stall with how long when it is held, and no second for the same hold", () => {
    const clock = testClock();
    const written: Array<Record<string, unknown>> = [];
    const stop = watchMainThread((record) => written.push(record), { intervalMs: 20, thresholdMs: 150, now: clock.now, every: clock.every, cancel: clock.cancel });
    for (let i = 0; i < 10; i += 1) clock.tick(20);
    const quiet = written.length;
    clock.hold(400);
    clock.tick(20);
    const held = written.slice();
    for (let i = 0; i < 5; i += 1) clock.tick(20);
    stop();
    expect({ quiet, held, after: written, stopped: !clock.running }).toEqual({
      quiet: 0,
      held: [{ ev: "stall", ms: 420 }],
      after: [{ ev: "stall", ms: 420 }],
      stopped: true,
    });
  });

  it("writes a tick more than the threshold late, and not one exactly at it", () => {
    const clock = testClock();
    const written: Array<Record<string, unknown>> = [];
    const stop = watchMainThread((record) => written.push(record), { intervalMs: 20, thresholdMs: 150, now: clock.now, every: clock.every, cancel: clock.cancel });
    clock.tick(170); // 150 late: at the threshold
    clock.tick(171); // 151 late
    stop();
    expect(written).toEqual([{ ev: "stall", ms: 171 }]);
  });

  // On the real thread and the real timer: the hold is written, with how long. Whether a
  // "free" thread writes nothing is the clock's case above — here something else on the
  // machine may hold the process too, and that stall is as real.
  it("writes the stall of its real thread held 400 ms", async () => {
    const written: Array<Record<string, unknown>> = [];
    const stop = watchMainThread((record) => written.push(record), { intervalMs: 20, thresholdMs: 150 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const until = Date.now() + 400;
    while (Date.now() < until) {
      // held
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    stop();
    const theHold = written.filter((r) => r.ev === "stall" && (r.ms as number) >= 350 && (r.ms as number) < 1_000);
    expect(theHold.length).toBeGreaterThanOrEqual(1);
  });
});

describe("tests/globalSetup.ts starts the suite's server through it", () => {
  it("serves the build, keeps the server's record in a file of its own, and frees the port when stopped", async () => {
    const setupLogs = join(logs, "setup");
    const stop = await startPreview(SETUP_PORT, { outDir: dist, logDir: setupLogs });
    const ok = (await fetch(`http://localhost:${SETUP_PORT}/assets/app-X1.css`)).ok;
    await stop();
    const files = readdirSync(setupLogs).filter((f) => f.endsWith(".jsonl"));
    expect(ok).toBe(true);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(new RegExp(`-${SETUP_PORT}\\.jsonl$`));
    const kinds = readLog(join(setupLogs, files[0])).map((r) => r.ev);
    expect(kinds).toEqual(expect.arrayContaining(["start", "listening", "req", "stop"]));
    expect(await portFree(SETUP_PORT)).toBe(true);
  }, 60_000);
});

