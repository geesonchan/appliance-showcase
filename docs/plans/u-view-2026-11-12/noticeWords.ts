// For item 10's plan (2026-11-13): every package switch in the L and on one wall (5 x 4 each),
// each from the room the package before it opens in that shape, through the real store. For
// each: the walls built before and after (LAYOUT_PARAMS — what the room is, which the slider
// does not always show: storeVsBuiltProbe.ts), the notice it gives now, word for word in
// both languages, and the notice in the U's pattern (toast.packageSwitched, then a
// toast.shapeWall line for each wall built longer), with its Undo button.
//   ROOT=<tree> npx vite-node docs/plans/u-view-2026-11-12/noticeWords.ts
const ROOT = process.env.ROOT ?? process.cwd();
const M = (p: string) => import(`${ROOT}/src/${p}`);
const { sayWith, translate } = await M("i18n/index.ts");
const { inchesSpoken } = await M("data/inches.ts");
const { wallToastKey } = await M("ui/shapeControls.ts");
const { useAppStore } = await M("store/useAppStore.ts");
const testRoom = await M("data/testRoom.ts");
const hoodMount = await M("data/hoodMount.ts");
const catalogue = await M("data/catalogue.ts");
const packages = await M("data/packages.ts");
const room = await M("data/room.ts");

const OPENED = useAppStore.getState();
const s = () => useAppStore.getState();
const PKGS = ["package-a", "package-b", "package-c", "package-d", "package-e"];
const name = (lang: "zh" | "en", id: string) => (lang === "zh" ? `套餐 ${id.slice(-1).toUpperCase()}` : `Package ${id.slice(-1).toUpperCase()}`);
const say = (lang: "zh" | "en", key: string, vars?: Record<string, string | number>) =>
  sayWith((k: string, v?: Record<string, string | number>) => translate(lang, k, v), key, vars);
const counts = { switches: 0, noticeNow: 0, noticeNamesUnchanged: 0, grewWithoutNotice: 0, noticeAfter: 0 };
let i = 0;
for (const shape of ["L", "one-wall"] as const) {
  for (const from of PKGS) {
    for (const to of PKGS) {
      if (from === to) continue;
      hoodMount.recordHoodModel(catalogue.APPLIANCE_BY_ID[packages.DEFAULT_PACKAGE.defaultSelection["slot-hood"]], packages.DEFAULT_PACKAGE.id);
      testRoom.resetRoom();
      useAppStore.setState(OPENED, true);
      s().setPackageId(from);
      if (shape !== "L") s().setLayoutShape(shape);
      useAppStore.setState({ toast: null });
      const before = { backWallIn: room.LAYOUT_PARAMS.backWallIn, leftWallIn: room.LAYOUT_PARAMS.leftWallIn };
      s().setPackageId(to);
      const after = { backWallIn: room.LAYOUT_PARAMS.backWallIn, leftWallIn: room.LAYOUT_PARAMS.leftWallIn };
      const t = s().toast;
      counts.switches += 1;
      const walls = shape === "one-wall" ? (["backWallIn"] as const) : (["backWallIn", "leftWallIn"] as const);
      const changed = walls.filter((k) => Math.abs(after[k] - before[k]) > 1e-9);
      const now = t?.key === "toast.roomGrew";
      if (now) counts.noticeNow += 1;
      if (now && (changed.length < 2 || shape === "one-wall")) counts.noticeNamesUnchanged += 1;
      if (!now && changed.length) counts.grewWithoutNotice += 1;
      if (changed.length) counts.noticeAfter += 1;
      if (!now && !changed.length) continue;
      i += 1;
      const tag = `${shape === "L" ? "L 型" : "一字型"} ${from.slice(-1).toUpperCase()}→${to.slice(-1).toUpperCase()}`;
      const wallsSaid = walls.map((k) => `${k === "backWallIn" ? "后墙" : "左墙"} ${inchesSpoken(before[k])}→${inchesSpoken(after[k])}`).join("，");
      console.log(`\n${i}. ${tag}（实际建成：${wallsSaid}）${!now ? "　**现在不弹提示**" : ""}`);
      for (const lang of ["zh", "en"] as const) {
        const undo = say(lang, "toast.undo.package", { package: name(lang, from) });
        const nowText = now ? `${say(lang, "toast.roomGrew", { ...t!.vars, package: name(lang, to) })}　［${undo}］` : "（不弹提示）";
        const lines = changed.length
          ? `${[say(lang, "toast.packageSwitched", { package: name(lang, to) }), ...changed.map((k) => say(lang, "toast.shapeWall", { wallKey: wallToastKey(k, shape), fromIn: inchesSpoken(before[k]), toIn: inchesSpoken(after[k]) }))].join(" / ")}　［${undo}］`
          : "（不弹提示）";
        console.log(`   ${lang} 现在：${nowText}`);
        console.log(`   ${lang} 改后：${lines}`);
      }
    }
  }
}
console.log(`\n${JSON.stringify(counts)}`);
