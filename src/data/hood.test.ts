import { describe, expect, it } from "vitest";
import {
  hoodCabinetFloor,
  hoodOutlet,
  hoodProfile,
  hoodTopDepthIn,
  outletSize,
} from "./hood";
import { CABINET_STANDARDS, ROOM, ft } from "./room";
import { SLOT_BY_ID } from "./slots";
import { FIXTURES } from "./testFixtures";
import type { Appliance } from "../types";

const hoodSlot = SLOT_BY_ID["slot-hood"];

describe("the canopy is a wedge, not a box", () => {
  it("is 24 inches deep at the bottom and 12 at the top", () => {
    const profile = hoodProfile(24, 12, 18);
    expect(Math.max(...profile.map(([x]) => x))).toBe(24);
    const top = profile.filter(([, y]) => y === 18).map(([x]) => x);
    expect(Math.max(...top)).toBe(12);
    expect(Math.min(...top)).toBe(0);
  });

  it("stands the front up before it starts sloping back", () => {
    const front = hoodProfile(24, 12, 18)
      .filter(([x]) => x === 24)
      .map(([, y]) => y);
    expect(front).toContain(0);
    expect(front).toContain(CABINET_STANDARDS.hood.bodyHeightIn === 18 ? 4.1875 : 4.1875);
  });

  it("keeps the top inside the bottom, whatever the sheet says", () => {
    expect(Math.max(...hoodProfile(24, 40, 18).map(([x]) => x))).toBe(24);
    expect(hoodTopDepthIn({ topDepthIn: 40 } as Appliance, 24)).toBe(24);
  });

  it("falls back to the 12 inch top the drawing shows", () => {
    expect(hoodTopDepthIn(undefined, 24)).toBe(12);
    expect(hoodTopDepthIn(FIXTURES.hoodNeedsBlower, 24)).toBe(12);
  });

  it("closes the section with five points", () => {
    expect(hoodProfile(24, 12, 18)).toHaveLength(5);
  });
});

describe("the duct comes off the top, behind the front edge", () => {
  it("puts the outlet at the size the cabinet above is cut for", () => {
    const outlet = hoodOutlet(hoodSlot, FIXTURES.hoodNeedsBlower);
    expect(outlet.widthIn).toBe(CABINET_STANDARDS.hood.outlet.widthIn);
    expect(outlet.depthIn).toBe(CABINET_STANDARDS.hood.outlet.depthIn);
    expect(outlet.widthFt).toBeCloseTo(ft(outlet.widthIn), 6);
    expect(outletSize()).toContain(String(CABINET_STANDARDS.hood.outlet.widthIn));
  });

  it("sets it back from the wall, not centred on the canopy", () => {
    const outlet = hoodOutlet(hoodSlot, FIXTURES.hoodNeedsBlower);
    const backZ = hoodSlot.position[2] - ft(hoodSlot.cutout.d) / 2;
    expect(outlet.position[2] - backZ).toBeCloseTo(
      ft(CABINET_STANDARDS.hood.outlet.fromWallIn),
      6,
    );
    expect(outlet.position[2]).toBeLessThan(hoodSlot.position[2]);
  });

  it("sits on the canopy's own top, so it moves with a taller hood", () => {
    const tall = { ...FIXTURES.hoodNeedsBlower, heightIn: 24 } as Appliance;
    const standard = hoodOutlet(hoodSlot, FIXTURES.hoodNeedsBlower);
    expect(hoodOutlet(hoodSlot, tall).position[1] - standard.position[1]).toBeCloseTo(
      ft(24 - 18),
      6,
    );
  });

  // The cabinet over a canopy is the bridge at 84", not the 54" the rest of the
  // wall cabinets start at. Cutting the hole at 54" puts it in mid-air.
  it("comes off exactly at the floor of the cabinet it passes through", () => {
    const floor = hoodCabinetFloor()!;
    expect(floor).not.toBeNull();
    expect(floor).toBeGreaterThan(ROOM.upperBottom);
    expect(hoodOutlet(hoodSlot, FIXTURES.hoodNeedsBlower).position[1]).toBeCloseTo(floor, 6);
  });
});
