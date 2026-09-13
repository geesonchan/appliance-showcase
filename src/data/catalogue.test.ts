import { describe, expect, it } from "vitest";
import {
  APPLIANCES,
  APPLIANCES_BY_SLOT,
  APPLIANCE_BY_ID,
  APPLIANCE_BY_SLOT,
  SCHEME,
  SLOT_ORDER,
} from "./catalogue";
import { ROOM, SLOTS, SLOT_RECORDS, ft } from "./slots";
import { appliancesFileSchema, parseDataFile, slotsFileSchema } from "./schema";

describe("data files", () => {
  // Importing the modules at all runs the schemas; these assert the parts zod
  // cannot express on its own.
  it("parses every appliance and slot", () => {
    expect(APPLIANCES.length).toBeGreaterThanOrEqual(6);
    expect(SLOTS).toHaveLength(6);
  });

  it("gives every slot at least one candidate appliance", () => {
    for (const slotId of SLOT_ORDER) {
      expect(APPLIANCES_BY_SLOT[slotId].length, slotId).toBeGreaterThan(0);
    }
  });

  it("uses unique appliance ids", () => {
    expect(Object.keys(APPLIANCE_BY_ID)).toHaveLength(APPLIANCES.length);
  });

  it("files every appliance under a category its slot accepts", () => {
    for (const appliance of APPLIANCES) {
      // Every slot in the file, not only the ones package A has.
      const slot = SLOT_RECORDS.find((record) => record.id === appliance.slot)!;
      expect(slot.compatibleCategories, `${appliance.id} in ${slot.id}`).toContain(
        appliance.category,
      );
    }
  });

  it("resolves the scheme's default selection to real appliances", () => {
    for (const slotId of SLOT_ORDER) {
      const appliance = APPLIANCE_BY_SLOT[slotId];
      expect(appliance, slotId).toBeDefined();
      expect(appliance.slot).toBe(slotId);
      expect(SCHEME.defaultSelection[slotId]).toBe(appliance.id);
    }
  });

  it("marks unverified rows rather than implying the prices are checked", () => {
    for (const appliance of APPLIANCES) {
      expect(
        appliance.verifiedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(appliance.verifiedAt),
        `${appliance.id} verifiedAt`,
      ).toBe(true);
    }
  });
});

describe("slot geometry", () => {
  it("keeps each slot's cabinet opening equal to its cutout", () => {
    for (const slot of SLOTS) {
      expect(slot.cabinetConfig.openingIn, slot.id).toEqual(slot.cutout);
    }
  });

  it("places every slot inside the room", () => {
    for (const slot of SLOTS) {
      const [x, y, z] = slot.position;
      expect(Math.abs(x), `${slot.id} x`).toBeLessThanOrEqual(ROOM.halfX);
      expect(Math.abs(z), `${slot.id} z`).toBeLessThanOrEqual(ROOM.halfZ);
      expect(y, `${slot.id} y`).toBeGreaterThanOrEqual(0);
      expect(y + ft(slot.cutout.h), `${slot.id} top`).toBeLessThanOrEqual(ROOM.wallHeight);
    }
  });

  it("gives a duct to every slot that vents and to no others", () => {
    for (const slot of SLOTS) {
      const vents = slot.compatibleCategories.includes("hood");
      expect(slot.utilities.duct !== null, slot.id).toBe(vents);
    }
  });
});

describe("validation", () => {
  const validAppliance = () => structuredClone(APPLIANCES[0]);

  it("rejects a row missing a required column", () => {
    const row = validAppliance() as Record<string, unknown>;
    delete row.msrpUSD;
    expect(() =>
      parseDataFile(appliancesFileSchema, { _meta: meta(), appliances: [row] }, "test"),
    ).toThrow(/msrpUSD/);
  });

  it("rejects a sourceUrl that is not a URL", () => {
    const row = validAppliance();
    row.sourceUrl = "ask Leo";
    expect(() =>
      parseDataFile(appliancesFileSchema, { _meta: meta(), appliances: [row] }, "test"),
    ).toThrow(/sourceUrl/);
  });

  it("rejects a voltage the scene cannot wire", () => {
    const row = validAppliance() as Record<string, unknown>;
    (row.requires as Record<string, unknown>).voltage = 208;
    expect(() =>
      parseDataFile(appliancesFileSchema, { _meta: meta(), appliances: [row] }, "test"),
    ).toThrow(/requires.voltage/);
  });

  it("names the file and the field when it throws", () => {
    expect(() =>
      parseDataFile(slotsFileSchema, { _meta: meta(), slots: [] }, "data/slots.json"),
    ).toThrow(/data\/slots\.json failed validation/);
  });
});

const meta = () => ({
  generatedBy: "test",
  updatedAt: "2026-09-05",
  provenance: "test",
});
