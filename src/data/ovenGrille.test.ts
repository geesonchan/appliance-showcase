import { afterAll, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { APPLIANCES } from "./catalogue";
import { isSteamOven } from "./columnModel";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGE_BY_ID } from "./packages";
import type { Appliance, SlotId } from "../types";

/**
 * The grille over a steam oven. Leo, round 38: the air that comes up behind the
 * open-backed cabinets leaves through a louvre in the door of the box stacked on
 * top — for a steam oven, and keyed on the machine rather than on the tower.
 */
afterAll(() => {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
});

function activate(id: string) {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
  const result = setActivePackage(id);
  expect(result.ok, JSON.stringify(result.reasons)).toBe(true);
}

const model = (name: string) => APPLIANCES.find((a) => a.model === name)!;

/** The stacked boxes that carry a grille, for whatever machine `inSlot` puts in each tower. */
const grilleBoxes = (inSlot: (slot: SlotId) => Appliance | undefined) =>
  CABINETS.filter(
    (box) => box.ventSlot !== undefined && box.id.endsWith("-stack") && isSteamOven(inSlot(box.ventSlot)),
  );

describe("the grille over a steam oven", () => {
  it("reads PODS302B as a steam oven, and no other oven in the catalogue", () => {
    expect(APPLIANCES.filter((a) => isSteamOven(a)).map((a) => a.model)).toEqual(["PODS302B"]);
    for (const other of ["MEM301WS", "PO302W", "ME301YP"]) {
      expect(isSteamOven(model(other)), other).toBe(false);
    }
  });

  it("puts one on D's steam oven and none on B's combination oven", () => {
    for (const [id, count] of [
      ["package-d", 1],
      ["package-b", 0],
    ] as const) {
      activate(id);
      const selection = PACKAGE_BY_ID[id].defaultSelection;
      const inSlot = (slot: SlotId) => APPLIANCES.find((a) => a.id === selection[slot]);
      expect(grilleBoxes(inSlot).length, id).toBe(count);
      // Both towers have the stacked box it would go in; only the machine decides.
      expect(CABINETS.filter((box) => box.ventSlot && box.id.endsWith("-stack")).length, id).toBe(1);
    }
  });

  it("follows the machine: a combination oven in D's tower loses it, a steam oven in B's gains it", () => {
    activate("package-d");
    expect(grilleBoxes(() => model("MEM301WS"))).toEqual([]);
    activate("package-b");
    expect(grilleBoxes(() => model("PODS302B")).length).toBe(1);
  });

  it("never puts one over a refrigerator column or the coffee cabinet", () => {
    activate("package-d");
    const slots = new Set(CABINETS.filter((box) => box.ventSlot).map((box) => box.ventSlot));
    expect([...slots]).toEqual(["slot-oven"]);
  });
});
