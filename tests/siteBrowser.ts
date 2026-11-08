import { fileURLToPath } from "node:url";
import type { Browser, LaunchOptions } from "playwright";
import { launchSiteBrowser, missWriter } from "../scripts/siteRoute.mjs";
import { PREVIEW_URL, ROUTE_MISSES } from "./globalSetup";

/**
 * The browser the suite's tests launch: 丁, the build's files answered by
 * Playwright, never through a connection on this machine
 * (docs/plans/route-wiring-plan.md; Leo, 2026-11-07). Bound here to the
 * suite's address and to `dist/`, so a test changes only the line that
 * launches its browser. A path with no file, answered with the page, is
 * written to ROUTE_MISSES; `tests/globalSetup.ts` reads it at the end.
 */
export const DIST = fileURLToPath(new URL("../dist", import.meta.url));

export function launchBrowser(options?: LaunchOptions): Promise<Browser> {
  return launchSiteBrowser(options, { origin: PREVIEW_URL, dir: DIST, onMiss: missWriter(ROUTE_MISSES) });
}
