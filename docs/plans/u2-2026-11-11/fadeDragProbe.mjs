// U-2: why fadeRebuild's phone cases find nothing faded (the full suite, 2026-11-11).
// As the test does on a phone: the hood's pin tapped, Configure opened, then the
// finger dragged across the 3D view at a quarter of its height, 40px at a time,
// reading what the fade hides after each drag; and what is under that point.
//   node docs/plans/u2-2026-11-11/fadeDragProbe.mjs <build folder>
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] }, { origin, dir: resolve(process.argv[2]), onMiss: () => {} });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(`${origin}/?debug=1&quality=high`);
await page.waitForSelector("canvas", { timeout: 60_000 });
await page.waitForTimeout(2500);
const tap = async (loc) => { const b = await loc.first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
await tap(page.locator('[data-pin-label="slot-hood"]'));
await page.waitForTimeout(2500);
await tap(page.getByRole("button", { name: "Configure", exact: true }));
await page.waitForTimeout(1500);
const canvas = await page.locator("canvas").boundingBox();
const x0 = canvas.x + canvas.width / 2, y0 = canvas.y + canvas.height * 0.25;
const under = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return `${e?.tagName} ${e?.className?.toString().slice(0, 60)}`; }, [x0, y0]);
console.log("canvas", JSON.stringify(canvas), "drag at", x0, y0, "under:", under);
const cdp = await context.newCDPSession(page);
for (let i = 0; i < 14; i += 1) {
  const at = (x) => [{ x, y: y0, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(x0) });
  for (let k = 1; k <= 10; k += 1) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(x0 + 4 * k) }); await page.waitForTimeout(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
  const f = await page.evaluate(() => window.__faded ?? []);
  console.log("drag", i + 1, "faded", f.length);
  if (f.length) break;
}
await page.screenshot({ path: process.argv[3] ?? "fade-probe.png" });
await browser.close();
