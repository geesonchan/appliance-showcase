// The states this round means to change (Leo, 2026-11-12: 「像素证明里把换型号后的状态列为
// 有意要变的」), shot on the old build and the new for the pixel report: the mouse
// at 1440, the page in English, the card left open. In each: flown to a
// machine, then either another model picked on the card (the camera pulled back,
// D1's fifth reason) or the zoom-in button pressed (the angle kept); the camera's
// angle and zoom read off the camera the page renders with.
//   node docs/plans/u-order-2026-11-11/intendedShots.mjs <build folder> <out folder> <tag>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, out, tag] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const CASES = [
  { name: "A-L-dishwasher-swap", query: "/?lang=en&quality=high&qualityLock=1", fly: "slot-dishwasher", act: "swap" },
  { name: "A-L-dishwasher-zoom", query: "/?lang=en&quality=high&qualityLock=1", fly: "slot-dishwasher", act: "zoom" },
  { name: "E-one-wall-fridge-swap", query: "/?v=2&pkg=E&shape=one-wall&lang=en&quality=high&qualityLock=1", fly: "slot-fridge", act: "swap" },
  { name: "E-one-wall-fridge-zoom", query: "/?v=2&pkg=E&shape=one-wall&lang=en&quality=high&qualityLock=1", fly: "slot-fridge", act: "zoom" },
  { name: "D-U-hood-swap", query: "/?v=2&pkg=D&shape=U&back=132&corner=blind&lang=en&quality=high&qualityLock=1", fly: "slot-hood", act: "swap" },
  { name: "D-U-default-zoom", query: "/?v=2&pkg=D&shape=U&back=132&corner=blind&lang=en&quality=high&qualityLock=1", fly: null, act: "zoom" },
];
const lines = [];
for (const c of CASES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const hook = new EventTarget();
    window.__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const r = event.detail;
      if (!r.isWebGLRenderer || !r.render) return;
      const own = r.render.bind(r);
      r.render = (scene, camera) => {
        window.__camera = camera;
        own(scene, camera);
      };
    });
  });
  await page.goto(`${origin}${c.query}`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(3000);
  const click = async (locator, wait = 2200) => {
    const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(wait);
  };
  const close = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await close.count()) await click(close, 800);
  const pose = () =>
    page.evaluate(() => {
      const cam = window.__camera;
      const e = cam.matrixWorld.elements;
      return `${Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI)}°/${Math.round((Math.asin(e[9]) * 180) / Math.PI)}° zoom ${Math.round(cam.zoom * 10) / 10}`;
    });
  if (c.fly) await click(page.locator(`[data-pin-label="${c.fly}"]`));
  const before = await pose();
  if (c.act === "swap") await click(page.locator("[data-model-card] [data-candidate][aria-pressed=false]"), 2800);
  else await click(page.locator('button[aria-label="Zoom in"]'), 1400);
  const after = await pose();
  const file = `${tag}-${c.name}.png`;
  await page.screenshot({ path: resolve(out, file) });
  lines.push({ tag, name: c.name, before, after, file, errors: errors.join(" | ") });
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, `${tag}.json`), JSON.stringify(lines, null, 1));
for (const l of lines) console.log(`${l.tag} ${l.name} | before ${l.before} | after ${l.after} | ${l.errors || "no errors"}`);
