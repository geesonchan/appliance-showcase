/**
 * Every L room the template builds, as geometry and words, one room a line:
 * round 98a's 1,045 (`roomSets.lRooms`). Run it on the commit before a round
 * and on the round, and compare the two files line by line (D17):
 *
 *   ROOT=<tree> OUT=<file.jsonl> npx vite-node scripts/lDump.ts
 *
 * ROOT is the tree to load (a worktree of the old commit, or this one); the
 * list of rooms is always this tree's. A run is written as round 97 wrote one
 * and the layout without its shape, so a dump of round 97's code still
 * compares; the words — the checklist's sentences, the bill's and the pins'
 * keys — are in `findings`, `words` and `occupancyWords`. Round 99a moved it
 * here from the rounds' scratch folders (Leo: "以后每轮都用它证明").
 */
import { writeFileSync } from "node:fs";

const ROOT = process.env.ROOT ?? process.cwd();
const OUT = process.env.OUT ?? "l-dump.jsonl";
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
const roomSets = await import("../src/data/roomSets.ts");
// Round 99: the words as the page shows them, where the tree has machineLabel.ts.
const ml: any = await M("data/machineLabel.ts").catch(() => null);
const billWord = (item: any, sel: any) => (ml ? ml.billLabelKey(item, sel) : item.labelKey);
const slotWord = (id: string, sel: any) => (ml ? ml.slotLabelKey(id, sel[id]) : slots.SLOT_BY_ID[id].labelKey);

// A run as round 97 wrote it: anything a later round adds to the record is not
// compared here (it is listed in the report), only what was there.
// The layout's `shape` (round 98a) likewise: asked for in the tests, not here.
const paramsOf = (p: any) => { if (!p) return p; const { shape: _s, ...rest } = p; return rest; };
const runOf = (r: any) => ({ id: r.id, axis: r.axis, centre: r.centre, segments: r.segments, uppers: r.uppers });

/** A run, wherever it turns up in the dump, as round 97 recorded one. */
const isRun = (v: any) => v && typeof v === "object" && "segments" in v && "uppers" in v && "centre" in v;
const asRound97 = (_k: string, v: any) => (isRun(v) ? runOf(v) : v);

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
    counterOut = counter.counterOutline(room.RUNS, range, islandTop);
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
    params: paramsOf(room.LAYOUT_PARAMS),
    requested: paramsOf(room.REQUESTED_PARAMS),
    issues: room.LAYOUT_ISSUES,
    roomSize: { halfX: room.ROOM.halfX, halfZ: room.ROOM.halfZ },
    runs: room.RUNS.map(runOf),
    // round 97's RUN, which round 98a removed (nothing read it): the two centre lines.
    runLines: { backZ: room.RUN_BY_ID.back.centre, leftX: room.RUN_BY_ID.left.centre },
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
for (const c of roomSets.lRooms({ packages, layoutState, room, candidates, catalogue, testRoom, layoutTemplate })) {
  const result: any = c.build();
  if (!result.ok) {
    refused++;
    const reasons = result.reasons;
    const occupancyWords = Array.isArray(reasons) ? reasons.map((r: any) => (r.occupancy ?? []).map((item: any) => billWord(item, c.selection()))) : null;
    out.push(JSON.stringify({ label: c.label, refused: reasons, occupancyWords }, (k, v) => (k === "patch" && v && typeof v === "object" ? paramsOf(v) : v)));
    continue;
  }
  built++;
  const line = c.label.includes(" swap ") ? { label: c.label, room: snapshot(c.pkg, c.selection()) } : { label: c.label, grown: result.grown ?? null, room: snapshot(c.pkg, c.selection()) };
  out.push(JSON.stringify(line, asRound97));
}
testRoom.resetRoom();
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`rooms built ${built}, refused ${refused}, lines ${out.length}`);
