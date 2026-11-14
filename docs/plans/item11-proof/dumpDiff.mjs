// Item 11's dumps, old (7200b1e) against new, room by room (each line of a dump is a room).
// Sorted into: rooms the same; rooms whose only difference is MEM301WS's power point record —
// its note (the conduit 60" to 50", Leo 2026-11-13: 「数据里 MEM301WS 软管 60″ 改成 50″」) and/or its
// new `whenNoCabinet` (the drawer under the opening) — each counted on its own; and rooms that
// really differ, with the keys that differ.
//   node docs/plans/item11-proof/dumpDiff.mjs <old.jsonl> <new.jsonl>
import { readFileSync } from "node:fs";
const [a, b] = process.argv.slice(2).map((f) => readFileSync(f, "utf8").split("\n").filter(Boolean));
// MEM301WS's power point, wherever the dump records it: its note names the manual's picture.
const isMem = (o) => o && typeof o === "object" && typeof o.note === "string" && o.note.includes("(§5.6, mem301ws-manual.png)");
const strip = (what) => (o) => {
  const copy = JSON.parse(JSON.stringify(o));
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    if (isMem(v)) {
      if (what.includes("note")) delete v.note;
      if (what.includes("way")) delete v.whenNoCabinet;
    }
    for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(copy);
  return copy;
};
const same = (x, y, f) => JSON.stringify(f(x)) === JSON.stringify(f(y));
let identical = 0, noteOnly = 0, wayOnly = 0, both = 0;
const real = [];
for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
  if (a[i] === b[i]) { identical += 1; continue; }
  const x = JSON.parse(a[i]), y = JSON.parse(b[i]);
  if (same(x, y, strip(["note"]))) { noteOnly += 1; continue; }
  if (same(x, y, strip(["way"]))) { wayOnly += 1; continue; }
  if (same(x, y, strip(["note", "way"]))) { both += 1; continue; }
  const sx = strip(["note", "way"])(x), sy = strip(["note", "way"])(y);
  const keys = Object.keys({ ...sx, ...sy }).filter((k) => JSON.stringify(sx[k]) !== JSON.stringify(sy[k]));
  real.push(`${x.label ?? x.case ?? i}: ${keys.join(", ")}`);
}
console.log(`${a.length} rooms old, ${b.length} new; the same ${identical}; only MEM301WS's point record: the note alone ${noteOnly}, whenNoCabinet alone ${wayOnly}, both ${both}; really different ${real.length}`);
for (const r of real) console.log("  " + r.slice(0, 260));
