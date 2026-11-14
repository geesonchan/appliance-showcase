// Item 11's intended change, shot: the 32 rooms of E's L with the sink on the left leg and the
// refrigerator on the back leg (the only rooms the dumps show changing, dumpDiff.mjs), on the old
// build (7200b1e) and the new. Each room's link is made from its parameters in the new L dump.
// Per room and build, the page in Chinese, the mouse at 1440:
//   1. the default view;
//   2. the view from above (the canvas dragged down);
//   3. install mode, flown to the combination oven by its label, the card open (closing it ends
//      the fade), with the install list's rows for the oven recorded word for word.
// Every label in the default view checked (shown, on screen, a click at its middle lands on it),
// and every page error. Then one sheet per room: a row per view, old left, new right.
//   node docs/plans/item11-proof/rooms32.mjs <new L dump> <old build> <new build> <out folder> <sheets folder>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [dump, oldBuild, newBuild, out, sheets] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
mkdirSync(sheets, { recursive: true });
const origin = "http://localhost:4177";
const base = Object.fromEntries(
  readFileSync(new URL("../item11-2026-11-13/links.txt", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => l.split(" ")),
).corner;

// The 32 rooms, and each one's link: the prototype's link with this room's own choices and walls.
const rooms = readFileSync(dump, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => r.room && r.label.startsWith('E {"sinkLeg":"left","fridgeEnd":"back"'))
  .map((r, i) => {
    const a = JSON.parse(r.label.slice(2));
    const p = r.room.params;
    const set = { back: p.backWallIn, left: p.leftWallIn, corner: a.cornerType, fridgeAbuts: a.fridgeEndAbuts, towerSide: a.towerSide, coffeeLeg: a.coffeeLeg, islandTurn: a.islandOrientation };
    const q = new URLSearchParams(base);
    for (const [k, v] of Object.entries(set)) q.set(k, String(v));
    const tag = `${String(i + 1).padStart(2, "0")}-coffee-${a.coffeeLeg}-${a.towerSide}-${a.cornerType}-${a.fridgeEndAbuts}-${a.islandOrientation}`;
    return { tag, arrangement: a, walls: [p.backWallIn, p.leftWallIn], query: q.toString() };
  });
if (rooms.length !== 32) throw new Error(`expected 32 rooms, found ${rooms.length}`);
writeFileSync(resolve(out, "links.txt"), rooms.map((r) => `${r.tag} ${r.query}`).join("\n") + "\n");

const records = [];
for (const build of ["old", "new"]) {
  const browser = await launchSiteBrowser(
    { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
    { origin, dir: resolve(build === "old" ? oldBuild : newBuild), onMiss: () => {} },
  );
  for (const r of rooms) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${origin}/?${r.query}&quality=high&qualityLock=1`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(3500);
    const click = async (locator, wait = 1500) => {
      const box = await locator.filter({ visible: true }).first().boundingBox({ timeout: 8000 });
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(wait);
    };
    // A notice the link brought (a wall adjusted): read, then closed, as a visitor would.
    const close = page.locator("[data-share-notice-close]").filter({ visible: true });
    const notice = (await close.count()) ? (await page.locator("[data-toast]").innerText().catch(() => "")).trim() : "";
    if (await close.count()) await click(close, 1000);
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll("[data-pin-label]")].map((label) => {
        const rect = label.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const onScreen = rect.width > 0 && rect.height > 0 && x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
        const hit = onScreen ? document.elementFromPoint(x, y) : null;
        return { text: label.textContent.trim(), ok: Number(getComputedStyle(label).opacity) > 0.5 && onScreen && !!hit && (hit === label || label.contains(hit)) };
      }),
    );
    const files = [`${r.tag}-${build}-1-default.png`, `${r.tag}-${build}-2-top.png`, `${r.tag}-${build}-3-install.png`];
    await page.screenshot({ path: resolve(out, files[0]) });
    const canvas = await page.locator("canvas").first().boundingBox();
    const [cx, cy] = [canvas.x + canvas.width / 2, canvas.y + canvas.height / 3];
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 420, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: resolve(out, files[1]) });
    // A fresh page for install mode, so the camera flies from the default view.
    await page.goto(`${origin}/?${r.query}&quality=high&qualityLock=1`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(3500);
    if (await close.count()) await click(close, 1000);
    await click(page.getByRole("button", { name: "安装", exact: true }), 2000);
    await click(page.locator('[data-pin-label="slot-microwave"]'), 2600);
    await page.screenshot({ path: resolve(out, files[2]) });
    const rows = [];
    const list = page.locator("[data-rough-in]").filter({ hasText: /组合烤箱/ });
    for (let i = 0; i < (await list.count()); i += 1) rows.push((await list.nth(i).innerText()).replace(/\s+/g, " ").trim());
    records.push({ ...r, build, files, labels, notice, rows, errors });
    await context.close();
  }
  await browser.close();
}
writeFileSync(resolve(out, "rooms32.json"), JSON.stringify(records, null, 1));

// The sheets: per room, a row per view, old on the left, new on the right; the room only.
const data = (f) => `data:image/png;base64,${readFileSync(resolve(out, f)).toString("base64")}`;
const crop = [150, 96, 920, 730];
const width = 760;
const height = Math.round((crop[3] / crop[2]) * width);
const panel = (f, caption) => `<div><div style="font-size:24px;padding:4px 0;color:#1d3b2a">${caption}</div>
  <div style="width:${width}px;height:${height}px;border:2px solid #333;background:url(${data(f)}) no-repeat;
  background-size:${Math.round((1440 / crop[2]) * width)}px auto;background-position:-${Math.round((crop[0] / crop[2]) * width)}px -${Math.round((crop[1] / crop[2]) * width)}px"></div></div>`;
// Install mode keeps the card on the right: that view is shown whole, the card in it.
const whole = (f, caption) => `<div><div style="font-size:24px;padding:4px 0;color:#1d3b2a">${caption}</div>
  <img src="${data(f)}" style="width:${width}px;border:2px solid #333;display:block"></div>`;
const VIEWS = ["默认视角", "俯视", "安装模式，飞近组合烤箱"];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const r of rooms) {
  const [o, n] = ["old", "new"].map((b) => records.find((x) => x.tag === r.tag && x.build === b));
  const a = r.arrangement;
  const title = `${r.tag.slice(0, 2)}　咖啡机在${a.coffeeLeg === "back" ? "后段" : "左段"}，烤箱塔朝${a.towerSide === "left" ? "左" : "右"}，${a.cornerType === "blind" ? "盲角柜" : "转盘柜"}，冰箱靠${a.fridgeEndAbuts === "wall" ? "墙" : "柜"}，岛台${a.islandOrientation === "parallel" ? "平行" : "垂直"}，墙 ${r.walls[0]}″ × ${r.walls[1]}″`;
  const rowsSaid = (x) => (x.rows.length ? x.rows.join("；") : "（清单里没有组合烤箱的接点）");
  const html = `<html><body style="margin:0;background:#fff;font-family:'Microsoft YaHei','PingFang SC',sans-serif">
  <div style="font-size:28px;font-weight:600;padding:14px 20px 2px">${title}</div>
  <div style="font-size:22px;padding:2px 20px 6px;color:#333">清单，改前：${rowsSaid(o)}<br>清单，改后：${rowsSaid(n)}</div>
  <div style="display:grid;grid-template-columns:repeat(2,${width}px);gap:14px;padding:8px 20px 20px">
  ${[0, 1, 2].map((v) => [o, n].map((x) => (v === 2 ? whole : panel)(x.files[v], `${x.build === "old" ? "改前（线上 7200b1e）" : "改后"} · ${VIEWS[v]}`)).join("")).join("")}</div></body></html>`;
  await page.setViewportSize({ width: width * 2 + 14 + 40, height: 600 });
  await page.setContent(html);
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(sheets, `${r.tag}.png`), fullPage: true });
}
await browser.close();
for (const x of records) {
  const bad = x.labels.filter((l) => !l.ok).map((l) => l.text);
  console.log(`${x.tag} ${x.build} | errors ${x.errors.length ? x.errors.join(" | ") : "none"}${x.notice ? ` | notice: ${x.notice}` : ""} | labels ${x.labels.length}, not seen or not clickable: ${bad.join("; ") || "none"} | rows: ${x.rows.join(" ; ") || "none"}`);
}
