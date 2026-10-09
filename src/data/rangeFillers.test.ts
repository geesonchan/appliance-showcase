import { afterAll, describe, expect, it } from "vitest";
import { applianceBox } from "./applianceBox";
import { CABINETS, type CabinetBox } from "./cabinets";
import { candidatesFor } from "./candidates";
import { APPLIANCE_BY_ID, migrateSelection } from "./catalogue";
import { dropsIntoCounter } from "./cookingSurface";
import { counterOutline } from "./counter";
import { dimensionsFor } from "./dimensions";
import { checkLayout, LAYOUT_LIMITS } from "./layoutRules";
import { setActivePackage, setRangeModel } from "./layoutState";
import { BUILDABLE_PACKAGES, PACKAGE_BY_ID, slotsOf } from "./packages";
import { HOOD_OPENING, ROOM, RUNS, type CabinetRun } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { Appliance, Package } from "../types";

/**
 * Round 84: a range narrower than its opening is closed in by the run.
 *
 * From Leo using package B: its 36" rangetop changed to a 30" freestanding
 * range on the model card, and the 3" each side were drawn as two strips of a
 * different colour standing up past the counter, with no stone over them. Leo,
 * from site: "30“宽炉头两边的填充应该是顺滑的橱柜和countertop的无缝填充才对" —
 * the fillers either side are part of the cabinetry, the same doors' finish,
 * flush with their fronts, the toe kick carried through, and the countertop
 * runs over them to the machine's two sides. In any package.
 *
 * So the run orders them: the cooking opening is a filler, the machine's own
 * opening, and a filler, and everything that reads the run follows from that —
 * the stone stops at the machine, the toe kick runs to it, the landings and
 * the dimension chain are measured from it. Every case below was run on round
 * 83's code first and went red there, except where it says it holds something
 * that must not move.
 *
 * The combinations are counted, not assumed: every buildable package, every
 * range its slot offers that fits, stands on the floor, and leaves more than a
 * scribe each side. Nine today — three 30" ranges in A's, B's and D's 36"
 * openings; C's own opening is 30" and its ranges fill it.
 */

afterAll(() => resetRoom());

const ft = (inches: number) => inches / 12;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Every swap that leaves a range standing in an opening wider than itself. */
function narrowRanges(): { entry: Package; appliance: Appliance; sideIn: number; openingIn: number }[] {
  const out: { entry: Package; appliance: Appliance; sideIn: number; openingIn: number }[] = [];
  for (const entry of BUILDABLE_PACKAGES) {
    const spec = slotsOf(entry)["slot-range"];
    if (!spec) continue;
    resetRoom();
    if (!setActivePackage(entry.id).ok) throw new Error(`${entry.id}: room refused`);
    for (const { appliance, fit } of candidatesFor("slot-range", entry)) {
      if (!fit.fits || dropsIntoCounter(appliance)) continue;
      const width = appliance.widthIn ?? appliance.cutoutWidthIn ?? spec.widthIn;
      const sideIn = (spec.widthIn - width) / 2;
      // Half an inch or less is a scribe, not a board (`Filler` in ApplianceModel).
      if (sideIn > 0.5) out.push({ entry, appliance, sideIn, openingIn: spec.widthIn });
    }
  }
  return out;
}

const CASES = narrowRanges();

/** The room built round one of them. */
function build(entry: Package, appliance: Appliance) {
  resetRoom();
  if (!setActivePackage(entry.id).ok) throw new Error(`${entry.id}: room refused`);
  const result = setRangeModel(appliance, entry.id);
  if (!result.ok) throw new Error(`${entry.id} ${appliance.model}: refused`);
  const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
  const segment = run.segments.find((s) => s.slot === "slot-range")!;
  const slot = SLOT_BY_ID["slot-range"];
  const at = run.axis === "x" ? slot.position[0] : slot.position[2];
  const machine = [at - ft(appliance.widthIn!) / 2, at + ft(appliance.widthIn!) / 2] as const;
  return { run, segment, machine };
}

/** A box's extent along its run. */
const alongOf = (box: CabinetBox, run: CabinetRun) => {
  const [i] = run.axis === "x" ? [0] : [2];
  return [box.position[i] - box.size[i] / 2, box.position[i] + box.size[i] / 2] as const;
};

/** A point on the plan, `along` the run and on its centre line. */
const onPlan = (run: CabinetRun, along: number): [number, number] =>
  run.axis === "x" ? [along, run.centre] : [run.centre, along];

function inside([x, z]: readonly [number, number], polygon: readonly (readonly [number, number])[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Stone over a point, and no hole in it there. */
function stoneAt(appliance: Appliance, point: [number, number]) {
  const { pieces } = counterOutline(RUNS, appliance);
  const piece = pieces.find((p) => inside(point, p.outline));
  return !!piece && !piece.holes.some((hole) => inside(point, hole));
}

const label = (entry: Package, appliance: Appliance) => `${entry.id} ${appliance.model}`;

describe("a range narrower than its opening", () => {
  it("is nine swaps today: three 30-inch ranges in A's, B's and D's 36-inch openings", () => {
    expect(CASES.map((c) => label(c.entry, c.appliance)).sort()).toEqual(
      [
        "package-a HIS8055U",
        "package-a MFGS4030RS",
        "package-a PRG304WH",
        "package-b HIS8055U",
        "package-b MFGS4030RS",
        "package-b PRG304WH",
        "package-d HIS8055U",
        "package-d MFGS4030RS",
        "package-d PRG304WH",
      ].sort(),
    );
  });

  it("is ordered by the run as a filler, the machine's own opening, and a filler", () => {
    const wrong: string[] = [];
    for (const { entry, appliance, sideIn } of CASES) {
      const { segment } = build(entry, appliance);
      const got = segment.modules.map((m) => `${m.kind} ${m.widthIn}`);
      const want = [`filler ${sideIn}`, `opening ${appliance.widthIn}`, `filler ${sideIn}`];
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        wrong.push(`${label(entry, appliance)}: ${JSON.stringify(got)}`);
      }
    }
    expect({ cases: CASES.length, wrong }).toEqual({ cases: 9, wrong: [] });
  });

  it("has the stone run over each filler to the machine's side, and stop there", () => {
    const wrong: string[] = [];
    for (const { entry, appliance } of CASES) {
      const { run, segment, machine } = build(entry, appliance);
      // Just inside each end of the opening, which is filler; and the middle,
      // which is the machine standing on the floor with nothing over it.
      const overFillers = [segment.from + ft(0.25), segment.to - ft(0.25)].every((along) =>
        stoneAt(appliance, onPlan(run, along)),
      );
      const justInside = [machine[0] + ft(0.25), machine[1] - ft(0.25)].some((along) =>
        stoneAt(appliance, onPlan(run, along)),
      );
      if (!overFillers || justInside) {
        wrong.push(`${label(entry, appliance)}: over the fillers ${overFillers}, over the machine ${justInside}`);
      }
    }
    expect({ cases: CASES.length, wrong }).toEqual({ cases: 9, wrong: [] });
  });

  it("carries the toe kick under each filler to the machine's side", () => {
    const wrong: string[] = [];
    for (const { entry, appliance } of CASES) {
      const { run, segment, machine } = build(entry, appliance);
      const toes = CABINETS.filter((box) => box.kind === "toe" && box.run === run.id).map((box) =>
        alongOf(box, run),
      );
      const covered = (along: number) => toes.some(([a, b]) => a - 1e-9 <= along && along <= b + 1e-9);
      const reaches = covered(segment.from + ft(0.25)) && covered(segment.to - ft(0.25));
      const stops = toes.some(([, b]) => near(b, machine[0])) && toes.some(([a]) => near(a, machine[1]));
      if (!reaches || !stops) wrong.push(`${label(entry, appliance)}: reaches ${reaches}, stops at the machine ${stops}`);
    }
    expect({ cases: CASES.length, wrong }).toEqual({ cases: 9, wrong: [] });
  });

  it("builds each filler as a base cabinet's strip: base height, run depth, a flush face", () => {
    const wrong: string[] = [];
    let fillers = 0;
    for (const { entry, appliance, sideIn } of CASES) {
      const { run, segment } = build(entry, appliance);
      const boxes = CABINETS.filter(
        (box) =>
          box.run === run.id &&
          box.module?.kind === "filler" &&
          alongOf(box, run)[0] >= segment.from - 1e-9 &&
          alongOf(box, run)[1] <= segment.to + 1e-9,
      );
      fillers += boxes.length;
      const neighbour = CABINETS.find((box) => box.run === run.id && box.kind === "base" && box.module?.kind !== "filler")!;
      const ok =
        boxes.length === 2 &&
        boxes.every(
          (box) =>
            box.kind === "base" &&
            box.face === "strip" &&
            near(box.size[1], neighbour.size[1]) &&
            near(box.position[1], neighbour.position[1]) &&
            near(Math.min(box.size[0], box.size[2]) * 12, sideIn) &&
            near(Math.max(box.size[0], box.size[2]), ROOM.counterDepth),
        );
      if (!ok) wrong.push(`${label(entry, appliance)}: ${boxes.length} boxes`);
    }
    expect({ cases: CASES.length, fillers, wrong }).toEqual({ cases: 9, fillers: 18, wrong: [] });
  });

  it("leaves the machine nothing of its own to fill beside it", () => {
    const wrong: string[] = [];
    for (const { entry, appliance } of CASES) {
      build(entry, appliance);
      const side = applianceBox(SLOT_BY_ID["slot-range"], appliance).filler.eachSide;
      if (side !== 0) wrong.push(`${label(entry, appliance)}: ${side * 12}" each side`);
    }
    expect({ cases: CASES.length, wrong }).toEqual({ cases: 9, wrong: [] });
  });

  it("goes back to a plain opening with the package's own range", () => {
    const wrong: string[] = [];
    for (const { entry, appliance } of CASES) {
      build(entry, appliance);
      const own = APPLIANCE_BY_ID[entry.defaultSelection["slot-range"]!];
      setRangeModel(own, entry.id);
      const segment = RUNS.flatMap((r) => r.segments).find((s) => s.slot === "slot-range")!;
      if (segment.modules.some((m) => m.kind === "filler")) wrong.push(label(entry, appliance));
    }
    expect({ cases: CASES.length, wrong }).toEqual({ cases: 9, wrong: [] });
  });

  it("is rebuilt when a range is changed for a range of another width", () => {
    // Package A opens on a 36" range that fills its opening; both stand on the
    // floor, so round 83's condition — has the kind changed? — said no.
    resetRoom();
    setActivePackage("package-a");
    const result = setRangeModel(APPLIANCE_BY_ID["thermador-prg304wh"], "package-a");
    const segment = RUNS.flatMap((r) => r.segments).find((s) => s.slot === "slot-range")!;
    expect({ rebuilt: result.rebuilt, fillers: segment.modules.filter((m) => m.kind === "filler").length }).toEqual({
      rebuilt: true,
      fillers: 2,
    });
  });

  it("follows a narrow range carried into another package", () => {
    // What the store does on a switch: migrate the choices, then record the
    // range carried across (useAppStore, setPackageId).
    resetRoom();
    setActivePackage("package-b");
    setRangeModel(APPLIANCE_BY_ID["maytag-mfgs4030rs"], "package-b");
    const before = { "slot-range": "maytag-mfgs4030rs" };
    setActivePackage("package-a");
    const selection = migrateSelection(PACKAGE_BY_ID["package-a"], before, PACKAGE_BY_ID["package-b"]);
    setRangeModel(APPLIANCE_BY_ID[selection["slot-range"]], "package-a");
    const segment = RUNS.flatMap((r) => r.segments).find((s) => s.slot === "slot-range")!;
    expect({
      carried: selection["slot-range"],
      modules: segment.modules.map((m) => m.kind),
    }).toEqual({ carried: "maytag-mfgs4030rs", modules: ["filler", "opening", "filler"] });
  });
});

/**
 * What else reads the cooking opening, case by case (Leo, round 84).
 *
 * Two of them are measured to the machine now, because the counter beside it
 * starts at the machine: rule 4's landings and rule 12's counter beside the
 * oven tower, and the dimension chain. Two keep reading the opening, because
 * what they are about is the stretch of wall the cabinets leave: the
 * backsplash (`HOOD_OPENING`, room.ts) and the wall cabinets either side of the
 * hood (`hoodSpan` and `wallCuts`, layoutTemplate.ts). Those two are held so
 * that nothing moves above the counter.
 */
describe("what reads the cooking opening", () => {
  it("counts the counter over the fillers as landing (D11 rule 4)", () => {
    // Package A with a 30" range, its narrow landing taken down 3" past the
    // rule's 12" by hand. The fillers are 3" each: 9" of base cabinet and 3" of
    // filler is 12" of counter, and passes. On round 83's code the room has no
    // fillers to count, so the same layout is cut by hand from the opening.
    const { run } = build(PACKAGE_BY_ID["package-a"], APPLIANCE_BY_ID["thermador-prg304wh"]);
    const runs: CabinetRun[] = structuredClone(RUNS);
    const r = runs.find((x) => x.id === run.id)!;
    const i = r.segments.findIndex((s) => s.slot === "slot-range");
    const [before, range, after] = [r.segments[i - 1], r.segments[i], r.segments[i + 1]];
    const narrowIn = LAYOUT_LIMITS.rangeLanding.narrowIn;
    const shift = before.to - before.from - ft(narrowIn - 3);
    before.to -= shift;
    range.from -= shift;
    range.to -= shift;
    after.from -= shift;
    range.modules = [
      { code: "BF3", kind: "filler", widthIn: 3 },
      { code: "RO30", kind: "opening", widthIn: 30, slot: "slot-range" },
      { code: "BF3", kind: "filler", widthIn: 3 },
    ];
    const landing = checkLayout(runs).filter((v) => v.code === "d11-4" && v.message.includes("counter beside it"));
    expect(landing).toEqual([]);
  });

  it("counts a filler toward the counter between the machine and the oven tower (D11 rule 12)", () => {
    // Package B: the oven tower beside the cooking surface. The counter between
    // them taken to 2", under rule 12's 5", and a 3" filler on that side.
    const { run } = build(PACKAGE_BY_ID["package-b"], APPLIANCE_BY_ID["maytag-mfgs4030rs"]);
    const runs: CabinetRun[] = structuredClone(RUNS);
    const r = runs.find((x) => x.id === run.id)!;
    const i = r.segments.findIndex((s) => s.slot === "slot-range");
    const towerAt = r.segments.findIndex((s) => !!s.slot && slotsOf(PACKAGE_BY_ID["package-b"])[s.slot]?.beside === "range");
    const step = towerAt < i ? -1 : 1;
    const clearance = r.segments[i + step];
    const range = r.segments[i];
    const away = r.segments[i - step];
    const take = clearance.to - clearance.from - ft(2);
    // The machine slid toward the tower: the clearance gives the inches, the
    // landing on the far side takes them.
    if (step === -1) {
      clearance.to -= take;
      range.from -= take;
      range.to -= take;
      away.from -= take;
    } else {
      clearance.from += take;
      range.from += take;
      range.to += take;
      away.to += take;
    }
    range.modules = [
      { code: "BF3", kind: "filler", widthIn: 3 },
      { code: "RO30", kind: "opening", widthIn: 30, slot: "slot-range" },
      { code: "BF3", kind: "filler", widthIn: 3 },
    ];
    const between = checkLayout(runs).filter((v) => v.code === "d11-12" && v.message.includes("of counter between"));
    expect(between).toEqual([]);
  });

  it("sets the dimension chain out from the machine's side, not the opening's", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const { entry, appliance } of CASES) {
      const { run, machine } = build(entry, appliance);
      // The chain is laid against the back run (dimensions.ts), and every
      // package's range stands there.
      if (run.id !== "back") {
        wrong.push(`${label(entry, appliance)}: range on the ${run.id} run`);
        continue;
      }
      checked += 1;
      const chain = dimensionsFor({ "slot-range": appliance }).find((d) => d.id === "cooktop-to-canopy")!;
      // Step 0 of the chain stands half a foot out from the cooking surface.
      if (!near(chain.from[0], machine[0] - 0.5)) {
        wrong.push(`${label(entry, appliance)}: ${((machine[0] - chain.from[0]) * 12).toFixed(3)}" from the machine`);
      }
    }
    expect({ checked, wrong }).toEqual({ checked: 9, wrong: [] });
  });

  it("keeps the backsplash the width of the opening", () => {
    const wrong: string[] = [];
    for (const { entry, appliance, openingIn } of CASES) {
      build(entry, appliance);
      const width = (HOOD_OPENING[1] - HOOD_OPENING[0]) * 12;
      if (!near(width, openingIn)) wrong.push(`${label(entry, appliance)}: ${width}"`);
    }
    expect({ cases: CASES.length, wrong }).toEqual({ cases: 9, wrong: [] });
  });

  it("leaves the wall cabinets either side of the hood where they were", () => {
    const wrong: string[] = [];
    for (const { entry, appliance } of CASES) {
      build(entry, appliance);
      const narrow = JSON.stringify(RUNS.map((r) => r.uppers));
      setRangeModel(APPLIANCE_BY_ID[entry.defaultSelection["slot-range"]!], entry.id);
      const own = JSON.stringify(RUNS.map((r) => r.uppers));
      if (narrow !== own) wrong.push(label(entry, appliance));
    }
    expect({ cases: CASES.length, wrong }).toEqual({ cases: 9, wrong: [] });
  });
});
