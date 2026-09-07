import { afterEach, describe, expect, it } from "vitest";
import { CABINETS } from "./cabinets";
import { FIXTURE_BY_ID } from "./fixtures";
import { setLayoutParams } from "./layoutState";
import { DEFAULT_PARAMS } from "./layoutTemplate";
import { ISLAND, LAYOUT_ISSUES, LAYOUT_PARAMS, RUN_BY_ID, segmentForSlot } from "./room";
import { SLOT_BY_ID } from "./slots";

/**
 * The room can be rebuilt while the page is running, and everything derived
 * from it has to move together. These are the assertions that would fail if one
 * of the rebuilds were left out of the chain — a cabinet run from one layout
 * standing around appliances from another.
 */
afterEach(() => {
  setLayoutParams(DEFAULT_PARAMS);
});

const module = (code: string) => CABINETS.find((box) => box.module?.code === code);

describe("changing a parameter changes the whole room", () => {
  it("moves the appliances with the cabinets", () => {
    expect(segmentForSlot("slot-fridge")!.id.startsWith("left")).toBe(true);

    setLayoutParams({ ...DEFAULT_PARAMS, fridgeEnd: "back", sinkLeg: "left" });

    const tower = segmentForSlot("slot-fridge")!;
    expect(tower.id.startsWith("back")).toBe(true);
    // The slot is placed on the run it now sits in, not where it used to be.
    expect(SLOT_BY_ID["slot-fridge"].position[2]).toBeCloseTo(RUN_BY_ID.back.centre, 6);
  });

  it("re-cuts the carcass around the appliances that moved", () => {
    setLayoutParams({ ...DEFAULT_PARAMS, fridgeEnd: "back", sinkLeg: "left" });

    const tower = module("T4296")!;
    expect(tower).toBeDefined();
    // A box on the back run is centred on the back run's line.
    expect(tower.position[2]).toBeCloseTo(RUN_BY_ID.back.centre, 6);
  });

  it("takes the sink and the dishwasher with the refrigerator", () => {
    setLayoutParams({ ...DEFAULT_PARAMS, fridgeEnd: "back", sinkLeg: "left" });

    expect(FIXTURE_BY_ID["fixture-sink"].position[0]).toBeCloseTo(RUN_BY_ID.left.centre, 6);
    expect(SLOT_BY_ID["slot-dishwasher"].position[0]).toBeCloseTo(RUN_BY_ID.left.centre, 6);
  });

  it("resizes the island and the openings in it", () => {
    const before = ISLAND.x[1] - ISLAND.x[0];
    setLayoutParams({ ...DEFAULT_PARAMS, islandLengthIn: 96 });

    expect((ISLAND.x[1] - ISLAND.x[0]) * 12).toBeCloseTo(96, 6);
    expect(ISLAND.x[1] - ISLAND.x[0]).toBeGreaterThan(before);
    expect(SLOT_BY_ID["slot-microwave"].position[0]).toBeGreaterThanOrEqual(ISLAND.x[0]);
    expect(SLOT_BY_ID["slot-wine"].position[0]).toBeLessThanOrEqual(ISLAND.x[1]);
  });

  it("puts everything back when the parameters go back", () => {
    setLayoutParams({ ...DEFAULT_PARAMS, fridgeEnd: "back", sinkLeg: "left", islandLengthIn: 96 });
    setLayoutParams(DEFAULT_PARAMS);

    expect(segmentForSlot("slot-fridge")!.id.startsWith("left")).toBe(true);
    expect((ISLAND.x[1] - ISLAND.x[0]) * 12).toBeCloseTo(DEFAULT_PARAMS.islandLengthIn, 6);
  });
});

describe("every box the generator produces can be told apart", () => {
  // A 72" stretch of wall is two W3642s. Naming a box after its module alone
  // gave them the same id, and React drew one of them.
  it("gives every cabinet a unique id, whatever the parameters", () => {
    for (const fridgeEnd of ["left", "back"] as const) {
      for (let islandLengthIn = 48; islandLengthIn <= 96; islandLengthIn += 6) {
        const sinkLeg = fridgeEnd === "left" ? ("back" as const) : ("left" as const);
        setLayoutParams({ ...DEFAULT_PARAMS, fridgeEnd, sinkLeg, islandLengthIn });
        const ids = CABINETS.map((box) => box.id);
        const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(duplicates, `${fridgeEnd} / ${islandLengthIn}"`).toEqual([]);
      }
    }
  });
});

describe("a refusal leaves the room standing", () => {
  it("keeps the layout and hands back the reason", () => {
    const standing = LAYOUT_PARAMS;
    const result = setLayoutParams({ ...DEFAULT_PARAMS, islandLengthIn: 50 });

    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain('50"');
    // Same layout object: nothing was rebuilt.
    expect(LAYOUT_PARAMS).toBe(standing);
    expect(LAYOUT_ISSUES).toEqual(result.reasons);
  });

  it("clears the reasons once a buildable set arrives", () => {
    setLayoutParams({ ...DEFAULT_PARAMS, islandLengthIn: 50 });
    expect(LAYOUT_ISSUES.length).toBeGreaterThan(0);

    setLayoutParams({ ...DEFAULT_PARAMS, islandLengthIn: 60 });
    expect(LAYOUT_ISSUES).toEqual([]);
  });
});
