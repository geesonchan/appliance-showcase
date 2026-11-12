// Machines in the way fade as cabinets do (Leo, 2026-11-11: 「挡在前面的机器也变半透明，
// 和柜子同一条规矩。先做原型，发新旧对比图给我看」). Every machine of every package, in the L,
// one wall and the U, flown to by a click on its pin label (the mouse at 1440,
// the page in Chinese, ?debug=1): a screenshot and what the fade hid
// (window.__faded). Run on the prototype built with and without the rule; the
// shots whose list differs are the ones the rule changes.
//   node docs/plans/u-order-2026-11-11/fadeShots.mjs <build folder> <out folder>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
// The U at the walls the prototype opens it at; the L and one wall as the
// package opens and as the shape button makes it.
const U_SIDE = { A: 155.25, B: 141, C: 159.75, D: 177, E: 147 };
const lines = [];
for (const code of ["A", "B", "C", "D", "E"]) {
  for (const shape of ["L", "one-wall", "U"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const link =
      shape === "U"
        ? `?v=2&pkg=${code}&shape=U&back=132&left=${U_SIDE[code]}&corner=blind`
        : `?v=2&pkg=${code}`;
    await page.goto(`${origin}/${link}&lang=zh&quality=high&qualityLock=1&debug=1`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(2500);
    const click = async (locator, wait = 1800) => {
      const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(wait);
    };
    const close = page.locator("[data-share-notice-close]").filter({ visible: true });
    if (await close.count()) await click(close, 600);
    if (shape === "one-wall") await click(page.locator("[data-segment=shape] button[data-value=one-wall]"));
    const slots = await page.locator("[data-pin-label]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-pin-label")))]);
    for (const slot of slots) {
      await click(page.locator(`[data-pin-label="${slot}"]`));
      // The card stays open: closing it ends the selection, and the fade with it.
      const file = `${code}-${shape}-${slot}.png`;
      const faded = await page.evaluate(() => window.__faded ?? []);
      await page.screenshot({ path: resolve(out, file) });
      lines.push({ code, shape, slot, file, faded, errors: errors.splice(0).join(" | ") });
      await click(page.getByRole("button", { name: "重置视角", exact: true }), 1200);
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(resolve(out, "fade.json"), JSON.stringify(lines, null, 1));
console.log(`${lines.length} fly-ins, ${lines.filter((l) => l.errors).length} with page errors`);
