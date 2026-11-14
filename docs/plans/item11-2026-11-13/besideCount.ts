// Item 14's question 7, read only (2026-11-13): in how many of E's rooms the coffee tower stands
// beside the combination oven tower (nothing between but boards), in the L, on one wall and in
// the U — roomSets' rooms, each built as the dumps build it.
//   ROOT=<tree> npx vite-node docs/plans/item11-2026-11-13/besideCount.ts
const ROOT = process.env.ROOT ?? process.cwd();
const M = (p: string) => import(`${ROOT}/src/${p}`);
const m = {
  packages: await M("data/packages.ts"),
  layoutState: await M("data/layoutState.ts"),
  room: await M("data/room.ts"),
  candidates: await M("data/candidates.ts"),
  catalogue: await M("data/catalogue.ts"),
  testRoom: await M("data/testRoom.ts"),
  layoutTemplate: await M("data/layoutTemplate.ts"),
};
const sets = await M("data/roomSets.ts");
for (const [shape, fn] of [["L", "lRooms"], ["one wall", "oneWallRooms"], ["U", "uRooms"]] as const) {
  if (!sets[fn]) { console.log(`${shape}: no ${fn}`); continue; }
  let built = 0, beside = 0;
  for (const c of sets[fn](m).filter((c: any) => c.pkg.code === "E" && !c.label.includes("swap"))) {
    if (!c.build().ok) continue;
    built += 1;
    const found = m.room.RUNS.some((run: any) => {
      const segs = run.segments;
      const t = segs.findIndex((s: any) => s.slot === "slot-microwave");
      const k = segs.findIndex((s: any) => s.slot === "slot-coffee");
      if (t < 0 || k < 0) return false;
      const [a, b] = t < k ? [t, k] : [k, t];
      return segs.slice(a + 1, b).every((s: any) => s.kind === "tall" && !s.slot && (s.to - s.from) * 12 <= 1);
    });
    if (found) beside += 1;
  }
  console.log(`${shape}: E's rooms built ${built}; the coffee tower beside the combination oven tower ${beside}`);
}
