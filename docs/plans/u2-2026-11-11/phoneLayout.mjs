// U-2, A's proof on the phone (Leo, 2026-11-11: 「手机因为多一行按钮画面变矮，逐个状态列出
// 标签、图钉、弹出卡在不在画面里、有没有被挡」), and the desktop's model card against
// the top bar. The pixel proof's ten phone states — each package on a 390 phone
// in English and a 360 phone in Chinese, by touch — and on a 1440 desktop each
// package by the mouse; in each, by its box on screen: every pin's label and
// dot, whether it is inside the 3D view and whether it shares any area with the
// top bar (both rows) or with another label; then the refrigerator's pin tapped
// (clicked) and the model card the same way.
//   node docs/plans/u2-2026-11-11/phoneLayout.mjs <build folder> <out.json>
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, outFile] = process.argv.slice(2);
const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const PKGS = ["A", "B", "C", "D", "E"];
const results = [];

const measure = (page) =>
  page.evaluate(() => {
    const box = (e) => {
      const r = e.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10);
    };
    const shown = (e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && r.width > 0 && r.height > 0;
    };
    const header = document.querySelector("header");
    const canvas = document.querySelector("canvas");
    const pins = [];
    for (const e of document.querySelectorAll("[data-pin-label], [data-pin-dot]")) {
      if (!shown(e)) continue;
      pins.push({ kind: e.hasAttribute("data-pin-label") ? "label" : "dot", slot: e.getAttribute("data-pin-label") ?? e.getAttribute("data-pin-dot"), box: box(e) });
    }
    const card = document.querySelector("[data-model-card]");
    return {
      header: box(header),
      canvas: box(canvas),
      pins,
      card: card && shown(card) ? box(card) : null,
    };
  });

const overlap = (a, b) =>
  Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]) > 0.01 && Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]) > 0.01;
const inside = (a, c) => a[0] >= c[0] - 0.01 && a[1] >= c[1] - 0.01 && a[0] + a[2] <= c[0] + c[2] + 0.01 && a[1] + a[3] <= c[1] + c[3] + 0.01;

function judge(m) {
  const labels = m.pins.filter((p) => p.kind === "label");
  const dots = m.pins.filter((p) => p.kind === "dot");
  const labelPairs = [];
  for (let i = 0; i < labels.length; i += 1)
    for (let j = i + 1; j < labels.length; j += 1) if (overlap(labels[i].box, labels[j].box)) labelPairs.push(`${labels[i].slot}×${labels[j].slot}`);
  return {
    labels: labels.length,
    dots: dots.length,
    outOfView: m.pins.filter((p) => !inside(p.box, m.canvas)).map((p) => `${p.kind}:${p.slot}`),
    underHeader: m.pins.filter((p) => overlap(p.box, m.header)).map((p) => `${p.kind}:${p.slot}`),
    labelOverLabel: labelPairs,
  };
}

const STATES = [
  ...[[390, "en"], [360, "zh"]].flatMap(([width, lang]) => PKGS.map((p) => ({ device: "phone", width, lang, p }))),
  ...PKGS.map((p) => ({ device: "desktop", width: 1440, lang: "en", p })),
];
for (const st of STATES) {
  const phone = st.device === "phone";
  const context = await browser.newContext(
    phone ? { viewport: { width: st.width, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/?quality=high&qualityLock=1`);
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);
  const press = async (locator) => {
    const b = await locator.first().boundingBox({ timeout: 5000 });
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(1500);
  };
  if (st.lang === "zh") await press(page.locator("header button", { hasText: "中" }));
  if (st.p !== "A") await press(page.locator(`[data-segment=package] button[data-value=package-${st.p.toLowerCase()}]`));
  const opened = await measure(page);
  await press(page.locator("[data-pin-label=slot-fridge]"));
  await page.waitForTimeout(1200);
  const carded = await measure(page);
  const card = carded.card;
  results.push({
    state: `${st.device}${st.width}-${st.lang}-${st.p}`,
    header: opened.header[3],
    canvas: opened.canvas,
    ...judge(opened),
    card: card
      ? { box: card, inScreen: inside(card, [0, 0, st.width, phone ? 844 : 900]), overHeader: overlap(card, opened.header) }
      : null,
    errors: errors.join(" | "),
  });
  await context.close();
}
await browser.close();
writeFileSync(outFile, JSON.stringify(results, null, 1));
for (const r of results)
  console.log(
    `${r.state} | header ${r.header} | view ${r.canvas[1]}+${r.canvas[3]} | labels ${r.labels} dots ${r.dots} | out of view ${r.outOfView.join(",") || "none"} | under the bar ${r.underHeader.join(",") || "none"} | label over label ${r.labelOverLabel.join(",") || "none"} | card ${r.card ? `${r.card.inScreen ? "on screen" : "OFF SCREEN"}, ${r.card.overHeader ? "OVER THE BAR" : "clear of the bar"}` : "none"} | ${r.errors || "no errors"}`,
  );
