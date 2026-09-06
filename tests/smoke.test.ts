import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { PREVIEW_URL } from "./globalSetup";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

/** A page with console errors collected, and the scene given time to draw. */
async function openPage(viewport: typeof DESKTOP, isMobile = false) {
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

  await page.goto(PREVIEW_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(2200);
  return { page, errors };
}

const pinOpacities = (page: Page) =>
  page.$$eval("button[style*='position: absolute']", (els) =>
    els.map((el) => getComputedStyle(el).opacity),
  );

/** Pin positions are projected through the camera, so they stand in for pose. */
const pinPositions = (page: Page) =>
  page.$$eval("button[style*='position: absolute']", (els) =>
    els.map((el) => (el as HTMLElement).style.transform).join("|"),
  );

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
    const before = await pinPositions(page);
    await page.getByRole("button", { name: /Range/ }).first().click();
    await page.waitForTimeout(1400);
    expect(await pinPositions(page)).not.toBe(before);
    expect(await page.getByText("View specs").isVisible()).toBe(true);

    // Clicking past the appliances clears the selection again.
    const canvas = (await page.locator("canvas").boundingBox())!;
    await page.mouse.click(canvas.x + 70, canvas.y + canvas.height - 70);
    await page.waitForTimeout(600);
    expect(await page.getByText("View specs").count()).toBe(0);
    await page.close();
  });

  it("swaps a model in place and follows it everywhere", async () => {
    const { page, errors } = await openPage(DESKTOP);
    const pinText = () =>
      page.locator("button[style*='position: absolute']").nth(1).textContent();
    const pinBefore = await pinText();

    await page.getByRole("button", { name: /^02 Range/ }).first().click();
    await page.waitForTimeout(1200);
    const specBefore = await page
      .getByRole("button", { name: "View specs" })
      .locator("xpath=..")
      .innerText();

    // Whatever the catalogue holds today, pick a candidate that is not the one
    // already specified. Keying this to a SKU would break on the next import.
    const others = page.locator("li button[aria-pressed='false']:not([disabled])");
    expect(await others.count()).toBeGreaterThan(0);
    await others.first().click();
    await page.waitForTimeout(900);

    // The pin, the callout and the scene all read the one selection.
    expect(await pinText()).not.toBe(pinBefore);
    expect(
      await page.getByRole("button", { name: "View specs" }).locator("xpath=..").innerText(),
    ).not.toBe(specBefore);

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
    await page.mouse.move(canvas.x + canvas.width / 2 + 600, canvas.y + canvas.height / 2, {
      steps: 25,
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

    const shifted = await page.$$eval("button[style*='position: absolute']", (els) =>
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
    await page.waitForTimeout(700);
    expect(await pinPositions(page)).toBe(before);
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
      expect(finding.ruleId).toMatch(/^[a-z-]+$/);
      expect(finding.message).not.toContain("{");
    }

    expect(errors).toEqual([]);
    await page.close();
  });
});
