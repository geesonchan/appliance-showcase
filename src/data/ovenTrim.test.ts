import { afterAll, describe, expect, it } from "vitest";
import { flushOffset } from "./applianceBox";
import { CABINETS } from "./cabinets";
import { APPLIANCES } from "./catalogue";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { OVEN_TRIM, CABINET_DOOR_IN, standardInstall, type StandardInstall } from "./ovenTrim";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { ROOM } from "./room";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, SlotId } from "../types";

/**
 * A hung oven's standard install. Leo, round 36: the trim laps the cutout and
 * the machine's front is in the plane of the tower's doors, not back inside
 * the hole.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

const TOWERS = [
  ["package-b", "slot-microwave"],
  ["package-d", "slot-oven"],
] as const;

/** A package, chosen from the default room, and the machine in its tower. */
function tower(id: string, slotId: SlotId): Appliance {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage(id);
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
  const appliance = APPLIANCES.find((a) => a.id === PACKAGE_BY_ID[id].defaultSelection[slotId]);
  if (!appliance) throw new Error(`${id} has nothing in ${slotId}`);
  return appliance;
}

/**
 * The front of the doors on the cabinet over the opening, in inches in front
 * of the slot's centre line — read off the cabinet the room actually built.
 */
function doorFrontIn(slotId: SlotId): number {
  const slot = SLOT_BY_ID[slotId];
  const bridge = CABINETS.find((box) => box.slot === slotId && box.id.endsWith("-bridge"));
  if (!bridge) throw new Error(`no cabinet over ${slotId}`);
  // A box on the left wall opens toward +x, one on the back wall toward +z.
  const depth = bridge.size[0] < bridge.size[2] ? bridge.size[0] : bridge.size[2];
  const offset =
    (bridge.position[0] - slot.position[0]) * Math.sin(slot.rotationY) +
    (bridge.position[2] - slot.position[2]) * Math.cos(slot.rotationY);
  return (offset + depth / 2) * 12 + CABINET_DOOR_IN;
}

/** What is wrong with an install, against the tower it is in and the machine's own sheet. */
function installProblems(
  model: string,
  slotId: SlotId,
  install: StandardInstall,
): string[] {
  const sheet = OVEN_TRIM[model];
  const slot = SLOT_BY_ID[slotId];
  const problems: string[] = [];
  const off = install.faceIn - doorFrontIn(slotId);
  if (Math.abs(off) > 0.125 + 1e-9) problems.push(`front is ${off}" from the door plane`);
  const { top, sides, bottom } = install.overlapIn;
  if (sides !== sheet.sidesIn) problems.push(`trim laps ${sides}" each side, the sheet says ${sheet.sidesIn}"`);
  if (bottom !== sheet.bottomIn) problems.push(`trim laps ${bottom}" at the bottom, the sheet says ${sheet.bottomIn}"`);
  if (top < sheet.topIn.min - 1e-9 || top > sheet.topIn.max + 1e-9) {
    problems.push(`trim laps ${top}" at the top, the sheet says ${sheet.topIn.min}"-${sheet.topIn.max}"`);
  }
  if (Math.abs((install.bodyIn.w - install.chassisIn.w) / 2 - sides) > 1e-9) {
    problems.push(`the trim's border is not the ${sides}" it laps`);
  }
  if (Math.abs(install.chassisIn.h + top + bottom - install.bodyIn.h) > 1e-9) {
    problems.push("the trim's border does not add up to the machine");
  }
  if (Math.abs(install.chassisIn.h - slot.cutout.h) > 1e-9) {
    problems.push(`what goes in the hole is ${install.chassisIn.h}", the hole is ${slot.cutout.h}"`);
  }
  if (install.faceIn - install.bodyIn.d < -(ROOM.counterDepth * 12) / 2 - 1e-9) {
    problems.push("its back is in the wall");
  }
  if (install.handleProudIn !== sheet.handleProudIn) problems.push(`handle ${install.handleProudIn}" proud`);
  return problems;
}

describe("a hung oven's standard install", () => {
  it("stands its front in the plane of the tower's doors, with the sheet's trim, in B and D", () => {
    for (const [id, slotId] of TOWERS) {
      const appliance = tower(id, slotId);
      const install = standardInstall(SLOT_BY_ID[slotId], appliance);
      expect(install, id).not.toBeNull();
      expect(installProblems(appliance.model, slotId, install!), id).toEqual([]);
    }
  });

  it("uses each machine's own figures", () => {
    // The package first: the slot is read from the room it builds.
    const combo = tower("package-b", "slot-microwave");
    const b = standardInstall(SLOT_BY_ID["slot-microwave"], combo)!;
    expect(b.bodyIn).toEqual({ w: 29.75, h: 49, d: 24.5 });
    expect(b.overlapIn).toEqual({ top: 0.5, sides: 0.5625, bottom: 0 });
    expect(b.handleProudIn).toBe(2.375);

    const steam = tower("package-d", "slot-oven");
    const d = standardInstall(SLOT_BY_ID["slot-oven"], steam)!;
    expect(d.bodyIn).toEqual({ w: 29.75, h: 48.875, d: 24.5 });
    expect(d.overlapIn).toEqual({ top: 1.5, sides: 0.5625, bottom: 0 });
    expect(d.handleProudIn).toBe(2.625);
    // The standard cutout is the 30" opening less a 3/4" cabinet side each side.
    expect(d.cutoutWidthIn).toBe(28.5);
    expect(d.sideIn).toBe(0.75);
  });

  it("fails the old recessed placement, a trim the wrong size, and one that misses the top", () => {
    for (const [id, slotId] of TOWERS) {
      const appliance = tower(id, slotId);
      const slot = SLOT_BY_ID[slotId];
      const install = standardInstall(slot, appliance)!;
      // Before round 36: flush with the face less the handle's reach, which put
      // the door skin two inches back inside the hole.
      const recessed =
        flushOffset(slot, install.bodyIn.d / 12) * 12 + install.bodyIn.d / 2 - install.handleProudIn;
      expect(installProblems(appliance.model, slotId, { ...install, faceIn: recessed }), id).not.toEqual([]);
      // 5/8" a side is what the two widths give; the sheet says 9/16".
      expect(
        installProblems(appliance.model, slotId, {
          ...install,
          overlapIn: { ...install.overlapIn, sides: 0.625 },
          chassisIn: { ...install.chassisIn, w: install.bodyIn.w - 1.25 },
        }),
        id,
      ).not.toEqual([]);
      // A trim that stops at the top of the hole rather than lapping over it.
      expect(
        installProblems(appliance.model, slotId, {
          ...install,
          overlapIn: { ...install.overlapIn, top: 0 },
          chassisIn: { ...install.chassisIn, h: install.bodyIn.h },
        }),
        id,
      ).not.toEqual([]);
    }
  });

  it("leaves a machine with no published trim, or not in a tower, to the old placement", () => {
    const appliance = tower("package-d", "slot-oven");
    expect(standardInstall(SLOT_BY_ID["slot-oven"], { ...appliance, model: "NOSHEET" })).toBeNull();
    const drawer = APPLIANCES.find((a) => a.model === "MD24BS")!;
    expect(standardInstall(SLOT_BY_ID["slot-microwave"], drawer)).toBeNull();
  });
});
