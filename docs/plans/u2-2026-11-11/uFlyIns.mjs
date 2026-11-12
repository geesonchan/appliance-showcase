// U-2, the plan's section 5: every machine of each package's U flown to, by a
// click on its pin's label with the mouse on a 1440 desktop, one screenshot each, with what
// the fade hid (?debug=1's window.__faded) — for the fly-in angles to be looked
// at machine by machine.
//   node docs/plans/u2-2026-11-11/uFlyIns.mjs <build folder> <out folder>
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
// The U's walls since the new order (2026-11-12): B 141", D 177", E 147".
const SIDE = { A: 155.25, B: 141, C: 159.75, D: 177, E: 147 };
const lines = [];
for (const code of Object.keys(SIDE)) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?v=2&pkg=${code}&shape=U&back=132&left=${SIDE[code]}&corner=blind&lang=en&quality=high&debug=1`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);
  const click = async (locator) => {
    const box = await locator.boundingBox({ timeout: 5000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await page.screenshot({ path: resolve(out, `${code}-00-default.png`) });
  // Each machine by its pin: a click on its label flies to it, as the list does.
  const slots = await page.locator("[data-pin-label]").evaluateAll((els) => els.map((e) => e.getAttribute("data-pin-label")));
  let i = 0;
  for (const slot of slots) {
    i += 1;
    const label = page.locator(`[data-pin-label="${slot}"]`).first();
    const name = (await label.innerText()).split(/\n/)[0];
    await click(label);
    await page.waitForTimeout(1800);
    const file = `${code}-${String(i).padStart(2, "0")}-${slot}.png`;
    await page.screenshot({ path: resolve(out, file) });
    const faded = await page.evaluate(() => window.__faded ?? []);
    lines.push({ code, i, slot, name, file, faded: faded.length, errors: errors.splice(0).join(" | ") });
    await click(page.getByRole("button", { name: "Reset view", exact: true }).first());
    await page.waitForTimeout(1400);
  }
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, "flyins.json"), JSON.stringify(lines, null, 1));
for (const l of lines) console.log(`${l.code} ${String(l.i).padStart(2)} ${l.slot} ${l.name} | faded ${l.faded} | ${l.errors || "no errors"}`);
