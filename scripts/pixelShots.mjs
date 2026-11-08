/**
 * The pixel proof's shots (D17): round 98a's 45 states — five packages on a
 * 1440 desktop in the three modes and flown to two machines, round 97's links
 * with and without the island, and each package on a 390 phone in English and
 * a 360 phone in Chinese — each shot whole, then the 3D canvas alone with
 * everything over it hidden, every visible text with its box and every pin's
 * leader line recorded. Real input only: the mouse on a desktop, a finger on a
 * phone. Shoot the old build and the new twice each, alternated, and compare
 * with `scripts/pixelCompare.mjs`.
 *
 *   node scripts/pixelShots.mjs <build folder> <out folder>
 *
 * The build is answered by 丁 (`scripts/siteRoute.mjs`; the wiring, Leo,
 * 2026-11-07: 「第 7 节五条都同意」): every request of the page's address is
 * answered from the build folder by Playwright, never through a connection
 * on this machine, so no server is started; a path with no file, answered
 * with the page, is written to `<out folder>/route-misses.jsonl`. Until then
 * the build was served by `scripts/previewServer.mjs`, recorded (the
 * server-reset round, 2026-11-06), and before that by a `vite preview`
 * started by hand; the local server's 10 s waits and resets
 * (docs/decisions.md, "A browser test that times out…") were why. PORT sets
 * the address's port (4177); nothing listens there.
 *
 * QUALITY=low shoots the low tier (high by default). The page is opened with
 * `?qualityLock=1` (round 100, Leo): the guard never drops it mid-shot, which
 * round 99b found in up to 22 of 45 states; LOCK=0 leaves it off, for a build
 * that has no lock. ONLY=<name,name> shoots just those states. Moved here from
 * the rounds' scratch folders in round 100.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openWatched } from "./pageWatch.mjs";
import { launchSiteBrowser, missWriter } from "./siteRoute.mjs";

const [build, out] = process.argv.slice(2);
if (!build || !out) throw new Error("node scripts/pixelShots.mjs <build folder> <out folder>");
if (/^https?:/.test(build)) throw new Error("pixelShots takes the build's folder and serves it itself, recorded (scripts/previewServer.mjs), not an address");
mkdirSync(out, { recursive: true });
const origin = `http://localhost:${Number(process.env.PORT ?? 4177)}`;
const base = `${origin}/`;
const QUALITY = process.env.QUALITY ?? "high";
const LOCK = process.env.LOCK !== "0";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const FIX = JSON.parse(readFileSync(new URL("./pixelLinks.json", import.meta.url), "utf8"));

const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: missWriter(resolve(out, "route-misses.jsonl")) },
);
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = (width) => ({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });

async function open(options, query = "") {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.addInitScript(() => {
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
  });
  const sep = query ? "&" : "?";
  await openWatched(page, `${base}${query}${sep}quality=${QUALITY}${LOCK ? "&qualityLock=1" : ""}`, { gotoTimeout: 90000, canvasTimeout: 60000, label: "pixelShots" });
  await page.waitForTimeout(2500);
  return { context, page };
}

async function settle(page) {
  const pose = () =>
    page.evaluate(() => {
      const v = window.__view;
      return v ? [...v.camera.matrixWorld.elements, v.camera.zoom].map((n) => n.toFixed(4)).join(",") : "";
    });
  let last = "";
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const now = await pose();
    if (now && now === last) break;
    last = now;
  }
  // A message on screen fades on its own: wait it out (D17, round 53).
  await page.waitForFunction(() => !document.querySelector("[data-toast]"), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const button = (page, name) => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function click(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function tap(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

const shots = [];
async function shoot(page, name) {
  if (ONLY && !ONLY.includes(name)) return;
  await settle(page);
  await page.screenshot({ path: `${out}/${name}.png` });
  const texts = await page.evaluate(() => {
    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim();
      if (!t) continue;
      const el = n.parentElement;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;
      const holder = el.closest("button, li, p, h1, h2, h3, label, a, [role=status]") ?? el;
      const b = holder.getBoundingClientRect();
      found.push({ t, rects: rects.map((r) => [r.x, r.y, r.width, r.height].map(Math.round)), box: [b.x, b.y, b.width, b.height].map(Math.round) });
    }
    // The pins' leader lines, in page coordinates: a pin that moves takes its line with it.
    const leaders = [];
    for (const line of document.querySelectorAll("svg[aria-hidden=true] line")) {
      const box = line.ownerSVGElement.getBoundingClientRect();
      const at = (k) => Number(line.getAttribute(k) ?? 0);
      if (getComputedStyle(line).display === "none" || getComputedStyle(line).visibility === "hidden") continue;
      leaders.push([box.x + at("x1"), box.y + at("y1"), box.x + at("x2"), box.y + at("y2")].map((n) => Math.round(n * 10) / 10));
    }
    return { found, leaders };
  });
  writeFileSync(`${out}/${name}.texts.json`, JSON.stringify(texts));
  const veil = await page.addStyleTag({ content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.canvas.png` });
  await veil.evaluate((tag) => tag.remove());
  await page.waitForTimeout(300);
  const bundle = await page.evaluate(() => document.querySelector('script[src*="assets/index-"]')?.getAttribute("src"));
  shots.push({ name, bundle });
}

const PKGS = ["A", "B", "C", "D", "E"];

// The desktop, by mouse: each package as it opens in the three modes, and two
// machines flown to from the list rail.
for (const p of PKGS) {
  if (ONLY && !ONLY.some((n) => n.startsWith(`desk-${p}-`))) continue;
  const { context, page } = await open(DESKTOP);
  if (p !== "A") {
    await click(page, button(page, p));
  }
  await shoot(page, `desk-${p}-materials`);
  await click(page, button(page, "White model"));
  await shoot(page, `desk-${p}-white`);
  await click(page, button(page, "Install"));
  await shoot(page, `desk-${p}-install`);
  await click(page, button(page, "Materials"));
  await settle(page);
  for (const machine of ["Refrigerator", "Dishwasher"]) {
    await click(page, page.locator('button[data-rail="left"]').first());
    await page.waitForTimeout(700);
    await click(page, page.locator('[data-panel="list"] ul li button', { hasText: machine }).first());
    await page.waitForTimeout(700);
    await click(page, page.locator('button[data-rail="left"]').first());
    await shoot(page, `desk-${p}-fly-${machine.toLowerCase()}`);
    await click(page, button(page, "Reset view"));
    await settle(page);
  }
  await context.close();
}

// Round 97's own links, which both builds read: a kitchen far from each
// package's own, and the same with no island.
for (const [code, link] of Object.entries(FIX)) {
  for (const [suffix, q] of [["", link], ["-noisland", link.replace(/([?&])island=[^&]*/, "$1island=none")]]) {
    if (ONLY && !ONLY.includes(`link-${code}${suffix}`)) continue;
    const { context, page } = await open(DESKTOP, q);
    await shoot(page, `link-${code}${suffix}`);
    await context.close();
  }
}

// A phone, by touch: each package as it opens, in English at 390 and Chinese at 360.
for (const [width, zh] of [[390, false], [360, true]]) {
  for (const p of PKGS) {
    if (ONLY && !ONLY.includes(`phone${width}${zh ? "-zh" : ""}-${p}`)) continue;
    const { context, page } = await open(PHONE(width));
    if (zh) {
      await tap(page, button(page, "中"));
      await page.waitForTimeout(800);
    }
    if (p !== "A") await tap(page, button(page, p));
    await shoot(page, `phone${width}${zh ? "-zh" : ""}-${p}`);
    await context.close();
  }
}

await browser.close();
writeFileSync(`${out}/shots.json`, JSON.stringify(shots, null, 1));
console.log(`${shots.length} shots, bundles: ${[...new Set(shots.map((s) => s.bundle))].join(" ")}`);
