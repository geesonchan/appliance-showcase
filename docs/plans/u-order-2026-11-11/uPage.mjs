// The U's five packages on one page (Leo, 2026-11-12: 「U 的五个套餐：默认视角、飞近灶、飞近
// 烤箱塔、飞近冰箱各一张，做成一页给我看」). Each package's U opened by a link at the
// walls it opens at, the page in Chinese, the mouse at 1440: the default view;
// then flown to the cooking surface, the oven tower (A and C have none) and the
// refrigerator by a click on each one's pin label, the card left open (HANDOFF
// section 6, 5), with what the fade hid. Where the label is hidden — its machine
// behind the left leg in the U's view from the left — by its row in the machine
// list instead (the list rail opened, the row clicked, the rail closed again).
//   node docs/plans/u-order-2026-11-11/uPage.mjs <build folder> <out folder>
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
const SIDE = { A: 155.25, B: 141, C: 159.75, D: 177, E: 147 };
const COOKING = { A: "slot-range", B: "slot-range", C: "slot-range", D: "slot-range", E: "slot-cooktop" };
const TOWER = { B: "slot-microwave", D: "slot-oven", E: "slot-microwave" };
const lines = [];
for (const code of Object.keys(SIDE)) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${origin}/?v=2&pkg=${code}&shape=U&back=132&left=${SIDE[code]}&corner=blind&lang=zh&quality=high&qualityLock=1&debug=1`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(3000);
  const click = async (locator, wait = 2000) => {
    const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(wait);
  };
  const close = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await close.count()) await click(close, 800);
  const shot = async (step) => {
    const file = `${code}-${step}.png`;
    await page.screenshot({ path: resolve(out, file) });
    lines.push({ code, step, file, faded: await page.evaluate(() => window.__faded ?? []), errors: errors.splice(0).join(" | ") });
  };
  await shot("1-default");
  for (const [step, slot] of [["2-cooking", COOKING[code]], ["3-oven-tower", TOWER[code]], ["4-fridge", "slot-fridge"]]) {
    if (!slot) continue;
    const label = page.locator(`[data-pin-label="${slot}"]`).first();
    const shown = await label.evaluate((e) => getComputedStyle(e).opacity !== "0");
    if (shown) await click(label);
    else {
      const names = { "slot-fridge": "冰箱", "slot-range": "炉", "slot-cooktop": "炉" };
      await click(page.locator('[data-rail="left"]'), 900);
      await click(page.locator("[data-panel=list] li button", { hasText: names[slot] }));
      await click(page.locator('[data-rail="left"]'), 1400);
    }
    await shot(`${step}${shown ? "" : "-by-list"}`);
    await click(page.getByRole("button", { name: "重置视角", exact: true }), 1400);
  }
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, "uPage.json"), JSON.stringify(lines, null, 1));
for (const l of lines) console.log(`${l.code} ${l.step} | faded ${l.faded.length} | ${l.errors || "no errors"}`);
