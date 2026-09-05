import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset URLs relative so the same build works on GitHub Pages
// project sites (/repo-name/) and at a domain root.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
