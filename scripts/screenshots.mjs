/**
 * Capture the review set from §10 of the brief.
 *
 *   npm run dev                       (in another terminal)
 *   node scripts/screenshots.mjs 2    -> screenshots/round-2/*.png
 *
 * Pass a round number as the first argument; it defaults to 1.
 * Set BASE_URL to point at a preview build instead of the dev server.
 * Set SET=mobile or SET=desktop to capture only one of the two; SET=round4 for
 * the island set; SET=round5 for the reworked layout; SET=round6 for the room
 * built to the trade's dimensions, the appliances at their own size, the new
 * pins and the ducting; SET=round7 for the module-built runs, the wedge canopy,
 * the dimension layer and the cabinet cutout; SET=round9 for the layout
 * controls and the four corners of the parameter set; SET=round10 for the sink
 * rule, the corner pair and a wall slider being argued with; SET=round11 for
 * the materials, the lighting and the finish picker; SET=round12 for the six
 * visual corrections and the mode-switch timing; SET=round13 for the accent
 * run, the redrawn refrigerator and the counter cut through at the range;
 * SET=round14 for the generated layout that showed the counter over the range,
 * the refrigerator's published split, and marble against quartz; SET=round15
 * for the one-piece refrigerator, the redrawn marble and the cabinets against
 * the canopy.
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
async function captureStates(page, prefix, { selectAppliance, setLighting, showAlternatives, hideAlternatives }) {
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

  // The alternatives for the slot just selected, fit check included.
  await showAlternatives(page);
  await settle(page, 900);
  await page.screenshot({ path: `${outDir}/${prefix}swap.png` });
  await hideAlternatives(page);
  await settle(page, 600);

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

/**
 * Round 4 is about the island and what came with it, so it is its own set
 * rather than another pass of the five standard states: the two island pins
 * only crowd each other from certain angles, and the checklist and the quote
 * sheet are not scene states at all.
 */
async function captureRound4(page) {
  await page.screenshot({ path: `${outDir}/mobile-island-overview.png` });

  // Fly in on the wine cabinet: its door faces the seating side, so the
  // overview shows glass rather than a blank cabinet end.
  await flyTo(page, /Wine cabinet/);
  await page.screenshot({ path: `${outDir}/mobile-wine-door.png` });

  await click(page, "Reset view");
  await settle(page, 1100);
  await flyTo(page, /Microwave/);
  await page.screenshot({ path: `${outDir}/mobile-microwave.png` });

  await click(page, "Reset view");
  await settle(page, 1100);

  // The checklist lives in the configure sheet, below the package summary.
  await click(page, "Configure");
  await page.waitForTimeout(700);
  await page.getByText("Install checklist").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/mobile-checklist.png` });
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(500);

  await click(page, "Request quote");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/mobile-quote.png` });
}

/** Pick an appliance from the sheet, then close it so the scene is visible. */
async function flyTo(page, name) {
  await click(page, "Appliances");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Close" }).click();
  await settle(page, 1600);
}

/**
 * Round 5: the room laid out to the cabinet rules, the fly-ins arriving at each
 * slot's own angle with whatever is in the way faded, and the two pages the
 * detail moved onto.
 */
async function captureRound5(page) {
  await page.screenshot({ path: `${outDir}/mobile-overview.png` });

  await flyTo(page, /Microwave/);
  await page.screenshot({ path: `${outDir}/mobile-microwave.png` });
  await click(page, "Reset view");
  await settle(page, 1100);

  await flyTo(page, /Refrigerator/);
  await page.screenshot({ path: `${outDir}/mobile-fridge.png` });

  // The spec card, for the appliance the camera is already on.
  await page.getByRole("button", { name: "View specs" }).last().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/mobile-spec-card.png` });
  await page.getByRole("button", { name: "Close" }).last().click();
  await page.waitForTimeout(400);
  await click(page, "Reset view");
  await settle(page, 1100);

  await click(page, "Quote");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/mobile-quote.png` });
}

/**
 * Round 6: the sizes. Everything here is about a number being right — the
 * canopy's height, the drawer's, the cabinet grid — so the set is the states
 * where those numbers are visible.
 */
async function captureRound6(page) {
  await page.screenshot({ path: `${outDir}/mobile-overview.png` });

  await click(page, "White model");
  await settle(page, 900);
  await page.screenshot({ path: `${outDir}/mobile-white-model.png` });

  await click(page, "Install");
  await settle(page, 1100);
  await page.screenshot({ path: `${outDir}/mobile-install.png` });
  await click(page, "Materials");
  await settle(page, 900);

  await flyTo(page, /Microwave/);
  await page.screenshot({ path: `${outDir}/mobile-microwave.png` });
  await click(page, "Reset view");
  await settle(page, 1100);

  await flyTo(page, /Ventilation hood/);
  await page.screenshot({ path: `${outDir}/mobile-hood.png` });

  // The blower list, which is now the manufacturer's rather than the brand's.
  await click(page, "Appliances");
  await page.waitForTimeout(700);
  // The blower section is the last thing in the hood's panel.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("div")) {
      if (el.scrollHeight > el.clientHeight + 20) el.scrollTop = el.scrollHeight;
    }
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/mobile-blowers.png` });
}

/**
 * Round 7: the room as a set of orderable boxes, the canopy cut to its drawing,
 * and the figures that say what everything is.
 */
async function captureRound7(page) {
  await page.screenshot({ path: `${outDir}/mobile-overview.png` });

  await click(page, "Install");
  await settle(page, 1200);
  await page.screenshot({ path: `${outDir}/mobile-dimensions.png` });
  await click(page, "Materials");
  await settle(page, 900);

  await flyTo(page, /Ventilation hood/);
  await page.screenshot({ path: `${outDir}/mobile-canopy.png` });
  await click(page, "Install");
  await settle(page, 1200);
  await page.screenshot({ path: `${outDir}/mobile-duct-cutout.png` });
  await click(page, "Materials");
  await settle(page, 900);
  await click(page, "Reset view");
  await settle(page, 1100);

  // The checklist, which now carries the clearance and the cabinet cutout.
  await click(page, "Configure");
  await page.waitForTimeout(700);
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("div")) {
        if (el.scrollHeight > el.clientHeight + 20) el.scrollTop = el.scrollHeight;
      }
    });
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: `${outDir}/mobile-checklist.png` });
}

/**
 * Round 9: the parameters as controls, and the room at the ends of their range.
 *
 * The four combinations are the corners of what the template will build rather
 * than four pretty rooms: the smallest kitchen that still passes every rule,
 * the largest, the one where the refrigerator and the sink have swapped legs,
 * and the one with no island at all — which only fits because a blind corner
 * hands the back wall a foot of run.
 */
const ROUND9 = [
  { name: "controls", query: "" },
  { name: "smallest", query: "?back=150&left=108" },
  { name: "largest", query: "?back=168&left=144&island=96&islandDepth=42" },
  { name: "swapped", query: "?fridge=back&sink=left&corner=blind" },
  { name: "no-island", query: "?island=none&corner=blind" },
];

async function captureRound9(page) {
  for (const { name, query } of ROUND9) {
    await page.goto(baseUrl + query, { waitUntil: "networkidle" });
    await settle(page, 2200);

    if (name === "controls") {
      // The rail is a sheet on a phone and the sheet stops at half the screen,
      // so nine controls will not fit in one frame: the room the kitchen is in,
      // then the kitchen in it.
      await click(page, "Configure");
      await page.waitForTimeout(700);
      for (const [at, file] of [
        ["Back wall", "mobile-controls-room"],
        ["Island depth", "mobile-controls-layout"],
      ]) {
        await page.getByText(at, { exact: true }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${outDir}/${file}.png` });
      }
      continue;
    }

    await page.screenshot({ path: `${outDir}/mobile-${name}.png` });
  }
}

/**
 * Round 10: the sink's landings, the corner bought as a pair, and a wall
 * slider that says what it cannot do and offers a way out.
 */
async function captureRound10(page) {
  const shots = [
    { name: "sink-rule", query: "" },
    { name: "sink-on-left", query: "?fridge=back&sink=left" },
    { name: "corner-blind", query: "?corner=blind" },
    { name: "no-island", query: "?island=none" },
  ];

  for (const { name, query } of shots) {
    await page.goto(baseUrl + query, { waitUntil: "networkidle" });
    await settle(page, 2200);
    await page.screenshot({ path: `${outDir}/mobile-${name}.png` });
  }

  // A back wall the sink will not fit on: the bill, and the button that fixes it.
  await page.goto(`${baseUrl}?back=144`, { waitUntil: "networkidle" });
  await settle(page, 2200);
  await page.screenshot({ path: `${outDir}/mobile-refused-scene.png` });

  await click(page, "Configure");
  await page.waitForTimeout(700);
  await page.getByText("Apply", { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/mobile-refused-bill.png` });

  await click(page, "Apply");
  await settle(page, 1400);
  await page.screenshot({ path: `${outDir}/mobile-applied.png` });

  // And the slider itself, with the stretch it can be built at picked out.
  await page.getByText("Back wall", { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/mobile-wall-slider.png` });
}

/**
 * Round 11: the room as a render rather than a diagram.
 *
 * Day and night on the default view, the range close up where the steel and
 * the cast iron have to hold up, and the four cabinet colours. Each one is a
 * query string, so every frame here is a link.
 */
async function captureRound11(page) {
  const shots = [
    { name: "day", query: "" },
    { name: "night", query: "", after: async () => clickIn(page, "Night") },
    { name: "marble-tile", query: "?counter=marble&floor=tile" },
    { name: "cabinet-green", query: "?cabinet=green" },
    { name: "cabinet-navy", query: "?cabinet=navy" },
    { name: "cabinet-clay", query: "?cabinet=clay" },
    { name: "cabinet-bone", query: "?cabinet=bone" },
  ];

  for (const shot of shots) {
    await page.goto(baseUrl + shot.query, { waitUntil: "networkidle" });
    await settle(page, 2400);
    if (shot.after) await shot.after();
    await settle(page, 1200);
    await page.screenshot({ path: `${outDir}/mobile-${shot.name}.png` });
  }

  // The range close up: the steel, the cast iron and the knobs at the size a
  // customer actually looks at them.
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await flyTo(page, /Range/);
  await settle(page, 1600);
  await page.screenshot({ path: `${outDir}/mobile-range.png` });

  // And the frame rate, with the quality tier the guard settled on.
  await page.goto(`${baseUrl}?debug=1`, { waitUntil: "networkidle" });
  await settle(page, 5000);
  await page.screenshot({ path: `${outDir}/mobile-fps.png` });
}

/** Open the sheet, press a control inside it, and close it again. */
async function clickIn(page, name) {
  await click(page, "Configure");
  await page.waitForTimeout(600);
  await click(page, name);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(400);
}

/**
 * Round 12: the six corrections, and what a mode switch costs now.
 */
async function captureRound12(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await page.screenshot({ path: `${outDir}/mobile-overview.png` });

  for (const [name, match] of [
    ["range", /Range/],
    ["fridge", /Refrigerator/],
    ["dishwasher", /Dishwasher/],
  ]) {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2400);
    await flyTo(page, match);
    await settle(page, 1500);
    await page.screenshot({ path: `${outDir}/mobile-${name}.png` });
  }

  // The sink on the left leg, where its tap used to point at the wrong wall.
  await page.goto(`${baseUrl}?fridge=back&sink=left`, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await page.screenshot({ path: `${outDir}/mobile-sink-left.png` });

  // Oak doors, which is where the grain and the panelled dishwasher show.
  await page.goto(`${baseUrl}?cabinet=oak`, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await page.screenshot({ path: `${outDir}/mobile-oak.png` });

  // And what a mode switch costs, measured in a page that is actually drawing.
  await page.goto(`${baseUrl}?debug=1`, { waitUntil: "networkidle" });
  await settle(page, 3000);
  const timings = [];
  for (const mode of ["White model", "Install", "Materials", "White model", "Install"]) {
    await click(page, mode);
    await page.waitForTimeout(900);
    const panel = await page.locator("div.font-mono").innerText();
    timings.push(`${mode}: ${panel.split(String.fromCharCode(10))[1]}`);
  }
  console.log(timings.join(" | "));
  await page.screenshot({ path: `${outDir}/mobile-mode-switch.png` });
}

/** Round 13: the accent run, the refrigerator, the range, and a wood kitchen. */
async function captureRound13(page) {
  await page.goto(`${baseUrl}?accentRun=island&accent=oak`, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await page.screenshot({ path: `${outDir}/mobile-accent-island.png` });

  for (const [name, match] of [
    ["fridge", /Refrigerator/],
    ["range", /Range/],
  ]) {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2400);
    await flyTo(page, match);
    await settle(page, 1500);
    await page.screenshot({ path: `${outDir}/mobile-${name}.png` });
  }

  await page.goto(`${baseUrl}?cabinet=oak`, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await page.screenshot({ path: `${outDir}/mobile-oak.png` });
}

/** Round 14: the counter on a generated layout, the split, and the two stones. */
async function captureRound14(page) {
  // Leo's case: the layout the generator produced, where the stone was still
  // over the range.
  const generated = "?fridge=back&sink=left&corner=blind&accentRun=left&accent=ink";
  await page.goto(baseUrl + generated, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await page.screenshot({ path: `${outDir}/mobile-generated.png` });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await flyTo(page, /Range/);
  await settle(page, 1500);
  await page.screenshot({ path: `${outDir}/mobile-range.png` });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await flyTo(page, /Refrigerator/);
  await settle(page, 1500);
  await page.screenshot({ path: `${outDir}/mobile-fridge.png` });

  for (const stone of ["marble", "quartz"]) {
    await page.goto(`${baseUrl}?counter=${stone}`, { waitUntil: "networkidle" });
    await settle(page, 2400);
    await page.screenshot({ path: `${outDir}/mobile-${stone}.png` });
  }
}

/** Round 15: the grille, the canopy's neighbours, and the two stones again. */
/**
 * Round 16: the second package.
 *
 * Package C is a 30" freestanding range under a 30" chimney hood and a 36"
 * counter-depth refrigerator standing at the end of a run with nothing built
 * round it — so the two shots are the room as a whole and the refrigerator up
 * close, which is where the missing joinery is the point.
 */
async function captureRound16(page) {
  const toPackage = async (code) => {
    await page.locator(`[data-segment="package"] button`, { hasText: code }).first().click();
    await settle(page, 2000);
  };

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await page.screenshot({ path: `${outDir}/mobile-a-overview.png` });

  await toPackage("C");
  await page.screenshot({ path: `${outDir}/mobile-c-overview.png` });

  await flyTo(page, /Refrigerator/);
  await settle(page, 1500);
  await page.screenshot({ path: `${outDir}/mobile-c-fridge.png` });

  // The hood too: no cabinet over a chimney, and the flue runs to the ceiling.
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await toPackage("C");
  await flyTo(page, /Ventilation hood/);
  await settle(page, 1500);
  await page.screenshot({ path: `${outDir}/mobile-c-hood.png` });
}

async function captureRound15(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await settle(page, 2400);
  await page.screenshot({ path: `${outDir}/mobile-overview.png` });

  for (const [name, match] of [
    ["fridge", /Refrigerator/],
    ["hood", /Ventilation hood/],
  ]) {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2400);
    await flyTo(page, match);
    await settle(page, 1500);
    await page.screenshot({ path: `${outDir}/mobile-${name}.png` });
  }

  for (const stone of ["marble", "quartz"]) {
    await page.goto(`${baseUrl}?counter=${stone}`, { waitUntil: "networkidle" });
    await settle(page, 2400);
    await page.screenshot({ path: `${outDir}/mobile-${stone}.png` });
    // And close up, where the difference between the two has to survive.
    await flyTo(page, /Dishwasher/);
    await settle(page, 1500);
    await page.screenshot({ path: `${outDir}/mobile-${stone}-close.png` });
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();

  if (only === "round16") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await captureRound16(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round15") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await captureRound15(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round14") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await captureRound14(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round13") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await captureRound13(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round12") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await captureRound12(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round11") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await captureRound11(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round10") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await captureRound10(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round9") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await captureRound9(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round7") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2200);
    await captureRound7(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round6") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2200);
    await captureRound6(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round5") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2200);
    await captureRound5(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

  if (only === "round4") {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 2200);
    await captureRound4(page);
    await ctx.close();
    await browser.close();
    console.log(`Wrote screenshots to ${outDir}/`);
    return;
  }

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
      // On a phone the alternatives live in the sheet, which stays open.
      showAlternatives: async (p) => {
        await click(p, "Appliances");
        await p.waitForTimeout(600);
      },
      // Close the sheet again so the toolbar underneath is reachable.
      hideAlternatives: async (p) => {
        await p.getByRole("button", { name: "Close" }).click();
        await p.waitForTimeout(400);
      },
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
      // The desktop column is already showing them after the selection.
      showAlternatives: async () => {},
      hideAlternatives: async (p) => {
        await click(p, "All appliances");
        await p.waitForTimeout(400);
      },
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
