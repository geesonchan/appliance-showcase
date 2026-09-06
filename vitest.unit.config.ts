import { defineConfig } from "vitest/config";

/**
 * Unit tests only: schema validation and the data invariants. No browser and
 * no build, so this runs in a couple of seconds. The full suite lives in
 * `vitest.config.ts`.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
