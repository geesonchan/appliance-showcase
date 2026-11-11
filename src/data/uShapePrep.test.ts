/**
 * U-0, the U's preparation (Leo, 2026-11-10: 「开始 U-0（准备，页面不变）」;
 * docs/plans/u-shape-plan.md, third draft, section 6). Nothing on the page
 * changes: the L and one wall build exactly what they built (the dumps and the
 * pixel proof say so). What changes is everything below that still took "one
 * corner, at the low end of the run it eats" or "a run is the left or the back"
 * for granted, so that a U — a back run with a corner at each end, and a right
 * run facing -x that holds the second — can be built on it in U-1.
 *
 * No U is in `SHAPES` yet, so these cases stand a U up by hand: three runs as
 * the plan's section 3 draws them, lopsided where it matters (the back run's two
 * ends are not the same distance from what stands near them).
 */
import { describe, expect, it } from "vitest";
import { cornerKick, diagonalDoor, kickIntoCorners, type CabinetBox } from "./cabinets";
import { checkLayout } from "./layoutRules";
import { cornersOf, SHAPES, validateShape, type ShapeSpec } from "./layoutShape";
import { ROOM, type CabinetRun, type CabinetModule, type RunSegment } from "./room";
import { SLOT_BY_ID } from "./slots";
import type { Slot, SlotId } from "../types";

const ft = (inches: number) => inches / 12;
const IN = (feet: number) => Math.round(feet * 12 * 1e6) / 1e6;

/** The U as a shape: each side leg holds the corner at its back end, the back run is eaten at both. */
const U_SPEC: ShapeSpec = {
  runs: [
    { id: "left", axis: "z", facing: { axis: "x", sign: 1 }, ends: ["corner", "open"] },
    { id: "back", axis: "x", facing: { axis: "z", sign: 1 }, ends: ["corner", "corner"] },
    { id: "right", axis: "z", facing: { axis: "x", sign: -1 }, ends: ["corner", "open"] },
  ],
  corners: [
    { owner: "left", other: "back", at: 0 },
    { owner: "right", other: "back", at: 1 },
  ],
};

// A 132" x 156" room: the back wall at z = -6.5', the side walls at x = ±5.5'.
const HALF_X = ft(66);
const HALF_Z = ft(78);
const D = ROOM.counterDepth;

const M = (code: string, kind: CabinetModule["kind"], widthIn: number, extra: Partial<CabinetModule> = {}): CabinetModule => ({
  code,
  kind,
  widthIn,
  ...extra,
});

type Piece = Omit<RunSegment, "from" | "to"> & { widthIn: number };
const piece = (id: string, kind: RunSegment["kind"], modules: CabinetModule[], extra: Partial<RunSegment> = {}): Piece => ({
  id,
  kind,
  modules,
  widthIn: modules.reduce((sum, m) => sum + m.widthIn, 0),
  ...extra,
});

/** Segments laid end to end from `start`, in feet. */
function lay(start: number, pieces: Piece[]): RunSegment[] {
  let at = start;
  return pieces.map(({ widthIn, ...rest }) => {
    const segment = { ...rest, from: at, to: at + ft(widthIn) };
    at = segment.to;
    return segment;
  });
}

const blind = (id: string) => piece(id, "corner", [M("BBC42", "corner", 42, { depthIn: 24 })]);
const susan = (id: string) => piece(id, "corner", [M("LS36", "corner", 36, { depthIn: 36 })]);
const counter = (id: string, widthIn: number) => piece(id, "counter", [M(`B${widthIn}`, "base", widthIn)]);

function run(id: CabinetRun["id"], pieces: Piece[], ends: CabinetRun["ends"], startAt?: number): CabinetRun {
  const spec = U_SPEC.runs.find((r) => r.id === id)!;
  const half = spec.axis === "x" ? HALF_X : HALF_Z;
  const facingHalf = spec.facing.axis === "x" ? HALF_X : HALF_Z;
  return {
    id,
    axis: spec.axis,
    facing: spec.facing,
    ends,
    centre: -spec.facing.sign * facingHalf + spec.facing.sign * (D / 2),
    segments: lay(startAt ?? -half, pieces),
    uppers: [],
  };
}

/** The back run between the two blind corners: from 24" off the left wall to 24" off the right. */
const backRun = (pieces: Piece[]) => run("back", pieces, ["corner", "corner"], -HALF_X + ft(24));
const leftLeg = (corner = blind("left-corner")) => run("left", [corner, counter("left-landing", 30)], ["corner", "open"]);
const rightLeg = (corner = blind("right-corner")) => run("right", [corner, counter("right-landing", 30)], ["corner", "open"]);

// ---------------------------------------------------------------------------

describe("U-0: a shape's corners, at either end of the run they eat", () => {
  it("says which end of each L run is a corner, and who holds it", () => {
    expect(cornersOf(SHAPES.L, "left")).toEqual(["holds", null]);
    expect(cornersOf(SHAPES.L, "back")).toEqual(["eaten", null]);
  });

  it("says the U's back run is eaten at both ends", () => {
    expect(cornersOf(U_SPEC, "back")).toEqual(["eaten", "eaten"]);
  });

  it("says the U's right run holds its corner at its own back end", () => {
    expect(cornersOf(U_SPEC, "right")).toEqual(["holds", null]);
  });

  it("takes every shape the page builds", () => {
    for (const spec of Object.values(SHAPES)) expect(() => validateShape(spec)).not.toThrow();
  });

  it("takes the U", () => {
    expect(() => validateShape(U_SPEC)).not.toThrow();
  });

  it("refuses a corner eating an end that is not a corner", () => {
    const wrong: ShapeSpec = { ...U_SPEC, corners: [{ owner: "right", other: "back", at: 0 }, { owner: "left", other: "back", at: 0 }] };
    const oneEnd: ShapeSpec = {
      ...U_SPEC,
      runs: U_SPEC.runs.map((r) => (r.id === "back" ? { ...r, ends: ["corner", "wall"] as const } : r)),
    };
    expect(() => validateShape(wrong)).toThrow(/twice/);
    expect(() => validateShape(oneEnd)).toThrow(/back.*high end/);
  });
});

describe("U-0: D11 rule 1 — a tall cabinet hard against a corner, at either end", () => {
  const tower = () => piece("back-tower", "tall", [M("T3096", "tall", 30)], { slot: "slot-oven" });
  const codesOf = (runs: CabinetRun[]) => checkLayout(runs).filter((v) => v.code === "d11-1" && /corner/.test(v.message));

  // Not checked at a run's low end yet: asked there, the check finds 16 of the
  // L's own rooms (E) with the combination oven tower hard against the corner,
  // live. U-0 changes nothing on the page; Leo decides (Open items, "E's L: the
  // combination oven tower hard against the corner").
  it.todo("catches a tower standing first on a run whose first end is a corner it does not hold");

  it("catches a tower standing last on a run whose last end is a corner", () => {
    const runs = [leftLeg(), backRun([counter("back-a", 30), counter("back-b", 24), tower()]), rightLeg()];
    expect(codesOf(runs)).toHaveLength(1);
  });

  it("leaves a tower 12\" clear of the corner alone", () => {
    const runs = [leftLeg(), backRun([counter("back-a", 30), tower(), counter("back-b", 12)]), rightLeg()];
    // Counter after it is rule 1's other half, not this one.
    expect(codesOf(runs)).toHaveLength(0);
  });
});

describe("U-0: D11 rule 10 — the sink clear of the corner at either end", () => {
  const sink = () => piece("back-sink", "fixture", [M("SB30", "sink-base", 30)], { fixture: "fixture-sink" });
  const dishwasher = () => piece("back-dishwasher", "appliance", [M("RO24", "opening", 24)], { slot: "slot-dishwasher" });
  const fromCorner = (runs: CabinetRun[]) =>
    checkLayout(runs).filter((v) => v.code === "d11-10" && /from the corner/.test(v.message));

  it("measures the sink from the corner at the run's high end", () => {
    // 40" of counter to the low corner, 10" to the high one: lopsided on purpose.
    const runs = [leftLeg(), backRun([counter("back-a", 40), dishwasher(), sink(), counter("back-b", 10)]), rightLeg()];
    expect(fromCorner(runs)).toHaveLength(1);
  });

  it("still measures it from the low end", () => {
    const runs = [leftLeg(), backRun([counter("back-a", 10), sink(), dishwasher(), counter("back-b", 40)]), rightLeg()];
    expect(fromCorner(runs)).toHaveLength(1);
  });

  it("passes a sink 18\" from the high corner and 12\" plus a dishwasher from the low one", () => {
    const runs = [leftLeg(), backRun([counter("back-a", 12), dishwasher(), sink(), counter("back-b", 18)]), rightLeg()];
    expect(fromCorner(runs)).toHaveLength(0);
  });
});

describe("U-0: what finishes a run — a corner end is not a finish, at either end", () => {
  const dishwasher = () => piece("back-dishwasher", "appliance", [M("RO24", "opening", 24)], { slot: "slot-dishwasher" });
  const terminal = (runs: CabinetRun[]) => checkLayout(runs).filter((v) => v.code === "d13-terminal" && /back run/.test(v.message));

  it("does not call a machine against the high-end corner the run's finish", () => {
    const runs = [leftLeg(), backRun([counter("back-a", 30), counter("back-b", 30), dishwasher()]), rightLeg()];
    expect(terminal(runs)).toHaveLength(0);
  });
});

describe("U-0: D11 rule 4 — the hood centred on a range standing on a run along z", () => {
  const range = () => piece("right-range", "appliance", [M("RO36", "opening", 36)], { slot: "slot-range" });
  const at = (slot: SlotId, x: number, z: number): Slot => ({ ...SLOT_BY_ID[slot], position: [x, SLOT_BY_ID[slot].position[1], z] });
  const notCentred = (runs: CabinetRun[], slots: Record<SlotId, Slot>) =>
    checkLayout(runs, undefined, undefined, slots).filter((v) => v.code === "d11-4" && /not centred/.test(v.message));

  it("catches a hood slid along the right run, off the range's centre", () => {
    const right = run("right", [blind("right-corner"), counter("right-a", 30), range(), counter("right-b", 30)], ["corner", "open"]);
    const runs = [leftLeg(), backRun([counter("back-a", 84)]), right];
    const x = right.centre;
    const slots = { ...SLOT_BY_ID, "slot-range": at("slot-range", x, 1), "slot-hood": at("slot-hood", x, 1.5) };
    expect(notCentred(runs, slots)).toHaveLength(1);
  });

  it("passes it centred", () => {
    const right = run("right", [blind("right-corner"), counter("right-a", 30), range(), counter("right-b", 30)], ["corner", "open"]);
    const runs = [leftLeg(), backRun([counter("back-a", 84)]), right];
    const x = right.centre;
    const slots = { ...SLOT_BY_ID, "slot-range": at("slot-range", x, 1), "slot-hood": at("slot-hood", x, 1) };
    expect(notCentred(runs, slots)).toHaveLength(0);
  });
});

describe("U-0: a corner susan's door faces the room from either back corner", () => {
  const susanBox = (facing: CabinetBox["facing"]): CabinetBox => ({
    id: "corner",
    kind: "base",
    position: [0, 0, 0],
    size: [3, 2.875, 3],
    run: "left",
    facing,
    module: M("LS36", "corner", 36, { depthIn: 36 }),
  });

  it("puts the back-left corner's door toward +x and +z, as it always has", () => {
    const door = diagonalDoor(susanBox({ axis: "x", sign: 1 }))!;
    expect([Math.sign(door.x), Math.sign(door.z), door.rotationY]).toEqual([1, 1, Math.PI / 4]);
  });

  it("puts the back-right corner's door toward -x and +z", () => {
    const door = diagonalDoor(susanBox({ axis: "x", sign: -1 }))!;
    expect([Math.sign(door.x), Math.sign(door.z), door.rotationY]).toEqual([-1, 1, -Math.PI / 4]);
  });
});

describe("U-0: the toe kick reaches into a corner at either end of the run it eats", () => {
  it("reaches the same way into both of the back run's corners", () => {
    const runs = [leftLeg(), backRun([counter("back-a", 84)]), rightLeg()];
    const [low, high] = kickIntoCorners(runs[1], runs).map(IN);
    // A blind corner is 24" deep; the legs' kick fronts are 21" off their walls.
    expect([low, high]).toEqual([3, 3]);
  });

  it("does not reach out of a run that holds its own corner", () => {
    const runs = [leftLeg(), backRun([counter("back-a", 84)]), rightLeg()];
    expect(kickIntoCorners(runs[2], runs).map(IN)).toEqual([0, 0]);
  });

  it("reaches as far as the susan at each end is deep, lopsided corners and all", () => {
    const runs = [leftLeg(susan("left-corner")), backRun([counter("back-a", 84)]), rightLeg()];
    expect(kickIntoCorners(runs[1], runs).map(IN)).toEqual([15, 3]);
  });

  it("gives the right run's susan its own corner kick, on its own side of the room", () => {
    const right = rightLeg(susan("right-corner"));
    const kick = cornerKick(right);
    expect(kick).not.toBeNull();
    expect(Math.sign(kick!.position[0] - right.centre)).toBe(-1);
  });
});
