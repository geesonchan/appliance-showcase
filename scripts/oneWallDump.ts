/**
 * Every one-wall room the template builds, as geometry and words, one room a
 * line: each package as it opens on one wall, with the hood housing's other
 * shape, at two wall lengths, and with every model each slot can hold, one at
 * a time (Leo, round 99a: "把一字型的几何导出也做成底稿…以后每轮都用它证明一字型没变").
 * The L's own 1,045 rooms are dumped the same way (round 98a's script).
 *
 * The rooms are `roomSets.oneWallRooms`. Run it on the commit before a round
 * and on the round, and compare the two files line by line:
 *
 *   ROOT=<tree> OUT=<file.jsonl> npx vite-node scripts/oneWallDump.ts
 *
 * ROOT is the tree to load (a worktree of the old commit, or this one); the
 * words — the checklist's sentences, the bill's and the pins' keys — are in
 * `findings`, `words` and `occupancyWords`, so a round that changes only
 * words can set them aside and compare the rest byte for byte.
 */
import { writeFileSync } from "node:fs";

const ROOT = process.env.ROOT ?? process.cwd();
const OUT = process.env.OUT ?? "one-wall-dump.jsonl";
const M = (p: string) => import(`${ROOT}/src/${p}`);


const layoutState = await M("data/layoutState.ts");
const room = await M("data/room.ts");
const packages = await M("data/packages.ts");
const catalogue = await M("data/catalogue.ts");
const slots = await M("data/slots.ts");
const cabinets = await M("data/cabinets.ts");
const counter = await M("data/counter.ts");
const dimensions = await M("data/dimensions.ts");
const roughInList = await M("data/roughInList.ts");
const roughIn = await M("data/roughIn.ts");
const checklist = await M("data/useChecklist.ts");
const serviceRoute = await M("data/serviceRoute.ts");
const flyIn = await M("data/flyIn.ts");
const hood = await M("data/hood.ts");
const towerVent = await M("data/towerVent.ts");
const barStools = await M("data/barStools.ts");
const applianceBox = await M("data/applianceBox.ts");
const candidates = await M("data/candidates.ts");
const testRoom = await M("data/testRoom.ts");
const fixtures = await M("data/fixtures.ts");
const i18n = await M("i18n/index.ts");
const layoutTemplate = await M("data/layoutTemplate.ts");
// The rooms, listed once for both dumps and the words test (round 99a); this tree's list.
const roomSets = await import("../src/data/roomSets.ts");
// The words as the page shows them (round 99, machineLabel.ts).
const ml: any = await M("data/machineLabel.ts");
const billWord = (item: any, sel: any) => ml.billLabelKey(item, sel);
const slotWord = (id: string, sel: any) => ml.slotLabelKey(id, sel[id]);

function say(lang: "en" | "zh", key: string, vars?: any) {
  return i18n.sayWith((k: string, v?: any) => i18n.translate(lang, k, v), key, vars);
}

function snapshot(pkg: any, sel: Record<string, any>) {
  const omitted = new Set(room.OMITTED_SLOTS);
  const present = packages.SLOT_ORDER.filter((id: string) => !omitted.has(id));
  const range = sel["slot-range"];
  const cooktop = sel["slot-cooktop"];
  const islandTop = room.ISLAND && sel["slot-cooktop"] && slots.SLOT_BY_ID["slot-cooktop"]
    ? { layout: room.ISLAND, slot: slots.SLOT_BY_ID["slot-cooktop"], appliance: cooktop }
    : undefined;
  let counterOut: any;
  try {
    counterOut = counter.counterOutline(room.RUNS, range, islandTop, islandTop ? undefined : cooktop);
  } catch (e: any) {
    counterOut = `throws: ${e.message}`;
  }
  const blower = null;
  const list = checklist.checklistFor(sel, blower);
  const findings = list.findings.map((f: any) => ({
    ...f,
    en: say("en", f.messageKey ?? f.key ?? "", f.params),
    zh: say("zh", f.messageKey ?? f.key ?? "", f.params),
  }));
  const points = roughInList.listRoughIn(sel).map((item: any) => ({
    key: item.key,
    resolved: item.resolved,
    leader: roughIn.leaderEnd(item.resolved),
  }));
  const perSlot: Record<string, any> = {};
  for (const id of present) {
    const slot = slots.SLOT_BY_ID[id];
    const appliance = sel[id];
    perSlot[id] = {
      slot,
      flyIn: flyIn.flyInAzimuth(slot),
      route: serviceRoute.serviceRoute(slot, 0.25),
      trimKits: room.trimKitsBeside(id),
      trimKit: room.trimKitBeside(id),
      runFor: room.runForSlot(id),
      box: appliance ? safe(() => applianceBox.applianceBox(slot, appliance)) : null,
      hinge: present.map((other: string) => (other === id ? null : room.hingeAwayFrom(id, other))),
    };
  }
  const hoodSlot = slots.SLOT_BY_ID["slot-hood"];
  return {
    params: room.LAYOUT_PARAMS,
    requested: room.REQUESTED_PARAMS,
    issues: room.LAYOUT_ISSUES,
    roomSize: { halfX: room.ROOM.halfX, halfZ: room.ROOM.halfZ },
    runs: room.RUNS,
    fridgeOpening: room.FRIDGE_OPENING,
    hoodOpening: room.HOOD_OPENING,
    island: room.ISLAND,
    placement: room.SLOT_PLACEMENT,
    fixturePlacement: room.FIXTURE_PLACEMENT,
    fixtures: fixtures.FIXTURES,
    windows: room.WINDOWS,
    omitted: room.OMITTED_SLOTS,
    omittedForWall: room.OMITTED_FOR_WALL,
    returnWall: room.fridgeReturnWall(),
    wallClearance: room.fridgeWallClearance(),
    cabinets: cabinets.CABINETS,
    outlines: cabinets.CABINET_OUTLINES,
    labelled: safe(() => cabinets.labelledBoxes()),
    corners: cabinets.CABINETS.filter((b: any) => b.kind === "corner").map((b: any) => safe(() => cabinets.diagonalDoor(b))),
    counter: counterOut,
    dimensions: safe(() => dimensions.dimensionsFor(sel)),
    dimensionsPerSlot: present.map((id: string) => safe(() => dimensions.dimensionsFor(sel, id))),
    points,
    findings,
    perSlot,
    hoodOutlet: hoodSlot && sel["slot-hood"] ? safe(() => hood.hoodOutlet(hoodSlot, sel["slot-hood"])) : null,
    vents: safe(() => towerVent.towerVents(sel)),
    stools: room.ISLAND ? safe(() => barStools.barStools(room.ISLAND)) : null,
    requirement: ["back", "left"].map((leg) => safe(() => room.wallRequirement(room.LAYOUT_PARAMS, leg, pkg))),
    words: {
      labels: Object.fromEntries(present.map((id: string) => [id, slotWord(id, sel)])),
      bill: ["back", "left"].map((leg) => safe(() => room.wallRequirement(room.LAYOUT_PARAMS, leg, pkg).items.map((item: any) => billWord(item, sel)))),
    },
  };
}

function safe<T>(f: () => T): T | string {
  try {
    return f();
  } catch (e: any) {
    return `throws: ${e.message}`;
  }
}


const out: string[] = [];
let built = 0;
let refused = 0;
for (const c of roomSets.oneWallRooms({ packages, layoutState, room, candidates, catalogue, testRoom, layoutTemplate })) {
  const result: any = c.build();
  if (!result.ok) {
    refused++;
    out.push(JSON.stringify({ label: c.label, refused: result.reasons }));
    continue;
  }
  built++;
  const line = c.label.includes(" swap ") ? { label: c.label, room: snapshot(c.pkg, c.selection()) } : { label: c.label, grown: result.grown ?? null, room: snapshot(c.pkg, c.selection()) };
  out.push(JSON.stringify(line));
}
testRoom.resetRoom();
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`one-wall rooms built ${built}, refused ${refused}, lines ${out.length}`);
