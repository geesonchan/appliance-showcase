import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The smoke suite drives a real browser against a real production build,
    // so it needs a server up first and far more than the default timeout.
    //
    // A test here opens a browser context, waits for a WebGL scene to settle
    // and then drives it: thirty to forty-five seconds each is normal, and a
    // sixty-second cap meant the suite passed or failed on how busy the
    // machine was rather than on whether the app works.
    globalSetup: ["tests/globalSetup.ts"],
    testTimeout: 150_000,
    // The setup hook warms a browser against a real build before any test
    // runs, which on a cold machine is a couple of minutes' worth of GPU
    // process and shader cache.
    hookTimeout: 240_000,
    // One file after another, not side by side (Leo, round 87). Eight files
    // now each start a browser on the GPU, and side by side they starve each
    // other: round 87's full run had 13 pages never load and ended 20 red,
    // where the same suite one file after another passed every test.
    // docs/decisions.md, Open items, "A browser test that times out".
    fileParallelism: false,
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
