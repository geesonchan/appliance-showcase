/**
 * How often a build drops to the low quality tier on a phone, and the frame
 * rate each second around the moment it might. Round 98b (Leo: "把帧率测试存成
 * 仓库里的脚本，以后每轮都能跑").
 *
 *   npm run build && npm run preview -- --port 4173     (in another terminal)
 *   node scripts/qualityDrop.mjs http://localhost:4173/
 *   node scripts/qualityDrop.mjs http://localhost:4311/ http://localhost:4312/
 *
 * One address: that build. Two: the old build and the new one, alternated run
 * by run so whatever state the machine is in falls on both alike (D17: compare
 * runs in the same state). RUNS sets how many per build, 10 by default.
 *
 * Each run opens a 360-wide phone page at `?quality=high`, taps 中, then B —
 * the path on which round 98b's pixel proof first saw a build at the low tier
 * — and reads, six seconds later, whether the scene's textures are still the
 * high tier's 512 pixels. `QualityGuard` drops a page to low after two seconds
 * in a row under 55 fps, and never goes back up until the page is loaded
 * again; the seconds just after a package switch sit close to that line on a
 * busy machine, so a drop now and then is the guard working, and what this
 * reports is whether one build drops more often than another. It found, in
 * round 98b, 1 in 10 on each of `c94a898` and 98b-1.
 */
import { chromium } from "playwright";

const bases = process.argv.slice(2);
if (bases.length === 0 || bases.length > 2) {
  console.error("usage: node scripts/qualityDrop.mjs <url> [<second url>]");
  process.exit(2);
}
const runs = Number(process.env.RUNS ?? 10);
const PHONE = { viewport: { width: 360, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });

async function once(base) {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.addInitScript(() => {
    // The renderer three.js announces to its devtools, to read the scene.
    const hook = new EventTarget();
    window.__THREE_DEVTOOLS__ = hook;
    hook.addEventListener("observe", (event) => {
      const r = event.detail;
      if (!r.isWebGLRenderer || !r.render) return;
      const own = r.render.bind(r);
      r.render = (scene, camera) => {
        window.__view = { scene, camera };
        own(scene, camera);
      };
    });
    // Frames per second, each second, from the page's own frame loop.
    window.__fps = [];
    let frames = 0;
    let start = performance.now();
    const tick = (now) => {
      frames += 1;
      if (now - start >= 1000) {
        window.__fps.push(Math.round((frames * 1000) / (now - start)));
        frames = 0;
        start = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const sep = base.includes("?") ? "&" : "?";
  await page.goto(`${base}${sep}quality=high`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("canvas", { timeout: 60000 });
  await page.waitForTimeout(2500);
  // By touch, as a phone is used (D17).
  const tap = async (name) => {
    const box = await page.getByRole("button", { name, exact: true }).filter({ visible: true }).first().boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  };
  await tap("中");
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => window.__fps.length);
  await tap("B");
  await page.waitForTimeout(6000);
  const result = await page.evaluate((from) => {
    let widest = 0;
    window.__view?.scene.traverse((object) => {
      const material = object.material;
      for (const each of Array.isArray(material) ? material : material ? [material] : []) {
        widest = Math.max(widest, each.map?.image?.width ?? 0);
      }
    });
    return { low: widest < 512, fps: window.__fps.slice(from) };
  }, before);
  const bundle = await page.evaluate(() => document.querySelector('script[src*="assets/index-"]')?.getAttribute("src"));
  await context.close();
  return { ...result, bundle };
}

const rows = bases.map(() => ({ drops: 0, lines: [], bundle: "" }));
for (let n = 0; n < runs; n += 1) {
  // Alternate which goes first, so neither always has the warmer machine.
  const order = n % 2 === 0 ? bases.map((_, i) => i) : bases.map((_, i) => i).reverse();
  for (const i of order) {
    const r = await once(bases[i]);
    rows[i].bundle = r.bundle;
    rows[i].drops += r.low ? 1 : 0;
    rows[i].lines.push(`${r.low ? "LOW " : "high"} fps after B: ${r.fps.join(" ")}`);
  }
}
await browser.close();

for (const [i, row] of rows.entries()) {
  console.log(`\n${bases[i]} (${row.bundle}): dropped to low in ${row.drops} of ${runs}`);
  for (const line of row.lines) console.log(`  ${line}`);
}
