import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS, type LayoutParams } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { SLOT_BY_ID } from "./slots";
import { TOWER_VENT, towerVents, ventInSlot, type TowerVent } from "./towerVent";

/**
 * The vent in the top of a hung oven's opening. Leo, round 32: at the back of
 * the shelf over the machine, where it cannot be seen, rather than in the
 * drawer or the toe kick under it, where it can.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

/** A package, chosen from the default room, and the room it landed in. */
function activate(id: string): LayoutParams {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage(id);
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
  return { ...DEFAULT_PARAMS, ...PACKAGE_BY_ID[id].defaultLayout, ...(result.adjusted ?? {}) };
}

/** What is wrong with a vent, measured against the cabinet it is cut in. */
function ventProblems(vent: TowerVent): string[] {
  const slot = SLOT_BY_ID[vent.slot];
  const problems: string[] = [];
  const bridge = CABINETS.find((box) => box.slot === vent.slot && box.id.endsWith("-bridge"));
  if (!bridge) return [`no cabinet over ${vent.slot} to cut a vent in`];
  const shelfIn = (bridge.position[1] - bridge.size[1] / 2) * 12;
  const at = ventInSlot(vent);
  if (Math.abs(at.heightIn - shelfIn) > 1e-6) {
    problems.push(`vent at ${at.heightIn}", the top of the opening is ${shelfIn}"`);
  }
  if (Math.abs(at.backEdgeIn) > 1e-6) {
    problems.push(`vent's back edge is ${at.backEdgeIn}" off the back of the opening`);
  }
  if (at.frontEdgeIn > 3 + 1e-6) problems.push(`vent reaches ${at.frontEdgeIn}" forward, wants 2"-3"`);
  if (vent.depthIn < 2 || vent.depthIn > 3) problems.push(`vent is ${vent.depthIn}" deep, wants 2"-3"`);
  if (vent.widthIn > slot.cutout.w || vent.widthIn < slot.cutout.w - 3) {
    problems.push(`vent is ${vent.widthIn}" wide in a ${slot.cutout.w}" opening`);
  }
  return problems;
}

describe("tower vent", () => {
  it("cuts one in the top of each hung oven's opening, at the back, in B and D", () => {
    for (const id of ["package-b", "package-d"]) {
      activate(id);
      const vents = towerVents();
      expect(vents.length, id).toBe(1);
      for (const vent of vents) {
        expect(SLOT_BY_ID[vent.slot].position[1], `${id} hangs off the floor`).toBeGreaterThan(0);
        expect(ventProblems(vent), id).toEqual([]);
        expect(vent.depthIn).toBe(TOWER_VENT.depthIn);
        expect(vent.widthIn).toBe(SLOT_BY_ID[vent.slot].cutout.w - 1.5);
      }
    }
    expect(PACKAGE_BY_ID["package-d"].defaultSelection["slot-oven"]).toBeTruthy();
  });

  it("gives none to a tower that stands on the floor or has a machine under it", () => {
    for (const id of ["package-a", "package-c"]) {
      activate(id);
      expect(towerVents(), id).toEqual([]);
    }
    activate("package-d");
    const slots = towerVents().map((vent) => vent.slot);
    expect(slots).not.toContain("slot-coffee");
    expect(slots).not.toContain("slot-fridge");
    expect(slots).not.toContain("slot-freezer");
    expect(slots).not.toContain("slot-wine");
  });

  it("follows the tower to the other side of the range", () => {
    const room = activate("package-b");
    for (const towerSide of ["left", "right"] as const) {
      const result = setLayoutParams({ ...room, towerSide });
      expect(result.ok, `${towerSide}: ${JSON.stringify(result.reasons)}`).toBe(true);
      const vents = towerVents();
      expect(vents.length, towerSide).toBe(1);
      for (const vent of vents) expect(ventProblems(vent), towerSide).toEqual([]);
    }
    setLayoutParams(room);
  });

  it("fails a vent under the machine, one out at the front, or one the wrong size", () => {
    activate("package-d");
    const [vent] = towerVents();
    const slot = SLOT_BY_ID[vent.slot];
    // In the drawer, under the opening.
    expect(
      ventProblems({ ...vent, position: [vent.position[0], slot.position[1] - 1 / 12, vent.position[2]] }),
    ).not.toEqual([]);
    // At the front of the shelf, where it shows.
    const out = ventInSlot(vent);
    const forward = (slot.cutout.d - out.frontEdgeIn) / 12;
    const cos = Math.cos(slot.rotationY);
    const sin = Math.sin(slot.rotationY);
    expect(
      ventProblems({
        ...vent,
        position: [vent.position[0] + forward * sin, vent.position[1], vent.position[2] + forward * cos],
      }),
    ).not.toEqual([]);
    // Too deep, and too narrow.
    expect(ventProblems({ ...vent, depthIn: 6 })).not.toEqual([]);
    expect(ventProblems({ ...vent, widthIn: 12 })).not.toEqual([]);
  });
});
