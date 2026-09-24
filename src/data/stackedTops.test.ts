import { afterAll, describe, expect, it } from "vitest";
import { CABINETS, standOffFromWall, type CabinetBox } from "./cabinets";
import { APPLIANCES } from "./catalogue";
import { checkLayout } from "./layoutRules";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { CABINET_STANDARDS, ROOM } from "./room";
import { SLOT_BY_ID } from "./slots";
import { TOWER_VENT, towerVents, ventsAtRear } from "./towerVent";
import { defaultSelectionOf } from "./testRoom";
import type { Appliance, SlotId } from "../types";

/**
 * D19: the 108-1/2" ceiling, finished by scheme A. Leo, round 37: every
 * cabinet that stops at 96" carries a 12" stacked box, and the half inch left
 * to the ceiling is the closing scribe D13 already allows.
 */
const inches = (feet: number) => feet * 12;
const PACKAGES = ["package-a", "package-b", "package-c", "package-d"];

afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

/** A package, chosen from the default room. */
function activate(id: string) {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage(id);
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
}

const topOf = (box: CabinetBox) => box.position[1] + box.size[1] / 2;
const bottomOf = (box: CabinetBox) => box.position[1] - box.size[1] / 2;

/** What is wrong with the tops of a set of boxes under the ceiling. */
function topProblems(boxes: CabinetBox[]): string[] {
  const problems: string[] = [];
  const byId = new Map(boxes.map((box) => [box.id, box]));
  for (const box of boxes) {
    if (box.run === "island" || box.installOnly || box.kind === "counter" || box.kind === "toe") continue;
    if (/-crown-\d+$/.test(box.id)) continue;
    const top = inches(topOf(box));
    if (top > inches(ROOM.wallHeight) + 1e-6) problems.push(`${box.id} goes through the ceiling at ${top}"`);

    if (box.id.endsWith("-stack")) {
      const under = byId.get(box.id.slice(0, -"-stack".length));
      if (!under) {
        problems.push(`${box.id} stands on nothing`);
        continue;
      }
      if (Math.abs(bottomOf(box) - topOf(under)) > 1e-6) problems.push(`${box.id} is not on the box under it`);
      const heightIn = Math.round(inches(box.size[1]) * 16) / 16;
      if (!CABINET_STANDARDS.stack.heightsIn.includes(heightIn)) {
        problems.push(`${box.id} is ${heightIn}" tall`);
      }
      const footprint = [0, 2].every(
        (axis) =>
          Math.abs(box.size[axis] - under.size[axis]) < 1e-6 &&
          Math.abs(box.position[axis] - under.position[axis]) < 1e-6,
      );
      if (!footprint) problems.push(`${box.id} does not stand where the box under it stands`);
      const gap = inches(ROOM.wallHeight - topOf(box));
      const { min, max } = CABINET_STANDARDS.closingGapIn;
      if (gap < min - 1e-6 || gap > max + 1e-6) problems.push(`${box.id} leaves ${gap}" to the ceiling`);
      continue;
    }
    if (Math.abs(top - inches(ROOM.upperTop)) < 1e-6 && !byId.has(`${box.id}-stack`)) {
      problems.push(`${box.id} stops at 96" with nothing stacked on it`);
    }
  }
  return problems;
}

/**
 * What is wrong with the box over a hung oven: its front should be in the
 * plane of the run and its back the stand-off clear of the wall. Inches,
 * measured from the slot's centre line along the way it faces.
 */
function bridgeProblems(boxes: CabinetBox[], slotId: SlotId): string[] {
  const slot = SLOT_BY_ID[slotId];
  const bridge = boxes.find((box) => box.slot === slotId && box.id.endsWith("-bridge"));
  if (!bridge) return [`no cabinet over ${slotId}`];
  const sin = Math.sin(slot.rotationY);
  const cos = Math.cos(slot.rotationY);
  const offset = (bridge.position[0] - slot.position[0]) * sin + (bridge.position[2] - slot.position[2]) * cos;
  const depth = Math.abs(bridge.size[0] * sin) + Math.abs(bridge.size[2] * cos);
  const frontIn = inches(offset + depth / 2);
  const backIn = inches(offset - depth / 2);
  const half = inches(ROOM.counterDepth) / 2;
  const problems: string[] = [];
  if (Math.abs(frontIn - half) > 1e-6) problems.push(`its front is ${frontIn - half}" off the run's face`);
  if (Math.abs(backIn + half - TOWER_VENT.bridgeStandOffIn) > 1e-6) {
    problems.push(`its back is ${backIn + half}" off the wall, wants ${TOWER_VENT.bridgeStandOffIn}"`);
  }
  return problems;
}

describe("D19 · the 108-1/2 inch ceiling, finished with stacked boxes", () => {
  it.each(PACKAGES)("stacks a 12 inch box on everything that stops at 96 inches, in %s", (id) => {
    activate(id);
    expect(inches(ROOM.wallHeight)).toBe(108.5);
    expect(CABINETS.filter((box) => box.id.endsWith("-stack")).length, id).toBeGreaterThan(0);
    expect(topProblems(CABINETS), id).toEqual([]);
    expect(checkLayout(), id).toEqual([]);
  });

  it("fails a missing stack, a stack the wrong height, and one off its box", () => {
    activate("package-d");
    const stack = CABINETS.find((box) => box.id.endsWith("-stack") && box.kind === "upper")!;
    const swap = (to: CabinetBox) => CABINETS.map((box) => (box === stack ? to : box));

    expect(topProblems(CABINETS.filter((box) => box !== stack))).not.toEqual([]);
    expect(
      topProblems(
        swap({
          ...stack,
          size: [stack.size[0], stack.size[1] + 3 / 12, stack.size[2]],
          position: [stack.position[0], stack.position[1] + 1.5 / 12, stack.position[2]],
        }),
      ),
    ).not.toEqual([]);
    expect(
      topProblems(swap({ ...stack, position: [stack.position[0] + 1 / 12, stack.position[1], stack.position[2]] })),
    ).not.toEqual([]);
  });

  it("fails a room whose stack is not a stocked height, or leaves more than a scribe", () => {
    activate("package-a");
    const { stackTop, wallHeight } = ROOM;
    try {
      ROOM.stackTop = stackTop + 3 / 12;
      expect(checkLayout().map((v) => v.code)).toContain("d13-stack");
      ROOM.stackTop = stackTop;
      ROOM.wallHeight = wallHeight + 1;
      expect(checkLayout().map((v) => v.code)).toContain("d13-closing-gap");
    } finally {
      ROOM.stackTop = stackTop;
      ROOM.wallHeight = wallHeight;
    }
  });
});

describe("the cabinets over a hung oven", () => {
  /**
   * Round 39, Leo: one condition decides the open backs, the stand-off and the
   * grille — a steam oven in the tower. The run marks the boxes over any hung
   * oven, and the stand-off is applied from the machine in the slot.
   */
  const standing = (_id: string, slotId: SlotId, appliance: Appliance) =>
    CABINETS.filter((box) => box.ventSlot === slotId).map((box) =>
      ventsAtRear(appliance) ? standOffFromWall(box) : box,
    );

  it("stands D's steam oven cabinets off the wall, and leaves B's combination oven against it", () => {
    for (const [id, standsOff] of [
      ["package-d", true],
      ["package-b", false],
    ] as const) {
      activate(id);
      const vent = towerVents(defaultSelectionOf(id)).find((v) => v.slot !== "slot-coffee")!;
      expect(vent.bridgeStandOffIn).toBe(3);
      const appliance = APPLIANCES.find((a) => a.id === PACKAGE_BY_ID[id].defaultSelection[vent.slot])!;
      const boxes = standing(id, vent.slot, appliance);
      // The bridge and the box stacked on it, both marked.
      expect(boxes.map((box) => box.id.replace(/^.*-(bridge(-stack)?)$/, "$1")).sort(), id).toEqual([
        "bridge",
        "bridge-stack",
      ]);
      const problems = bridgeProblems(boxes, vent.slot);
      if (standsOff) expect(problems, id).toEqual([]);
      else expect(problems.some((p) => p.includes("off the wall")), `${id} is against the wall`).toBe(true);
    }
  });

  it("follows the machine: a steam oven in B's tower stands off, a combination oven in D's does not", () => {
    activate("package-b");
    const b = towerVents(defaultSelectionOf("package-b")).find((v) => v.slot !== "slot-coffee")!;
    expect(bridgeProblems(standing("package-b", b.slot, APPLIANCES.find((a) => a.model === "PODS302B")!), b.slot)).toEqual([]);
    activate("package-d");
    const d = towerVents(defaultSelectionOf("package-d")).find((v) => v.slot !== "slot-coffee")!;
    expect(
      bridgeProblems(standing("package-d", d.slot, APPLIANCES.find((a) => a.model === "MEM301WS")!), d.slot),
    ).not.toEqual([]);
  });

  it("fails a box against the wall, or one standing out of the run", () => {
    activate("package-d");
    const vent = towerVents(defaultSelectionOf("package-d")).find((v) => v.slot !== "slot-coffee")!;
    const bridge = standOffFromWall(
      CABINETS.find((box) => box.slot === vent.slot && box.id.endsWith("-bridge"))!,
    );
    const slot = SLOT_BY_ID[vent.slot];
    const along = Math.abs(Math.sin(slot.rotationY)) > 0.5 ? 0 : 2;
    const flush = { ...bridge };
    flush.size = [...bridge.size];
    flush.position = [...bridge.position];
    flush.size[along] = ROOM.counterDepth;
    flush.position[along] = along === 0 ? slot.position[0] : slot.position[2];
    expect(bridgeProblems([flush], vent.slot)).not.toEqual([]);
    const proud = { ...bridge, position: [...bridge.position] as [number, number, number] };
    proud.position[along] += 1 / 12;
    expect(bridgeProblems([proud], vent.slot)).not.toEqual([]);
  });

  it("leaves the refrigerator columns and the coffee cabinet against the wall", () => {
    activate("package-d");
    for (const slotId of ["slot-fridge", "slot-coffee"] as const) {
      const bridge = CABINETS.find((box) => box.slot === slotId && box.id.endsWith("-bridge"));
      if (!bridge) continue;
      const depth = Math.min(bridge.size[0], bridge.size[2]);
      expect(inches(depth), slotId).toBeCloseTo(inches(ROOM.counterDepth), 6);
    }
  });
});

describe("a chimney hood under the 108-1/2 inch ceiling", () => {
  it("raises C's canopy just enough for its chimney to reach, and leaves A's alone", () => {
    activate("package-c");
    const hood = SLOT_BY_ID["slot-hood"];
    const undersideIn = inches(hood.position[1]);
    const clearanceIn = undersideIn - (hood.builtForCooktopIn ?? 36);
    const { chimneyReachIn, aboveCooktopMinIn, aboveCooktopMaxIn } = CABINET_STANDARDS.hood;
    expect(undersideIn + chimneyReachIn).toBeCloseTo(inches(ROOM.wallHeight), 6);
    expect(clearanceIn).toBeCloseTo(30.5, 6);
    expect(clearanceIn).toBeGreaterThanOrEqual(aboveCooktopMinIn);
    expect(clearanceIn).toBeLessThanOrEqual(aboveCooktopMaxIn);
    // On the 30" minimum it would have stopped half an inch short.
    expect(36 + aboveCooktopMinIn + chimneyReachIn).toBeLessThan(inches(ROOM.wallHeight));

    activate("package-a");
    const under = SLOT_BY_ID["slot-hood"];
    expect(inches(under.position[1]) - (under.builtForCooktopIn ?? 36)).toBeCloseTo(aboveCooktopMinIn, 6);
  });
});
