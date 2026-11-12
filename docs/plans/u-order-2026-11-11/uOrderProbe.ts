/**
 * The U's new order (Leo, 2026-11-11): each package's U at the walls the page
 * opens it at (`uWantedIn`: everything the package has), from the tree at
 * ROOT — its three legs from the corner out (what stands there and how wide),
 * what is left out, the side walls' range at that back wall, the stone's
 * pieces and every connection point listed. Run on the U-2 tree and on the prototype, and compare.
 *
 *   ROOT=<tree> [VITE_U_PANTRY=none] npx vite-node docs/plans/u-order-2026-11-11/uOrderProbe.ts
 */
const ROOT = process.env.ROOT ?? process.cwd();
const M = (p: string) => import(`${ROOT}/src/${p}`);
const layoutState = await M("data/layoutState.ts");
const room = await M("data/room.ts");
const packages = await M("data/packages.ts");
const catalogue = await M("data/catalogue.ts");
const counter = await M("data/counter.ts");
const template = await M("data/layoutTemplate.ts");
const testRoom = await M("data/testRoom.ts");
const roughInList = await M("data/roughInList.ts");

const IN = (ft: number) => Math.round(ft * 12 * 1000) / 1000;
const out: Record<string, unknown> = {};
for (const code of ["A", "B", "C", "D", "E"]) {
  testRoom.resetRoom();
  const pkg = packages.PACKAGES.find((p: { code: string }) => p.code === code);
  layoutState.setActivePackage(pkg.id);
  const asked = { ...room.REQUESTED_PARAMS, shape: "U", cornerType: "blind" };
  const walls = template.uWantedIn(asked, pkg);
  const base = { ...asked, ...walls };
  const range = template.feasibleRange(base, "leftWallIn", pkg);
  const result = template.generateLayout(base, pkg);
  if (!result.ok) {
    out[code] = result.reasons;
    continue;
  }
  room.applyLayout(result.layout, result.layout.params, []);
  const legs: Record<string, string[]> = {};
  for (const run of result.layout.runs) {
    legs[run.id] = run.segments.map(
      (s: { slot?: string; fixture?: string; kind: string; from: number; to: number; modules: { code: string }[] }) =>
        `${(s.slot ?? s.fixture ?? s.kind).replace("slot-", "")} ${IN(s.to - s.from)}" [${s.modules.map((m) => m.code).join(" ")}]`,
    );
  }
  const sel = Object.fromEntries(
    Object.entries(packages.packageInShape(pkg, "U").defaultSelection).map(([s, id]) => [s, catalogue.APPLIANCE_BY_ID[id as string]]),
  );
  const outline = counter.counterOutline(result.layout.runs, sel["slot-range"], undefined, sel["slot-cooktop"]);
  const stone = outline.pieces.map((piece: { outline: [number, number][] }) => {
    const xs = piece.outline.map((p) => p[0]);
    const zs = piece.outline.map((p) => p[1]);
    return IN(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)));
  });
  // Every connection point the room lists, slot by slot (a point that drops
  // out of the list is the check: docs, "New cabinet kind: check connections").
  const points = roughInList.listRoughIn(sel).map((item: { key: string; resolved: Record<string, unknown> }) => `${item.key} in ${(item.resolved.host as { id: string } | undefined)?.id ?? "NO HOST"}`);
  out[code] = { points, walls, sideWalls: range, omitted: result.layout.omitted ?? result.omitted ?? null, legs, stone };
}
console.log(JSON.stringify(out, null, 1));
