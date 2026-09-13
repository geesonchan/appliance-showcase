import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

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
      for (const code of ["A", "B", "C", "D"]) {
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
