// Throwaway: item 11's pictures made small for the commit (Leo, 2026-11-13: 合计 2 MB 以内，手机上还能看清柜子分界).
// Each picture scaled to at most MAXW wide and saved as JPEG at quality Q; the originals untouched.
//   MAXW=1133 Q=0.55 node docs/plans/item11-2026-11-13/shrink.mjs <out folder> <png>...
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { chromium } from "playwright";
const [out, ...files] = process.argv.slice(2);
const maxW = Number(process.env.MAXW ?? 1133), q = Number(process.env.Q ?? 0.6);
const b = await chromium.launch();
const p = await b.newPage();
let total = 0;
for (const f of files) {
  const src = `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  const data = await p.evaluate(async ([src, maxW, q]) => {
    const img = new Image(); img.src = src; await img.decode();
    const w = Math.min(maxW, img.width), h = Math.round((img.height * w) / img.width);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    return [c.toDataURL("image/jpeg", q), w, h];
  }, [src, maxW, q]);
  const buf = Buffer.from(data[0].split(",")[1], "base64");
  const to = join(out, relative("docs/plans/item11-2026-11-13", f)).replace(/\.png$/, ".jpg");
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, buf);
  total += buf.length;
  console.log(`${to} ${data[1]}x${data[2]} ${buf.length}`);
}
console.log(`total ${total}`);
await b.close();
