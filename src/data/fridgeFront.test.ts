import { afterAll, describe, expect, it } from "vitest";
import { CABINETS, type CabinetBox } from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { dimensionsFor } from "./dimensions";
import * as fridgeModel from "./fridgeModel";
import { applianceBox } from "./applianceBox";
import { setActivePackage, setFridgeModel, setLayoutParamsGrowing } from "./layoutState";
import { oneWallWantedIn, wallRequirement, type LayoutParams } from "./layoutTemplate";
import { BUILDABLE_PACKAGES, PACKAGE, PACKAGES } from "./packages";
import { FRIDGE_OPENING, LAYOUT_PARAMS, OMITTED_FOR_WALL, REQUESTED_PARAMS, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { Appliance } from "../types";

/**
 * The refrigerator's front, round of the fridge-front plan
 * (docs/plans/fridge-front-plan.md; Leo's answers of 2026-10-24 and
 * 2026-10-27, written into docs/decisions.md).
 *
 * A built-in refrigerator stands straight against the cabinetry: on the
 * counter's side a plain 3/4" panel the full height, which is the "at least
 * 4" flat" its manual asks the side to give going in (T36BT120NS p. 21,
 * T36IT100NP p. 23); at its end a 3/4" panel against cabinetry, or 3-1/2" of
 * filler against a return wall. Its doors are 35-3/4" (T36BT120NS p. 19,
 * T36IT100NP p. 21), so a 36" opening leaves an eighth each side, and their
 * face is in the plane of the cabinet doors. Every figure below was worked
 * out by hand from those and reported to Leo before it was written here; the
 * cases are the lopsided ones, where the two ends differ.
 */
afterAll(() => resetRoom());

const inches = (ft: number) => Math.round(ft * 12 * 1000) / 1000;
const idOf = (code: string) => PACKAGES.find((entry) => entry.code === code)!.id;
const T36BT = "thermador-t36bt120ns";
const T36IT = "thermador-t36it100np";
const T36FT = "thermador-t36ft820ns";

/** A package's room, in either shape, at the wall it asks for there, and the refrigerator chosen. */
function room(code: string, shape: LayoutParams["shape"], patch: Partial<LayoutParams> = {}, fridge?: string) {
  resetRoom();
  if (!setActivePackage(idOf(code)).ok) throw new Error(`${code} will not build`);
  const asked: LayoutParams = { ...REQUESTED_PARAMS, ...patch, shape };
  const backWallIn =
    shape === "one-wall" && patch.backWallIn === undefined ? Math.max(asked.backWallIn, oneWallWantedIn(asked, PACKAGE)) : asked.backWallIn;
  const built = setLayoutParamsGrowing({ ...asked, backWallIn });
  if (!built.ok) throw new Error(`${code} ${shape} ${JSON.stringify(patch)} refused`);
  if (fridge && !setFridgeModel(APPLIANCE_BY_ID[fridge]).ok) throw new Error(`${code}: ${fridge} refused`);
}

/** The refrigerator's segment, its parts in the order the run has them and how wide it is. */
function segment() {
  for (const run of RUNS) {
    const found = run.segments.find((s) => s.slot === "slot-fridge");
    if (found) return `${found.modules.map((module) => module.code).join(" ")} (${inches(found.to - found.from)})`;
  }
  throw new Error("no refrigerator on any run");
}

/** A box's extent along its run, across it and up, in inches. */
function extents(box: CabinetBox) {
  const run = RUNS.find((candidate) => candidate.id === box.run)!;
  const [along, across] = run.axis === "x" ? [0, 2] : [2, 0];
  const span = (axis: number) =>
    [inches(box.position[axis] - box.size[axis] / 2), inches(box.position[axis] + box.size[axis] / 2)] as const;
  return { along: span(along), across: span(across), up: span(1) };
}

describe("a built-in refrigerator's segment: a 3/4\" side panel, the machine, and its end (Leo, 2026-10-27)", () => {
  it("builds A's own and a built-in in C's, against cabinetry and against a wall, in an L and on one wall", () => {
    expect({
      "A L, cabinet past it": (room("A", "L", { fridgeEndAbuts: "cabinet" }), segment()),
      "A L, wall past it": (room("A", "L", { fridgeEndAbuts: "wall" }), segment()),
      "A one wall": (room("A", "one-wall"), segment()),
      // C keeps its own segment (Leo, 2026-10-24, 4) and the rest goes in a
      // board outside the side panel, on the counter's side.
      "C L, cabinet past it": (room("C", "L", { fridgeEndAbuts: "cabinet" }, T36BT), segment()),
      "C L, wall past it": (room("C", "L", { fridgeEndAbuts: "wall" }, T36BT), segment()),
      "C one wall": (room("C", "one-wall", {}, T36BT), segment()),
    }).toEqual({
      "A L, cabinet past it": "PNL0.75 T3696 PNL0.75 (37.5)",
      "A L, wall past it": "PNL0.75 T3696 BF3.5 (40.25)",
      "A one wall": "BF3.5 T3696 PNL0.75 (40.25)",
      "C L, cabinet past it": "PNL4.5 PNL0.75 T3696 PNL0.75 (42)",
      "C L, wall past it": "PNL2.25 PNL0.75 T3696 BF3.5 (42.5)",
      "C one wall": "BF3.5 T3696 PNL0.75 PNL2.25 (42.5)",
    });
  });

  it("draws no 3\" panels round the machine, and stands each board on the floor to 96\", carried on to 108\", flush with the cabinets", () => {
    room("A", "L", { fridgeEndAbuts: "wall" });
    const own = CABINETS.filter((box) => box.slot === "slot-fridge");
    const base = CABINETS.find((box) => box.run === own[0].run && box.kind === "base")!;
    const boards = own
      .filter((box) => box.module && /^(PNL|BF)/.test(box.module.code) && !box.id.endsWith("-stack"))
      .map((box) => {
        const stack = CABINETS.find((other) => other.id === `${box.id}-stack`);
        const at = extents(box);
        return {
          code: box.module!.code,
          face: box.face,
          wideIn: inches((at.along[1] - at.along[0]) / 12),
          up: at.up,
          stackedTo: stack ? extents(stack).up[1] : null,
          flushWithTheCabinets: JSON.stringify(at.across) === JSON.stringify(extents(base).across),
        };
      });
    expect({
      threeInchPanels: own.filter((box) => /-panel-[ab]$/.test(box.id)).map((box) => box.id),
      boards,
    }).toEqual({
      threeInchPanels: [],
      boards: [
        { code: "PNL0.75", face: "strip", wideIn: 0.75, up: [0, 96], stackedTo: 108, flushWithTheCabinets: true },
        { code: "BF3.5", face: "strip", wideIn: 3.5, up: [0, 96], stackedTo: 108, flushWithTheCabinets: true },
      ],
    });
  });

  it("opens the machine's own 36\" between the boards, 3/4\" from one end of the segment and 3-1/2\" from the other", () => {
    room("A", "L", { fridgeEndAbuts: "wall" });
    const found = RUNS.flatMap((run) => run.segments).find((s) => s.slot === "slot-fridge")!;
    expect({
      openingIn: inches(FRIDGE_OPENING[1] - FRIDGE_OPENING[0]),
      fromTheEnds: [inches(FRIDGE_OPENING[0] - found.from), inches(found.to - FRIDGE_OPENING[1])],
    }).toEqual({ openingIn: 36, fromTheEnds: [0.75, 3.5] });
  });

  it("says the 3-1/2\" at a return wall out loud for A, as it does for C", () => {
    room("A", "L", { fridgeEndAbuts: "wall" });
    const clearance = dimensionsFor(
      Object.fromEntries(BUILDABLE_PACKAGES[0].slots.map((slot) => [slot.slotId, undefined])) as never,
    ).find((d) => d.id === "fridge-door-clearance");
    expect(clearance?.valueIn ?? null).toBe(3.5);
  });
});

describe("the walls A asks for, with the shorter segment (plan section 3.3)", () => {
  const LEFT = { sinkLeg: "back", fridgeEnd: "left", cornerType: "blind", hasIsland: false } as const;
  const BACK = { sinkLeg: "left", fridgeEnd: "back", cornerType: "blind", hasIsland: false } as const;
  const shortest = (patch: Partial<LayoutParams>, leg: "left" | "back") => {
    resetRoom();
    setActivePackage(idOf("A"));
    return wallRequirement({ ...REQUESTED_PARAMS, ...patch }, leg).minimumIn;
  };

  it("asks less of the refrigerator's wall, 4-1/2\" against cabinetry and 1-3/4\" against a wall", () => {
    expect({
      backCabinet: shortest({ ...BACK, fridgeEndAbuts: "cabinet" }, "back"),
      backWall: shortest({ ...BACK, fridgeEndAbuts: "wall" }, "back"),
      leftCabinet: shortest({ ...LEFT, fridgeEndAbuts: "cabinet" }, "left"),
      leftWall: shortest({ ...LEFT, fridgeEndAbuts: "wall" }, "left"),
    }).toEqual({ backCabinet: 124.5, backWall: 127.25, leftCabinet: 96, leftWall: 97.25 });
  });

  it("gives the 4-1/2\" in A's own room to the first base cabinet and a 1-1/2\" filler", () => {
    room("A", "L");
    const left = RUNS.find((run) => run.id === "left")!;
    expect({
      walls: `${LAYOUT_PARAMS.backWallIn} x ${LAYOUT_PARAMS.leftWallIn}`,
      left: left.segments.flatMap((s) => s.modules.map((module) => module.code)).join(" "),
    }).toEqual({ walls: "168 x 144", left: "BBC42 B33 B30 BF1.5 PNL0.75 T3696 PNL0.75" });
  });

  it("builds A on one wall at 236\", and opens an old link's 237-3/4\" as it is, with nothing left out", () => {
    room("A", "one-wall");
    const own = { wallIn: LAYOUT_PARAMS.backWallIn, omitted: [...OMITTED_FOR_WALL] };
    room("A", "one-wall", { backWallIn: 237.75 });
    expect({ own, link: { wallIn: LAYOUT_PARAMS.backWallIn, omitted: [...OMITTED_FOR_WALL], segment: segment() } }).toEqual({
      own: { wallIn: 236, omitted: [] },
      link: { wallIn: 237.75, omitted: [], segment: "BF3.5 T3696 PNL0.75 (40.25)" },
    });
  });

  it("puts a built-in in C's one-wall room with nothing left out and the wall as it was", () => {
    room("C", "one-wall", {}, T36BT);
    expect({ wallIn: LAYOUT_PARAMS.backWallIn, omitted: [...OMITTED_FOR_WALL] }).toEqual({ wallIn: 232.25, omitted: [] });
  });
});

describe("a model that needs more room grows the wall, as D18 does (Leo, 2026-10-24, 5; 2026-10-27, 6/1)", () => {
  const BACK = { sinkLeg: "left", fridgeEnd: "back", cornerType: "blind", hasIsland: false } as const;
  const swapped = (code: string, shape: LayoutParams["shape"], patch: Partial<LayoutParams>, fridge: string) => {
    room(code, shape, patch);
    const standing = [...OMITTED_FOR_WALL];
    const result = setFridgeModel(APPLIANCE_BY_ID[fridge]) as { ok: boolean; grown?: unknown };
    return {
      ok: result.ok,
      grown: result.grown ?? null,
      wallIn: LAYOUT_PARAMS.backWallIn,
      // What the swap left out that was standing before it.
      leftOut: OMITTED_FOR_WALL.filter((slotId) => !standing.includes(slotId)),
      segment: segment(),
    };
  };

  it("grows A's back wall for T36FT820NS, from the shortest wall the built-in builds at", () => {
    expect({
      cabinet: swapped("A", "L", { ...BACK, fridgeEndAbuts: "cabinet", backWallIn: 124.5 }, T36FT),
      wall: swapped("A", "L", { ...BACK, fridgeEndAbuts: "wall", backWallIn: 127.25 }, T36FT),
    }).toEqual({
      cabinet: {
        ok: true,
        grown: [{ key: "backWallIn", fromIn: 124.5, toIn: 129 }],
        wallIn: 129,
        leftOut: [],
        segment: "PNL3 RO36 PNL3 (42)",
      },
      wall: {
        ok: true,
        grown: [{ key: "backWallIn", fromIn: 127.25, toIn: 129.5 }],
        wallIn: 129.5,
        leftOut: [],
        segment: "PNL3 RO36 BF3.5 (42.5)",
      },
    });
  });

  it("grows A's one wall to 238-1/4\" for T36FT820NS rather than leave the microwave drawer and the wine cooler out", () => {
    expect(swapped("A", "one-wall", {}, T36FT)).toEqual({
      ok: true,
      grown: [{ key: "backWallIn", fromIn: 236, toIn: 238.25 }],
      wallIn: 238.25,
      leftOut: [],
      segment: "BF3.5 RO36 PNL3 (42.5)",
    });
  });

  it("grows nothing where the room already has the wall", () => {
    expect(swapped("A", "L", { fridgeEndAbuts: "wall" }, T36FT)).toMatchObject({ ok: true, grown: [], wallIn: 168 });
  });
});

describe("a built-in's doors: 35-3/4\", an eighth each side, their face on the cabinet doors' (Leo, 2026-10-27, 2 and 7)", () => {
  const builtInFront = (fridgeModel as unknown as { builtInFront?: (slot: unknown, appliance: Appliance) => { doorWidthIn: number } | null }).builtInFront;
  const front = (code: string, fridge: string) => {
    room(code, "L", {}, fridge);
    return builtInFront?.(SLOT_BY_ID["slot-fridge"], APPLIANCE_BY_ID[fridge])?.doorWidthIn ?? null;
  };

  it("narrows the doors of the two models whose manuals give 35-3/4\", and only where they stand on their own", () => {
    expect({
      "A T36BT120NS": front("A", T36BT),
      "A T36IT100NP": front("A", T36IT),
      "C T36BT120NS": front("C", T36BT),
      "C T36IT100NP": front("C", T36IT),
      // B's refrigerator stands in its bank (Leo, 2026-10-24, 6), and the
      // columns wait for round 101 (8): as they were.
      "B T36BT120NS": front("B", T36BT),
      "A T30IR905SP": front("A", "thermador-t30ir905sp"),
      "A T36FT820NS": front("A", T36FT),
    }).toEqual({
      "A T36BT120NS": 35.75,
      "A T36IT100NP": 35.75,
      "C T36BT120NS": 35.75,
      "C T36IT100NP": 35.75,
      "B T36BT120NS": null,
      "A T30IR905SP": null,
      "A T36FT820NS": null,
    });
  });

  it("puts the door face 24-3/4\" off the wall, the cabinet doors' plane, with the handle in front of it", () => {
    const offset = (fridgeModel as unknown as { flushDoorOffset?: (appliance: Appliance, d: number) => number }).flushDoorOffset;
    const faces = [T36BT, T36IT].map((fridge) => {
      room("A", "L", {}, fridge);
      const appliance = APPLIANCE_BY_ID[fridge];
      const box = applianceBox(SLOT_BY_ID["slot-fridge"], appliance);
      const stance = fridgeModel.fridgeStance(appliance, box.d);
      // The slot stands on the run's centre line, 12" off the wall.
      const dz = offset ? offset(appliance, box.d) : Number.NaN;
      return {
        doorFaceIn: inches(1 + dz + stance.doorZ + stance.doorThickness / 2),
        handleProudIn: inches(stance.handleZ + stance.handleR - (stance.doorZ + stance.doorThickness / 2)),
      };
    });
    expect(faces).toEqual([
      { doorFaceIn: 24.75, handleProudIn: 1.25 },
      { doorFaceIn: 24.75, handleProudIn: 1.25 },
    ]);
  });

  it("tiles a 35-3/4\" front as it tiles a 36\" one", () => {
    const appliance = APPLIANCE_BY_ID[T36BT];
    const panels = fridgeModel.fridgeParts(appliance, { w: 35.75 / 12, h: 7 });
    const edges = panels.map((panel) => [inches(panel.x - panel.w / 2), inches(panel.x + panel.w / 2)]);
    expect({
      left: Math.min(...edges.map((edge) => edge[0])),
      right: Math.max(...edges.map((edge) => edge[1])),
    }).toEqual({ left: -17.875, right: 17.875 });
  });
});
