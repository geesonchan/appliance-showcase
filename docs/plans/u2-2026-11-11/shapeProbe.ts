// Every shape switch, 6 directions x 5 packages x 3 wall cases, through the real store.
// ROOT=<tree> OUT=<file.json> npx vite-node shapeProbe.ts
import { writeFileSync } from "node:fs";
const ROOT = process.env.ROOT ?? process.cwd();
const OUT = process.env.OUT ?? "probe.json";
const M = (p: string) => import(`${ROOT}/src/${p}`);
const { useAppStore } = await M("store/useAppStore.ts");
const room = await M("data/room.ts");
const tmpl = await M("data/layoutTemplate.ts");
const testRoom = await M("data/testRoom.ts");
const hoodMount = await M("data/hoodMount.ts");
const catalogue = await M("data/catalogue.ts");
const packages = await M("data/packages.ts");
const openLink = await M("store/openLink.ts");
const shareLink = await M("store/shareLink.ts");

const OPENED = useAppStore.getState();
const s = () => useAppStore.getState();
function freshPage() {
  hoodMount.recordHoodModel(catalogue.APPLIANCE_BY_ID[packages.DEFAULT_PACKAGE.defaultSelection["slot-hood"]], packages.DEFAULT_PACKAGE.id);
  testRoom.resetRoom();
  useAppStore.setState(OPENED, true);
}
const SHAPES = ["L", "one-wall", "U"];
const PKGS = ["package-a", "package-b", "package-c", "package-d", "package-e"];
const walls = () => ({ back: s().layoutParams.backWallIn, left: s().layoutParams.leftWallIn });
const out: any[] = [];

for (const pkg of PKGS) {
  for (const from of SHAPES) {
    for (const to of SHAPES) {
      if (from === to) continue;
      for (const wallCase of ["opened", "shortest", "longest", "link"]) {
        if (wallCase === "link" && from === "L") continue;
        freshPage();
        s().setPackageId(pkg);
        let reached = true;
        if (from !== "L") {
          const r = s().setLayoutShape(from);
          reached = r.ok && s().layoutParams.shape === from;
        }
        if (wallCase === "link") {
          const link = shareLink.writeLink(openLink.kitchenNow());
          freshPage();
          openLink.openSharedLink("?" + link);
          reached = s().layoutParams.shape === from;
        }
        let set: any = null;
        if (reached && wallCase !== "opened") {
          const p = s().layoutParams;
          const limits = tmpl.paramLimitsFor(from);
          const keys = from === "one-wall" ? ["backWallIn"] : ["backWallIn", "leftWallIn"];
          for (const key of keys) {
            const range = tmpl.feasibleRange(s().layoutParams, key);
            const value = wallCase === "shortest" ? (range?.minIn ?? limits[key].min) : (range?.maxIn ?? limits[key].max);
            s().setLayout({ [key]: value });
          }
          set = { ...walls(), issues: s().layoutIssues.map((r: any) => r.key) };
          void p;
        }
        const before = { shape: s().layoutParams.shape, ...walls() };
        const toastBefore = s().toast?.id ?? null;
        let result: any;
        try {
          result = s().setLayoutShape(to);
        } catch (e: any) {
          result = { threw: e.message };
        }
        const after = { shape: s().layoutParams.shape, ...walls() };
        const toast = s().toast && s().toast.id !== toastBefore ? { key: s().toast.key, vars: s().toast.vars, undo: !!s().toast.undo, undoLabel: s().toast.undoLabel?.key } : null;
        const issues = s().layoutIssues.map((r: any) => r.key);
        const omitted = [...(room.OMITTED_FOR_WALL ?? [])];
        // Undo, where offered: back to the shape and walls before?
        let undo: any = null;
        if (toast?.undo) {
          s().undo();
          undo = { shape: s().layoutParams.shape, ...walls() };
        }
        out.push({ pkg: pkg.slice(-1).toUpperCase(), from, to, wallCase, reached, set, before, result, after, toast, issues, omitted, undo });
      }
    }
  }
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log("cases", out.length);
