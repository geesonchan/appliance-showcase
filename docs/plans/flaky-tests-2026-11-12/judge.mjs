/**
 * How one vitest run is judged, from its exit code and its printed log (one rule for
 * repeat.mjs, which runs, and rejudge.mjs, which reads the logs again):
 * - red: a case failed (a "×" line), or the run failed for anything else;
 * - "the file's own count only": the run failed only because a file that counts its own
 *   cases (fadeRebuild's "N of 24 … actually ran") was run filtered with -t, and **the
 *   chosen case passed** — at least one case passed, none failed (Leo, 2026-11-12: 「加一个
 *   条件，选中的那条必须有通过记录（0 条通过要算红）」);
 * - passed: exit 0.
 */
export function judge(exit, text) {
  const crossed = text.split(/\n/).filter((l) => /^\s+×\s/.test(l)).map((l) => l.trim());
  const passed = Number(/Tests\s+(\d+) passed/.exec(text)?.[1] ?? 0);
  const countOnly = exit !== 0 && crossed.length === 0 && /tests actually ran/.test(text) && passed >= 1;
  const failed = exit !== 0 && !countOnly;
  const firstError = text.match(/(AssertionError|TimeoutError|Error): [^\n]*/)?.[0] ?? "exit " + exit;
  const why = failed ? [...crossed, firstError].join(" | ") : countOnly ? "the file's own count only (a filtered run)" : null;
  return { failed, countOnly, passed, why };
}
