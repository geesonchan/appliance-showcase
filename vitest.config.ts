import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The smoke suite drives a real browser against a real production build,
    // so it needs a server up first and far more than the default timeout.
    globalSetup: ["tests/globalSetup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
