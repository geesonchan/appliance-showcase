/**
 * The test servers' launcher: Vite's own `preview()` — the server `vite
 * preview` is — in a process of its own, with a record of what it did written
 * to a file as it goes (the server-reset round, 甲; Leo, 2026-11-06: 「写一个独立
 * 的启动脚本……里面调用同样的 preview()，挂上请求、连接、出错和主线程卡顿的记录，仍然作为单
 * 独的进程启动，输出写进文件」; docs/plans/server-reset-plan.md, sections 2 and 7).
 *
 * Why a process of its own: in the tests' process the server would share a
 * main thread with the tests' own work, and a stall measured there could be
 * the move's, or the move could hide the stall being looked for (Leo).
 *
 *   node scripts/previewServer.mjs --port 4174 --outDir dist --log <file.jsonl>
 *
 * or, from a script or the suite's setup, `startPreviewServer({ port, outDir,
 * log })`, which starts that and waits until it listens. The record, one JSON
 * object a line, each with its time `t`:
 *   start, listening, stop               — the server's life;
 *   conn, conn-close, conn-error,
 *   conn-timeout                         — each connection: opened (its client
 *                                          port), closed (bytes each way, how
 *                                          long it lived), an error (its code);
 *   req                                  — each request: its connection, method,
 *                                          path, status, bytes sent (as sent,
 *                                          compressed), ms from its start to its
 *                                          end, and how it ended — "finish", or
 *                                          "close" when the connection went first;
 *                                          `realServer: true` when it carried the
 *                                          header x-real-server: 1 (a test kept off
 *                                          丁, docs/plans/route-wiring-plan.md);
 *   loop                                 — each second, the main thread's delay
 *                                          (median, 99th percentile, worst, ms);
 *   stall                                — the main thread held past 200 ms, and
 *                                          for how long.
 * The record is written with synchronous writes, so a server ended by force
 * still leaves every line up to its end. Stdout and stderr go to
 * `<log>.out.txt`. When the process that started it goes away, it stops too.
 * Held by `scripts/previewServer.test.ts`.
 */
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const ROOT = join(dirname(SELF), "..");

/**
 * Watches the thread it runs on: a timer every `intervalMs`; when a tick comes
 * more than `thresholdMs` late, `write({ ev: "stall", ms })`, ms the time since
 * the tick before. Returns what stops it.
 */
export function watchMainThread(write, { intervalMs = 50, thresholdMs = 200 } = {}) {
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    const gap = now - last;
    if (gap - intervalMs > thresholdMs) write({ ev: "stall", ms: Math.round(gap) });
    last = now;
  }, intervalMs);
  return () => clearInterval(timer);
}

/** The record, a line an object. */
export function readLog(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/** The server itself, in this process: what the script runs. */
async function serve({ port, outDir, log }) {
  mkdirSync(dirname(log), { recursive: true });
  const fd = openSync(log, "a");
  const write = (record) => writeSync(fd, `${JSON.stringify({ t: new Date().toISOString(), ...record })}\n`);
  const { preview, version } = await import("vite");
  write({ ev: "start", pid: process.pid, port, outDir, node: process.version, vite: version });

  const server = await preview({
    root: ROOT,
    logLevel: "warn",
    build: { outDir },
    preview: { port, strictPort: true },
  });
  const http = server.httpServer;

  let connections = 0;
  http.on("connection", (socket) => {
    const id = ++connections;
    const opened = performance.now();
    socket.__previewId = id;
    write({ ev: "conn", id, remote: socket.remotePort, family: socket.remoteFamily });
    socket.on("error", (error) => write({ ev: "conn-error", id, code: error.code ?? null, message: String(error.message).slice(0, 200) }));
    socket.on("timeout", () => write({ ev: "conn-timeout", id }));
    socket.on("close", (hadError) =>
      write({ ev: "conn-close", id, hadError, bytesRead: socket.bytesRead, bytesWritten: socket.bytesWritten, ageMs: Math.round(performance.now() - opened) }),
    );
  });

  let requests = 0;
  // First of the request listeners, so its clock starts before Vite's middleware runs.
  http.prependListener("request", (req, res) => {
    const n = ++requests;
    const socket = req.socket;
    const start = performance.now();
    const before = socket.bytesWritten;
    // As asked: Vite's middleware rewrites req.url (a path with no file becomes /index.html).
    const url = req.url;
    // A test kept on the real server marks its requests (丁's wiring, docs/plans/route-wiring-plan.md, section 5).
    const realServer = req.headers["x-real-server"] === "1";
    let written = false;
    const end = (how) => {
      if (written) return;
      written = true;
      write({
        ev: "req",
        n,
        conn: socket.__previewId ?? null,
        method: req.method,
        url,
        status: res.statusCode,
        bytes: socket.bytesWritten - before,
        ms: Math.round(performance.now() - start),
        ended: how,
        ...(realServer ? { realServer: true } : {}),
      });
    };
    res.on("finish", () => end("finish"));
    res.on("close", () => end(res.writableFinished ? "finish" : "close"));
  });

  const stopWatch = watchMainThread(write);
  const delay = monitorEventLoopDelay({ resolution: 10 });
  delay.enable();
  const ms = (ns) => Math.round((ns / 1e6) * 10) / 10;
  const sampler = setInterval(() => {
    write({ ev: "loop", p50: ms(delay.percentile(50)), p99: ms(delay.percentile(99)), max: ms(delay.max) });
    delay.reset();
  }, 1_000);

  const url = `http://localhost:${port}`;
  write({ ev: "listening", url });
  process.stdout.write(`ready ${url}\n`);
  if (process.send) process.send({ ready: url });

  let stopping = false;
  const stop = async (why) => {
    if (stopping) return;
    stopping = true;
    clearInterval(sampler);
    stopWatch();
    delay.disable();
    write({ ev: "stop", why });
    const closed = server.close();
    http.closeAllConnections?.();
    await closed.catch(() => {});
    closeSync(fd);
    process.exit(0);
  };
  process.on("message", (message) => message === "stop" && stop("asked"));
  process.on("disconnect", () => stop("its parent went away"));
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
}

/**
 * Starts the server in a process of its own and resolves once it listens:
 * `{ url, pid, log, stop }`. `stop()` asks it to stop and waits until it has
 * exited (ended by force after 5 s).
 */
export async function startPreviewServer({ port, outDir, log, timeoutMs = 60_000 }) {
  const logFile = resolve(log);
  mkdirSync(dirname(logFile), { recursive: true });
  const outFile = `${logFile.replace(/\.jsonl$/, "")}.out.txt`;
  const out = openSync(outFile, "a");
  const child = spawn(process.execPath, [SELF, "--port", String(port), "--outDir", resolve(outDir), "--log", logFile], {
    stdio: ["ignore", out, out, "ipc"],
    cwd: ROOT,
  });
  closeSync(out);
  const exited = new Promise((done) => child.once("exit", () => done()));
  const url = await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`preview server on ${port} not up in ${timeoutMs} ms; see ${outFile}`)), timeoutMs);
    child.on("message", (message) => {
      if (message?.ready) {
        clearTimeout(timer);
        done(message.ready);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`preview server on ${port} exited (${code}) before it listened: ${readFileSync(outFile, "utf8").slice(-800)}`));
    });
  });
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      if (child.connected) child.send("stop");
      const force = setTimeout(() => child.kill(), 5_000);
      await exited;
      clearTimeout(force);
    }
  };
  return { url, pid: child.pid, log: logFile, stop };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === SELF;
if (isMain) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
  };
  const port = Number(arg("port", "4173"));
  await serve({
    port,
    outDir: resolve(arg("outDir", join(ROOT, "dist"))),
    log: resolve(arg("log", join(ROOT, "test-results", "preview-server", `${new Date().toISOString().replace(/[:.]/g, "-")}-${port}.jsonl`))),
  });
}
