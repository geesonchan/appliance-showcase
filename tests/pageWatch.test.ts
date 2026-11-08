import { existsSync, readFileSync, rmSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { canvasWatched, gotoWatched, openWatched, watchOf } from "../scripts/pageWatch.mjs";
import { PREVIEW_URL } from "./globalSetup";
import { realServerContext } from "../scripts/siteRoute.mjs";

/**
 * The shared watch on a page that does not draw (Leo, 2026-11-05: 「选丙，共用
 * 记录工具……只加记录、不改网页」; docs/plans/blank-canvas-plan.md).
 *
 * A page with no canvas: the wait fails as it always failed, and the record
 * of what the page was doing is written beside it — its state, its console
 * and errors, the WebGL contexts, the GPU, a screenshot. The real page that
 * draws: nothing is written, and the watch has when its canvas came.
 */

const EXPECTED_TESTS = 2;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} page-watch tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
});
afterAll(async () => {
  await browser?.close();
});

describe("the shared watch on a page (scripts/pageWatch.mjs)", () => {
  it("writes what a page that never draws was doing, and fails as it did", async () => {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    // A page that logs an error, makes a 2D context and never a canvas in
    // the document — what the record must catch.
    const html = `<!doctype html><title>no canvas</title><p>nothing to draw</p><script>
      console.error("the scene would have started here");
      document.createElement("canvas").getContext("2d");
    </script>`;
    await gotoWatched(page, `data:text/html,${encodeURIComponent(html)}`, { waitUntil: "load", label: "pageWatch no canvas" });
    const failure = await canvasWatched(page, { timeout: 1500, label: "pageWatch no canvas" }).then(
      () => null,
      (error: Error) => error.message,
    );
    const where = failure?.match(/blank-canvas record: (.+\.json)/)?.[1] ?? null;
    const record = where && existsSync(where) ? JSON.parse(readFileSync(where, "utf8")) : null;
    expect({
      failedAsBefore: !!failure && /Timeout 1500ms exceeded/.test(failure),
      recorded: !!record,
      step: record?.step,
      readyState: record?.page?.readyState,
      canvases: record?.page?.canvases,
      canvasAt: record?.page?.watch?.canvasAt,
      contexts: record?.page?.watch?.contexts?.map((c: { type: string; made: boolean }) => [c.type, c.made]),
      console: record?.console?.some((line: { type: string; text: string }) => line.type === "error" && /scene would have started/.test(line.text)),
      text: record?.page?.text,
      gpu: Array.isArray(record?.gpu?.devices),
      screenshot: !!record?.screenshot && existsSync(record.screenshot),
    }).toEqual({
      failedAsBefore: true,
      recorded: true,
      step: "canvas",
      readyState: "complete",
      canvases: [],
      canvasAt: null,
      contexts: [["2d", true]],
      console: true,
      text: "nothing to draw",
      gpu: true,
      screenshot: true,
    });
    if (where) {
      rmSync(where, { force: true });
      rmSync(where.replace(/\.json$/, ".png"), { force: true });
    }
    await page.context().close();
  });

  it("writes nothing for the page that draws, and keeps when its canvas came", async () => {
    // On the real local server, not 丁 (docs/plans/route-wiring-plan.md, section 3), marked for the server's record: may meet the 10 s wait now and then.
    const page = await (await realServerContext(browser, { viewport: { width: 1440, height: 900 } })).newPage();
    await openWatched(page, `${PREVIEW_URL}?quality=high`, { label: "pageWatch draws" });
    const log = await page.evaluate(() => (window as unknown as { __pageWatch?: { canvasAt: number | null; canvasSizedAt: number | null; contexts: { type: string; made: boolean }[]; webgl: unknown[] } }).__pageWatch);
    expect({
      canvasCame: typeof log?.canvasAt === "number" && typeof log?.canvasSizedAt === "number",
      webglMade: log?.contexts.some((context) => /webgl/.test(context.type) && context.made),
      lost: log?.webgl,
      pageErrors: watchOf(page)?.pageErrors,
      failedRequests: watchOf(page)?.failedRequests,
    }).toEqual({ canvasCame: true, webglMade: true, lost: [], pageErrors: [], failedRequests: [] });
    await page.context().close();
  });
});
