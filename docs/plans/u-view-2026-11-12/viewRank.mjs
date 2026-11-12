// The view table read (viewTable.mjs's json): per direction, pitch and board, each
// package's labels shown and clickable of all, which are not, and the fronts seen
// (a front "seen" at half its points or more); then the combinations where every
// package shows every label, ranked by the fronts seen over the five packages (the
// count of fronts seen, then how much of them shows: the part not blocked times how
// square on the face is to the camera, 100 face on, 0 edge on).
//   node docs/plans/u-view-2026-11-12/viewRank.mjs <table json> [more json...]
import { readFileSync } from "node:fs";

const rows = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
const key = (r) => `${r.board}|${r.az}|${r.pitch}`;
const groups = new Map();
for (const r of rows) {
  if (!groups.has(key(r))) groups.set(key(r), []);
  groups.get(key(r)).push(r);
}
const seen = (v) => v !== null && v >= 50;
const summary = [...groups.values()].map((g) => {
  const fronts = g.flatMap((r) => [r.fronts.cooking, r.fronts.hood, r.fronts.tower].filter((v) => v !== null));
  // How much of each front shows: the part not blocked times how square on it is.
  const shows = g.flatMap((r) => ["cooking", "hood", "tower"].filter((k) => r.fronts[k] !== null).map((k) => (r.fronts[k] * (r.square?.[k] ?? 100)) / 100));
  return {
    board: g[0].board,
    az: g[0].az,
    pitch: g[0].pitch,
    allLabels: g.every((r) => r.shown === r.total),
    labels: g.map((r) => `${r.code} ${r.shown}/${r.total}${r.hiddenSlots.length ? " (" + r.hiddenSlots.join(", ") + ")" : ""}`),
    frontsSeen: fronts.filter(seen).length,
    frontsOf: fronts.length,
    frontsMean: Math.round(fronts.reduce((a, b) => a + b, 0) / fronts.length),
    showsMean: Math.round(shows.reduce((a, b) => a + b, 0) / shows.length),
    fronts: g.map((r) => `${r.code} 灶${r.fronts.cooking}(${r.square?.cooking ?? "?"}) 罩${r.fronts.hood ?? "-"}(${r.square?.hood ?? "-"}) 塔${r.fronts.tower ?? "-"}(${r.square?.tower ?? "-"})`),
  };
});
for (const s of summary) {
  console.log(`${s.board} ${s.az}°/${s.pitch}° | labels all: ${s.allLabels} | fronts ${s.frontsSeen}/${s.frontsOf} mean ${s.frontsMean}% shows ${s.showsMean}%`);
  for (let i = 0; i < s.labels.length; i += 1) console.log(`   ${s.labels[i]} | ${s.fronts[i]}`);
}
const ranked = summary.filter((s) => s.allLabels).sort((a, b) => b.frontsSeen - a.frontsSeen || b.showsMean - a.showsMean);
console.log(`\nEvery label in every package: ${ranked.length} of ${summary.length}`);
for (const s of ranked) console.log(`${s.board} ${s.az}°/${s.pitch}° fronts ${s.frontsSeen}/${s.frontsOf} mean ${s.frontsMean}% shows ${s.showsMean}%`);
