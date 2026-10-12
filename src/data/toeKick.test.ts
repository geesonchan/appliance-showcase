import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { BASE_CABINET_BAND, CABINETS, type CabinetBox, wearsDoorFinish } from "./cabinets";
import { candidatesFor } from "./candidates";
import { dropsIntoCounter, openingAlong } from "./cookingSurface";
import { setActivePackage, setLayoutParams, setLayoutParamsGrowing, setRangeModel } from "./layoutState";
import { DEFAULT_PARAMS, type LayoutParams } from "./layoutTemplate";
import { BUILDABLE_PACKAGES, PACKAGES, slotsOf } from "./packages";
import { ISLAND, REQUESTED_PARAMS, ROOM, RUNS, type CabinetRun } from "./room";
import { resolveRoughIn } from "./roughIn";
import { resetRoom } from "./testRoom";

/**
 * Round 92b, Leo: every base cabinet stands on a toe kick — 4" high, its front
 * 3" behind the carcass front, 3-3/4" behind the door face; a US standard base
 * cabinet and his site practice — and it is in the doors' finish. So do the
 * oven and coffee towers; a refrigerator's or a column's surround, and the
 * board that is a run's exposed end, go to the floor. docs/decisions.md D13 and
 * D22, round 92b.
 */

afterAll(() => resetRoom());

const inch = (feet: number) => Math.round(feet * 12 * 16) / 16;
const bottomOf = (box: CabinetBox) => inch(box.position[1] - box.size[1] / 2);
const alongOf = (run: CabinetRun, box: CabinetBox) => {
  const a = run.axis === "x" ? 0 : 2;
  return [inch(box.position[a] - box.size[a] / 2), inch(box.position[a] + box.size[a] / 2)] as const;
};

type Arrangement = Partial<Pick<LayoutParams, "sinkLeg" | "fridgeEnd" | "coffeeLeg" | "islandOrientation" | "cornerType">>;
const ARRANGEMENTS: [string, Arrangement][] = [["as it opens", {}]];
for (const sinkLeg of ["back", "left"] as const)
  for (const fridgeEnd of ["left", "back"] as const)
    for (const coffeeLeg of ["left", "back"] as const)
      for (const islandOrientation of ["parallel", "perpendicular"] as const)
        ARRANGEMENTS.push([
          `sink ${sinkLeg}, refrigerator ${fridgeEnd}, coffee ${coffeeLeg}, island ${islandOrientation}`,
          { sinkLeg, fridgeEnd, coffeeLeg, islandOrientation },
        ]);
ARRANGEMENTS.push(["a corner susan", { cornerType: "lazy-susan" }]);

function build(id: string, arrangement: Arrangement): boolean {
  resetRoom();
  if (!setActivePackage(id).ok) return false;
  if (Object.keys(arrangement).length === 0) return true;
  return setLayoutParamsGrowing({ ...REQUESTED_PARAMS, ...arrangement }).ok;
}

describe("what stands on the toe kick, every package and arrangement", () => {
  it.each(PACKAGES.map((pkg) => pkg.id))("stands every base cabinet on the kick, 4\" up (%s)", (id) => {
    let built = 0;
    let counted = 0;
    const wrong: string[] = [];
    for (const [name, arrangement] of ARRANGEMENTS) {
      if (!build(id, arrangement)) continue;
      built += 1;
      // The one base box that does not: the fixed panel over the machine in the
      // bottom of a coffee tower, which stands on that machine (round 73).
      const bases = CABINETS.filter((box) => box.kind === "base" && !box.module?.lowerSlot);
      counted += bases.length;
      for (const box of bases) if (bottomOf(box) !== 4) wrong.push(`${name}: ${box.id} at ${bottomOf(box)}"`);
    }
    expect({ built: built > 0, counted: counted > 0, wrong }).toEqual({ built: true, counted: true, wrong: [] });
  });

  it.each(PACKAGES.map((pkg) => pkg.id))("runs the kick's front 3\" behind the carcass front (%s)", (id) => {
    let counted = 0;
    const wrong: string[] = [];
    for (const [name, arrangement] of ARRANGEMENTS) {
      if (!build(id, arrangement)) continue;
      for (const run of RUNS) {
        const a = run.axis === "x" ? 2 : 0;
        const wall = run.centre - ROOM.counterDepth / 2;
        for (const box of CABINETS.filter((b) => b.kind === "toe" && b.run === run.id && b.rotationY === undefined)) {
          counted += 1;
          const front = Math.abs(box.position[a] + box.size[a] / 2 - wall) > Math.abs(box.position[a] - box.size[a] / 2 - wall)
            ? box.position[a] + box.size[a] / 2
            : box.position[a] - box.size[a] / 2;
          const fromFront = inch(ROOM.counterDepth - Math.abs(front - wall));
          if (fromFront !== 3) wrong.push(`${name}: ${box.id} ${fromFront}" behind`);
        }
      }
    }
    expect({ counted: counted > 0, wrong }).toEqual({ counted: true, wrong: [] });
  });
});

describe("which boards go to the floor, as each package opens", () => {
  // Written out by hand from each package's runs, not read back from the code.
  // Beside an oven or coffee tower a board stands on the kick; beside a
  // refrigerator or a column, and at a run's exposed end, it goes to the floor.
  const BOARDS: Record<string, Record<string, number>> = {
    "package-a": { "left-fridge-panel-a": 0, "left-fridge-panel-b": 0 },
    "package-b": {
      "left-left-end-panel-PNL3-0": 0,
      "back-tower-panel-PNL0.75-0": 4,
      "back-tall-inner-PNL3-0": 0,
      "back-tall-outer-PNL3-0": 0,
    },
    "package-c": { "left-fridge-PNL3-0": 0, "left-fridge-PNL3-2": 0 },
    "package-d": {
      "left-coffee-panel-start-PNL0.75-0": 4,
      "left-coffee-panel-end-PNL0.75-0": 4,
      "left-tall-inner-PNL0.75-0": 0,
      "left-tall-outer-PNL0.75-0": 0,
      "back-tower-panel-PNL0.75-0": 4,
    },
    "package-e": {
      "left-tall-inner-PNL0.75-0": 0,
      "left-tall-outer-PNL0.75-0": 0,
      "back-microwave-panel-start-PNL0.75-0": 4,
      "back-microwave-panel-end-PNL0.75-0": 4,
      "back-coffee-panel-start-PNL0.75-0": 4,
      "back-coffee-panel-end-PNL0.75-0": 4,
    },
  };

  it.each(Object.keys(BOARDS))("stands each board where its volume does (%s)", (id) => {
    build(id, {});
    const boards = CABINETS.filter(
      (box) => box.kind === "surround" && !box.installOnly && !box.id.endsWith("-stack") && bottomOf(box) < 36,
    );
    expect(Object.fromEntries(boards.map((box) => [box.id, bottomOf(box)]))).toEqual(BOARDS[id]);
  });
});

describe("where the kick starts and stops", () => {
  const kicksOn = (run: CabinetRun) =>
    CABINETS.filter((b) => b.kind === "toe" && b.run === run.id && b.rotationY === undefined)
      .map((box) => alongOf(run, box))
      .sort((p, q) => p[0] - q[0]);

  it("reaches 3\" into a blind corner on the leg without the corner box, to the corner leg's kick front", () => {
    build("package-a", {});
    const other = RUNS.find((run) => run.segments[0].kind !== "corner")!;
    expect(inch(other.segments[0].from) - kicksOn(other)[0][0]).toBe(3);
  });

  it("reaches 15\" into a corner susan's square, whose front is 36\" off the wall", () => {
    build("package-a", { cornerType: "lazy-susan" });
    const other = RUNS.find((run) => run.segments[0].kind !== "corner")!;
    expect(inch(other.segments[0].from) - kicksOn(other)[0][0]).toBe(15);
  });

  it("runs to the wall under a filler that ends the run against it", () => {
    // Package A's back run ends on a 3" filler against the right wall.
    build("package-a", {});
    const back = RUNS.find((run) => run.id === "back")!;
    const end = inch(back.segments[back.segments.length - 1].to);
    expect(end - kicksOn(back)[kicksOn(back).length - 1][1]).toBe(0);
  });

  it("stops at the inside face of the end panel that goes to the floor", () => {
    // Package B's left run ends on its 3" end panel.
    build("package-b", {});
    const left = RUNS.find((run) => run.id === "left")!;
    const end = inch(left.segments[left.segments.length - 1].to);
    expect(end - kicksOn(left)[kicksOn(left).length - 1][1]).toBe(3);
  });

  it("stops at the inside face of a refrigerator enclosure's board that ends the run", () => {
    // Package A's left run ends on its refrigerator's enclosure, a 3" board to
    // the floor each side. Run to the end, the kick's end face lay in that
    // board's outer face and the two flickered (round 92b's pixel diff).
    build("package-a", {});
    const left = RUNS.find((run) => run.id === "left")!;
    const end = inch(left.segments[left.segments.length - 1].to);
    expect(end - kicksOn(left)[kicksOn(left).length - 1][1]).toBe(3);
  });

  it("sets the island's kick in 3\" on all four sides, the seating side too", () => {
    build("package-e", {});
    const island = CABINETS.filter((b) => b.run === "island" && b.kind === "base");
    const toe = CABINETS.find((b) => b.id === "island-toe")!;
    const extent = (boxes: CabinetBox[], axis: 0 | 2) => [
      Math.min(...boxes.map((b) => b.position[axis] - b.size[axis] / 2)),
      Math.max(...boxes.map((b) => b.position[axis] + b.size[axis] / 2)),
    ];
    const insets = ([0, 2] as const).flatMap((axis) => {
      const [lo, hi] = extent(island, axis);
      const [tlo, thi] = extent([toe], axis);
      return [inch(tlo - lo), inch(hi - thi)];
    });
    expect({ seating: ISLAND.overhangIn > 0, insets }).toEqual({ seating: true, insets: [3, 3, 3, 3] });
  });
});

describe("the kick under a corner susan's diagonal door", () => {
  it("runs along the door's chord, 3\" behind it, from one leg's kick front to the other's", () => {
    build("package-a", { cornerType: "lazy-susan" });
    const piece = CABINETS.find((b) => b.kind === "toe" && b.rotationY !== undefined)!;
    const run = RUNS.find((r) => r.segments[0].kind === "corner")!;
    const wall = run.centre - ROOM.counterDepth / 2;
    const a = run.axis === "x" ? 0 : 2;
    const c = run.axis === "x" ? 2 : 0;
    // In the corner's terms: along this leg from the corner's wall, out from this leg's wall.
    const along = (x: number, z: number) => ((a === 0 ? x : z) - run.segments[0].from) * 12;
    const out = (x: number, z: number) => ((c === 0 ? x : z) - wall) * 12;
    // The front edge's midpoint: half the depth back toward the corner from the centre.
    const half = piece.size[2] / 2;
    const toward = [Math.sin(piece.rotationY!), Math.cos(piece.rotationY!)];
    const fronts = [1, -1].map((s) => [piece.position[0] + s * toward[0] * half, piece.position[2] + s * toward[1] * half]);
    const front = fronts.reduce((p, q) => (along(p[0], p[1]) + out(p[0], p[1]) > along(q[0], q[1]) + out(q[0], q[1]) ? p : q));
    // The chord between the legs' fronts is a + c = 36 + 24 = 60; 3" behind it
    // is 60 - 3 root 2. The piece spans between the two kick fronts, 21" off
    // each wall: (21, 34.757) to (34.757, 21), 19.456" long.
    expect({
      behindChord: Math.round(((60 - (along(front[0], front[1]) + out(front[0], front[1]))) / Math.SQRT2) * 100) / 100,
      length: Math.round(piece.size[0] * 12 * 100) / 100,
      high: inch(piece.size[1]),
    }).toEqual({ behindChord: 3, length: 19.46, high: 4 });
  });

  it("puts none under a blind corner, which is a straight box", () => {
    build("package-a", {});
    expect(CABINETS.filter((b) => b.kind === "toe" && b.rotationY !== undefined)).toEqual([]);
  });
});

describe("the kick's finish, and the rough-in points in a base cabinet", () => {
  it("finishes the kick in the doors' finish, the counter apart", () => {
    expect({ toe: wearsDoorFinish("toe"), counter: wearsDoorFinish("counter") }).toEqual({ toe: true, counter: false });
  });

  it("measures a point in the sink base from the cabinet's floor, 4\" up, with the same figure", () => {
    build("package-a", {});
    // SHV78CM3N's power: "6" from the bottom" of the sink base (data/rough-in.json).
    const power = resolveRoughIn("slot-dishwasher", APPLIANCE_BY_ID["bosch-shv78cm3n"]).find(
      (p) => p.point.type === "power",
    )!;
    expect({ figure: power.point.y, floor: inch(power.host.min[1]), at: inch(power.position[1]) }).toEqual({
      figure: 6,
      floor: 4,
      at: 10,
    });
  });

  it("writes where a base cabinet is once, in cabinets.ts, and the rough-in hosts read it", () => {
    const source = readFileSync(new URL("./roughIn.ts", import.meta.url), "utf8");
    expect({
      copies: (source.match(/ROOM\.counterHeight - ROOM\.counterThickness/g) ?? []).length,
      reads: (source.match(/BASE_CABINET_BAND/g) ?? []).length >= 5,
      band: BASE_CABINET_BAND.map(inch),
    }).toEqual({ copies: 0, reads: true, band: [4, 34.5] });
  });
});

/** The kick along a run, its pieces joined where they meet, in inches. */
function kickSpans(run: CabinetRun): [number, number][] {
  const pieces = CABINETS.filter((b) => b.kind === "toe" && b.run === run.id && b.rotationY === undefined)
    .map((box) => [...alongOf(run, box)] as [number, number])
    .sort((p, q) => p[0] - q[0]);
  const joined: [number, number][] = [];
  for (const [from, to] of pieces) {
    const last = joined[joined.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else joined.push([from, to]);
  }
  return joined;
}

describe("the kick at the cooking surface, every package and every range it offers", () => {
  // Round 92b, from Leo trying it on B and D: the drawer base under their
  // rangetop stood on the kick, and the kick broke there, so a strip of floor
  // showed under it. Whether the kick runs on or breaks is round 83's one
  // answer, `dropsIntoCounter`: a rangetop drops into the stone over a drawer
  // base, which stands on the kick like any base cabinet, so the kick runs on
  // under it; a range — freestanding or slide-in — stands on the floor, so the
  // kick breaks exactly at the machine's two sides (its fillers, round 84,
  // stand on the kick). Every range that fits, then the package's own again.
  it.each(BUILDABLE_PACKAGES.filter((pkg) => slotsOf(pkg)["slot-range"]).map((pkg) => pkg.id))(
    "runs on under a rangetop and breaks at a range's two sides (%s)",
    (id) => {
      build(id, {});
      const pkg = PACKAGES.find((p) => p.id === id)!;
      const own = APPLIANCE_BY_ID[pkg.defaultSelection["slot-range"]!];
      const ranges = candidatesFor("slot-range", pkg).filter((c) => c.fit.fits).map((c) => c.appliance);
      const wrong: string[] = [];
      let rangetops = 0;
      for (const range of [...ranges, own]) {
        if (!setRangeModel(range, id).ok) {
          wrong.push(`${range.model}: refused`);
          continue;
        }
        const run = RUNS.find((r) => r.segments.some((s) => s.slot === "slot-range"))!;
        const segment = run.segments.find((s) => s.slot === "slot-range")!;
        const spans = kickSpans(run);
        const covers = ([from, to]: readonly [number, number]) => spans.some(([a, b]) => a <= from && b >= to);
        const machine = openingAlong(segment).map(inch) as [number, number];
        const opening = [inch(segment.from), inch(segment.to)] as const;
        let got: string;
        if (dropsIntoCounter(range)) {
          rangetops += 1;
          got = covers(opening) ? "runs on" : "broken";
        } else {
          const into = spans.some(([a, b]) => a < machine[1] && b > machine[0]);
          const sides = spans.some(([, b]) => b === machine[0]) && spans.some(([a]) => a === machine[1]);
          got = into ? "runs under the machine" : sides ? "breaks at its sides" : "broken short of its sides";
        }
        const want = dropsIntoCounter(range) ? "runs on" : "breaks at its sides";
        if (got !== want) wrong.push(`${range.model}: ${got}, want ${want}`);
      }
      // How many swaps went in, so an empty list cannot pass (D22, round 72).
      expect({ ranges: ranges.length > 1, wrong }).toEqual({ ranges: true, wrong: [] });
      // The 36" rangetop fits A's, B's and D's 36" openings, not C's 30".
      expect(rangetops > 0).toBe(id !== "package-c");
    },
  );

  it("has no range on a run in package E, which cooks in its island: the island's kick is one piece", () => {
    build("package-e", {});
    expect({
      rangeOnARun: RUNS.some((r) => r.segments.some((s) => s.slot === "slot-range")),
      islandKicks: CABINETS.filter((b) => b.run === "island" && b.kind === "toe").length,
    }).toEqual({ rangeOnARun: false, islandKicks: 1 });
  });
});

describe("nothing stands on the kick over a gap", () => {
  // Every box on a wall run whose foot is 4" up — a base cabinet, a drawer base,
  // a filler, a tower and its boards — has the kick under the whole of it.
  // Asked of every package and arrangement, so a cabinet lifted where the kick
  // breaks shows wherever it is, not only where it was first seen.
  it.each(PACKAGES.map((pkg) => pkg.id))("has the kick under everything standing 4\" up (%s)", (id) => {
    let built = 0;
    let counted = 0;
    const wrong = new Set<string>();
    for (const [name, arrangement] of ARRANGEMENTS) {
      if (!build(id, arrangement)) continue;
      built += 1;
      for (const run of RUNS) {
        const spans = kickSpans(run);
        for (const box of CABINETS.filter((b) => b.run === run.id && b.kind !== "toe" && bottomOf(b) === 4)) {
          counted += 1;
          const [from, to] = alongOf(run, box);
          if (!spans.some(([a, b]) => a <= from && b >= to)) wrong.add(`${name}: ${box.id} (${from}"-${to}")`);
        }
      }
    }
    expect({ built: built > 0, counted: counted > 0, wrong: [...wrong] }).toEqual({
      built: true,
      counted: true,
      wrong: [],
    });
  });
});

describe("after these, the default room", () => {
  it("puts the room back", () => {
    resetRoom();
    expect(setLayoutParams(DEFAULT_PARAMS).ok).toBe(true);
  });
});
