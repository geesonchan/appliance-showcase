// The prototype's on-page view switch (Leo, 2026-11-12: 「链接没能正确固定角度，然后就变回默认的
// 角度了」), by the real mouse at 1440, the page in Chinese: opened by a link with no angle
// (the prototype's default), each candidate's button pressed, the angle read off the
// camera the page renders with; then a link with no angle opened again (the last pick
// kept); a package switched by its top-bar button; the board button (the page reloads).
//   node docs/plans/u-view-2026-11-12/switchCheck.mjs <build folder> <out folder>
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const pose = () =>
  page.evaluate(() => {
    const e = window.__cam.matrixWorld.elements;
    return `${Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI)}°/${Math.round((Math.asin(e[9]) * 180) / Math.PI)}°`;
  });
const click = async (locator, wait = 2200) => {
  const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(wait);
};
const open = async (q) => {
  await page.goto(origin + q);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(3500);
};
const step = async (name) => {
  const p = await pose();
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  console.log(`${name} | ${p} | ${new URL(page.url()).search} | ${errors.splice(0).join(" | ") || "no errors"}`);
};
await open("/?v=2&pkg=E&shape=U&back=132&left=147&corner=blind&lang=zh");
await step("1-opened-no-angle");
for (const label of ["正前方·往下50°", "正前方·往下55°", "正前方·往下60°", "现在：往左45°·往下25°", "正前方·往下55°"]) {
  await click(page.locator("[data-proto-switch] button", { hasText: label }));
  await step(`2-${label}`);
}
await open("/?v=2&pkg=B&shape=U&lang=zh");
await step("3-link-with-no-angle-again");
await click(page.locator("[data-segment=package] button[data-value=package-d]"), 3000);
await step("4-package-D");
await click(page.locator("[data-proto-switch] button", { hasText: "背板" }), 5000);
await step("5-board-off");
await browser.close();
