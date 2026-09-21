import { afterAll, describe, expect, it } from "vitest";
import { APPLIANCE_BY_ID } from "./catalogue";
import { setActivePackage, setLayoutParams } from "./layoutState";
import { checkLayout, LAYOUT_LIMITS } from "./layoutRules";
import { DEFAULT_PARAMS, type IslandLayout } from "./layoutTemplate";
import { DEFAULT_PACKAGE } from "./packages";
import { ISLAND, ROOM, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import type { Slot, SlotId } from "../types";

/**
 * Each failing check says which rule it is. Round 69.
 *
 * Until now rule 7's three checks — which way the island's two openings face,
 * the aisle in front of it, the aisle behind its seating — all failed as
 * `d11-7`, and rule 9 (the dishwasher's services in the sink base) failed as
 * `d11-8`, the number it had before decisions.md renumbered it. A finding that
 * does not say which check it is sends whoever reads it to the wrong place.
 * One room per code, each broken in exactly one way.
 */
function packageA() {
  setActivePackage(DEFAULT_PACKAGE.id);
  setLayoutParams(DEFAULT_PARAMS);
}

afterAll(() => packageA());

const codesOf = (...args: Parameters<typeof checkLayout>) => checkLayout(...args).map((v) => v.code);

describe("rule 7, one code per check", () => {
  it("the two island openings facing the same way is d11-7-facing", () => {
    packageA();
    const wine = SLOT_BY_ID["slot-wine"];
    const microwave = SLOT_BY_ID["slot-microwave"];
    const slots: Record<SlotId, Slot> = {
      ...SLOT_BY_ID,
      "slot-microwave": { ...microwave, rotationY: wine.rotationY },
    };
    expect(codesOf(RUNS, undefined, ISLAND, slots)).toContain("d11-7-facing");
  });

  it("an aisle three inches short is d11-7-aisle", () => {
    packageA();
    const closer: IslandLayout = { ...ISLAND, z: [ISLAND.z[0] - 3 / 12, ISLAND.z[1] - 3 / 12] };
    expect(codesOf(RUNS, undefined, closer)).toContain("d11-7-aisle");
  });

  it("too little room behind a seating overhang is d11-7-seating", () => {
    packageA();
    const edge = ROOM.halfZ - (LAYOUT_LIMITS.seatingAisleIn - 1) / 12;
    const far = edge - 15 / 12;
    const depth = ISLAND.z[1] - ISLAND.z[0];
    const seated: IslandLayout = { ...ISLAND, overhangIn: 15, z: [far - depth, far], working: far - depth, seating: far };
    expect(codesOf(RUNS, undefined, seated)).toContain("d11-7-seating");
  });

  it("no check reports as plain d11-7 any more", () => {
    packageA();
    const closer: IslandLayout = { ...ISLAND, z: [ISLAND.z[0] - 3 / 12, ISLAND.z[1] - 3 / 12] };
    expect(codesOf(RUNS, undefined, closer)).not.toContain("d11-7");
  });
});

describe("rule 9 is d11-9", () => {
  // A lopsided sample: a "dishwasher" whose drawing puts its points in the
  // opening, not the sink base — MD24BS's rough-in, read as the dishwasher's.
  it("a dishwasher whose services are not in the sink base is d11-9", () => {
    packageA();
    const stray = APPLIANCE_BY_ID["thermador-md24bs"];
    expect(codesOf(RUNS, { "slot-dishwasher": stray })).toContain("d11-9");
  });
});
