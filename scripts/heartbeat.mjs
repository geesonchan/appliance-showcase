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

/** One request: how long it took, its status and bytes, or why it failed (never throws). */
export async function beat(url, timeoutMs = 10_000) {
  const start = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    const body = await response.arrayBuffer();
    return { ms: Math.round(performance.now() - start), status: response.status, bytes: body.byteLength, error: null };
  } catch (error) {
    const cause = error?.cause?.code ?? error?.cause?.message;
    const name = error?.name === "TimeoutError" ? "timeout" : error?.name === "AbortError" ? "aborted" : null;
    return { ms: Math.round(performance.now() - start), status: null, bytes: null, error: [name, error?.message, cause].filter(Boolean).join(": ") };
  }
}

const SELF = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  const [url, out, every = "250"] = process.argv.slice(2);
  if (!url || !out) throw new Error("node scripts/heartbeat.mjs <url> <out.jsonl> [ms]");
  const interval = Number(every);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  const fd = openSync(out, "a");
  let running = true;
  const end = () => {
    running = false;
    closeSync(fd);
    process.exit(0);
  };
  process.on("SIGINT", end);
  process.on("SIGTERM", end);
  while (running) {
    const began = performance.now();
    const t = new Date().toISOString();
    const result = await beat(url);
    writeSync(fd, `${JSON.stringify({ t, ...result })}\n`);
    const wait = interval - (performance.now() - began);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
}
