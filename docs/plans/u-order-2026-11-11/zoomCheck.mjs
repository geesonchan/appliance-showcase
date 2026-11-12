// Do the +/− buttons move the camera's angle? (Found reading CameraRig.tsx,
// 2026-11-11: the zoom step calls the fly-in tween without the camera's own
// angle, so it may swing to the L's default 45°/35°.) The mouse at 1440, the
// page in Chinese: package A's L at its default view and flown to the
// refrigerator, and package D's U at its default view; the angle and zoom read
// off the rendered camera before and after a click on 放大 (zoom in).
//   node docs/plans/u-order-2026-11-11/zoomCheck.mjs <build folder>
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build] = process.argv.slice(2);
// A page opened without a link may be in English: the button by either name.
const ZOOM_IN_EN = "Zoom in";
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const CASES = [
  { name: "A's L, default view", url: "/?lang=zh&quality=high", fly: null },
  { name: "A's L, flown to the refrigerator", url: "/?lang=zh&quality=high", fly: "slot-fridge" },
  { name: "A's L, flown to the dishwasher", url: "/?lang=zh&quality=high", fly: "slot-dishwasher" },
  { name: "D's U, default view", url: "/?v=2&pkg=D&shape=U&back=132&left=207&corner=blind&lang=zh&quality=high", fly: null },
];
for (const c of CASES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const hook = new EventTarget();
    window.__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const r = event.detail;
      if (!r.isWebGLRenderer || !r.render) return;
      const own = r.render.bind(r);
      r.render = (scene, camera) => {
        window.__view = { camera };
        own(scene, camera);
      };
    });
  });
  await page.goto(`${origin}${c.url}`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(3000);
  const click = async (locator) => {
    const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(2000);
  };
  const close = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await close.count()) await click(close);
  const view = () =>
    page.evaluate(() => {
      const cam = window.__view.camera;
      const e = cam.matrixWorld.elements;
      return `${Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI)}°/${Math.round((Math.asin(e[9]) * 180) / Math.PI)}° zoom ${Math.round(cam.zoom * 100) / 100}`;
    });
  if (c.fly) await click(page.locator(`[data-pin-label=${c.fly}]`));
  const before = await view();
  await click(page.locator(`button[aria-label="放大"], button[aria-label="${ZOOM_IN_EN}"]`));
  const after = await view();
  console.log(`${c.name}: before ${before} | after 放大 ${after}`);
  await context.close();
}
await browser.close();
