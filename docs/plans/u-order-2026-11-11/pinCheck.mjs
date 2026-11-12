// Which pin labels the U's default view shows, package by package: a label is
// hidden (opacity 0, takes no click) when its machine's pin point is behind
// something (PinProjector). Run on a build, and on the prototype with its
// back board on and off (`protoBoard`), the view the same.
//   node docs/plans/u-order-2026-11-11/pinCheck.mjs <build folder> [extra query]
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";
const [build, extra] = process.argv.slice(2);
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] }, { origin, dir: resolve(build), onMiss: () => {} });
for (const [code, side] of [["A", 155.25], ["B", 141], ["C", 159.75], ["D", 177], ["E", 147]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${origin}/?v=2&pkg=${code}&shape=U&back=132&left=${side}&corner=blind&lang=zh&quality=high${extra ? `&${extra}` : ""}`);
  await page.waitForSelector("canvas", { timeout: 60000 });
  await page.waitForTimeout(3000);
  const pins = await page.evaluate(() =>
    [...document.querySelectorAll("[data-pin-label]")].map((e) => ({ slot: e.getAttribute("data-pin-label").replace("slot-", ""), shown: getComputedStyle(e).opacity !== "0" })),
  );
  console.log(`${code} shown: ${pins.filter((p) => p.shown).map((p) => p.slot).join(", ") || "-"} | hidden: ${pins.filter((p) => !p.shown).map((p) => p.slot).join(", ") || "-"}`);
  await page.close();
}
await browser.close();
