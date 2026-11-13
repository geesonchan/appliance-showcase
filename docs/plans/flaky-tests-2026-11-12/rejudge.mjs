// The filtered fadeRebuild runs' logs read again by judge.mjs's rule as it is now (Leo,
// 2026-11-12: 「改完用现有的 60 份日志重新判一遍，报结果，不用重跑测试」): each run's exit code
// from its series' .jsonl, its text from its own -runNN.log.
//   node docs/plans/flaky-tests-2026-11-12/rejudge.mjs
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { judge } from "./judge.mjs";

const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const SERIES = ["fade-before-slider", "fade-before-island", "fade-before-island-b", "fade-after-slider", "fade-after-island"];
let all = 0;
for (const name of SERIES) {
  const runs = readFileSync(here(`${name}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const tally = { passedAlone: 0, countOnly: 0, red: 0, missingLog: 0 };
  const passes = [];
  for (const r of runs) {
    const log = here(`${name}-run${String(r.run).padStart(2, "0")}.log`);
    if (!existsSync(log)) {
      tally.missingLog += 1;
      continue;
    }
    const j = judge(r.exit, readFileSync(log, "utf8"));
    passes.push(j.passed);
    if (j.failed) tally.red += 1;
    else if (j.countOnly) tally.countOnly += 1;
    else tally.passedAlone += 1;
  }
  all += runs.length;
  console.log(`${name}: ${runs.length} runs | red ${tally.red} | count only, the chosen case(s) passed ${tally.countOnly} | exit 0 ${tally.passedAlone} | no log ${tally.missingLog} | cases passed per run: ${[...new Set(passes)].join(",")}`);
}
console.log(`${all} runs read`);
