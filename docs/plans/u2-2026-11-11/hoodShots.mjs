// U-2, the hood on the U's right leg (Leo, 2026-11-11: 「B，D套餐的insert hood形状不对」).
// Each case opens a package by a link (its housing), switches the
// shape by the mouse on the top bar's buttons, then flies to the hood by a
// click on its pin's label; a hood other than the package's own is picked in
// the model card by the mouse, as a customer would, and flown to again; one
// screenshot each, with the model the card shows and the page's errors. A case with `views` instead
// turns the camera by a mouse drag on the 3D view, left and right of the
// default, for the backs of the left leg's tall units.
//   node docs/plans/u2-2026-11-11/hoodShots.mjs <build folder> <out folder> <set>
//   set: liner | others | backs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, out, set] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);

const SETS = {
  liner: [
    ...["B", "D"].flatMap((p) =>
      ["L", "one-wall", "U"].flatMap((shape) => ["box", "sweep"].map((housing) => ({ p, shape, housing }))),
    ),
    ...["box", "sweep"].map((housing) => ({ p: "E", shape: "one-wall", housing, hood: "VCIN36GWS" })),
  ],
  others: ["B", "D"].flatMap((p) =>
    ["HMCB36WS", "PH36HWS", "JVM3160RFSS"].map((hood) => ({ p, shape: "U", housing: "box", hood })),
  ),
  backs: ["B", "D", "E"].map((p) => ({ p, shape: "U", housing: "box", views: true })),
};

const lines = [];
for (const c of SETS[set]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${origin}/?v=2&pkg=${c.p}&lang=zh&housing=${c.housing}&quality=high&qualityLock=1&debug=1`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);
  const click = async (locator) => {
    const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1800);
  };
  if (c.shape !== "L") await click(page.locator(`[data-segment=shape] button[data-value=${c.shape}]`));
  const name = `${c.p}-${c.shape}-${c.housing}${c.hood ? `-${c.hood}` : ""}`;
  if (c.views) {
    const canvas = await page.locator("canvas").first().boundingBox();
    const [cx, cy] = [canvas.x + canvas.width / 2, canvas.y + canvas.height / 2];
    for (const [side, dx] of [["left-front", 130], ["right-front", -130], ["left-side", 260], ["right-side", -260]]) {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + dx, cy, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(1800);
      await page.screenshot({ path: resolve(out, `${name}-${side}.png`) });
      lines.push({ name: `${name} ${side}`, errors: errors.splice(0).join(" | ") });
      await click(page.getByRole("button", { name: "重置视角", exact: true }));
    }
  } else {
    await click(page.locator("[data-pin-label=slot-hood]"));
    if (c.hood) {
      await click(page.locator("[data-card-scroll] button", { hasText: c.hood }));
      await click(page.locator("[data-pin-label=slot-hood]"));
    }
    const card = await page.locator("[data-model-card] [data-card-model]").filter({ visible: true }).first().innerText().catch(() => "");
    await page.screenshot({ path: resolve(out, `${name}.png`) });
    lines.push({ name, shown: card.replace(/\s+/g, " "), errors: errors.splice(0).join(" | ") });
  }
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, `${set}.json`), JSON.stringify(lines, null, 1));
for (const l of lines) console.log(`${l.name} | ${l.shown ?? ""} | ${l.errors || "no errors"}`);
