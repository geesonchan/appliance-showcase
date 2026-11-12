// The U's new order, drawn to scale from the probe's figures (uOrderProbe.ts):
// for each package, the U as it is now, the new order with the pantry cabinet
// kept and without it, side by side; the cooking surface and the oven tower
// called out. A sketch from the generator's numbers, not a screenshot.
//   node docs/plans/u-order-2026-11-11/planSketch.mjs <out folder>
// or one package with the variants named (probe-<name>.json, title after =):
//   node docs/plans/u-order-2026-11-11/planSketch.mjs <out folder> <code> <file tag> <name=title>...
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? here);
mkdirSync(out, { recursive: true });
const probe = (name) => JSON.parse(readFileSync(resolve(here, `probe-${name}.json`), "utf8"));
const [, , , onlyCode, fileTag, ...named] = process.argv;
const VARIANTS = onlyCode
  ? named.map((pair) => pair.split("="))
  : [
      ["now", "现在（U-2）"],
      ["keep", "新排法 · 留储物高柜"],
      ["none", "新排法 · 不留储物高柜"],
    ];
const data = Object.fromEntries(VARIANTS.map(([v]) => [v, probe(v)]));

const PX = 3.2; // pixels to the inch
const DEPTH = { base: 24, tall: 24 };

/** One item of a leg, read off the probe's line: `range 36" [B36]`. */
function item(line, code) {
  const m = line.match(/^(\S+) ([\d.]+)" \[(.*)\]$/);
  const [, what, w, codes] = m;
  const width = Number(w);
  const tallCode = /^T\d/.test(codes);
  let label;
  let kind;
  if (what === "corner") [label, kind] = ["转角", "corner"];
  else if (what === "counter") [label, kind] = [width < 3 ? "" : "台面", "counter"];
  else if (what === "tall" && width < 1) [label, kind] = ["", "panel"];
  else if (what === "tall") [label, kind] = ["储物高柜", "pantry"];
  else if (what === "fridge") [label, kind] = ["冰箱", "cold"];
  else if (what === "freezer") [label, kind] = ["冷冻柱", "cold"];
  else if (what === "wine") [label, kind] = ["酒柜柱", "cold"];
  else if (what === "coffee") [label, kind] = ["咖啡塔", "coffee"];
  else if (what === "range") [label, kind] = [code === "D" || code === "B" ? "炉头" : "灶", "cook"];
  else if (what === "cooktop") [label, kind] = ["灶", "cook"];
  else if (what === "oven") [label, kind] = ["烤箱塔", "oven"];
  else if (what === "microwave") [label, kind] = tallCode ? ["烤箱塔", "oven"] : ["微波抽屉", "spare"];
  else if (what === "dishwasher") [label, kind] = ["洗碗机", "dw"];
  else if (what === "fixture-sink") [label, kind] = ["水槽", "sink"];
  else [label, kind] = [what, "spare"];
  return { label, kind, width, codes };
}

const FILL = {
  corner: "#d9d4c7",
  counter: "#efe9dc",
  panel: "#555",
  pantry: "#9bb7d4",
  cold: "#b9d7ea",
  coffee: "#c8a27a",
  cook: "#e8a19a",
  oven: "#f0b35b",
  spare: "#cfe3c4",
  dw: "#d0d0d0",
  sink: "#9fd0f0",
};
const tallKinds = new Set(["pantry", "cold", "coffee", "oven", "panel"]);

/** One U at its own walls, top-left at (x0, y0); returns its SVG. */
function drawU(code, variant, title, x0, y0) {
  const r = data[variant][code];
  const W = r.walls.backWallIn;
  const H = r.walls.leftWallIn;
  const s = (inches) => inches * PX;
  const parts = [];
  parts.push(`<text x="${x0 + s(W) / 2}" y="${y0 - 52}" font-size="17" font-weight="bold" text-anchor="middle">${title}</text>`);
  parts.push(`<text x="${x0 + s(W) / 2}" y="${y0 - 30}" font-size="14" text-anchor="middle" fill="#333">后墙 ${W}"，左右墙 ${H}"</text>`);
  // Walls: the back and the two sides.
  parts.push(`<path d="M${x0} ${y0 + s(H)} V${y0} H${x0 + s(W)} V${y0 + s(H)}" fill="none" stroke="#222" stroke-width="6"/>`);
  const box = (x, y, w, h, it) => {
    const tall = tallKinds.has(it.kind);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FILL[it.kind]}" stroke="#333" stroke-width="${tall ? 1.5 : 0.8}"/>`);
  };
  const say = (x, y, text, size = 12, rotate = 0, weight = "normal") =>
    parts.push(
      `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="middle" dominant-baseline="middle"${rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : ""}>${text}</text>`,
    );
  const leg = (name) => r.legs[name].map((line) => item(line, code));
  // Left leg: along the left wall, from the back wall down.
  let at = 0;
  for (const it of leg("left")) {
    const d = tallKinds.has(it.kind) ? DEPTH.tall : DEPTH.base;
    box(x0, y0 + s(at), s(d), s(it.width), it);
    if (it.label) say(x0 + s(d) / 2, y0 + s(at + it.width / 2), `${it.label} ${it.width}"`, it.width < 16 ? 9 : 11, -90);
    at += it.width;
  }
  // Right leg: along the right wall, from the back wall down.
  at = 0;
  const marks = {};
  for (const it of leg("right")) {
    const d = tallKinds.has(it.kind) ? DEPTH.tall : DEPTH.base;
    box(x0 + s(W - d), y0 + s(at), s(d), s(it.width), it);
    if (it.label) say(x0 + s(W - d / 2), y0 + s(at + it.width / 2), `${it.label} ${it.width}"`, it.width < 16 ? 9 : 11, 90);
    if (it.kind === "cook") marks.cook = at + it.width / 2;
    if (it.kind === "oven") marks.oven = at + it.width / 2;
    if (it.kind === "counter" && it.width >= 30 && variant.startsWith("d-")) marks.slack = at + it.width / 2;
    if (it.kind === "counter" && variant === "d-tower" && at > 100 && it.width === 15) marks.slack = at + it.width / 2;
    at += it.width;
  }
  // Back leg: between the two corner boxes' depth.
  at = DEPTH.base;
  for (const it of leg("back")) {
    box(x0 + s(at), y0, s(it.width), s(DEPTH.base), it);
    if (it.label) say(x0 + s(at + it.width / 2), y0 + s(DEPTH.base / 2), `${it.label}`, 10);
    at += it.width;
  }
  // Where the cooking surface and the oven tower are: arrows from the middle.
  const callout = (along, text, colour) => {
    const yy = y0 + s(along);
    const xx = x0 + s(W - DEPTH.base) - 8;
    parts.push(`<line x1="${xx - 50}" y1="${yy}" x2="${xx}" y2="${yy}" stroke="${colour}" stroke-width="2.5" marker-end="url(#arr)"/>`);
    parts.push(`<text x="${xx - 54}" y="${yy}" font-size="13" font-weight="bold" fill="${colour}" text-anchor="end" dominant-baseline="middle">${text}</text>`);
  };
  const cookName = code === "E" ? "灶" : "炉头";
  if (marks.cook !== undefined) callout(marks.cook, variant === "now" ? cookName : `${cookName}：转角这一头（靠水槽）`, "#b03a2e");
  if (marks.slack !== undefined) callout(marks.slack, "多出的 15\"", "#2e7d32");
  if (marks.oven !== undefined) callout(marks.oven, "烤箱塔：开放端", "#b06a00");
  // The stone's pieces, as the probe lists them: left, back, then the right
  // leg's from the corner.
  parts.push(`<text x="${x0 + s(W) / 2}" y="${y0 + s(H) + 28}" font-size="13" text-anchor="middle" fill="#333">石板：${r.stone.map((p) => `${p}"`).join(" / ")}</text>`);
  return parts.join("\n");
}

function sheet(code, variants) {
  const gap = 300;
  const maxH = Math.max(...variants.map(([v]) => data[v][code].walls.leftWallIn));
  const width = variants.length * (132 * PX + gap) + 40;
  const height = maxH * PX + 200;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Microsoft YaHei, PingFang SC, sans-serif">
<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>
<rect width="100%" height="100%" fill="#fff"/>
<text x="20" y="30" font-size="20" font-weight="bold">${code} · U 型俯视示意（按比例，从生成器的数字画的，不是页面截图；新排法是原型）</text>`;
  variants.forEach(([v, title], i) => {
    svg += drawU(code, v, title, 40 + gap * 0.75 + i * (132 * PX + gap), 120);
  });
  svg += "</svg>";
  return { svg, width, height };
}

const browser = await chromium.launch();
for (const code of onlyCode ? [onlyCode] : ["A", "B", "C", "D", "E"]) {
  const variants = !onlyCode && (code === "A" || code === "C") ? [["now", "现在 = 新排法（没有烤箱塔，不变）"]] : VARIANTS;
  const { svg, width, height } = sheet(code, variants);
  writeFileSync(resolve(out, `plan-${code}${fileTag ? `-${fileTag}` : ""}.svg`), svg);
  const page = await browser.newPage({ viewport: { width: Math.ceil(width), height: Math.ceil(height) } });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: resolve(out, `plan-${code}${fileTag ? `-${fileTag}` : ""}.png`) });
  await page.close();
}
await browser.close();
console.log("drawn");
