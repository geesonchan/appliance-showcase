import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The commit this build was made from, stamped into the page.
 *
 * A deploy that fails leaves the last good build on the link, and for a day
 * nobody could tell by looking: the site was a commit behind and said nothing
 * about it. Now the footer carries the short hash, so "is this live?" is a
 * question the page answers rather than one the Actions tab answers.
 *
 * The runner's own SHA where there is one, git where there is not, and `dev`
 * for a working tree with neither — a build should never fail for want of a
 * version stamp.
 */
const commit = (() => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();

// base "./" keeps asset URLs relative so the same build works on GitHub Pages
// project sites (/repo-name/) and at a domain root.
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: { __COMMIT__: JSON.stringify(commit) },
  build: {
    rollupOptions: {
      output: {
        /**
         * three.js gets its own chunk.
         *
         * It is most of the bundle and it changes when the dependency changes,
         * which is roughly never — while the app around it changes every round.
         * Splitting them means a visitor who has been here before downloads the
         * kilobytes that moved rather than the megabyte that did not, and the
         * browser can start parsing the renderer while the app is still coming
         * down the wire.
         *
         * React is split for the same reason and on the same schedule.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](three)[\\/]/.test(id)) return "three";
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
        },
      },
    },
    // The three chunk is legitimately large; the warning is for the app code,
    // which should stay well under this.
    chunkSizeWarningLimit: 800,
  },
});
