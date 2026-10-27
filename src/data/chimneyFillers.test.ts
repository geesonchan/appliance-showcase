import { afterAll, describe, expect, it } from "vitest";
import { CABINETS, type CabinetBox } from "./cabinets";
import { candidatesFor } from "./candidates";
import { APPLIANCE_BY_ID } from "./catalogue";
import { rangeModelFor } from "./cookingSurface";
import { axisIndex, otherAxis } from "./frame";
import { hoodModelFor, hoodMount } from "./hoodMount";
import { setActivePackage, setHoodModel, setLayoutParamsGrowing, setRangeModel } from "./layoutState";
import { hoodSpan, oneWallWantedIn, wallRequirement, type LayoutParams } from "./layoutTemplate";
import { BUILDABLE_PACKAGES, PACKAGE, slotsOf } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import type { CabinetModule, CabinetRun, UpperBank } from "./roomShell";
import { resetRoom } from "./testRoom";
import type { Appliance, Package, SlotId } from "../types";

/**
 * A chimney hood narrower than its opening has a filler each side of it, in
 * the wall cabinets. Leo, 2026-10-24 (D16, amended; `docs/plans/
 * chimney-fillers-plan.md`), his site practice, overturning round 87's "the
 * gap is left open":
 * - drawn as cabinetry only — on no list;
 * - as wide as the gap: HMCB30WS in a 36" opening, 3-1/32" each side;
 * - flush with the wall cabinets' doors and in their finish (round 84's
 *   seamless filler);
 * - from the wall cabinets' 54" to 108" with them, the crown over it;
 * - for any chimney hood narrower than its opening, not one model.
 *
 * The wall cabinets still break at the opening, so nothing along the wall
 * moves: the two banks beside the hood each reach into it by the filler.
 */

afterAll(() => resetRoom());

const HMCB30WS = APPLIANCE_BY_ID["thermador-hmcb30ws"];
const HMCB36WS = APPLIANCE_BY_ID["thermador-hmcb36ws"];
const inches = (feet: number) => Math.round(feet * 12 * 100000) / 100000;

/** A package's room in a shape, as the page opens on it there. */
function enter(entry: Package, shape: "L" | "one-wall") {
  resetRoom();
  if (!setActivePackage(entry.id).ok) throw new Error(`${entry.code} will not build`);
  if (shape === "L") return;
  const asked: LayoutParams = { ...REQUESTED_PARAMS, shape: "one-wall" };
  asked.backWallIn = Math.max(asked.backWallIn, oneWallWantedIn(asked, entry));
  if (!setLayoutParamsGrowing(asked).ok) throw new Error(`${entry.code} on one wall will not build`);
}

/** Every model a slot of the room standing now takes. */
const fitting = (slotId: SlotId): Appliance[] =>
  slotsOf(PACKAGE)[slotId]
    ? candidatesFor(slotId, PACKAGE)
        .filter((candidate) => candidate.fit.fits)
        .map((candidate) => candidate.appliance)
    : [];

/** Every room with a chimney hood in it: each package, shape, range its opening takes and chimney hood its hood opening takes. */
function chimneyRooms(): { name: string; build: () => void }[] {
  const rooms: { name: string; build: () => void }[] = [];
  for (const entry of BUILDABLE_PACKAGES) {
    for (const shape of ["L", "one-wall"] as const) {
      enter(entry, shape);
      const ranges = fitting("slot-range");
      for (const range of ranges.length > 0 ? ranges : [undefined]) {
        enter(entry, shape);
        if (range) setRangeModel(range);
        for (const hood of fitting("slot-hood").filter((candidate) => hoodMount(candidate) === "chimney")) {
          const build = () => {
            enter(entry, shape);
            if (range) setRangeModel(range);
            setHoodModel(hood);
          };
          build();
          const name = `${entry.code} ${shape} ${(rangeModelFor(PACKAGE) as Appliance | undefined)?.model ?? "own rangetop"} ${hoodModelFor(PACKAGE)?.model}`;
          rooms.push({ name, build });
        }
      }
    }
  }
  return rooms;
}

/** Where a box starts and stops along a run, in feet. */
function along(run: CabinetRun, box: CabinetBox): [number, number] {
  const i = axisIndex(run.axis);
  return [box.position[i] - box.size[i] / 2, box.position[i] + box.size[i] / 2];
}

/** What stands in the wall cabinets at each flank of the hood, as drawn. */
function besideTheHood() {
  const spec = slotsOf(PACKAGE);
  for (const run of RUNS) {
    const span = hoodSpan(run.segments, spec);
    if (!span) continue;
    /**
     * The wall cabinets' module standing inside the opening at one of its
     * flanks, and its bank. A bridge or a housing is the hood's own, not a
     * bank reaching in.
     */
    const reaching = (flank: "start" | "end") => {
      for (const bank of run.uppers) {
        let at = bank.from;
        for (const [index, module] of bank.modules.entries()) {
          const from = at;
          const to = (at += module.widthIn / 12);
          if (module.slot === "slot-hood") continue;
          const within = from >= span[0] - 1e-9 && to <= span[1] + 1e-9;
          const atFlank = flank === "start" ? Math.abs(from - span[0]) < 1e-9 : Math.abs(to - span[1]) < 1e-9;
          if (within && atFlank) return { bank, module, index };
        }
      }
      return null;
    };
    const describe = (found: { bank: UpperBank; module: CabinetModule; index: number } | null) => {
      if (!found) return null;
      const { bank, module, index } = found;
      const box = CABINETS.find((candidate) => candidate.module === module);
      if (!box) return { widthIn: module.widthIn, kind: module.kind, drawn: false };
      const neighbour = bank.modules[index === 0 ? 1 : index - 1];
      const beside = CABINETS.find((candidate) => candidate.module === neighbour);
      const across = axisIndex(otherAxis(run.axis));
      const stack = CABINETS.find((candidate) => candidate.id === `${box.id}-stack`);
      const [a0, a1] = along(run, box);
      const crown = CABINETS.some(
        (candidate) =>
          candidate.id.startsWith(`${bank.id}-crown-`) && along(run, candidate)[0] <= a0 + 1e-9 && along(run, candidate)[1] >= a1 - 1e-9,
      );
      return {
        widthIn: inches(a1 - a0),
        kind: module.kind,
        face: box.face ?? "door",
        fromIn: inches(box.position[1] - box.size[1] / 2),
        toIn: inches(box.position[1] + box.size[1] / 2),
        // Its front in the plane of the wall cabinet's beside it, as deep.
        flush:
          !!beside &&
          Math.abs(box.position[across] - beside.position[across]) < 1e-9 &&
          Math.abs(box.size[across] - beside.size[across]) < 1e-9,
        stack: stack
          ? {
              fromIn: inches(stack.position[1] - stack.size[1] / 2),
              toIn: inches(stack.position[1] + stack.size[1] / 2),
              widthIn: inches(along(run, stack)[1] - along(run, stack)[0]),
              face: stack.face ?? "door",
            }
          : null,
        crown,
      };
    };
    // "left" and "right" along the run: the opening's start and its end.
    return {
      openingIn: inches(span[1] - span[0]),
      left: describe(reaching("start")),
      right: describe(reaching("end")),
    };
  }
  return null;
}

/** HMCB30WS's 29-15/16" in a 36" opening: 3-1/32" each side, 54" to 96", a board on it to 108", under the crown. */
const FILLER = {
  widthIn: 3.03125,
  kind: "filler",
  face: "strip",
  fromIn: 54,
  toIn: 96,
  flush: true,
  stack: { fromIn: 96, toIn: 108, widthIn: 3.03125, face: "strip" },
  crown: true,
};

/** The 31 rooms (the plan's section 1): A, B and D with any of their five ranges, in the L and on one wall, and E's rangetop on one wall. */
const RANGES = ["PRG366WH", "PCG366W", "PRG304WH", "HIS8055U", "MFGS4030RS"];
const FILLED = [
  ...["A", "B", "D"].flatMap((code) =>
    ["L", "one-wall"].flatMap((shape) => RANGES.map((range) => `${code} ${shape} ${range} HMCB30WS`)),
  ),
  "E one-wall own rangetop HMCB30WS",
].sort();

describe("a chimney hood narrower than its opening has a filler each side, in the wall cabinets (Leo, 2026-10-24)", () => {
  const rooms = chimneyRooms();

  it("in the 31 rooms where one is: 3-1/32\" each side, 54\" to 108\", flush with the doors, under the crown", () => {
    const seen: Record<string, unknown> = {};
    for (const room of rooms.filter((candidate) => FILLED.includes(candidate.name))) {
      room.build();
      seen[room.name] = besideTheHood();
    }
    expect(Object.keys(seen).sort()).toEqual(FILLED);
    expect(seen).toEqual(Object.fromEntries(FILLED.map((name) => [name, { openingIn: 36, left: FILLER, right: FILLER }])));
  });

  it("and in no other: HMCB36WS in a 36\" opening and C's HMCB30WS in its 30\" are a scribe each side, and the wall cabinets stop at the opening", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const room of rooms) {
      if (FILLED.includes(room.name)) continue;
      room.build();
      const beside = besideTheHood();
      checked += 1;
      if (beside?.left || beside?.right) wrong.push(`${room.name}: ${JSON.stringify(beside)}`);
    }
    expect({ checked, wrong }).toEqual({ checked: 37, wrong: [] });
  });

  it("comes and goes with the hood in the same room: HMCB30WS, HMCB36WS and back", () => {
    enter(PACKAGE_A, "L");
    const steps = [HMCB30WS, HMCB36WS, HMCB30WS].map((hood) => {
      const { rebuilt } = setHoodModel(hood);
      const beside = besideTheHood();
      return `${hood.model} rebuilt ${rebuilt}: ${beside?.left?.kind ?? "nothing"} ${beside?.left?.widthIn ?? ""} | ${beside?.right?.kind ?? "nothing"} ${beside?.right?.widthIn ?? ""}`;
    });
    expect(steps).toEqual([
      // From A's own under-cabinet hood: it hangs differently, so the room was always built again.
      "HMCB30WS rebuilt true: filler 3.03125 | filler 3.03125",
      "HMCB36WS rebuilt true: nothing  | nothing ",
      "HMCB30WS rebuilt true: filler 3.03125 | filler 3.03125",
    ]);
  });

  it("leaves every wall's lengths as they were: the fillers are in the wall cabinets, and the wall's list is what stands on the floor", () => {
    const changed: string[] = [];
    for (const name of FILLED) {
      const room = rooms.find((candidate) => candidate.name === name)!;
      room.build();
      const legs = RUNS.map((run) => run.id).filter((leg): leg is "left" | "back" => leg === "left" || leg === "back");
      const narrow = legs.map((leg) => JSON.stringify(wallRequirement(REQUESTED_PARAMS, leg)));
      setHoodModel(HMCB36WS);
      const wide = legs.map((leg) => JSON.stringify(wallRequirement(REQUESTED_PARAMS, leg)));
      if (narrow.join() !== wide.join()) changed.push(name);
    }
    expect(changed).toEqual([]);
  });
});

const PACKAGE_A = BUILDABLE_PACKAGES.find((entry) => entry.code === "A")!;
