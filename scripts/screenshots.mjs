/**
 * Capture the review set from §10 of the brief.
 *
 *   npm run dev                       (in another terminal)
 *   node scripts/screenshots.mjs 1    -> screenshots/round-1/*.png
 *
 * Pass a round number as the first argument; it defaults to 1.
 * Set BASE_URL to point at a preview build instead of the dev server.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const round = process.argv[2] ?? "1";
const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
const outDir = `screenshots/round-${round}`;

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** Wait for the canvas to have drawn at least one frame. */
async function settle(page, ms = 1400) {
  await page.waitForSelector("canvas");
  await page.waitForTimeout(ms);
}

async function clickText(page, text) {
  await page.getByRole("button", { name: text, exact: true }).first().click();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();

  const desktop = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 2,
  });
  const page = await desktop.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(page, 2200);

  await page.screenshot({ path: `${outDir}/overview.png` });

  await clickText(page, "White model");
  await settle(page, 900);
  await page.screenshot({ path: `${outDir}/white-model.png` });

  await clickText(page, "Install");
  await settle(page, 900);
  await page.screenshot({ path: `${outDir}/install.png` });

  await clickText(page, "Materials");
  await settle(page, 900);
  // Fly the camera in on the range, then let the 800ms tween finish.
  await page.getByRole("button", { name: /Range/ }).first().click();
  await settle(page, 1500);
  await page.screenshot({ path: `${outDir}/zoomed.png` });

  await clickText(page, "Night");
  await settle(page, 900);
  await page.screenshot({ path: `${outDir}/night.png` });

  const mobile = await browser.newContext({
    viewport: MOBILE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  await phone.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(phone, 2200);
  await phone.screenshot({ path: `${outDir}/mobile.png` });

  await browser.close();
  console.log(`Wrote screenshots to ${outDir}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
