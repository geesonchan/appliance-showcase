/**
 * Capture the review set from §10 of the brief.
 *
 *   npm run dev                       (in another terminal)
 *   node scripts/screenshots.mjs 2    -> screenshots/round-2/*.png
 *
 * Pass a round number as the first argument; it defaults to 1.
 * Set BASE_URL to point at a preview build instead of the dev server.
 * Set SET=mobile or SET=desktop to capture only one of the two.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const round = process.argv[2] ?? "1";
const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
const only = process.env.SET;
const outDir = `screenshots/round-${round}`;

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** Wait for the canvas to have drawn, then let the scene settle. */
async function settle(page, ms = 1200) {
  await page.waitForSelector("canvas");
  await page.waitForTimeout(ms);
}

const click = (page, name) =>
  page.getByRole("button", { name, exact: true }).first().click();

/**
 * The five scene states, in the same order on both viewports so they can be
 * compared side by side. Selecting an appliance and switching the lighting go
 * through the side panels, which live in a sheet on a phone, so each viewport
 * supplies its own way in.
 */
async function captureStates(page, prefix, { selectAppliance, setLighting }) {
  await page.screenshot({ path: `${outDir}/${prefix}overview.png` });

  await click(page, "White model");
  await settle(page, 900);
  await page.screenshot({ path: `${outDir}/${prefix}white-model.png` });

  await click(page, "Install");
  await settle(page, 900);
  await page.screenshot({ path: `${outDir}/${prefix}install.png` });

  await click(page, "Materials");
  await settle(page, 900);
  // Fly the camera in on the range, then let the 800ms tween finish.
  await selectAppliance(page);
  await settle(page, 1500);
  await page.screenshot({ path: `${outDir}/${prefix}zoomed.png` });

  // Back to the default framing so day and night are comparable.
  await click(page, "Reset view");
  await settle(page, 1100);
  await setLighting(page, "Night");
  await settle(page, 900);
  await page.screenshot({ path: `${outDir}/${prefix}night.png` });
  await setLighting(page, "Day");
  await settle(page, 700);
}

/** On a phone both side panels live behind the half-height sheet. */
async function viaSheet(page, tab, action) {
  await click(page, tab);
  await page.waitForTimeout(500);
  await action();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(400);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();

  if (only !== "desktop") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2200);

    await captureStates(page, "mobile-", {
      selectAppliance: (p) =>
        viaSheet(p, "Appliances", () =>
          p.getByRole("button", { name: /Range/ }).first().click(),
        ),
      setLighting: (p, value) => viaSheet(p, "Configure", () => click(p, value)),
    });

    // Sixth mobile shot: the half-height sheet, scene still visible above it.
    await click(page, "Configure");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${outDir}/mobile-sheet.png` });
    await ctx.close();
  }

  if (only !== "mobile") {
    const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2200);

    await captureStates(page, "desktop-", {
      selectAppliance: (p) => p.getByRole("button", { name: /Range/ }).first().click(),
      setLighting: (p, value) => click(p, value),
    });
    await ctx.close();
  }

  await browser.close();
  console.log(`Wrote screenshots to ${outDir}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
