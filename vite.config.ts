import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset URLs relative so the same build works on GitHub Pages
// project sites (/repo-name/) and at a domain root.
export default defineConfig({
  base: "./",
  plugins: [react()],
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
