/**
 * What the renderer holds after each of fifty model swaps in a row: three.js's
 * own count of geometries and textures (`renderer.info.memory`), and the page's
 * JavaScript heap where Chrome reports it. Round 100, Leo: measured only, to
 * see whether they keep climbing; a leak found is a round of its own. Round
 * 99's reading found a vented cabinet's box geometry made again on every swap
 * and the old one not disposed (`CabinetLayer.tsx`, Open items).
 *
 *   npm run build && npm run preview -- --port 4173     (in another terminal)
 *   node scripts/swapMemory.mjs http://localhost:4173/
 *
 * A 1440 desktop in package A's L, by the mouse: the pin of an opening, then
 * a model on its card that fits and is not the one standing, round the
 * openings in turn (SLOTS), SWAPS times (50 by default), a second and a half
 * after each before reading.
 */
import { chromium } from "playwright";

const base = process.argv[2];
if (!base) {
  console.error("usage: node scripts/swapMemory.mjs <url>");
  process.exit(2);
}
const swaps = Number(process.env.SWAPS ?? 50);
const slots = (process.env.SLOTS ?? "slot-range,slot-hood,slot-dishwasher,slot-fridge").split(",");

// Without the last flag Chrome rounds the heap it reports, to keep pages from timing it.
const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-precise-memory-info"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.addInitScript(() => {
  const hook = new EventTarget();
  window.__THREE_DEVTOOLS__ = hook;
  hook.addEventListener("observe", (event) => {
    if (event.detail?.isWebGLRenderer) window.__renderer = event.detail;
  });
});
const sep = base.includes("?") ? "&" : "?";
await page.goto(`${base}${sep}quality=high`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector("canvas", { timeout: 60000 });
await page.waitForTimeout(3000);

const click = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
const read = () =>
  page.evaluate(() => ({
    geometries: window.__renderer?.info.memory.geometries,
    textures: window.__renderer?.info.memory.textures,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e5) / 10 : null,
  }));

const rows = [{ n: 0, swap: "(page open)", ...(await read()) }];
for (let n = 1; n <= swaps; n += 1) {
  const slot = slots[(n - 1) % slots.length];
  await click(page.locator(`[data-pin-label="${slot}"]`).first());
  await page.waitForTimeout(600);
  // The card names the opening it is for: a pin that did not open its own card is said, not swapped.
  if ((await page.locator(`[data-model-card="${slot}"]`).count()) === 0) {
    rows.push({ n, swap: `${slot}: its card did not open`, ...(await read()) });
    continue;
  }
  const next = page.locator(`[data-model-card="${slot}"] [data-candidate][data-fits="true"][aria-pressed="false"]`);
  const count = await next.count();
  if (count === 0) {
    rows.push({ n, swap: `${slot}: nothing else fits`, ...(await read()) });
    continue;
  }
  // Round the models it offers, so a long run does not swap back and forth between two.
  const pick = next.nth(Math.floor((n - 1) / slots.length) % count);
  const id = await pick.getAttribute("data-candidate");
  await click(pick);
  await page.waitForTimeout(1500);
  const chosen = await page.locator(`[data-model-card="${slot}"] [data-candidate="${id}"]`).first().getAttribute("aria-pressed");
  rows.push({ n, swap: `${slot} → ${id}${chosen === "true" ? "" : " (NOT TAKEN)"}`, ...(await read()) });
}
const bundle = await page.evaluate(() => document.querySelector('script[src*="assets/index-"]')?.getAttribute("src"));
await browser.close();

console.log(`${base} (${bundle}): ${swaps} swaps, desktop 1440, package A, L`);
console.log("n\tgeometries\ttextures\theap MB\tswap");
for (const row of rows) console.log(`${row.n}\t${row.geometries}\t${row.textures}\t${row.heapMB}\t${row.swap}`);
