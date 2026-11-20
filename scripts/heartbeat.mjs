/**
 * The heartbeat beside the server-reset loop (docs/plans/server-reset-plan.md,
 * section 2, 甲): asks the test server for one small file every `ms`
 * milliseconds and writes how long each answer took, one JSON object a line:
 * { t, ms, status, bytes, error }. A process of its own, outside the browser
 * and outside the server: when the server stalls the heartbeat slows with it;
 * when the browser stalls and the server does not, it does not.
 *
 *   node scripts/heartbeat.mjs <url> <out.jsonl> [ms = 250]
 *
 * One beat at a time: the next is asked for `ms` after the last one began, or
 * at once if it took longer. A beat gives up after 10 s. Lines are written as
 * they come, synchronously, so a heartbeat ended by force keeps them all.
 * Held by `scripts/heartbeat.test.ts`.
 */
import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One request: how long it took, its status and bytes, or why it failed (never throws).
 *
 * The clock it times by and the signal it gives up on can be handed in (12d-2, Leo,
 * 2026-11-18): a test drives both, so what it asks of the timing does not hang on how
 * busy the machine is. Left out, they are the real ones — `performance.now` and a
 * `timeoutMs` timeout — and the heartbeat behaves as it always did.
 */
export async function beat(url, timeoutMs = 10_000, { now = () => performance.now(), signal } = {}) {
  const start = now();
  try {
    const response = await fetch(url, { signal: signal ?? AbortSignal.timeout(timeoutMs), cache: "no-store" });
    const body = await response.arrayBuffer();
    return { ms: Math.round(now() - start), status: response.status, bytes: body.byteLength, error: null };
  } catch (error) {
    const cause = error?.cause?.code ?? error?.cause?.message;
    const name = error?.name === "TimeoutError" ? "timeout" : error?.name === "AbortError" ? "aborted" : null;
    return { ms: Math.round(now() - start), status: null, bytes: null, error: [name, error?.message, cause].filter(Boolean).join(": ") };
  }
}

/**
 * The heartbeat itself: a beat, its line, and the next one `every` ms after the last began, or
 * at once if it took longer, for as long as `going()` says.
 *
 * The clock it keeps time by, the wait between beats and the stamp on each line can be handed in
 * (12d-2, Leo, 2026-11-19: the process case as the two beat() cases, the test keeping its own
 * time). Left out, they are the real ones, and the heartbeat behaves as it always did.
 */
export async function run({
  url,
  every,
  write,
  going = () => true,
  now = () => performance.now(),
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  stamp = () => new Date().toISOString(),
}) {
  while (going()) {
    const began = now();
    const t = stamp();
    const result = await beat(url, 10_000, { now });
    write(`${JSON.stringify({ t, ...result })}\n`);
    const left = every - (now() - began);
    if (left > 0) await wait(left);
  }
}

/** Its command line: the url, the file, and the interval, 250 ms unless one is given. */
export function argsOf(argv) {
  const [url, out, every = "250"] = argv;
  if (!url || !out) throw new Error("node scripts/heartbeat.mjs <url> <out.jsonl> [ms]");
  return { url, out, every: Number(every) };
}

/**
 * The heartbeat as its process runs it: the command line read, the file opened, and the loop
 * handed the url and the interval the command line gave, each line written to the file as it
 * comes, until a signal stops it.
 *
 * The loop and the signals can be handed in (12d-2, Leo, 2026-11-19: 「直接查从命令行读到的间隔和交给
 * 循环的是不是同一个值」), so a test sees what the process hands its loop with no clock at all. Left
 * out, they are `run` and SIGINT and SIGTERM, and the heartbeat behaves as it always did.
 */
export async function main(argv, { loop = run, stopOn = ["SIGINT", "SIGTERM"] } = {}) {
  const { url, out, every } = argsOf(argv);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  const fd = openSync(out, "a");
  let running = true;
  const end = () => {
    running = false;
    closeSync(fd);
    process.exit(0);
  };
  for (const signal of stopOn) process.on(signal, end);
  try {
    await loop({ url, every, write: (line) => writeSync(fd, line), going: () => running });
  } finally {
    for (const signal of stopOn) process.off(signal, end);
    if (running) closeSync(fd);
  }
}

const SELF = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main(process.argv.slice(2));
