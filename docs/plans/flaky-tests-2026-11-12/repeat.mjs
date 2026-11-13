// Runs one vitest test file (or one test in it, by name) again and again, each run a fresh
// vitest, and counts the runs that fail; with --busy, with busy.mjs keeping every core full
// for the whole series. Each run's exit code and, for a red one, its first assertion line,
// into a JSON lines file.
// The load stops by itself after BUSY_SECONDS (900 unless set), whatever happens here.
//   node docs/plans/flaky-tests-2026-11-12/repeat.mjs <runs> <out.jsonl> [--busy] [--config=<vitest config>] <test file> [-t <name>]
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { judge } from "./judge.mjs";

const args = process.argv.slice(2);
const runs = Number(args.shift());
const out = resolve(args.shift());
const busy = args.includes("--busy");
const config = args.find((a) => a.startsWith("--config="))?.split("=")[1];
const rest = args.filter((a) => a !== "--busy" && !a.startsWith("--config="));
mkdirSync(dirname(out), { recursive: true });

const load = busy ? spawn(process.execPath, [fileURLToPath(new URL("./busy.mjs", import.meta.url)), process.env.BUSY_SECONDS ?? "900", ...(process.env.BUSY_THREADS ? [process.env.BUSY_THREADS] : [])], { stdio: "ignore", env: process.env }) : null;
if (load) await new Promise((r) => setTimeout(r, 1500));
let red = 0;
for (let i = 1; i <= runs; i += 1) {
  const started = new Date();
  // vitest by its own script, no shell between: through `npx` with a shell on Windows the
  // arguments were joined unquoted, so a -t name with spaces and commas was cut at its first
  // space and the run ran the whole file (found 2026-11-12, 17:20).
  const r = spawnSync(process.execPath, [resolve("node_modules/vitest/vitest.mjs"), "run", ...(config ? ["--config", config] : []), ...rest], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = `${r.stdout}\n${r.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
  writeFileSync(out.replace(/\.jsonl$/, `-run${String(i).padStart(2, "0")}.log`), text);
  // Judged by judge.mjs: a failed case is red; a run that failed only on the file's own
  // count of its cases, with the chosen case passed, is written down, not counted red.
  const { failed, why } = judge(r.status, text);
  if (failed) red += 1;
  appendFileSync(out, `${JSON.stringify({ run: i, busy, start: started.toISOString(), ms: Date.now() - started.getTime(), exit: r.status, why })}\n`);
  console.log(`${i}/${runs} ${busy ? "busy" : "idle"} exit ${r.status}${why ? " | " + why.slice(0, 160) : ""}`);
}
load?.kill();
console.log(`${red} of ${runs} red (${busy ? "busy" : "idle"})`);
