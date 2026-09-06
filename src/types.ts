import type { z } from "zod";
import type {
  applianceSchema,
  cabinetConfigSchema,
  categorySchema,
  finishSchema,
  fuelSchema,
  schemeSchema,
  slotIdSchema,
  slotRecordSchema,
  utilitiesSchema,
} from "./data/schema";

/**
 * Domain types.
 *
 * Everything that comes out of `data/` is derived from the zod schemas rather
 * than declared twice: the schema is what actually validates at runtime, so a
 * hand-written mirror of it can only ever drift. Types that describe view
 * state, not data, are declared here directly.
 */

export type Category = z.infer<typeof categorySchema>;
export type Fuel = z.infer<typeof fuelSchema>;
export type SlotId = z.infer<typeof slotIdSchema>;
export type Finish = z.infer<typeof finishSchema>;
export type CabinetConfig = z.infer<typeof cabinetConfigSchema>;
export type Utilities = z.infer<typeof utilitiesSchema>;
export type CabinetType = CabinetConfig["type"];
export type DuctRoute = NonNullable<Utilities["duct"]>["route"];

export type Appliance = z.infer<typeof applianceSchema>;
export type Scheme = z.infer<typeof schemeSchema>;

/** The product half of a slot, as maintained in `data/slots.json`. */
export type SlotRecord = z.infer<typeof slotRecordSchema>;

/**
 * A slot as the scene uses it: the record from JSON plus its placement, which
 * `room.ts` derives from the cabinet run. See docs/decisions.md D3.
 */
export type Slot = SlotRecord & {
  /** Floor-level centre of the appliance footprint, in feet. */
  position: [number, number, number];
  /** Rotation about Y in radians. 0 faces +Z, out from the back wall. */
  rotationY: number;
};

// --- view state, not data ---

export type Lang = "en" | "zh";
export type UtilityType = "gas" | "power" | "water" | "duct";
export type RenderMode = "realistic" | "white" | "install";
export type Lighting = "day" | "night";
