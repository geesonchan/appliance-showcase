// Item 10's before and after page: the notice a package switch shows, old build (1ea029b) beside the
// new, from walk.mjs's pictures, on a desktop at 1440 (the notice as the page draws it, at twice its
// pixels for a phone to read).
//   node docs/plans/item10-2026-11-13/sheet.mjs <walk folder> <out file>
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
const [dir, out] = process.argv.slice(2);
const ROWS = [
  ["desktop-zh-L-AD", "L 型 A→D，中文"],
  ["desktop-zh-L-AB", "L 型 A→B，中文（左墙没变）"],
  ["desktop-en-L-AB", "L 型 A→B，英文"],
  ["desktop-zh-one-wall-CA", "一字型 C→A，中文（改前不弹）"],
  ["desktop-en-one-wall-CB", "一字型 C→B，英文"],
  ["desktop-zh-U-BA", "U 型 B→A，中文（改前不弹）"],
];
const img = (tag, name) => {
  const f = resolve(dir, `${tag}-${name}.png`);
  return existsSync(f) ? `<img src="data:image/png;base64,${readFileSync(f).toString("base64")}" style="zoom:2;image-rendering:auto">` : `<div style="font-size:26px;color:#888;padding:12px">（不弹提示）</div>`;
};
const html = `<html><body style="margin:0;padding:24px;background:#fff;font-family:'Microsoft YaHei',sans-serif">
<div style="font-size:34px;font-weight:600;padding-bottom:16px">第 10 项：换套餐的提示，改前（线上 1ea029b）和改后（本地）</div>
<table style="border-collapse:collapse">${ROWS.map(([name, caption]) => `<tr><td colspan=2 style="font-size:28px;padding:18px 0 6px;color:#1d3b2a">${caption}</td></tr>
<tr><td style="padding:6px 24px 6px 0;vertical-align:top"><div style="font-size:22px;color:#666">改前</div>${img("old", name)}</td>
<td style="padding:6px 0;vertical-align:top"><div style="font-size:22px;color:#666">改后</div>${img("new", name)}</td></tr>`).join("")}</table></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2400, height: 800 } });
await p.setContent(html);
await p.waitForTimeout(400);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log("sheet written");
