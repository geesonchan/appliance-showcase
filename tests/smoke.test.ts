import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/**
 * How many tests this file runs, and a check that every one of them did.
 *
 * Round 37's first run had its setup fall over: all twenty-five tests were
 * skipped, and through a pipe the run looked like a pass. A smoke suite that
 * tested nothing has to fail, so the count is asserted once the file is done.
 * Change the number when a test is added or removed. A run filtered with -t
 * runs fewer on purpose, and is the one exception.
 */
const EXPECTED_TESTS = 29;
let testsRun = 0;
const filtered = process.argv.some((arg) => arg === "-t" || arg.startsWith("--testNamePattern"));
beforeEach(() => {
  testsRun += 1;
});
afterAll(() => {
  if (filtered) return;
  expect(testsRun, `${testsRun} of ${EXPECTED_TESTS} smoke tests actually ran`).toBe(EXPECTED_TESTS);
});

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();

  // Warm the browser as well as the server. The first page in a fresh Chromium
  // pays for the GPU process and the shader cache before a WebGL canvas
  // appears, and whichever test happened to run first was paying it — which is
  // a fact about the machine, not about the app.
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  await page.goto(PREVIEW_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector("canvas", { timeout: 120_000 });
  await page.waitForTimeout(1500);
  await context.close();
});

afterAll(async () => {
  await browser?.close();
});

/** A page with console errors collected, and the scene given time to draw. */
async function openPage(viewport: typeof DESKTOP, isMobile = false, query = "") {
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  // Count draw calls so we can tell whether a layer actually reached the GPU.
  await page.addInitScript(() => {
    (window as unknown as { __draws: number }).__draws = 0;
    const patch = (proto: WebGLRenderingContext | WebGL2RenderingContext) => {
      for (const name of ["drawElements", "drawArrays"] as const) {
        const original = proto[name];
        if (!original) continue;
        // Patching a built-in purely for instrumentation.
        (proto as unknown as Record<string, unknown>)[name] = function (
          this: unknown,
          ...args: unknown[]
        ) {
          (window as unknown as { __draws: number }).__draws++;
          return (original as (...a: unknown[]) => unknown).apply(this, args);
        };
      }
    };
    if (window.WebGL2RenderingContext) patch(WebGL2RenderingContext.prototype);
    if (window.WebGLRenderingContext) patch(WebGLRenderingContext.prototype);
  });

  // Navigation gets its own budget rather than Playwright's 30s default: the
  // scene is a megabyte and a half of JavaScript and a WebGL context, and on a
  // loaded machine "no network activity for half a second" takes longer than
  // that to arrive.
  await page.goto(PREVIEW_URL + query, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2200);
  return { page, errors };
}

/**
 * Wait for the fly-in to arrive, rather than for a number of milliseconds.
 *
 * The fade is recalculated as the camera moves, and on the way to an appliance
 * the camera passes through angles where things stand in the sight line that
 * do not stand in it when it arrives. Sampling at a fixed delay asserted about
 * whichever frame the machine happened to be on — which passed on a quiet
 * machine and failed on a busy one, for no difference in the app.
 */
async function settled(page: Page, ms = 500, limit = 12_000) {
  const read = () =>
    page.evaluate(() => ((window as unknown as { __faded?: string[] }).__faded ?? []).join("|"));
  // The fly-in is an 800ms tween and the fade is recalculated every fourth
  // frame, so for the first moment after a click nothing has moved yet and two
  // equal readings mean "not started", not "arrived".
  await page.waitForTimeout(1200);
  const deadline = Date.now() + limit;
  let last = await read();
  while (Date.now() < deadline) {
    await page.waitForTimeout(ms);
    const now = await read();
    if (now === last) return;
    last = now;
  }
}

const pinOpacities = (page: Page) =>
  page.$$eval("button[style*='position: absolute']", (els) =>
    els.map((el) => getComputedStyle(el).opacity),
  );

/**
 * The dots, which are a pure projection of their anchors and so stand in for
 * the camera pose. The labels are not: they are pushed off the appliances and
 * off each other afterwards, so a sub-pixel difference in pose can move one of
 * them a long way.
 */
const pinPositions = (page: Page) =>
  page.$$eval("[data-pin-dot]", (els) =>
    els.map((el) => (el as HTMLElement).style.transform).join("|"),
  );

/**
 * Wait for the pins to stop moving.
 *
 * The camera flies in over 800ms and the pins are re-projected every frame, so
 * a fixed delay is a bet on how fast the machine is: the same click that has
 * finished in a second on a quiet box is still in the air three seconds later
 * on a loaded one. Waiting for the projection to settle asserts about the
 * arrival rather than about the clock.
 */
async function pinsSettled(page: Page, ms = 400, limit = 12_000) {
  const deadline = Date.now() + limit;
  await page.waitForTimeout(ms);
  let last = await pinPositions(page);
  while (Date.now() < deadline) {
    await page.waitForTimeout(ms);
    const now = await pinPositions(page);
    if (now === last) return last;
    last = now;
  }
  return last;
}

const setMode = (page: Page, label: string) =>
  page.getByRole("button", { name: label, exact: true }).first().click();

const drawsPerFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = (window as unknown as { __draws: number }).__draws;
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - t0 < 500) requestAnimationFrame(tick);
          else
            resolve(
              ((window as unknown as { __draws: number }).__draws - start) / frames,
            );
        };
        requestAnimationFrame(tick);
      }),
  );

describe("desktop", () => {
  it("loads the scene with all six pins and no console errors", async () => {
    const { page, errors } = await openPage(DESKTOP);
    expect(await pinOpacities(page)).toEqual(["1", "1", "1", "1", "1", "1"]);
    expect(errors).toEqual([]);
    await page.close();
  });

  it("keeps every pin visible in all three render modes", async () => {
    const { page } = await openPage(DESKTOP);
    for (const mode of ["White model", "Install", "Materials"]) {
      await setMode(page, mode);
      await page.waitForTimeout(700);
      expect(await pinOpacities(page), `pins in ${mode}`).toEqual([
        "1",
        "1",
        "1",
        "1",
        "1",
        "1",
      ]);
    }
    await page.close();
  });

  // docs/decisions.md D1: switching render mode must not move the camera.
  it("holds the camera pose across render mode switches", async () => {
    const { page } = await openPage(DESKTOP);
    const before = await pinPositions(page);
    for (const mode of ["White model", "Install", "Materials"]) {
      await setMode(page, mode);
      await page.waitForTimeout(700);
      expect(await pinPositions(page), `camera after ${mode}`).toBe(before);
    }
    await page.close();
  });

  it("draws more geometry in install mode than in materials mode", async () => {
    const { page } = await openPage(DESKTOP);
    const materials = await drawsPerFrame(page);
    await setMode(page, "Install");
    await page.waitForTimeout(900);
    const install = await drawsPerFrame(page);
    expect(install).toBeGreaterThan(materials);
    await page.close();
  });

  it("flies the camera in and offers the selected appliance", async () => {
    const { page } = await openPage(DESKTOP);
    const before = await pinsSettled(page);
    await page.getByRole("button", { name: /Range/ }).first().click();
    expect(await pinsSettled(page)).not.toBe(before);
    expect(await page.getByText("View specs").isVisible()).toBe(true);

    // Clicking past the appliances clears the selection again.
    const canvas = (await page.locator("canvas").boundingBox())!;
    await page.mouse.click(canvas.x + 70, canvas.y + canvas.height - 70);
    await page.waitForTimeout(600);
    expect(await page.getByText("View specs").count()).toBe(0);
    await page.close();
  });

  // Leo's check on the range: whatever is drawn on the front of it — knobs,
  // door, grates — the machine standing in the room is the size the spec sheet
  // says. The low back rail is the one thing above that line, and it is drawn
  // outside the body for exactly that reason.
  it("draws the range at the size its own record publishes", async () => {
    const { page } = await openPage(DESKTOP, false, "?debug=1");
    await page.waitForTimeout(1200);

    const measured = await page.evaluate(
      () =>
        (
          window as unknown as {
            __applianceBoxes?: Record<string, { w: number; h: number; d: number }>;
          }
        ).__applianceBoxes?.["slot-range"],
    );
    expect(measured).toBeTruthy();
    // Thermador PRG366WH: 36" x 36-3/4" x 24-3/4", from its own spec sheet.
    expect(measured!.w).toBeCloseTo(36, 1);
    expect(measured!.h).toBeCloseTo(36.75, 1);
    expect(measured!.d).toBeCloseTo(24.75, 1);
    await page.close();
  });

  // The same check on the refrigerator, whose front is four proud panels with
  // handles standing off them: all of it has to fit the opening it goes in.
  it("draws the refrigerator inside its own opening", async () => {
    const { page } = await openPage(DESKTOP, false, "?debug=1");
    await page.waitForTimeout(1200);

    const measured = await page.evaluate(
      () =>
        (
          window as unknown as {
            __applianceBoxes?: Record<string, { w: number; h: number; d: number }>;
          }
        ).__applianceBoxes?.["slot-fridge"],
    );
    expect(measured).toBeTruthy();
    expect(measured!.w).toBeCloseTo(36, 1);
    expect(measured!.h).toBeCloseTo(84, 1);
    expect(measured!.d).toBeCloseTo(25, 1);
    await page.close();
  });

  it("swaps a model in place and follows it everywhere", async () => {
    const { page, errors } = await openPage(DESKTOP, false, "?debug=1");
    // The measured geometry, which is the only proof the scene itself changed
    // rather than just the panel text beside it.
    const rangeBox = () =>
      page.evaluate(
        () =>
          (window as unknown as { __applianceBoxes?: Record<string, { w: number }> })
            .__applianceBoxes?.["slot-range"],
      );

    // The appliance list opens folded (D12, round 31).
    await page.click(`button[data-rail="left"]`);
    await page.getByRole("button", { name: /^02 Range/ }).first().click();
    await page.waitForTimeout(1200);
    const boxBefore = await rangeBox();
    const specBefore = await page
      .getByRole("button", { name: "View specs" })
      .locator("xpath=..")
      .innerText();

    // Whatever the catalogue holds today, pick a candidate that is not the one
    // already specified. Keying this to a SKU would break on the next import.
    const others = page.locator("li button[aria-pressed='false']:not([disabled])");
    expect(await others.count()).toBeGreaterThan(0);
    await others.first().click();
    await page.waitForTimeout(1200);

    expect(
      await page.getByRole("button", { name: "View specs" }).locator("xpath=..").innerText(),
    ).not.toBe(specBefore);
    // A narrower range is drawn narrower: the model reads its own dimensions.
    const boxAfter = await rangeBox();
    expect(boxAfter!.w).not.toBe(boxBefore!.w);

    expect(errors).toEqual([]);
    await page.close();
  });

  it("redraws the utility runs when the fuel changes", async () => {
    const { page } = await openPage(DESKTOP);
    await setMode(page, "Install");
    await page.waitForTimeout(900);
    const withGas = await drawsPerFrame(page);

    // Swap the gas range for the induction one: no gas line, so strictly less
    // geometry. Found by fuel rather than by SKU so an import cannot break it.
    // The appliance list opens folded (D12, round 31).
    await page.click(`button[data-rail="left"]`);
    await page.getByRole("button", { name: /^02 Range/ }).first().click();
    await page.waitForTimeout(1200);
    const induction = page.locator("li button[aria-pressed]:not([disabled])").filter({
      hasText: /Induction|induction/,
    });
    if ((await induction.count()) === 0) {
      // No induction range in stock today; the unit tests cover the rule.
      await page.close();
      return;
    }
    await induction.first().click();
    await page.waitForTimeout(1200);
    const withoutGas = await drawsPerFrame(page);

    expect(withoutGas).toBeLessThan(withGas);
    await page.close();
  });

  it("fades pins that the room has moved in front of", async () => {
    const { page } = await openPage(DESKTOP);
    const canvas = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down();
    // A quarter turn, which puts a run of cabinets between the camera and one
    // of the pins. Not the walls: those fade as you orbit behind them, and
    // something you can see through is not in the way.
    await page.mouse.move(canvas.x + canvas.width / 2 + 300, canvas.y + canvas.height / 2, {
      steps: 15,
    });
    await page.mouse.up();
    await page.waitForTimeout(1200);

    const opacities = await pinOpacities(page);
    expect(opacities).toContain("0");
    expect(opacities).toContain("1");
    await page.close();
  });
});

describe("mobile", () => {
  const sheetHeightVh = (page: Page) =>
    page
      .locator("[data-sheet]")
      .evaluate((el) =>
        Math.round((el.getBoundingClientRect().height / window.innerHeight) * 100),
      );

  /**
   * The three render modes stay on one line.
   *
   * The control is one control: Materials, White model and Install are three
   * ways of looking at the same room, and the third dropping onto a second
   * line reads as something broken rather than as a layout. It happened
   * because the box is centred with `left-1/2`, which leaves it half the
   * screen — 195px on a phone — to lay three words out in.
   */
  it("keeps the three render modes on one line", async () => {
    const { page } = await openPage(MOBILE, true);
    const control = page.locator('[data-segment="mode"]');
    const buttons = control.locator("button");
    expect(await buttons.count()).toBe(3);

    const box = await control.boundingBox();
    const rows = await buttons.evaluateAll((all) =>
      all.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    const heights = await buttons.evaluateAll((all) =>
      all.map((el) => el.getBoundingClientRect().height),
    );

    // One row: every option starts at the same height, and the box is one
    // option tall plus its own padding.
    expect(new Set(rows).size, `modes on ${new Set(rows).size} lines`).toBe(1);
    expect(box!.height).toBeLessThanOrEqual(Math.max(...heights) + 8);
    // And it fits the phone it is centred on.
    expect(box!.width).toBeLessThanOrEqual(MOBILE.width);

    await page.close();
  });

  it("opens the sheet at half height and keeps it open while you work", async () => {
    const { page, errors } = await openPage(MOBILE, true);
    await page.getByRole("button", { name: "Appliances" }).click();
    await page.waitForTimeout(600);
    expect(await sheetHeightVh(page)).toBe(50);

    // Neither selecting an appliance nor flipping a switch may dismiss it.
    await page.getByRole("button", { name: /Range/ }).first().click();
    await page.waitForTimeout(800);
    expect(await page.locator("[data-sheet]").count()).toBe(1);

    await page.getByRole("button", { name: "Configure" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("switch", { name: "Show cabinets" }).click();
    await page.waitForTimeout(400);
    expect(await page.locator("[data-sheet]").count()).toBe(1);
    expect(await sheetHeightVh(page)).toBe(50);

    expect(errors).toEqual([]);
    await page.close();
  });

  it("drags down to the low snap and closes from the header", async () => {
    const { page } = await openPage(MOBILE, true);
    await page.getByRole("button", { name: "Configure" }).click();
    await page.waitForTimeout(600);

    const grabber = (await page.locator("[role=separator]").boundingBox())!;
    await page.mouse.move(grabber.x + grabber.width / 2, grabber.y + grabber.height / 2);
    await page.mouse.down();
    await page.mouse.move(grabber.x + grabber.width / 2, grabber.y + 160, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(await sheetHeightVh(page)).toBe(26);

    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(500);
    expect(await page.locator("[data-sheet]").count()).toBe(0);
    expect(
      await page.getByRole("button", { name: "Reset view" }).isVisible(),
    ).toBe(true);
    await page.close();
  });

  // docs/decisions.md D1: the sheet is the second allowed camera behaviour.
  it("lifts the framing while the sheet is open and puts it back", async () => {
    const { page } = await openPage(MOBILE, true);
    const before = await pinPositions(page);
    const canvasHeight = await page
      .locator("canvas")
      .evaluate((c) => (c as HTMLCanvasElement).clientHeight);

    await page.getByRole("button", { name: "Configure" }).click();
    await page.waitForTimeout(700);

    const shifted = await page.$$eval("[data-pin-dot]", (els) =>
      els.map((el) => {
        const match = /translate3d\((-?\d+)px, (-?\d+)px/.exec(
          (el as HTMLElement).style.transform,
        );
        return match ? Number(match[2]) : null;
      }),
    );
    const baseline = before.split("|").map((transform) => {
      const match = /translate3d\((-?\d+)px, (-?\d+)px/.exec(transform);
      return match ? Number(match[2]) : null;
    });

    const expected = -canvasHeight * 0.12;
    for (const [index, y] of shifted.entries()) {
      const from = baseline[index];
      if (y === null || from === null) continue;
      expect(y - from).toBeCloseTo(expected, -1);
    }

    await page.getByRole("button", { name: "Close" }).click();
    // Settled rather than a fixed wait, and to the pixel rather than to the
    // string. The pins are re-projected every frame off a camera that eases
    // back, and the last frame of an ease can round one label a pixel either
    // way; a framing that had not been put back would move all six of them.
    const after = await pinsSettled(page);
    const coords = (positions: string) =>
      positions.split("|").flatMap((transform) => {
        const match = /translate3d\((-?\d+)px, (-?\d+)px/.exec(transform);
        return match ? [Number(match[1]), Number(match[2])] : [];
      });
    const back = coords(after);
    const start = coords(before);
    expect(back.length).toBe(start.length);
    for (const [index, value] of start.entries()) {
      expect(Math.abs(back[index] - value), `pin coordinate ${index}`).toBeLessThanOrEqual(1);
    }
    await page.close();
  });
});

describe("quote sheet", () => {
  it("carries the package the scene is showing, in both forms", async () => {
    const { page, errors } = await openPage(DESKTOP);

    // Swap the range so the quote has to reflect a choice, not the default.
    await page.getByRole("button", { name: /Range/ }).first().click();
    await page.waitForTimeout(1200);
    const alternative = page.locator("button", { hasText: /^Select/ }).first();
    const swapped = (await alternative.count()) > 0;
    if (swapped) {
      await alternative.click();
      await page.waitForTimeout(900);
    }
    // The callout names the appliance the camera flew to: "RANGE / Brand Model".
    const callout = await page
      .getByRole("button", { name: "View specs" })
      .locator("xpath=..")
      .innerText();
    // "RANGE" / "Thermador PRG366WH" / "View specs" / "→"
    const lines = callout.split("\n").map((line) => line.trim()).filter(Boolean);
    const model = (lines[1] ?? "").split(" ").pop() ?? "";

    // The quote lives behind one entry in the top bar now, not in the room.
    expect(await page.getByRole("button", { name: "Request quote" }).count()).toBe(0);
    await page.getByRole("button", { name: "Quote", exact: true }).click();
    await page.waitForTimeout(500);

    const quote = page.locator("body");
    await quote.getByRole("button", { name: "Copy summary" }).waitFor();
    await quote.getByRole("button", { name: "Readable summary" }).click();
    await page.waitForTimeout(300);
    const summary = await quote.locator("pre").innerText();
    // The model in the left column has to be the model on the quote.
    expect(model.length).toBeGreaterThan(3);
    expect(summary).toContain(model);
    expect(summary).not.toMatch(/[{}]|^[a-z]+\.[a-zA-Z]+$/m);

    await quote.getByRole("button", { name: "JSON", exact: true }).click();
    await page.waitForTimeout(300);
    const json = JSON.parse(await quote.locator("pre").innerText());
    expect(json.lines).toHaveLength(6);
    expect(json.lines.map((line: { model: string }) => line.model)).toContain(model);
    // Every finding traces back to the rule that produced it.
    for (const finding of json.findings) {
      // A rule id, or a rough-in line keyed by slot and connection.
      expect(finding.ruleId).toMatch(/^[a-z-]+(:[a-z0-9-]+)*$/);
      expect(finding.message).not.toContain("{");
    }

    expect(errors).toEqual([]);
    await page.close();
  });
});

describe("occlusion fade", () => {
  /**
   * D1 behaviour 3. The check runs against `window.__faded`, which the fade
   * publishes under ?debug=1: what is on screen is the wrong thing to assert
   * on, because "the counter looks paler" is not something a test can read.
   */
  it("fades only what stands between the camera and the appliance", async () => {
    const { page, errors } = await openPage(DESKTOP, false, "?debug=1");
    const faded = () => page.evaluate(() => (window as unknown as { __faded?: string[] }).__faded);

    expect(await faded()).toEqual([]);

    // The microwave drawer faces the perimeter: the island's own counter
    // overhangs it, whatever angle you arrive at.
    await page.getByRole("button", { name: /^05 Microwave/ }).first().click();
    await settled(page);
    const hidden = (await faded())!;
    expect(hidden).toContain("island-counter");
    // The appliance's own enclosure is never in its own way.
    expect(hidden.some((id) => id.startsWith("island-behind-microwave"))).toBe(false);

    // Everything comes back when the room does.
    await page.getByRole("button", { name: "Reset view" }).click();
    await settled(page);
    expect(await faded()).toEqual([]);

    // Another slot fades a different set, and never its own enclosure: the
    // check is targeted, not "dim the room whenever a slot is open".
    await page.getByRole("button", { name: /^01 Refrigerator/ }).first().click();
    await settled(page);
    const forFridge = (await faded())!;
    expect(forFridge).not.toEqual(hidden);
    expect(forFridge).not.toContain("island-counter");
    expect(forFridge.some((id) => id.startsWith("left-fridge"))).toBe(false);

    expect(errors).toEqual([]);
    await page.close();
  });
});

describe("pin labels", () => {
  /**
   * The keep-out rule, checked against what was actually laid out.
   * `window.__pinLayout` publishes the label rectangles and the appliances'
   * screen footprints under ?debug=1, which is the only way to assert "this
   * label is not on top of that fridge" without reading pixels.
   */
  it("never lands a label on an appliance", async () => {
    const { page, errors } = await openPage(DESKTOP, false, "?debug=1");
    const canvas = (await page.locator("canvas").boundingBox())!;

    const check = async (label: string) => {
      const layout = await page.evaluate(
        () =>
          (
            window as unknown as {
              __pinLayout?: {
                appliances: { x: number; y: number; w: number; h: number }[];
                labels: { slot: string; x: number; y: number; w: number; h: number; hidden: boolean }[];
              };
            }
          ).__pinLayout,
      );
      expect(layout, label).toBeTruthy();
      expect(layout!.labels.length).toBe(6);
      expect(layout!.appliances.length).toBe(6);
      for (const box of layout!.labels) {
        if (box.hidden) continue;
        expect(box.w, `${box.slot} has no measured width`).toBeGreaterThan(0);
        for (const area of layout!.appliances) {
          const clear =
            Math.abs(box.x - area.x) >= (box.w + area.w) / 2 ||
            Math.abs(box.y - area.y) >= (box.h + area.h) / 2;
          expect(clear, `${label}: ${box.slot} label sits on an appliance`).toBe(true);
        }
      }
    };

    await check("default view");

    // ...and it still holds after the room has been turned round.
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width / 2 + 260, canvas.y + canvas.height / 2 - 60, {
      steps: 15,
    });
    await page.mouse.up();
    await page.waitForTimeout(900);
    await check("after orbiting");

    expect(errors).toEqual([]);
    await page.close();
  });
});

describe("cabinet finishes", () => {
  /**
   * Every panel the cabinetmaker makes is in one of two colours.
   *
   * A kitchen is finished in the colour that was picked, and — if a run is
   * wearing one — the accent. Nothing else. A third colour on screen means
   * something is drawing joinery from a value written down somewhere other
   * than the picker, which is exactly what a drawer front under the microwave
   * was doing: it stayed the scheme's green while the rest of the room went
   * navy. `window.__cabinetPanels` publishes the distinct colours actually on
   * the cabinet-role meshes, so the rule can be checked against the scene
   * rather than against the code that was meant to produce it.
   *
   * Handles, knobs and the dark inside a vent are hardware, not panels, and
   * are marked as such at the material.
   */
  const panels = (page: Page) =>
    page.evaluate(
      () => (window as unknown as { __cabinetPanels: () => string[] }).__cabinetPanels(),
    );

  it("paints every cabinet panel in the picked colour, and the accent run in the accent", async () => {
    const { page, errors } = await openPage(DESKTOP, false, "?debug=1");

    const NAVY = "#2B3A4A";
    const BRICK = "#8A4A38";

    // The configuration rail opens open (D12, round 31).
    await page.waitForSelector(`[data-segment="accent-run"]`);

    // One colour through the whole room.
    await page.click(`[data-segment="accent-run"] button[data-value="none"]`);
    await page.click(`button[data-swatch="${NAVY}"]`);
    await page.waitForTimeout(600);
    expect(await panels(page)).toEqual([NAVY]);

    // And two once a run is wearing a second — the left leg here, which every
    // layout has.
    await page.click(`[data-segment="accent-run"] button[data-value="left"]`);
    await page.click(`button[data-swatch="${BRICK}"]`);
    await page.waitForTimeout(600);
    expect(await panels(page)).toEqual([NAVY, BRICK].sort());

    // That the joinery around an appliance follows its own run — the drawer
    // front under the microwave, the fridge surround, the filler beside the
    // dishwasher — is `cabinetPaint` over `runForSlot`, and is asserted on the
    // arithmetic in src/three/accentRun.test.ts.

    expect(errors).toEqual([]);
    await page.context().close();
  });
});

describe("RAL colours", () => {
  /**
   * A RAL number typed into the finish picker paints the doors exactly the
   * table's value, and one it cannot read changes nothing. Round 33.
   */
  it("paints the doors in a typed RAL colour, and leaves them for one it does not know", async () => {
    const { page, errors } = await openPage(DESKTOP, false, "?debug=1");
    const panels = () =>
      page.evaluate(() =>
        (window as unknown as { __cabinetPanels: () => string[] }).__cabinetPanels(),
      );
    const type = async (which: string, text: string) => {
      await page.fill(`[data-ral-input="${which}"]`, text);
      await page.click(`[data-ral-apply="${which}"]`);
      await page.waitForTimeout(700);
    };

    await page.waitForSelector(`[data-ral-input="cabinet"]`);
    const before = await panels();

    // Not in the table: an error, and the doors as they were.
    await type("cabinet", "RAL 1234");
    expect(await page.textContent(`[data-ral-error="cabinet"]`)).toContain("RAL 1234");
    expect(await panels()).toEqual(before);
    // Not a RAL number at all: the same.
    await type("cabinet", "green");
    expect(await page.$(`[data-ral-error="cabinet"]`)).not.toBeNull();
    expect(await panels()).toEqual(before);

    // In the table: every panel is that colour, and the picker says which.
    await type("cabinet", "RAL 6005");
    expect(await panels()).toEqual(["#0F4336"]);
    expect(await page.textContent(`[data-ral-current="cabinet"]`)).toContain("RAL 6005");

    // The accent takes one too.
    await page.click(`[data-segment="accent-run"] button[data-value="left"]`);
    await type("accent", "ral 9010");
    expect(await panels()).toEqual(["#0F4336", "#F7F9EF"].sort());

    expect(errors).toEqual([]);
    await page.context().close();
  });
});

describe("tower vent", () => {
  /**
   * The vent in the top of a hung oven's opening, at the back (D11, round 32).
   * It exists only in the install view: in the finished room it is behind the
   * machine and under the cabinet, and a vent on the front of the tower is
   * exactly what the rule is there to stop.
   */
  it("draws the vent in install mode and nowhere on the finished tower", async () => {
    const { page, errors } = await openPage(DESKTOP, false, "?debug=1");
    const vents = () =>
      page.evaluate(() =>
        (
          window as unknown as { __towerVents: () => { slot: string; shown: boolean }[] }
        ).__towerVents(),
      );

    // D's coffee cabinet has one too since round 73: TCM24PS's manual asks for
    // air at its back (p. 11). D11 rule 12.
    for (const [code, slots] of [
      ["B", ["slot-microwave"]],
      ["D", ["slot-coffee", "slot-oven"]],
    ] as const) {
      await page.locator(`[data-segment="package"] button`, { hasText: code }).first().click();
      await page.waitForTimeout(1800);

      await setMode(page, "Materials");
      await page.waitForTimeout(600);
      const finished = await vents();
      expect(finished.map((vent) => vent.slot).sort(), code).toEqual([...slots]);
      expect(finished.every((vent) => !vent.shown), `${code} in materials`).toBe(true);

      await setMode(page, "Install");
      await page.waitForTimeout(900);
      expect((await vents()).every((vent) => vent.shown), `${code} in install`).toBe(true);
      await setMode(page, "Materials");
      await page.waitForTimeout(600);
    }

    expect(errors).toEqual([]);
    await page.context().close();
  });

  /**
   * Round 36, Leo: confirm it is where round 32 said — in the shelf over the
   * machine, at the back — and that nothing else named a vent is on or under
   * either tower.
   */
  it("sits in the shelf over the opening, and nothing vent-like is under the tower", async () => {
    const { page, errors } = await openPage(DESKTOP, false, "?debug=1");
    // And D's coffee cabinet's, since round 73.
    for (const [code, slots] of [
      ["B", ["slot-microwave"]],
      ["D", ["slot-coffee", "slot-oven"]],
    ] as const) {
      await page.locator(`[data-segment="package"] button`, { hasText: code }).first().click();
      await page.waitForTimeout(1800);
      await setMode(page, "Install");
      await page.waitForTimeout(900);

      const vents = await page.evaluate(() =>
        (
          window as unknown as {
            __towerVents: () => { slot: string; yIn: number; shelfIn: number | null }[];
          }
        ).__towerVents(),
      );
      expect(vents.map((vent) => vent.slot).sort(), code).toEqual([...slots]);
      for (const vent of vents) {
        expect(vent.shelfIn, `${code} has a cabinet over the opening`).not.toBeNull();
        expect(Math.abs(vent.yIn - (vent.shelfIn ?? 0)), `${code}: vent at ${vent.yIn}"`).toBeLessThan(0.05);
      }
      for (const slot of slots) {
        const named = await page.evaluate(
          (slot) =>
            (window as unknown as { __ventNames: () => { name: string; slot: string | null }[] })
              .__ventNames()
              .filter((vent) => vent.slot === slot)
              .map((vent) => vent.name),
          slot,
        );
        expect(named, `${code} ${slot}`).toEqual(["tower-vent"]);
      }

      await setMode(page, "Materials");
      await page.waitForTimeout(600);
    }
    expect(errors).toEqual([]);
    await page.context().close();
  });
});

describe("a hung oven's front", () => {
  /**
   * Round 36, Leo: a standard install. The machine's trim laps over its cutout
   * and its front is in the plane of the tower's doors, not back inside the
   * hole. Handles excepted — they are meant to stand proud.
   */
  it("stands in the plane of the tower's doors, in B and D", async () => {
    const { page, errors } = await openPage(DESKTOP, false, "?debug=1");
    for (const [code, slot] of [
      ["B", "slot-microwave"],
      ["D", "slot-oven"],
    ] as const) {
      await page.locator(`[data-segment="package"] button`, { hasText: code }).first().click();
      await page.waitForTimeout(1800);
      await setMode(page, "Materials");
      await page.waitForTimeout(600);
      const fronts = await page.evaluate(() =>
        (
          window as unknown as { __ovenFronts: () => { slot: string; ovenIn: number; doorIn: number }[] }
        ).__ovenFronts(),
      );
      const front = fronts.find((each) => each.slot === slot);
      expect(front, `${code}: no oven front found`).toBeTruthy();
      const off = front!.ovenIn - front!.doorIn;
      expect(Math.abs(off), `${code}: oven front ${off.toFixed(3)}" from the door plane`).toBeLessThanOrEqual(
        0.125 + 1e-3,
      );
    }
    expect(errors).toEqual([]);
    await page.context().close();
  });
});

describe("pin labels and the scene controls", () => {
  /**
   * No label lands on the hint line or the toolbar under it. Round 31's
   * screenshots had package A's 05 and 06 printed across "Drag to rotate"
   * once the Configuration rail opened by default and the scene got narrower.
   */
  it("keeps every label off the hint and the toolbar, in every package, at 1440 and 390", async () => {
    for (const [viewport, isMobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ] as const) {
      const { page, errors } = await openPage(viewport, isMobile);
      for (const code of ["A", "B", "C", "D", "E"]) {
        await page.locator(`[data-segment="package"] button`, { hasText: code }).first().click();
        await page.waitForTimeout(2200);
        const where = `package ${code} at ${viewport.width}px`;
        const found = await page.evaluate(() => {
          const areas = [...document.querySelectorAll<HTMLElement>("[data-pin-keep-out]")]
            .filter((element) => element.offsetParent !== null)
            .map((element) => ({
              name: element.hasAttribute("data-scene-hint") ? "hint" : "toolbar",
              rect: element.getBoundingClientRect(),
            }));
          const labels = [...document.querySelectorAll<HTMLElement>("[data-pin-label]")].filter(
            (element) => element.style.opacity === "1",
          );
          const clashes: string[] = [];
          for (const label of labels) {
            const a = label.getBoundingClientRect();
            for (const { name, rect: b } of areas) {
              if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
                clashes.push(`${label.dataset.pinLabel} over the ${name}`);
              }
            }
          }
          return { clashes, labels: labels.length, hint: areas.some((area) => area.name === "hint") };
        });
        expect(found.labels, where).toBeGreaterThan(0);
        // The hint line is only shown from 640px up; the toolbar always is.
        expect(found.hint, where).toBe(!isMobile);
        expect(found.clashes, where).toEqual([]);
      }
      expect(errors).toEqual([]);
      await page.context().close();
    }
  });
});

describe("switching to a package with more machines", () => {
  /**
   * Round 59. The pin projector's per-label boxes were sized once, to the
   * package the page opened on, and a switch from A's six machines to D's ten
   * wrote past the end of them: `Cannot set properties of undefined (setting
   * 'dotX')`, once per switch. The room's key remounts the projector a moment
   * later, which is why nothing stayed wrong on screen.
   *
   * ⚠️ **Clicked from inside the page, on purpose.** A click through
   * Playwright's mouse, a tap or a key press never threw, on the live site or
   * locally, at full speed or with the CPU slowed six times; a `click()` or a
   * dispatched click event from script threw every time. Every other test here
   * clicks with the mouse, which is why none of the ones that switch into D and
   * assert no errors ever caught it. The input that reproduces it is the one
   * to test with.
   *
   * Two tests, because they are two facts: the error is the bug; the ten
   * labels are what a customer sees, and they were right before the fix too.
   */
  const switchFromScript = (page: Page, id: string) =>
    page.$eval(`[data-segment="package"] button[data-value="${id}"]`, (button) =>
      (button as HTMLButtonElement).click(),
    );

  it("throws nothing going from A to D", async () => {
    const { page, errors } = await openPage(DESKTOP);
    await switchFromScript(page, "package-d");
    await page.waitForTimeout(3000);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  it("places and shows every one of D's ten labels", async () => {
    const { page } = await openPage(DESKTOP);
    await switchFromScript(page, "package-d");
    await page.waitForTimeout(3000);
    const labels = await page.$$eval("[data-pin-label]", (els) =>
      els.map((el) => ({
        slot: el.getAttribute("data-pin-label"),
        placed: (el as HTMLElement).style.transform !== "",
        shown: (el as HTMLElement).style.opacity === "1",
      })),
    );
    expect(labels.map((label) => label.slot)).toHaveLength(10);
    expect(labels.filter((label) => !label.placed || !label.shown)).toEqual([]);
    await page.context().close();
  });

  /**
   * Round 59, found by fixing the throw above. The shadow map is refreshed
   * once per room, and the refresh used to be asked for by a component outside
   * the room's key, which hears of a switch before the new room is mounted. A
   * frame drawn in that gap spent the refresh on the old room. The throw had
   * been skipping that frame; without it, a script-clicked switch into D kept
   * 641 pixels of stale shadow edge that a mouse-clicked one does not.
   *
   * So the two inputs are held to the same picture. `?quality=high` pins the
   * render tier, which otherwise follows the frame rate; the top bar is left
   * out, where focus and hover differ by input; and the room-grew toast is
   * waited out.
   */
  it("draws the same room whether the switch was clicked with the mouse or from script", async () => {
    const shoot = async (how: "mouse" | "script") => {
      const { page } = await openPage(DESKTOP, false, "?quality=high");
      await page.waitForTimeout(5000);
      if (how === "script") await switchFromScript(page, "package-d");
      else await page.locator(`[data-segment="package"] button[data-value="package-d"]`).click();
      await page.waitForTimeout(24000);
      const png = await page.screenshot({ clip: { x: 0, y: 60, width: 1440, height: 840 } });
      await page.context().close();
      return png.toString("base64");
    };
    const mouse = await shoot("mouse");
    const script = await shoot("script");

    // Decoded and compared in a page, so a failure says how much differs, by
    // how many levels at most, and where.
    const result = await (async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const found = await page.evaluate(
        async ([a, b]) => {
          const load = async (data: string) => {
            const image = new Image();
            image.src = `data:image/png;base64,${data}`;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d")!;
            context.drawImage(image, 0, 0);
            return { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data };
          };
          const [pa, pb] = [await load(a), await load(b)];
          const { width, height } = pa;
          // The difference, drawn red over a dimmed copy of the script picture.
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d")!;
          const out = context.createImageData(width, height);
          let n = 0;
          let max = 0;
          let box = [width, height, -1, -1];
          for (let i = 0; i < pa.data.length; i += 4) {
            const d = Math.max(
              Math.abs(pa.data[i] - pb.data[i]),
              Math.abs(pa.data[i + 1] - pb.data[i + 1]),
              Math.abs(pa.data[i + 2] - pb.data[i + 2]),
            );
            const differs = d > 0;
            out.data[i] = differs ? 255 : pb.data[i] / 3;
            out.data[i + 1] = differs ? 40 : pb.data[i + 1] / 3;
            out.data[i + 2] = differs ? 40 : pb.data[i + 2] / 3;
            out.data[i + 3] = 255;
            if (!differs) continue;
            n += 1;
            max = Math.max(max, d);
            const x = (i / 4) % width;
            const y = Math.floor(i / 4 / width);
            box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
          }
          context.putImageData(out, 0, 0);
          const diff = canvas.toDataURL("image/png").split(",")[1];
          return { n, max, box, diff };
        },
        [mouse, script],
      );
      await context.close();
      return found;
    })();

    // Round 70: a red here used to leave nothing but a count, and one such red
    // in round 69 was lost altogether. A failure now keeps both pictures and
    // the difference, and says where it is. The box is in the screenshot's own
    // pixels; it starts 60 below the top of the page, under the top bar.
    let evidence = "";
    if (result.n > 0) {
      const dir = `test-results/mouse-script/${new Date().toISOString().replace(/[:.]/g, "-")}`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/mouse.png`, Buffer.from(mouse, "base64"));
      writeFileSync(`${dir}/script.png`, Buffer.from(script, "base64"));
      writeFileSync(`${dir}/diff.png`, Buffer.from(result.diff, "base64"));
      const [x0, y0, x1, y1] = result.box;
      evidence = ` — up to ${result.max} levels, within x ${x0}-${x1}, y ${y0}-${y1}; pictures in ${dir}`;
    }
    expect(
      result.n,
      `pixels that differ between a mouse-clicked and a script-clicked switch into D${evidence}`,
    ).toBe(0);
  });
});

describe("side rails", () => {
  /**
   * Configuration open, the list closed, and a change kept for the tab.
   * See docs/decisions.md D12, round 31.
   */
  it("opens with the list closed and Configuration open, and remembers a change", async () => {
    const { page, errors } = await openPage(DESKTOP);
    expect(await page.$(`aside [data-panel="list"]`)).toBeNull();
    expect(await page.$(`[data-segment="accent-run"]`)).not.toBeNull();

    await page.click(`button[data-rail="right"]`);
    await page.click(`button[data-rail="left"]`);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(`aside [data-panel="list"]`);
    expect(await page.$(`[data-segment="accent-run"]`)).toBeNull();

    // A new tab is a new session, and gets the default back.
    const fresh = await openPage(DESKTOP);
    expect(await fresh.page.$(`aside [data-panel="list"]`)).toBeNull();
    await fresh.page.context().close();

    expect(errors).toEqual([]);
    await page.context().close();
  });

  /**
   * The list never scrolls sideways. Rounds 20-30 had it 386px wide in a
   * 200px column from package B on, and 613px on D: the room's size was a
   * fractional number of feet printed in display type.
   */
  it("never scrolls the appliance list sideways, at 1440 or 390, in any package", async () => {
    for (const [viewport, isMobile] of [
      [DESKTOP, false],
      [MOBILE, true],
    ] as const) {
      const { page, errors } = await openPage(viewport, isMobile);
      if (isMobile) {
        await page.getByRole("button", { name: "Appliances", exact: true }).first().click();
      } else {
        await page.click(`button[data-rail="left"]`);
      }
      for (const code of ["A", "B", "C", "D", "E"]) {
        await page.locator(`[data-segment="package"] button`, { hasText: code }).first().click();
        await page.waitForTimeout(1500);
        const where = `package ${code} at ${viewport.width}px`;
        const lists = await page.$$eval(`[data-panel="list"]`, (elements) =>
          elements
            .filter((element) => (element as HTMLElement).offsetParent !== null)
            .map((element) => [element.scrollWidth, element.clientWidth]),
        );
        expect(lists.length, where).toBe(1);
        const [[scrollWidth, clientWidth]] = lists;
        expect(scrollWidth, where).toBe(clientWidth);
      }
      expect(errors).toEqual([]);
      await page.context().close();
    }
  });
});

describe("the coffee height slider", () => {
  /**
   * Round 76, Leo: dragged up to look and back down, it finds the manual's
   * 37-7/16" again rather than a whole inch beside it. Driven by the keyboard,
   * which is real input (D17: a click from script is not a click), on the
   * slider itself — its value read back from what the panel prints.
   */
  it("comes back to the manufacturer's height after going up to 40 inches and down again", async () => {
    const { page, errors } = await openPage(DESKTOP);
    await page.locator(`[data-segment="package"] button`, { hasText: "E" }).first().click();
    await page.waitForTimeout(1800);
    const control = page.locator("label", { hasText: "Coffee machine height" }).first();
    const slider = control.locator(`input[type="range"]`);
    await slider.focus();
    // The value beside the label, and whether the line under the track says
    // it is the manufacturer's height.
    const shown = async () => ({
      value: await control.locator("span").first().innerText(),
      recommended: await control.locator("[data-coffee-recommended]").count(),
    });

    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    const up = await shown();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);
    const back = await shown();

    expect({ up, back }).toEqual({
      up: { value: 'Coffee machine height\n40"', recommended: 0 },
      back: { value: 'Coffee machine height\n37-7/16"', recommended: 1 },
    });
    expect(errors).toEqual([]);
    await page.context().close();
  });
});
