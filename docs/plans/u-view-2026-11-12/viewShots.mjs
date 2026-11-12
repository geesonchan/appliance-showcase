// The U's default view, the candidates side by side (Leo, 2026-11-12: 「前三名各拍五个套餐的默认
// 画面，起预览，链接里能切」). On the view prototype, each package's U opened by a link at the
// walls it opens at with the view in the link (protoAz, protoPitch, protoBoard), the page in
// Chinese, the mouse at 1440 (or a finger at 390 with --phone), the card closed: the
// default view as a customer first sees it.
//   node docs/plans/u-view-2026-11-12/viewShots.mjs <build folder> <out folder> <az/pitch/board>... [--phone]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const args = process.argv.slice(2);
const phone = args.includes("--phone");
const [build, out, ...views] = args.filter((a) => a !== "--phone");
mkdirSync(out, { recursive: true });
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const SIDE = { A: 155.25, B: 141, C: 159.75, D: 177, E: 147 };
const device = phone
  ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
  : { viewport: { width: 1440, height: 900 } };
for (const view of views) {
  const [az, pitch, board] = view.split("/");
  for (const code of Object.keys(SIDE)) {
    const context = await browser.newContext(device);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `${origin}/?v=2&pkg=${code}&shape=U&back=132&left=${SIDE[code]}&corner=blind&lang=zh&quality=high&qualityLock=1&protoAz=${az}&protoPitch=${pitch}&protoBoard=${board}`,
    );
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(3500);
    const close = page.locator("[data-share-notice-close]").filter({ visible: true });
    if (await close.count()) {
      const box = await close.first().boundingBox();
      if (phone) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1200);
    }
    const file = `${code}-az${az}-p${pitch}-${board}${phone ? "-phone" : ""}.png`;
    await page.screenshot({ path: resolve(out, file) });
    console.log(`${file} | ${errors.join(" | ") || "no errors"}`);
    await context.close();
  }
}
await browser.close();
