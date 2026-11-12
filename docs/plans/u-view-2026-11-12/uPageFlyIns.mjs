// The U's page again at its new view (Leo, 2026-11-12: 「U 的一页图重拍（默认画面，加每台机器飞近，
// 卡片开着），给我逐台看」). Each package's U opened by a link at the walls it opens at, the page
// in Chinese, the mouse at 1440, the link's notice closed: the default view; then every
// machine flown to by a click on its pin label (every label shows in this view, which
// tests/uLabels.test.ts holds), shot with its card open (HANDOFF section 6, 5), and the view
// reset before the next.
//   node docs/plans/u-view-2026-11-12/uPageFlyIns.mjs <build folder> <out folder>
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
const lines = [];
for (const code of Object.keys(SIDE)) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?v=2&pkg=${code}&shape=U&back=132&left=${SIDE[code]}&corner=blind&lang=zh&quality=high&qualityLock=1`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(3000);
  const click = async (locator, wait) => {
    const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(wait);
  };
  const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await notice.count()) await click(notice, 1200);
  await page.screenshot({ path: resolve(out, `${code}-00-default.png`) });
  lines.push({ code, i: 0, slot: "default", name: "默认画面", file: `${code}-00-default.png`, card: null, errors: errors.splice(0).join(" | ") });
  const slots = await page.locator("[data-pin-label]").evaluateAll((els) => els.map((e) => e.getAttribute("data-pin-label")));
  let i = 0;
  for (const slot of slots) {
    i += 1;
    const label = page.locator(`[data-pin-label="${slot}"]`);
    const name = (await label.first().innerText()).replace(/\s+/g, " ").trim();
    await click(label, 2400);
    const file = `${code}-${String(i).padStart(2, "0")}-${slot}.png`;
    await page.screenshot({ path: resolve(out, file) });
    const card = await page.locator(`[data-model-card="${slot}"]`).filter({ visible: true }).count();
    lines.push({ code, i, slot, name, file, card: card > 0, errors: errors.splice(0).join(" | ") });
    await click(page.getByRole("button", { name: "重置视角", exact: true }), 1600);
  }
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, "flyins.json"), JSON.stringify(lines, null, 1));
for (const l of lines) console.log(`${l.code} ${String(l.i).padStart(2)} ${l.name} | card ${l.card ?? "-"} | ${l.errors || "no errors"}`);
