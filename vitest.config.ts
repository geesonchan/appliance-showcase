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
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
