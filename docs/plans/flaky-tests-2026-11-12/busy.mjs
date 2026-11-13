// "The machine busy" for the flaky tests' plan (Leo, 2026-11-12: 「改前改后各在"电脑很忙"的条件下跑多少次，
// 失败各几次」): one busy loop per logical core, at normal priority, in worker threads of this
// process, until it is stopped (Ctrl+C, or killed) or for the seconds given. Every core is
// kept full, so any other process — a test's worker, the browser — has to share the CPU,
// as it does in a full suite with Chromium, the GPU process and vitest's workers all running.
// With BUSY_PRIORITY=above (or high) the process runs above normal priority, so a test's
// worker at normal priority is held off the CPU for a while now and then, as in a full suite.
//   node docs/plans/flaky-tests-2026-11-12/busy.mjs [seconds] [threads]
import { Worker } from "node:worker_threads";
import { constants, cpus, setPriority } from "node:os";

const seconds = Number(process.argv[2] ?? 0);
const threads = Number(process.argv[3] ?? cpus().length);
const level = process.env.BUSY_PRIORITY;
if (level) setPriority(process.pid, level === "high" ? constants.priority.PRIORITY_HIGH : constants.priority.PRIORITY_ABOVE_NORMAL);
const code = "for (;;) { Math.sqrt(Math.random()); }";
const workers = Array.from({ length: threads }, () => new Worker(code, { eval: true }));
console.log(`busy: ${threads} threads${seconds ? `, ${seconds}s` : ""}, pid ${process.pid}`);
if (seconds) setTimeout(() => process.exit(0), seconds * 1000);
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
void workers;
