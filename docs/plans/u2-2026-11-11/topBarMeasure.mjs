// U-2, A: where the shape buttons fit in the top bar. For each width and
// language: the header's height, which row the shapes are in, and the room the
// first row has left between the packages and the right-hand group — against
// the shapes' own width — so the second row's threshold is measured, not
// guessed. Served from the build folder by scripts/siteRoute.mjs.
//   node docs/plans/u2-2026-11-11/topBarMeasure.mjs <build folder>
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const build = process.argv[2];
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser({}, { origin, dir: resolve(build), onMiss: () => {} });
const WIDTHS = [360, 375, 390, 414, 430, 768, 820, 1024, 1280, 1440];
for (const width of WIDTHS) {
  for (const lang of ["en", "zh"]) {
    const phone = width < 768;
    const context = await browser.newContext({ viewport: { width, height: 844 }, ...(phone ? { hasTouch: true, isMobile: true } : {}) });
    const page = await context.newPage();
    await page.goto(`${origin}/?v=2&pkg=A&lang=${lang}&quality=low`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const header = document.querySelector("header");
      const rows = [...header.querySelectorAll("[data-shape-row]")].map((row) => ({
        row: row.getAttribute("data-shape-row"),
        shown: getComputedStyle(row).display !== "none",
        w: row.querySelector("[data-segment=shape]")?.getBoundingClientRect().width ?? 0,
      }));
      const first = header.firstElementChild;
      const [left, right] = [...first.children];
      const lastLeft = [...left.children].filter((c) => getComputedStyle(c).display !== "none").pop();
      const shapes = header.querySelector("[data-shape-row=second] [data-segment=shape]");
      const canvas = document.querySelector("canvas").getBoundingClientRect();
      return {
        header: header.getBoundingClientRect().height,
        rows,
        leftEnd: lastLeft.getBoundingClientRect().right,
        rightStart: right.getBoundingClientRect().left,
        shapesW: shapes ? shapes.getBoundingClientRect().width : rows.find((r) => r.shown)?.w,
        canvasTop: canvas.top,
        canvasH: canvas.height,
      };
    });
    const shownRow = m.rows.find((r) => r.shown)?.row;
    console.log(
      `${String(width).padStart(4)} ${lang}  header ${m.header}  shapes in ${shownRow} row  first-row room ${(m.rightStart - m.leftEnd).toFixed(0)} px` +
        `  shapes ${m.shapesW?.toFixed(0) ?? "?"} px  canvas top ${m.canvasTop} h ${m.canvasH}`,
    );
    await context.close();
  }
}
await browser.close();
