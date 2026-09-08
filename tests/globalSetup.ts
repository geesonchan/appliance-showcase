import { spawn, type ChildProcess } from "node:child_process";

/** Kept off 4173 so a preview server you already have open is left alone. */
export const PREVIEW_PORT = 4174;
export const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

async function waitForServer(url: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not come up at ${url} within ${timeoutMs}ms`);
}

/**
 * Fetch the page and everything it pulls, once, before any test runs.
 *
 * The first navigation otherwise pays for the server's first serve of a
 * megabyte and a half of JavaScript, and Playwright's `networkidle` gives it
 * thirty seconds to go quiet. On a busy machine that is not always enough, and
 * the suite fails on whichever test happened to be first rather than on
 * anything about the app.
 */
async function warm(url: string) {
  const html = await (await fetch(url)).text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => href.startsWith("/") || href.startsWith("./"));
  await Promise.all(
    assets.map((href) => fetch(new URL(href, url)).then((r) => r.arrayBuffer()).catch(() => {})),
  );
}

/**
 * Serves the production build for the smoke suite.
 *
 * Run `npm run build` first, or use `npm test`, which does it for you. Testing
 * the built output rather than the dev server is deliberate: the bugs worth
 * catching here (shader variants, dependency pre-bundling) only show up in one
 * of the two.
 */
export default async function setup() {
  let server: ChildProcess | undefined;

  server = spawn(
    "npx",
    ["vite", "preview", "--port", String(PREVIEW_PORT), "--strictPort"],
    { stdio: "ignore", shell: true },
  );

  await waitForServer(PREVIEW_URL);
  await warm(PREVIEW_URL);

  return async () => {
    server?.kill();
  };
}
