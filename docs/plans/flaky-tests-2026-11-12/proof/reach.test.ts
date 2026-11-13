/**
 * The fadeRebuild diagnostics on a step that cannot be reached (docs/plans/flaky-tests-plan.md,
 * 4: 「第 2 节的诊断用一次故意找不到的元素」): the site's own build, a phone, the Configure
 * sheet open, then the test's own `reach` waiting for an element that is not there, with a
 * short timeout. The error must name the step, give the page's state and the element's
 * three frames, and point at a screenshot that exists.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { launchSiteBrowser } from "../../../../scripts/siteRoute.mjs";
import { reach } from "./reachCopy";

it("names the step and says what the page showed", { timeout: 120_000 }, async () => {
  const origin = "http://localhost:4177";
  const browser = await launchSiteBrowser({}, { origin, dir: resolve("dist"), onMiss: () => {} });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`${origin}/?debug=1`);
  await page.waitForSelector("canvas");
  await page.waitForTimeout(2500);
  page.setDefaultTimeout(3000);
  let message = "";
  try {
    await reach({ page }, "9 an element that is not there", page.locator("[data-not-on-this-page]"));
  } catch (error) {
    message = (error as Error).message;
  }
  await browser.close();
  const shot = /screenshot: (\S+)/.exec(message)?.[1] ?? "";
  console.log(message);
  expect({
    step: message.startsWith('step "9 an element that is not there": '),
    timeout: /Timeout 3000ms exceeded/.test(message),
    page: /the page: \{"sheetTab":.*"backWallSliders":\[/.test(message),
    frames: /the element, three frames: \[\[\],\[\],\[\]\]/.test(message),
    screenshot: shot !== "" && existsSync(shot),
  }).toEqual({ step: true, timeout: true, page: true, frames: true, screenshot: true });
});
