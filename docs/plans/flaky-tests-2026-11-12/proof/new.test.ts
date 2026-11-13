/**
 * The main-thread watch's tests as they are now, run with stalls injected: meant to stay
 * green (docs/plans/flaky-tests-plan.md, 1.6). Run with `-t "main-thread watch"`.
 */
import "../injectStalls";
import "../../../../scripts/previewServer.test";
