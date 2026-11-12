// The round's real input (Leo, 2026-11-12: 「真鼠标、真手指：切形状、换套餐、换型号、放大缩小、
// 退回」): the mouse on a 1440 desktop and a finger on a 390 phone, the page in
// Chinese and English. A's L → U → one wall → U (Undo where one is offered) →
// package D in the U → flown to the hood → another model on the card → zoom in
// → zoom out → reset view → the L → Undo back into the U. After each step: the
// shape and package the buttons show, the notice and its Undo, the camera's
// angle and zoom off the camera the page renders with, the card on screen, the
// page's errors; and a screenshot.
//   node docs/plans/u-order-2026-11-11/realInput2.mjs <build folder> <out folder>
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
const WORDS = {
  zh: { reset: "重置视角", zoomIn: "放大", zoomOut: "缩小" },
  en: { reset: "Reset view", zoomIn: "Zoom in", zoomOut: "Zoom out" },
};
const report = [];
for (const [device, options] of Object.entries(DEVICES)) {
  for (const lang of ["zh", "en"]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.addInitScript(() => {
      const hook = new EventTarget();
      window.__THREE_DEVTOOLS__ = hook;
      hook.addEventListener("observe", (event) => {
        const r = event.detail;
        if (!r.isWebGLRenderer || !r.render) return;
        const own = r.render.bind(r);
        r.render = (scene, camera) => {
          window.__camera = camera;
          own(scene, camera);
        };
      });
    });
    await page.goto(`${origin}/?v=2&pkg=A&lang=${lang}&quality=low`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(2500);
    const press = async (locator, wait = 1900) => {
      const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 5000 });
      if (!box) throw new Error(`nothing to press on the ${device}`);
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      if (device === "desktop") await page.mouse.click(x, y);
      else await page.touchscreen.tap(x, y);
      await page.waitForTimeout(wait);
    };
    const notice = page.locator("[data-share-notice-close]").filter({ visible: true });
    if (await notice.count()) await press(notice, 600);
    const state = async (step) => {
      const s = await page.evaluate(() => {
        const active = (name) =>
          [...document.querySelectorAll(`[data-segment=${name}] button`)].find((b) => b.offsetParent !== null && b.className.includes("bg-accent"))?.dataset.value ?? null;
        const toast = document.querySelector("[role=status][data-toast]");
        const c = window.__camera;
        const e = c?.matrixWorld.elements;
        return {
          shape: active("shape"),
          pkg: active("package"),
          toast: toast ? [...toast.querySelectorAll("span.block")].map((l) => l.textContent).join(" / ") || toast.textContent : null,
          undo: [...document.querySelectorAll("[data-toast-undo]")].find((b) => b.offsetParent !== null)?.textContent ?? null,
          view: e ? `${Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI)}°/${Math.round((Math.asin(e[9]) * 180) / Math.PI)}° zoom ${Math.round(c.zoom * 10) / 10}` : null,
          card: [...document.querySelectorAll("[data-model-card]")].find((el) => el.offsetParent !== null)?.getAttribute("data-model-card") ?? null,
          model: [...document.querySelectorAll("[data-model-card] [data-card-model]")].find((el) => el.offsetParent !== null)?.textContent?.replace(/\s+/g, " ") ?? null,
        };
      });
      const n = report.filter((r) => r.device === device && r.lang === lang).length;
      const shot = `${device}-${lang}-${String(n).padStart(2, "0")}-${step.replace(/[^a-zA-Z0-9]+/g, "_")}.png`;
      await page.screenshot({ path: resolve(out, shot) });
      report.push({ device, lang, step, ...s, errors: errors.splice(0).join(" | "), shot });
      const r = report[report.length - 1];
      console.log(`${device} ${lang} | ${step} | ${r.pkg} ${r.shape} | ${r.view} | card ${r.card ?? "-"} ${r.model ?? ""} | toast ${r.toast ?? "-"} | undo ${r.undo ?? "-"} | ${r.errors || "no errors"}`);
    };
    const undo = page.locator("[data-toast-undo]");
    const w = WORDS[lang];
    await state("opened A, L");
    await press(page.locator("[data-segment=shape] button[data-value=U]"));
    await state("L to U");
    await press(page.locator("[data-segment=shape] button[data-value=one-wall]"));
    await state("U to one wall");
    await press(page.locator("[data-segment=shape] button[data-value=U]"));
    await state("one wall to U");
    if (await undo.filter({ visible: true }).count()) {
      await press(undo);
      await state("Undo");
      await press(page.locator("[data-segment=shape] button[data-value=U]"));
      await state("U again");
    } else await state("no Undo offered");
    await press(page.locator("[data-segment=package] button[data-value=package-d]"), 2600);
    await state("package D");
    await press(page.locator('[data-pin-label="slot-hood"]'));
    await state("flown to the hood");
    await press(page.locator("[data-model-card] [data-candidate][aria-pressed=false]"), 2600);
    await state("another hood");
    await press(page.locator(`button[aria-label="${w.zoomIn}"]`), 1200);
    await state("zoom in");
    await press(page.locator(`button[aria-label="${w.zoomOut}"]`), 1200);
    await state("zoom out");
    await press(page.locator(`button[aria-label="${w.reset}"]`));
    await state("reset view");
    await press(page.locator("[data-segment=shape] button[data-value=L]"));
    await state("U to L");
    if (await undo.filter({ visible: true }).count()) {
      await press(undo);
      await state("Undo back to the U");
    } else await state("no Undo offered");
    await context.close();
  }
}
await browser.close();
writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 1));
