import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS, type LayoutParams } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import { APPLIANCES } from "./catalogue";
import { SLOT_BY_ID } from "./slots";
import { TOWER_VENT, towerVents, ventInSlot, type TowerVent } from "./towerVent";
import { defaultSelectionOf } from "./testRoom";

/**
 * The vent in the top of a hung oven's opening. Leo, round 32: at the back of
 * the shelf over the machine, where it cannot be seen, rather than in the
 * drawer or the toe kick under it, where it can.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

/** The vents in the room the package stands in, asked with its own machines. */
const ventsOf = (id: string) => towerVents(defaultSelectionOf(id));
const ovenVent = (id: string) => ventsOf(id).find((vent) => vent.slot !== "slot-coffee")!;

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
      // The ovens'. D's coffee cabinet has one too since round 73, below.
      const vents = ventsOf(id).filter((vent) => vent.slot !== "slot-coffee");
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

  it("gives none to a tower that stands on the floor", () => {
    for (const id of ["package-a", "package-c"]) {
      activate(id);
      expect(ventsOf(id), id).toEqual([]);
    }
    activate("package-d");
    const slots = ventsOf("package-d").map((vent) => vent.slot);
    expect(slots).not.toContain("slot-fridge");
    expect(slots).not.toContain("slot-freezer");
    expect(slots).not.toContain("slot-wine");
  });

  it("follows the tower to the other side of the range", () => {
    const room = activate("package-b");
    for (const towerSide of ["left", "right"] as const) {
      const result = setLayoutParams({ ...room, towerSide });
      expect(result.ok, `${towerSide}: ${JSON.stringify(result.reasons)}`).toBe(true);
      const vents = ventsOf("package-b");
      expect(vents.length, towerSide).toBe(1);
      for (const vent of vents) expect(ventProblems(vent), towerSide).toEqual([]);
    }
    setLayoutParams(room);
  });

  it("fails a vent under the machine, one out at the front, or one the wrong size", () => {
    activate("package-d");
    const vent = ovenVent("package-d");
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

/**
 * Round 73: which tower breathes at its back is the machine's, recorded per
 * model with where it comes from — TCM24PS's manual (p. 11), Leo's site
 * practice for PODS302B — not "is it a steam oven". One assertion each.
 */
describe("tower vent, by the machine's rearVent", () => {
  it("records it for exactly TCM24PS (its manual) and PODS302B (Leo's site practice)", () => {
    const recorded = APPLIANCES.filter((a) => a.rearVent).map((a) => `${a.model}:${a.rearVent!.source}`);
    expect(recorded.sort()).toEqual(["PODS302B:site", "TCM24PS:manual"]);
  });

  it("gives D's coffee machine a vent in the top of its opening, over its dishwasher", () => {
    activate("package-d");
    expect(ventsOf("package-d").map((vent) => vent.slot).sort()).toEqual(["slot-coffee", "slot-oven"]);
  });

  it("gives E's coffee machine a vent in the top of its opening, over its wine cooler", () => {
    activate("package-e");
    expect(ventsOf("package-e").map((vent) => vent.slot)).toEqual(["slot-coffee"]);
  });

  it("cuts the coffee machine's where every other is cut: at the back of the shelf over the opening", () => {
    activate("package-e");
    const coffee = ventsOf("package-e").find((vent) => vent.slot === "slot-coffee")!;
    expect(ventProblems(coffee)).toEqual([]);
  });

  /**
   * The fault this round found on the live site: E's coffee cabinet, with
   * nothing under it, was taken for a hung oven and given a vent under a
   * cabinet with a solid back — a hole to nowhere. A coffee machine with no
   * `rearVent` and nothing under it gets none.
   */
  it("does not take a coffee machine for a hung oven", () => {
    const id = "test-coffee-over-a-cabinet";
    const e = PACKAGE_BY_ID["package-e"];
    PACKAGE_BY_ID[id] = {
      ...e,
      id,
      slots: e.slots
        .filter((slot) => slot.slotId !== "slot-wine-2")
        .map((slot) => (slot.slotId === "slot-coffee" ? { ...slot, standsOver: null } : slot)),
      defaultSelection: Object.fromEntries(
        Object.entries(e.defaultSelection).filter(([slot]) => slot !== "slot-wine-2"),
      ) as typeof e.defaultSelection,
    };
    activate(id);
    const selection = defaultSelectionOf(id);
    const quiet = { ...selection["slot-coffee"], rearVent: null };
    const slots = towerVents({ ...selection, "slot-coffee": quiet }).map((vent) => vent.slot);
    delete PACKAGE_BY_ID[id];
    expect(slots).not.toContain("slot-coffee");
  });
});
