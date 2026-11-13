// Item 10's walk by hand (the plan, section 7: 「真鼠标、真手指：电脑 1440、手机 390，中英文。L 型、一字型、U 型各
// 换几次套餐（含一字型 C→A、A→B 和 U 型 B→A）。每一步查提示、滑杆上的数和退回；退回以后再查滑杆。」).
// The package and shape buttons, the Layout tab and Undo pressed with the mouse on a desktop and a
// finger on a phone; for each switch: what the notice says, its button, the sliders the Layout tab
// shows and the room built (`__room()`, ?debug=1 — it draws nothing extra in the shots, which are
// of the notice alone), then the same after Undo. And a picture of the notice, for the before and
// after pages. Run on the old build and on the new.
//   node docs/plans/item10-2026-11-13/walk.mjs <build folder> <out folder> <tag>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, out, tag] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const origin = "http://localhost:4177";
const WALKS = [
  ["desktop", "zh", "L", "A", "D"],
  ["desktop", "zh", "one-wall", "C", "A"],
  ["desktop", "zh", "U", "B", "A"],
  ["desktop", "zh", "L", "A", "B"],
  ["desktop", "en", "L", "A", "B"],
  ["desktop", "en", "one-wall", "C", "B"],
  ["desktop", "en", "U", "A", "C"],
  ["desktop", "en", "L", "C", "D"],
  ["phone", "zh", "L", "A", "B"],
  ["phone", "zh", "one-wall", "A", "B"],
  ["phone", "zh", "U", "B", "A"],
  ["phone", "zh", "one-wall", "C", "A"],
  ["phone", "en", "L", "A", "D"],
  ["phone", "en", "one-wall", "C", "A"],
  ["phone", "en", "U", "B", "C"],
  ["phone", "en", "L", "E", "B"],
];
const WORDS = {
  zh: { backWallIn: "后墙", leftWallIn: "左墙", sides: "左右墙长度", configure: "配置", close: "关闭" },
  en: { backWallIn: "Back wall", leftWallIn: "Left wall", sides: "Side walls", configure: "Configure", close: "Close" },
};
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const records = [];
for (const [device, lang, shape, from, to] of WALKS) {
  console.error(`${new Date().toTimeString().slice(0, 8)} ${device} ${lang} ${shape} ${from}→${to}`);
  const phone = device === "phone";
  const context = await browser.newContext(
    phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${origin}/?v=2&pkg=A&lang=${lang}&debug=1&quality=high&qualityLock=1`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(3000);
  const press = async (locator, wait = 1200) => {
    const target = locator.filter({ visible: true }).first();
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox({ timeout: 8000 });
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    if (phone) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await page.waitForTimeout(wait);
  };
  const words = WORDS[lang];
  const sliders = async () => {
    if (phone) await press(page.getByRole("button", { name: words.configure, exact: true }));
    await press(page.locator('[data-right-tab="layout"], [data-sheet-tab="layout"]'), 800);
    const read = await page.evaluate((names) => {
      const found = {};
      for (const label of document.querySelectorAll("label")) {
        const input = label.querySelector('input[type="range"]');
        if (!input || input.getClientRects().length === 0) continue;
        const [name, figure] = [...(label.querySelector("span")?.children ?? [])].map((el) => (el.textContent ?? "").trim());
        for (const [key, wanted] of Object.entries(names)) if (name.startsWith(wanted)) found[key === "sides" ? "leftWallIn" : key] = figure;
      }
      return found;
    }, { backWallIn: words.backWallIn, leftWallIn: words.leftWallIn, sides: words.sides });
    // The sheet's own close: a fresh page's hint card has a 「关闭」 / "Close" of its own.
    if (phone) await press(page.locator("[data-sheet]").getByRole("button", { name: words.close, exact: true }));
    return read;
  };
  const built = () =>
    page.evaluate(() => {
      const p = window.__room().params;
      return p.shape === "one-wall" ? { backWallIn: p.backWallIn } : { backWallIn: p.backWallIn, leftWallIn: p.leftWallIn };
    });
  const notice = async () => {
    const toast = page.locator("[data-toast]");
    if ((await toast.count()) === 0) return null;
    const blocks = await page.locator("[data-toast] span.block").allInnerTexts();
    const lines = blocks.length ? blocks : [await toast.locator("span").first().innerText()];
    const undo = page.locator("[data-toast] [data-toast-undo]");
    return { lines: lines.map((l) => l.trim()), button: (await undo.count()) ? (await undo.innerText()).trim() : null };
  };
  try {
  if (from !== "A") await press(page.locator(`[data-segment="package"] [data-value="package-${from.toLowerCase()}"]`), 3000);
  if (shape !== "L") await press(page.locator(`[data-segment="shape"] [data-value="${shape}"]`), 3000);
  const before = { sliders: await sliders(), room: await built() };
  await press(page.locator(`[data-segment="package"] [data-value="package-${to.toLowerCase()}"]`), 3000);
  const said = await notice();
  const name = `${tag}-${device}-${lang}-${shape}-${from}${to}`;
  let shot = null;
  if (said) {
    shot = `${name}.png`;
    await page.locator("[data-toast]").screenshot({ path: resolve(out, shot) });
  }
  const after = { sliders: await sliders(), room: await built() };
  let back = null;
  if (said?.button) {
    await press(page.locator("[data-toast] [data-toast-undo]"), 3000);
    back = { toast: await page.locator("[data-toast]").count(), sliders: await sliders(), room: await built() };
  }
  records.push({ device, lang, shape, from, to, before, said, shot, after, back, errors });
  } catch (error) {
    const failed = `${tag}-${device}-${lang}-${shape}-${from}${to}-FAILED.png`;
    await page.screenshot({ path: resolve(out, failed) }).catch(() => {});
    records.push({ device, lang, shape, from, to, failed: String(error.message).split(/\n/)[0], shot: failed, errors });
  }
  await context.close();
}
await browser.close();
writeFileSync(resolve(out, `${tag}.json`), JSON.stringify(records, null, 1));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fig = (s) => Object.values(s ?? {}).join(" × ");
const num = (r) => Object.values(r ?? {}).map((v) => `${v}"`).join(" × ");
for (const r of records) {
  if (r.failed) { console.log(`${r.device} ${r.lang} ${r.shape} ${r.from}→${r.to}: FAILED ${r.failed} (${r.shot})`); continue; }
  const slidersMatch = same(Object.values(r.after.sliders), Object.values(r.after.room).map((v) => `${v}"`));
  const undone = r.back ? same(r.back.sliders, r.before.sliders) && same(r.back.room, r.before.room) && r.back.toast === 0 : null;
  console.log(
    `${r.device} ${r.lang} ${r.shape} ${r.from}→${r.to}: before ${fig(r.before.sliders)} (room ${num(r.before.room)}) | said ${r.said ? r.said.lines.join(" / ") : "nothing"}${r.said?.button ? ` [${r.said.button}]` : ""} | after sliders ${fig(r.after.sliders)}, room ${num(r.after.room)}${slidersMatch ? "" : " — NOT THE SAME"} | ${r.back ? `Undo: sliders ${fig(r.back.sliders)}, room ${num(r.back.room)}${undone ? ", as before" : " — NOT AS BEFORE"}` : "no Undo"} | errors ${r.errors.length ? r.errors.join(" | ") : "none"}`,
  );
}
