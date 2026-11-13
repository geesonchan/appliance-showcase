// For item 10's plan (2026-11-13): after each package switch, in the L, one wall and the U, the
// store's walls (what the Layout tab's sliders show and the next panel change builds from)
// against the room built (LAYOUT_PARAMS); 5 x 4 switches a shape, each from the room the
// package before it opens in that shape.
//   ROOT=<tree> npx vite-node docs/plans/u-view-2026-11-12/storeVsBuiltProbe.ts
const ROOT = process.env.ROOT ?? process.cwd();
const M = (p: string) => import(`${ROOT}/src/${p}`);
const { useAppStore } = await M("store/useAppStore.ts");
const testRoom = await M("data/testRoom.ts");
const hoodMount = await M("data/hoodMount.ts");
const catalogue = await M("data/catalogue.ts");
const packages = await M("data/packages.ts");
const room = await M("data/room.ts");
const OPENED = useAppStore.getState();
const s = () => useAppStore.getState();
const PKGS = ["package-a", "package-b", "package-c", "package-d", "package-e"];
let n = 0;
const off: string[] = [];
for (const shape of ["L", "one-wall", "U"]) {
  for (const from of PKGS) {
    for (const to of PKGS) {
      if (from === to) continue;
      hoodMount.recordHoodModel(catalogue.APPLIANCE_BY_ID[packages.DEFAULT_PACKAGE.defaultSelection["slot-hood"]], packages.DEFAULT_PACKAGE.id);
      testRoom.resetRoom();
      useAppStore.setState(OPENED, true);
      s().setPackageId(from);
      if (shape !== "L") s().setLayoutShape(shape);
      s().setPackageId(to);
      n += 1;
      const st = s().layoutParams;
      const b = room.LAYOUT_PARAMS;
      const walls = shape === "one-wall" ? (["backWallIn"] as const) : (["backWallIn", "leftWallIn"] as const);
      const diff = walls.filter((k) => Math.abs(st[k] - b[k]) > 1e-9);
      if (diff.length) off.push(`${shape} ${from.slice(-1)}→${to.slice(-1)}: ${diff.map((k) => `${k} store ${st[k]} built ${b[k]}`).join("; ")}`);
    }
  }
}
console.log(`${n} switches; the store's walls not the room's in ${off.length}`);
for (const l of off) console.log(l);
