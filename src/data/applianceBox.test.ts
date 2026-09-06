import { describe, expect, it } from "vitest";
import { APPLIANCES_BY_SLOT } from "./catalogue";
import { applianceBox, flushOffset } from "./applianceBox";
import { FIXTURES } from "./testFixtures";
import { ROOM, SLOT_BY_ID } from "./slots";
import type { Appliance } from "../types";

const inches = (feet: number) => feet * 12;
const slot = (id: keyof typeof SLOT_BY_ID) => SLOT_BY_ID[id];

describe("an appliance is drawn at its own size, not its opening's", () => {
  // The case that started this: a 16-5/8" drawer rendered as a 34" cabinet.
  it("draws a microwave drawer at 16 inches in a 34 inch opening", () => {
    const drawer = {
      ...FIXTURES.microwaveDrawer,
      heightIn: null,
      cutoutHeightIn: 16.625,
    } as Appliance;
    const box = applianceBox(slot("slot-microwave"), drawer);
    expect(inches(box.h)).toBeCloseTo(16.625, 4);
    expect(inches(box.h)).toBeLessThan(slot("slot-microwave").cutout.h);
  });

  it("fills the rest of the opening with cabinetry, and accounts for all of it", () => {
    const drawer = {
      ...FIXTURES.microwaveDrawer,
      heightIn: null,
      cutoutHeightIn: 16.625,
    } as Appliance;
    const box = applianceBox(slot("slot-microwave"), drawer);
    const total = inches(box.h + box.filler.below + box.filler.above);
    expect(total).toBeCloseTo(slot("slot-microwave").cutout.h, 4);
    // A drawer hangs under the counter, so the cabinetry goes beneath it.
    expect(box.filler.below).toBeGreaterThan(0);
    expect(box.filler.above).toBe(0);
    expect(inches(box.y)).toBeCloseTo(box.filler.below * 12, 4);
  });

  it("stands a floor-mounted appliance on the bottom of its opening", () => {
    const short = { ...FIXTURES.wine, heightIn: 30 } as Appliance;
    const box = applianceBox(slot("slot-wine"), short);
    expect(box.y).toBe(0);
    expect(inches(box.filler.above)).toBeCloseTo(slot("slot-wine").cutout.h - 30, 4);
    expect(box.filler.below).toBe(0);
  });

  it("splits the leftover width between the two sides", () => {
    const narrow = { ...FIXTURES.dishwasher, widthIn: 18 } as Appliance;
    const box = applianceBox(slot("slot-dishwasher"), narrow);
    expect(inches(box.filler.eachSide)).toBeCloseTo(
      (slot("slot-dishwasher").cutout.w - 18) / 2,
      4,
    );
  });

  // A taller-than-the-opening appliance is a real state the fit check reports
  // rather than blocks, so it must not produce negative cabinetry.
  it("never asks for a negative amount of filler", () => {
    const tall = { ...FIXTURES.fridgeBuiltIn, heightIn: 96, widthIn: 40 } as Appliance;
    const box = applianceBox(slot("slot-fridge"), tall);
    expect(box.filler.above).toBe(0);
    expect(box.filler.eachSide).toBe(0);
    expect(inches(box.h)).toBe(96);
  });

  it("falls back to the published cutout, then to the slot", () => {
    const bare = {
      ...FIXTURES.wine,
      widthIn: null,
      heightIn: null,
      depthIn: null,
      cutoutWidthIn: 23.5,
      cutoutHeightIn: null,
      cutoutDepthIn: null,
    } as Appliance;
    const box = applianceBox(slot("slot-wine"), bare);
    expect(inches(box.w)).toBe(23.5);
    expect(inches(box.h)).toBe(slot("slot-wine").cutout.h);
    expect(inches(box.d)).toBe(slot("slot-wine").cutout.d);
  });

  // The bounding-box rule, over the catalogue as it actually stands.
  it("keeps every catalogue model inside its own published dimensions", () => {
    for (const [slotId, candidates] of Object.entries(APPLIANCES_BY_SLOT)) {
      const def = SLOT_BY_ID[slotId as keyof typeof SLOT_BY_ID];
      for (const appliance of candidates) {
        const box = applianceBox(def, appliance);
        const declaredH = appliance.heightIn ?? appliance.cutoutHeightIn ?? def.cutout.h;
        const declaredW = appliance.widthIn ?? appliance.cutoutWidthIn ?? def.cutout.w;
        expect(inches(box.h), `${appliance.id} height`).toBeLessThanOrEqual(declaredH + 1e-6);
        expect(inches(box.w), `${appliance.id} width`).toBeLessThanOrEqual(declaredW + 1e-6);
      }
    }
  });
});

describe("appliances sit flush with the cabinet face", () => {
  it("moves a shallow body forward in a 24 inch run", () => {
    const shallow = { ...FIXTURES.dishwasher, depthIn: 22 } as Appliance;
    const box = applianceBox(slot("slot-dishwasher"), shallow);
    expect(flushOffset(slot("slot-dishwasher"), box.d)).toBeGreaterThan(0);
  });

  it("pushes a hood back against the wall instead", () => {
    const hood = FIXTURES.hoodNeedsBlower;
    const box = applianceBox(slot("slot-hood"), hood);
    expect(flushOffset(slot("slot-hood"), box.d)).toBeLessThanOrEqual(0);
  });

  // A hood is hung at its slot height, so there is nothing under it to fill.
  it("hangs a hood with no cabinetry above or below it", () => {
    const box = applianceBox(slot("slot-hood"), FIXTURES.hoodNeedsBlower);
    expect(box.y).toBe(0);
    expect(box.filler.below).toBe(0);
    expect(box.filler.above).toBe(0);
  });

  it("keeps a full-depth body inside the run", () => {
    const box = applianceBox(slot("slot-fridge"), FIXTURES.fridgeBuiltIn);
    const offset = flushOffset(slot("slot-fridge"), box.d);
    expect(Math.abs(offset)).toBeLessThan(ROOM.counterDepth);
  });
});
