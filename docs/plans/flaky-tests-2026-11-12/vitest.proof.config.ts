import { defineConfig } from "vitest/config";

/**
 * The flaky tests' proof only (docs/plans/flaky-tests-plan.md, 1.6 and Leo's 6.4): the
 * files in proof/, which no suite of the site's runs. One file a run, by name.
 */
export default defineConfig({
  test: {
    include: ["docs/plans/flaky-tests-2026-11-12/proof/*.test.ts"],
  },
});
