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
 *
 * Two options (round 99a, Leo: the shop uses a 1440 desktop with the Layout
 * tab open): VIEW=desktop opens a 1440 x 900 page and uses the mouse where a
 * phone uses a finger, and TAB=layout opens the Layout tab before 中 and B, so
 * what that tab works out at a package switch is in the frames counted.
 *
 *   VIEW=desktop TAB=layout node scripts/qualityDrop.mjs <old url> <new url>
 *
 * Two more (round 100, Leo's proof of the guard's two seconds after a rebuild):
 *
 * - THROTTLE=<n> slows the page's CPU n times over (Chrome's
 *   `Emulation.setCPUThrottlingRate`), from the moment the scene is on screen,
 *   so a machine that draws at sixty here can stand in for one that sits near
 *   55. Whether the page had already dropped before the first tap is reported
 *   on its own ("before"): that is the room being too heavy at rest, not a
 *   switch misjudged.
 * - ROUTE= what is tapped — not PATH, which is the shell's (desktop names;
 *   only `b` taps 中 first):
 *   `b` (the default) 中 then B; `packages` B, C, D, E three seconds apart;
 *   `shape` the Layout tab, one wall, back to the L four seconds later;
 *   `modes` White model, Install, Materials three seconds apart; `e-onewall`
 *   the Layout tab, one wall, then E — the Layout tab's figures for E's one
 *   wall are the longest task it works out (round 99a). Every path ends in the
 *   Materials mode, where the textures it reads are on screen.
 *
 *   THROTTLE=4 ROUTE=e-onewall VIEW=desktop node scripts/qualityDrop.mjs <old url> <new url>
 */
import { chromium } from "playwright";

const bases = process.argv.slice(2);
if (bases.length === 0 || bases.length > 2) {
  console.error("usage: node scripts/qualityDrop.mjs <url> [<second url>]");
  process.exit(2);
}
const runs = Number(process.env.RUNS ?? 10);
const PHONE = { viewport: { width: 360, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const desktop = process.env.VIEW === "desktop";
const layoutTab = process.env.TAB === "layout";
const throttle = Number(process.env.THROTTLE ?? 1);
const path = process.env.ROUTE ?? "b";
const PATHS = ["b", "packages", "shape", "modes", "e-onewall"];
if (!PATHS.includes(path)) {
  console.error(`ROUTE is one of ${PATHS.join(", ")}`);
  process.exit(2);
}
if (layoutTab && !desktop) {
  console.error("TAB=layout opens the desktop's Layout tab: use it with VIEW=desktop");
  process.exit(2);
}
if (path !== "b" && !desktop) {
  console.error(`ROUTE=${path} uses the desktop's controls: use it with VIEW=desktop`);
  process.exit(2);
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });

/** The widest texture on screen: 512 at the high tier, 256 at the low. */
const widestMap = (page) =>
  page.evaluate(() => {
    let widest = 0;
    window.__view?.scene.traverse((object) => {
      const material = object.material;
      for (const each of Array.isArray(material) ? material : material ? [material] : []) {
        widest = Math.max(widest, each.map?.image?.width ?? 0);
      }
    });
    return widest;
  });

async function once(base) {
  const context = await browser.newContext(desktop ? DESKTOP : PHONE);
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
  if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  const atRest = await page.evaluate(() => window.__fps.length);
  await page.waitForTimeout(2500);
  // By touch, as a phone is used, and by the mouse on a desktop (D17).
  const press = async (role, name) => {
    const box = await page.getByRole(role, { name, exact: true }).filter({ visible: true }).first().boundingBox();
    if (desktop) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    else await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  };
  const tap = (name) => press("button", name);
  if (layoutTab || path === "shape" || path === "e-onewall") {
    await press("tab", "Layout");
    await page.waitForTimeout(1500);
  }
  if (path === "b") {
    await tap("中");
    await page.waitForTimeout(800);
  }
  if (path === "e-onewall") {
    await tap("Single-wall kitchen");
    await page.waitForTimeout(4000);
  }
  const lowBefore = (await widestMap(page)) < 512;
  const before = await page.evaluate(() => window.__fps.length);
  const marks = [];
  const mark = async () => marks.push((await page.evaluate(() => window.__fps.length)) - before);
  const steps = {
    b: [["B", 6000]],
    packages: [["B", 3000], ["C", 3000], ["D", 3000], ["E", 6000]],
    shape: [["Single-wall kitchen", 4000], ["L-shaped kitchen", 6000]],
    modes: [["White model", 3000], ["Install", 3000], ["Materials", 6000]],
    "e-onewall": [["E", 6000]],
  }[path];
  for (const [name, wait] of steps) {
    await mark();
    await tap(name);
    await page.waitForTimeout(wait);
  }
  const low = (await widestMap(page)) < 512;
  const { fps, rest } = await page.evaluate(
    ([from, restFrom]) => ({ fps: window.__fps.slice(from), rest: window.__fps.slice(restFrom, from) }),
    [before, atRest],
  );
  const bundle = await page.evaluate(() => document.querySelector('script[src*="assets/index-"]')?.getAttribute("src"));
  await context.close();
  return { low, lowBefore, fps, rest, marks, bundle };
}

const rows = bases.map(() => ({ drops: 0, before: 0, lines: [], bundle: "" }));
for (let n = 0; n < runs; n += 1) {
  // Alternate which goes first, so neither always has the warmer machine.
  const order = n % 2 === 0 ? bases.map((_, i) => i) : bases.map((_, i) => i).reverse();
  for (const i of order) {
    const r = await once(bases[i]);
    rows[i].bundle = r.bundle;
    rows[i].before += r.lowBefore ? 1 : 0;
    rows[i].drops += r.low && !r.lowBefore ? 1 : 0;
    // A tap's second is marked with a bar before it.
    const seconds = r.fps.map((fps, at) => (r.marks.includes(at) ? `| ${fps}` : `${fps}`)).join(" ");
    const state = r.lowBefore ? "BEFORE" : r.low ? "LOW   " : "high  ";
    rows[i].lines.push(`${state} at rest: ${r.rest.join(" ")}  after: ${seconds}`);
  }
}
await browser.close();

console.log(`path ${path}, ${desktop ? "desktop 1440" : "phone 360"}${layoutTab ? ", Layout tab" : ""}, CPU throttle ${throttle}x`);
for (const [i, row] of rows.entries()) {
  console.log(
    `\n${bases[i]} (${row.bundle}): dropped to low after the first tap in ${row.drops} of ${runs}; already low before it in ${row.before}`,
  );
  for (const line of row.lines) console.log(`  ${line}`);
}
