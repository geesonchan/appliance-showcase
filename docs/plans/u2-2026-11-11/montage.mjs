// Screenshots side by side, each with its name over it, into one PNG: for
// comparing a machine across packages and shapes at a glance.
//   node docs/plans/u2-2026-11-11/montage.mjs <out.png> <columns> <crop x,y,w,h | full> <title> <png[::caption]>...
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { chromium } from "playwright";

const [outFile, columns, crop, title, ...files] = process.argv.slice(2);
const [cx, cy, cw, ch] = crop === "full" ? [0, 0, 1440, 900] : crop.split(",").map(Number);
const cell = 440;
const scale = cell / cw;
const tiles = files
  .map((arg) => {
    const [f, caption] = arg.split("::");
    const data = readFileSync(resolve(f)).toString("base64");
    return `<figure><figcaption>${caption ?? basename(f, ".png")}</figcaption><div class="crop" style="width:${cell}px;height:${Math.round(ch * scale)}px"><img src="data:image/png;base64,${data}" style="transform:scale(${scale});left:${-cx * scale}px;top:${-cy * scale}px"></div></figure>`;
  })
  .join("");
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#fff;font:14px system-ui,"Microsoft YaHei",sans-serif}
h1{font-size:18px;margin:0 0 10px}
main{display:grid;grid-template-columns:repeat(${columns},${cell}px);gap:10px}
figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}
.crop{position:relative;overflow:hidden;border:1px solid #ccc}
.crop img{position:absolute;transform-origin:0 0}
</style><h1>${title}</h1><main>${tiles}</main>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(columns) * (cell + 10) + 24, height: 400 } });
await page.setContent(html);
await page.screenshot({ path: resolve(outFile), fullPage: true });
await browser.close();
