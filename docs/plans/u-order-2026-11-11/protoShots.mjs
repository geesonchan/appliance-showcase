// The U's new order, the prototype's 3D (Leo, 2026-11-11: B、D、E 各发默认视角、俯视、飞近
// 炉头、飞近烤箱塔四张 3D 截图，储物高柜"留"和"不留"两种各一组). Each package opened by a
// link as a U at the walls the prototype opens it at, the page in Chinese, on
// a 1440 desktop by the mouse: the default view; from above; flown
// to the cooking surface and to the oven tower by a click on each one's pin
// label. A prototype's pictures, not the finished work's.
// A and C, which have no oven tower and do not change, the default view and
// from above only.
// EXTRA= adds to each link (the prototype's `protoPitch=`); ONLY_DEFAULT=1
// takes the default view alone.
//   node docs/plans/u-order-2026-11-11/protoShots.mjs <build folder> <out folder> <tag> <code=side,...>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, out, tag, sides] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const SIDE = Object.fromEntries(sides.split(",").map((pair) => pair.split("=")).map(([code, side]) => [code, Number(side)]));
const COOKING = { A: "slot-range", B: "slot-range", C: "slot-range", D: "slot-range", E: "slot-cooktop" };
const TOWER = { B: "slot-microwave", D: "slot-oven", E: "slot-microwave" };
const lines = [];
for (const code of Object.keys(SIDE)) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${origin}/?v=2&pkg=${code}&shape=U&back=132&left=${SIDE[code]}&corner=blind&lang=zh&quality=high&qualityLock=1${process.env.EXTRA ? `&${process.env.EXTRA}` : ""}`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(3000);
  const click = async (locator) => {
    const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1800);
  };
  const shot = async (step) => {
    const file = `${tag}-${code}-${step}.png`;
    await page.screenshot({ path: resolve(out, file) });
    lines.push({ tag, code, step, file, errors: errors.splice(0).join(" | ") });
  };
  // The notice the link leaves (it names no models, so they are the package's
  // own) closed first, so it is not in the pictures.
  const close = page.locator("[data-share-notice-close]").filter({ visible: true });
  if (await close.count()) await click(close);
  // A fly-in is shot with the model card open, as the page is used: closing it
  // ends the selection and the fade with it (Leo, 2026-11-12; HANDOFF section 6).
  await shot("1-default");
  if (process.env.ONLY_DEFAULT) {
    await context.close();
    continue;
  }
  // From above: the page's 平面图 button is not built yet ("coming soon"), so
  // the 3D view is tilted down by a mouse drag as far as it will go.
  const canvas = await page.locator("canvas").first().boundingBox();
  const [cx, cy] = [canvas.x + canvas.width / 2, canvas.y + canvas.height / 3];
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 420, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(1800);
  await shot("2-top");
  await click(page.getByRole("button", { name: "重置视角", exact: true }));
  if (!TOWER[code]) {
    await context.close();
    continue;
  }
  await click(page.locator(`[data-pin-label=${COOKING[code]}]`));
  await shot("3-cooking");
  await click(page.getByRole("button", { name: "重置视角", exact: true }));
  await click(page.locator(`[data-pin-label=${TOWER[code]}]`));
  await shot("4-oven-tower");
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, `${tag}.json`), JSON.stringify(lines, null, 1));
for (const l of lines) console.log(`${l.tag} ${l.code} ${l.step} | ${l.errors || "no errors"}`);
