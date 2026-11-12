// The camera after another model is picked on the card (Leo, 2026-11-11: 「每一个家电选择
// 另外一个选项替换之后，可以再重新放远」): D's U, the mouse at 1440, the page in Chinese. For each
// machine: flown to by its pin label, then the first other model on its card
// clicked; a screenshot after each, and the camera's angle and zoom read off
// the camera the page renders with.
//   node docs/plans/u-order-2026-11-11/swapShots.mjs <build folder> <out folder> <tag> [extra query]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, out, tag, extra] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const lines = [];
for (const slot of ["slot-dishwasher", "slot-hood", "slot-fridge"]) {
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
        window.__view = { camera };
        own(scene, camera);
      };
    });
  });
  await page.goto(`${origin}/?v=2&pkg=D&shape=U&back=132&left=177&corner=blind&lang=zh&quality=high&qualityLock=1${extra ? `&${extra}` : ""}`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(3000);
  const click = async (locator) => {
    const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(2200);
  };
  const close = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await close.count()) await click(close);
  const view = () =>
    page.evaluate(() => {
      const c = window.__view?.camera;
      if (!c) return null;
      const e = c.matrixWorld.elements;
      return {
        azimuth: Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI),
        pitch: Math.round((Math.asin(e[9]) * 180) / Math.PI),
        zoom: Math.round(c.zoom * 100) / 100,
      };
    });
  const shot = async (step) => {
    const file = `${tag}-${slot}-${step}.png`;
    await page.screenshot({ path: resolve(out, file) });
    lines.push({ tag, slot, step, file, view: await view(), card: await page.locator("[data-card-model]").filter({ visible: true }).first().innerText().catch(() => null), errors: errors.splice(0).join(" | ") });
  };
  await shot("0-default");
  await click(page.locator(`[data-pin-label=${slot}]`));
  await shot("1-flown");
  await click(page.locator("[data-card-scroll] button[aria-pressed=false]"));
  await shot("2-swapped");
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, `${tag}.json`), JSON.stringify(lines, null, 1));
for (const l of lines)
  console.log(`${l.tag} ${l.slot} ${l.step} | ${l.view ? `${l.view.azimuth}°/${l.view.pitch}° zoom ${l.view.zoom}` : "?"} | ${(l.card ?? "-").replace(/\s+/g, " ")} | ${l.errors || "no errors"}`);
