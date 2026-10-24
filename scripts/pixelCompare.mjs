/**
 * The pixel proof's comparison (D17): the old build against the new, each shot
 * twice (`scripts/pixelShots.mjs`). For each state the canvas alone must be
 * the same in the closest pairing of runs; on the whole screen every pixel that
 * differs must lie inside a text that differs (its own box, old or new) or on
 * a pin's leader line that moved. Each line also gives each build's own two
 * runs against each other (old/old, new/new). Writes a diff image per state
 * that differs, and a JSON report. Moved here from the rounds' scratch folders
 * in round 100.
 *
 *   node scripts/pixelCompare.mjs <old 1> <old 2> <new 1> <new 2> <out folder>
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const [o1, o2, n1, n2, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const names = readdirSync(o1).filter((f) => f.endsWith(".png") && !f.endsWith(".canvas.png")).map((f) => f.slice(0, -4)).sort();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<canvas></canvas>");
const url = (dir, file) => `data:image/png;base64,${readFileSync(`${dir}/${file}`).toString("base64")}`;
const record = (dir, name) => JSON.parse(readFileSync(`${dir}/${name}.texts.json`, "utf8"));
const texts = (dir, name) => record(dir, name).found;
/** The leader lines in one run and not in the other: a line that moved, at either end of its move. */
const movedLines = (a, b) => { const k = (l) => l.join(","); const ka = new Set(a.map(k)), kb = new Set(b.map(k)); return [...a.filter((l) => !kb.has(k(l))), ...b.filter((l) => !ka.has(k(l)))]; };

/** Pixels that differ, and how many of them fall outside the given boxes; a diff image when asked. */
async function diff(a, b, boxes = [], writeImage = false, lines = []) {
  return page.evaluate(
    async ({ a, b, boxes, writeImage, lines }) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = ia.width, h = ia.height;
      if (w !== ib.width || h !== ib.height) return { size: true };
      const read = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const da = read(ia), db = read(ib);
      const near = (x, y, [x1, y1, x2, y2]) => { const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0; return Math.hypot(x - x1 - t * dx, y - y1 - t * dy) <= 2; };
      const inside = (x, y) => boxes.some(([bx, by, bw, bh]) => x >= bx - 2 && x <= bx + bw + 2 && y >= by - 2 && y <= by + bh + 2) || lines.some((l) => near(x, y, l));
      const out = writeImage ? new ImageData(w, h) : null;
      let count = 0, outside = 0;
      const outsideAt = [];
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (out) { const g = (db[i] + db[i + 1] + db[i + 2]) / 3; out.data[i] = out.data[i + 1] = out.data[i + 2] = g * 0.35 + 160; out.data[i + 3] = 255; }
        if (d === 0) continue;
        count++;
        const p = i / 4, x = p % w, y = (p - x) / w;
        const ok = inside(x, y);
        if (!ok) { outside++; if (outsideAt.length < 5) outsideAt.push([x, y]); }
        if (out) { out.data[i] = ok ? 230 : 0; out.data[i + 1] = 0; out.data[i + 2] = ok ? 0 : 230; }
      }
      let png = null;
      if (out && count > 0) {
        const c = new OffscreenCanvas(w, h);
        const x = c.getContext("2d");
        x.putImageData(out, 0, 0);
        x.strokeStyle = "rgba(0,160,0,0.9)";
        for (const [bx, by, bw, bh] of boxes) x.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
        const bytes = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
        let s = "";
        for (let k = 0; k < bytes.length; k += 32768) s += String.fromCharCode(...bytes.subarray(k, k + 32768));
        png = btoa(s);
      }
      return { count, outside, outsideAt, png };
    },
    { a, b, boxes, writeImage, lines },
  );
}

/** The texts that differ between two runs: in one and not at the same place in the other. */
function changedTexts(oldTexts, newTexts) {
  const key = (t) => `${t.t}@${t.rects.map((r) => r.join(",")).join(";")}`;
  const ko = new Set(oldTexts.map(key));
  const kn = new Set(newTexts.map(key));
  const gone = oldTexts.filter((t) => !kn.has(key(t)));
  const came = newTexts.filter((t) => !ko.has(key(t)));
  const overlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  const changes = [];
  for (const g of gone) {
    const to = came.filter((c) => overlap(c.box, g.box));
    changes.push({ from: g.t, to: to.map((c) => c.t).join(" | ") || "(nothing there now)", at: g.box });
  }
  for (const c of came) if (!gone.some((g) => overlap(g.box, c.box))) changes.push({ from: "(nothing there before)", to: c.t, at: c.box });
  const boxes = [...gone, ...came].flatMap((t) => [t.box, ...t.rects]);
  return { changes, boxes };
}

const report = [];
for (const name of names) {
  // The canvas alone: the closest pairing between builds, and each build against itself.
  const canvas = async (a, b) => (await diff(url(a, `${name}.canvas.png`), url(b, `${name}.canvas.png`))).count;
  const canvasOO = await canvas(o1, o2);
  const canvasNN = await canvas(n1, n2);
  const pairings = [[o1, n1], [o1, n2], [o2, n1], [o2, n2]];
  const canvasCross = [];
  for (const [a, b] of pairings) canvasCross.push(await canvas(a, b));
  // Among the pairings whose canvas is closest, the one closest on the whole
  // screen outside the changed texts and their leaders (D17: runs in the same state).
  const lowest = Math.min(...canvasCross);
  let chosen = null;
  for (const [i, [oa, nb]] of pairings.entries()) {
    if (canvasCross[i] !== lowest) continue;
    const { changes, boxes } = changedTexts(texts(oa, name), texts(nb, name));
    const lines = movedLines(record(oa, name).leaders, record(nb, name).leaders);
    const whole = await diff(url(oa, `${name}.png`), url(nb, `${name}.png`), boxes, false, lines);
    if (!chosen || whole.outside < chosen.whole.outside) chosen = { i, oa, nb, changes, boxes, lines, whole };
  }
  const { i: best, oa, nb, changes, boxes, lines } = chosen;
  const whole = await diff(url(oa, `${name}.png`), url(nb, `${name}.png`), boxes, true, lines);
  const screenOO = (await diff(url(o1, `${name}.png`), url(o2, `${name}.png`))).count;
  const screenNN = (await diff(url(n1, `${name}.png`), url(n2, `${name}.png`))).count;
  if (whole.png) writeFileSync(`${outDir}/${name}.diff.png`, Buffer.from(whole.png, "base64"));
  report.push({ name, screenOO, screenNN, pairing: [oa, nb].map((d) => d.split(/[/]/).pop()), canvasOO, canvasNN, canvasBest: canvasCross[best], screen: whole.count, outsideChangedText: whole.outside, outsideAt: whole.outsideAt, movedLeaders: lines.length / 2, changes });
  console.log(`${name}: canvas ${canvasCross[best]} (old/old ${canvasOO}, new/new ${canvasNN}); screen ${whole.count} (old/old ${screenOO}, new/new ${screenNN}), outside changed text and moved leaders ${whole.outside}; ${changes.length} text changes, ${lines.length / 2} leaders moved`);
}
await browser.close();
writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 1));
