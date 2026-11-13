// Leo, 2026-11-12, for the list of things registered: 「L 型、一字型换套餐的提示旧句式，先查墙没变时会不会
// 也说"加到"」. Every package switch in the L and on one wall, from each package to each other
// (5 x 4), the room as that package opens it in the shape, through the real store: the
// notice's key, each wall before and after, and whether the notice names a wall that did not
// change (toast.roomGrew names both, back and left, whenever one grew; on one wall the left
// wall is not drawn).
//   ROOT=<tree> OUT=<file.json> npx vite-node docs/plans/u-view-2026-11-12/roomGrewProbe.ts
import { writeFileSync } from "node:fs";
const ROOT = process.env.ROOT ?? process.cwd();
const OUT = process.env.OUT ?? "roomGrew.json";
const M = (p: string) => import(`${ROOT}/src/${p}`);
const { useAppStore } = await M("store/useAppStore.ts");
const testRoom = await M("data/testRoom.ts");
const hoodMount = await M("data/hoodMount.ts");
const catalogue = await M("data/catalogue.ts");
const packages = await M("data/packages.ts");

const OPENED = useAppStore.getState();
const s = () => useAppStore.getState();
function freshPage() {
  hoodMount.recordHoodModel(catalogue.APPLIANCE_BY_ID[packages.DEFAULT_PACKAGE.defaultSelection["slot-hood"]], packages.DEFAULT_PACKAGE.id);
  testRoom.resetRoom();
  useAppStore.setState(OPENED, true);
}
const PKGS = ["package-a", "package-b", "package-c", "package-d", "package-e"];
const out: Record<string, unknown>[] = [];
for (const shape of ["L", "one-wall"]) {
  for (const from of PKGS) {
    for (const to of PKGS) {
      if (from === to) continue;
      freshPage();
      s().setPackageId(from);
      if (shape !== "L") s().setLayoutShape(shape);
      useAppStore.setState({ toast: null });
      const before = { back: s().layoutParams.backWallIn, left: s().layoutParams.leftWallIn };
      s().setPackageId(to);
      const after = { back: s().layoutParams.backWallIn, left: s().layoutParams.leftWallIn };
      const t = s().toast;
      const said = t?.key === "toast.roomGrew";
      const changed = {
        back: Math.abs(after.back - before.back) > 1e-9,
        left: shape === "L" && Math.abs(after.left - before.left) > 1e-9,
      };
      out.push({
        shape,
        from,
        to,
        before,
        after,
        key: t?.key ?? null,
        vars: t?.vars ?? null,
        // A wall the notice names that did not change: back and left are always both named.
        namesUnchanged: said ? (["back", "left"] as const).filter((w) => !changed[w]) : [],
      });
    }
  }
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
const said = out.filter((r) => r.key === "toast.roomGrew");
const wrong = said.filter((r) => (r.namesUnchanged as string[]).length > 0);
console.log(`${out.length} switches; toast.roomGrew in ${said.length}; naming a wall that did not change in ${wrong.length}`);
for (const r of wrong) console.log(`${r.shape} ${r.from}→${r.to} | back ${(r.before as any).back}→${(r.after as any).back} left ${(r.before as any).left}→${(r.after as any).left} | unchanged named: ${(r.namesUnchanged as string[]).join(", ")}`);
for (const r of out.filter((x) => x.key && x.key !== "toast.roomGrew")) console.log(`other notice: ${r.shape} ${r.from}→${r.to} ${r.key}`);
