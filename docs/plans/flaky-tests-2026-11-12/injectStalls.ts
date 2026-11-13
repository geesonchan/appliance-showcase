/**
 * "Injected stalls" (docs/plans/flaky-tests-plan.md, 1.6): the test's own thread held by
 * something that is not the test, as the busy machine held it on 2026-11-11 and
 * 2026-11-12 — every 250 ms, 200 ms of other work, from the moment this is imported.
 * Whatever the test calls "free" is then sometimes not.
 */
setInterval(() => {
  const until = Date.now() + 200;
  while (Date.now() < until) {
    // someone else's work
  }
}, 250);
