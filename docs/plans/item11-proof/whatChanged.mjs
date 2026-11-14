// Item 11: in each L room that really changed (dumpDiff.mjs), which parts of the record differ —
// the path cut to its first three steps, array positions as [] — grouped over the rooms; and per
// room the walls, the back leg's first pieces and the oven's power point, old and new.
//   node docs/plans/item11-proof/whatChanged.mjs <old.jsonl> <new.jsonl>
import { readFileSync } from "node:fs";
const [a, b] = process.argv.slice(2).map((f) => readFileSync(f, "utf8").split("\n").filter(Boolean));
const isMem = (o) => o && typeof o === "object" && typeof o.note === "string" && o.note.includes("(§5.6, mem301ws-manual.png)");
const clean = (o) => { const c = JSON.parse(JSON.stringify(o)); const w = (v) => { if (!v || typeof v !== "object") return; if (isMem(v)) { delete v.note; delete v.whenNoCabinet; } for (const k of Object.keys(v)) w(v[k]); }; w(c); return c; };
const groups = new Map();
const rows = [];
for (let i = 0; i < a.length; i += 1) {
  if (a[i] === b[i]) continue;
  const x = clean(JSON.parse(a[i])), y = clean(JSON.parse(b[i]));
  if (JSON.stringify(x) === JSON.stringify(y)) continue;
  const paths = new Set();
  const walk = (p, u, v, depth) => {
    if (JSON.stringify(u) === JSON.stringify(v)) return;
    if (depth < 3 && u && v && typeof u === "object" && typeof v === "object")
      for (const k of new Set([...Object.keys(u), ...Object.keys(v)])) walk(`${p}.${Array.isArray(u) ? "[]" : k}`, u[k], v[k], depth + 1);
    else paths.add(p);
  };
  walk("", x, y, 0);
  const key = [...paths].sort().join("  ");
  groups.set(key, (groups.get(key) ?? 0) + 1);
  const run = (o, id) => (o.room.runs ?? o.room.layout?.runs ?? []).find?.((r) => r.id === id);
  const pieces = (o) => { const r = run(o, "back"); return r ? r.segments.filter((s) => (s.to - s.from) * 12 > 1).slice(0, 3).map((s) => `${s.kind} ${Math.round((s.to - s.from) * 1200) / 100}`).join(", ") : "?"; };
  const oven = (o) => (o.room.points ?? []).filter((p) => p.key?.includes("slot-microwave")).map((p) => `${p.resolved.noCabinet ? "no cabinet, " : ""}${p.resolved.host?.id ?? ""}`).join("; ") || "(none)";
  const walls = (o) => JSON.stringify(o.room.params ? [o.room.params.backWallIn, o.room.params.leftWallIn] : o.room.walls ?? "?");
  rows.push(`${x.label}\n    walls ${walls(x)} -> ${walls(y)}\n    back leg from the corner: ${pieces(x)} -> ${pieces(y)}\n    oven power point: ${oven(x)} -> ${oven(y)}`);
}
for (const [k, n] of groups) console.log(`${n} rooms differ in: ${k}`);
for (const r of rows) console.log(r);
