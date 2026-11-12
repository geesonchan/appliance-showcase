// U-2: the shape buttons by real input (Leo, 2026-11-11: 「真鼠标、真手指切 L → U →
// 一字型 → U → 退回，再换套餐」) — the mouse on a 1440 desktop, a finger on a 390
// phone. After each step: the shape the buttons show, the toast's words, the
// camera's view (azimuth and pitch, from the camera the page renders with),
// the page's errors; and a screenshot. Where a switch changes no wall there is
// no notice and no Undo (乙): recorded as such. Then, past Leo's list, the way
// back to the L after a package changed (the plan's section 2.4), and Undo where
// a wall did change.
//   node docs/plans/u2-2026-11-11/realInput.mjs <build folder> <out folder>
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

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
};
const report = [];

for (const [device, options] of Object.entries(DEVICES)) {
  for (const lang of ["zh", "en"]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.addInitScript(() => {
      const hook = new EventTarget();
      window.__THREE_DEVTOOLS__ = hook;
      hook.addEventListener("observe", (event) => {
        const r = event.detail;
        if (!r.isWebGLRenderer || !r.render) return;
        const own = r.render.bind(r);
        r.render = (scene, camera) => {
          window.__view = { camera };
          own(scene, camera);
        };
      });
    });
    await page.goto(`${origin}/?v=2&pkg=A&lang=${lang}&quality=low`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(2500);

    const press = async (selector) => {
      const box = await page.locator(selector).filter({ visible: true }).first().boundingBox({ timeout: 5000 });
      if (!box) throw new Error(`no ${selector} on the ${device}`);
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      if (device === "desktop") await page.mouse.click(x, y);
      else await page.touchscreen.tap(x, y);
      await page.waitForTimeout(1800);
    };
    const state = async (step) => {
      const s = await page.evaluate(() => {
        const active = [...document.querySelectorAll("[data-segment=shape] button")].find(
          (b) => b.offsetParent !== null && b.className.includes("bg-accent"),
        );
        const pkg = [...document.querySelectorAll("[data-segment=package] button")].find((b) => b.className.includes("bg-accent"));
        const toast = document.querySelector("[role=status][data-toast]");
        const e = window.__view?.camera.matrixWorld.elements;
        // The camera's back axis: where it looks from.
        const view = e ? { azimuth: Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI), pitch: Math.round((Math.asin(e[9]) * 180) / Math.PI) } : null;
        return {
          shape: active?.dataset.value ?? null,
          pkg: pkg?.dataset.value ?? null,
          toast: toast ? [...toast.querySelectorAll("span.block")].map((l) => l.textContent).join(" / ") || toast.textContent : null,
          undo: document.querySelector("[data-toast-undo]")?.textContent ?? null,
          view,
        };
      });
      const shot = `${device}-${lang}-${String(report.filter((r) => r.device === device && r.lang === lang).length).padStart(2, "0")}-${step.replace(/[^a-zA-Z0-9]+/g, "_")}.png`;
      await page.screenshot({ path: resolve(out, shot) });
      report.push({ device, lang, step, ...s, errors: errors.splice(0).join(" | "), shot });
      const r = report[report.length - 1];
      console.log(`${r.device} ${r.lang} | ${r.step} | ${r.pkg} ${r.shape} | view ${r.view ? `${r.view.azimuth}°/${r.view.pitch}°` : "?"} | toast ${r.toast ?? "-"} | undo ${r.undo ?? "-"} | errors ${r.errors || "none"}`);
    };

    await state("opened A, L");
    await press("[data-segment=shape] button[data-value=U]");
    await state("L to U");
    await press("[data-segment=shape] button[data-value=one-wall]");
    await state("U to one-wall");
    await press("[data-segment=shape] button[data-value=U]");
    await state("one-wall to U");
    // No wall changes on this switch (one wall kept the U's side walls; 乙):
    // no notice, so no Undo to press. Recorded, not pressed.
    if (await page.locator("[data-toast-undo]").filter({ visible: true }).count()) {
      await press("[data-toast-undo]");
      await state("Undo");
    } else await state("no Undo offered");
    await press("[data-segment=package] button[data-value=package-d]");
    await state("package D");
    await press("[data-segment=shape] button[data-value=L]");
    await state("then L (section 2.4)");
    // Undo where a wall changed: one wall from this L, and back.
    await press("[data-segment=shape] button[data-value=one-wall]");
    await state("L to one-wall");
    await press("[data-toast-undo]");
    await state("Undo back to the L");
    await press("[data-segment=shape] button[data-value=U]");
    await state("L to U again");
    await press("[data-segment=shape] button[data-value=one-wall]");
    await state("U to one-wall");
    // The camera to one wall's own view, so an Undo back into the U shows its turn.
    await press(`button[aria-label="${lang === "zh" ? "重置视角" : "Reset view"}"]`);
    await state("reset view on one wall");
    await press("[data-toast-undo]");
    await state("Undo back to the U");
    await context.close();
  }
}
await browser.close();
writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 1));
